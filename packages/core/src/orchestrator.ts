import path from 'path';
import type {
  TestCase,
  ProductProfile,
  ReleaseReport,
  TestPointResult,
  Finding,
  Breakpoint,
  RunCoverage,
  TraceabilityEntry,
} from '@qa/types';
import { BrowserManager, BREAKPOINT_VIEWPORTS, locateElement } from './browser.js';
import { EvidenceCollector } from './evidence.js';
import { PreFlightChecker } from './preflight.js';
import { SourceLocator } from './source-locator.js';
import { ReproScriptGenerator } from './repro-generator.js';
import { ReportGenerator } from './reporter.js';
import { expandValidationTestCases } from './validator-expander.js';
import { SuppressionsManager } from './suppressions.js';
import {
  BugDetectionChecker,
  SpecConformanceChecker,
  UXQualityChecker,
  PermissionMatrixChecker,
  DesignStandardsChecker,
  type DesignTokens,
} from '@qa/checkers';
import { promises as fs } from 'fs';

export type OrchestratorEvent =
  | {
      type: 'RUN_STARTED';
      runId: string;
      targetUrl: string;
      productId: string;
      testCaseCount: number;
      /** 'safe-public' for a read-only website scan; absent for a full product run. */
      mode?: 'safe-public';
    }
  | { type: 'PREFLIGHT_STARTED'; roles: string[] }
  | {
      type: 'TEST_POINT_STARTED';
      testCaseId: string;
      testCaseName: string;
      role: string;
      breakpoint: Breakpoint;
      /** 0-based position among all test points in this run. */
      index: number;
      total: number;
    }
  | { type: 'STEP_STARTED'; stepIndex: number; stepName: string; action: string; target?: string; testCaseId: string }
  | { type: 'STEP_COMPLETED'; stepIndex: number; passed: boolean; durationMs: number; error?: string; screenshotUrl?: string }
  | { type: 'FINDINGS_UPDATED'; totalFindings: number }
  | { type: 'RUN_COMPLETED'; runId: string; report: ReleaseReport };

export interface RunOptions {
  targetUrl: string;
  productId: string;
  specTestCases: TestCase[];
  profile?: ProductProfile;
  headless?: boolean;
  tunnelAuth?: string;
  outputDir?: string;
  breakpoints?: Breakpoint[];
  repoRoot?: string;
  enableA11y?: boolean;
  /** Record a video per test point; kept only when the point fails. Default true. */
  recordVideo?: boolean;
  /** Overwrite visual baselines with this run's screenshots instead of comparing against them. */
  updateBaselines?: boolean;
  onEvent?: (event: OrchestratorEvent) => void;
  /** Override the generated runId (e.g. so a caller can respond with an id before the run starts and have RUN_STARTED/RUN_COMPLETED carry the same id). Defaults to an internally generated `run-<timestamp>`. */
  runId?: string;
}

export class FlowTestOrchestrator {
  private browserManager = new BrowserManager();
  private preflightChecker = new PreFlightChecker();
  private bugChecker = new BugDetectionChecker();
  private specChecker = new SpecConformanceChecker();
  private uxChecker = new UXQualityChecker();
  private designChecker = new DesignStandardsChecker();

  async run(options: RunOptions): Promise<ReleaseReport> {
    const startTime = Date.now();
    const runId = options.runId || `run-${Date.now()}`;
    const onEvent = options.onEvent || (() => {});
    const outputDir = options.outputDir || path.join(process.cwd(), '.qa-report');
    const evidenceDir = path.join(outputDir, 'evidence');
    const authDir = path.join(outputDir, 'auth');
    const repoRoot = options.repoRoot || process.cwd();

    const sourceLocator = new SourceLocator(repoRoot);
    const reproGenerator = new ReproScriptGenerator(evidenceDir);
    const reportGenerator = new ReportGenerator(outputDir);
    const suppressionsManager = new SuppressionsManager(outputDir);

    // Expand validation rules into synthetic test cases up front so RUN_STARTED can report
    // an accurate test case count and subscribers know a run has begun before pre-flight
    // (which can itself take several seconds, or fail outright).
    const testCasesToRun = expandValidationTestCases(options.specTestCases);
    onEvent({
      type: 'RUN_STARTED',
      runId,
      targetUrl: options.targetUrl,
      productId: options.productId,
      testCaseCount: testCasesToRun.length,
    });

    onEvent({ type: 'PREFLIGHT_STARTED', roles: (options.profile?.roles || []).map((r) => r.role) });
    console.log(`[QA Orchestrator] Running Pre-flight health check on ${options.targetUrl}...`);
    const preflight = await this.preflightChecker.runPreFlight(
      options.targetUrl,
      options.profile,
      options.tunnelAuth,
      {
        browserManager: this.browserManager,
        authDir,
      }
    );

    if (!preflight.ok) {
      throw new Error(`Pre-flight check failed: ${preflight.error}`);
    }
    console.log(`[QA Orchestrator] Pre-flight check PASSED.`);

    const roleStorageStates = preflight.roleStorageStates || {};

    // Initialize Permission Matrix Checker if available in profile
    let permChecker: PermissionMatrixChecker | undefined;
    if (options.profile?.permissionMatrix) {
      permChecker = new PermissionMatrixChecker(options.profile.permissionMatrix);
    } else if (options.profile?.permissionMatrixFile) {
      try {
        const matrixContent = await fs.readFile(options.profile.permissionMatrixFile, 'utf8');
        permChecker = new PermissionMatrixChecker(matrixContent);
        console.log(`[QA Orchestrator] Loaded permission matrix from ${options.profile.permissionMatrixFile}`);
      } catch (err) {
        console.warn(`[QA Orchestrator] Could not load permission matrix from ${options.profile.permissionMatrixFile}`);
      }
    }

    let designTokens: DesignTokens | undefined;
    if (options.profile?.figmaTokensFile) {
      try {
        designTokens = JSON.parse(await fs.readFile(path.resolve(options.profile.figmaTokensFile), 'utf8'));
      } catch {
        console.warn(`[QA Orchestrator] Could not load design tokens from ${options.profile.figmaTokensFile}`);
      }
    }
    const baselineDir = path.resolve(options.profile?.visualBaselineDir || '.qa-baselines');
    const recordVideo = options.recordVideo ?? true;

    const breakpoints: Breakpoint[] = options.breakpoints || ['1440px'];
    const results: TestPointResult[] = [];
    const allFindings: Finding[] = [];

    // Running step counter across all test cases x breakpoints (not reset per test case),
    // so UI consumers of STEP_STARTED/STEP_COMPLETED see one continuously advancing sequence
    // for the whole run rather than restarting at 0 for every test point.
    let globalStepIndex = 0;
    const plannedTestPoints = testCasesToRun.length * breakpoints.length;

    for (const testCase of testCasesToRun) {
      for (const bp of breakpoints) {
        onEvent({
          type: 'TEST_POINT_STARTED',
          testCaseId: testCase.id,
          testCaseName: testCase.name || testCase.flowId,
          role: testCase.role,
          breakpoint: bp,
          index: results.length,
          total: plannedTestPoints,
        });
        console.log(`[QA Orchestrator] Executing ${testCase.id} ("${testCase.flowId}") on ${bp} as ${testCase.role}...`);
        const pointStartTime = Date.now();
        const testCaseEvidenceDir = path.join(evidenceDir, `${testCase.id}-${bp}`);
        const evidenceCollector = new EvidenceCollector(testCaseEvidenceDir);

        const storageState = roleStorageStates[testCase.role];

        const context = await this.browserManager.createContext({
          headless: options.headless ?? true,
          viewport: BREAKPOINT_VIEWPORTS[bp],
          tunnelAuth: options.tunnelAuth,
          baseUrl: options.targetUrl,
          storageState,
          recordVideoDir: recordVideo ? testCaseEvidenceDir : undefined,
        });

        const page = await context.newPage();
        evidenceCollector.attach(page);

        let testPointPassed = true;
        let stepError: string | undefined;
        let pointResult: TestPointResult | undefined;

        try {
          const startUrl = new URL(testCase.startPage, options.targetUrl).toString();
          await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Execute each step with up to 2 retries
          for (let i = 0; i < testCase.steps.length; i++) {
            const step = testCase.steps[i];
            const urlBefore = page.url();
            let stepSuccess = false;
            let currentStepError: string | undefined;
            const currentGlobalStepIndex = globalStepIndex++;
            const stepStartedAt = Date.now();

            onEvent({
              type: 'STEP_STARTED',
              stepIndex: currentGlobalStepIndex,
              stepName: step.name,
              action: step.action,
              target: step.selector || step.value,
              testCaseId: testCase.id,
            });

            const MAX_RETRIES = 2;
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              try {
                if (step.action === 'click') {
                  const locator = await locateElement(page, step.selector || '');
                  await locator.waitFor({ state: 'visible', timeout: 4000 });
                  await locator.click({ timeout: 4000 });
                } else if (step.action === 'fill') {
                  const locator = await locateElement(page, step.selector || '');
                  await locator.waitFor({ state: 'visible', timeout: 4000 });
                  await locator.fill(step.value || '', { timeout: 4000 });
                } else if (step.action === 'select') {
                  const locator = await locateElement(page, step.selector || '');
                  await locator.waitFor({ state: 'visible', timeout: 4000 });
                  await locator.selectOption(step.value || '', { timeout: 4000 });
                } else if (step.action === 'navigate') {
                  await page.goto(new URL(step.value || '', options.targetUrl).toString(), {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000,
                  });
                } else if (step.action === 'wait') {
                  await page.waitForTimeout(1000);
                }

                await page.waitForTimeout(300);
                stepSuccess = true;
                currentStepError = undefined;
                break;
              } catch (err: unknown) {
                currentStepError = err instanceof Error ? err.message : String(err);
                if (attempt < MAX_RETRIES) {
                  await page.waitForTimeout(500);
                }
              }
            }

            if (!stepSuccess) {
              testPointPassed = false;
              stepError = currentStepError;
            }

            const stepEvidence = await evidenceCollector.recordStep(
              page,
              i + 1,
              step.name,
              step.action,
              urlBefore,
              stepSuccess,
              currentStepError
            );

            onEvent({
              type: 'STEP_COMPLETED',
              stepIndex: currentGlobalStepIndex,
              passed: stepSuccess,
              durationMs: Date.now() - stepStartedAt,
              error: currentStepError,
              screenshotUrl: stepEvidence.screenshotPath
                ? `/api/evidence/${path.relative(outputDir, stepEvidence.screenshotPath).replace(/\\/g, '/')}`
                : undefined,
            });

            // If a step fails after retries, cascade remaining steps as Blocked
            if (!stepSuccess) {
              for (let j = i + 1; j < testCase.steps.length; j++) {
                const blockedStep = testCase.steps[j];
                const blockedStepIndex = globalStepIndex++;
                onEvent({
                  type: 'STEP_STARTED',
                  stepIndex: blockedStepIndex,
                  stepName: blockedStep.name,
                  action: blockedStep.action,
                  target: blockedStep.selector || blockedStep.value,
                  testCaseId: testCase.id,
                });
                await evidenceCollector.recordStep(
                  page,
                  j + 1,
                  blockedStep.name,
                  blockedStep.action,
                  page.url(),
                  false,
                  `Blocked: Previous step "${step.name}" failed`
                );
                onEvent({
                  type: 'STEP_COMPLETED',
                  stepIndex: blockedStepIndex,
                  passed: false,
                  durationMs: 0,
                  error: `Blocked: Previous step "${step.name}" failed`,
                });
              }
              break;
            }
          }

          // Evaluate Checkers
          const stepEvidenceList = evidenceCollector.getStepEvidenceList();

          // 1. Bug Detection
          const bugFindings = this.bugChecker.check(stepEvidenceList, {
            testCaseId: testCase.id,
            flowId: testCase.flowId,
            role: testCase.role,
            breakpoint: bp,
            urlPath: page.url(),
          });

          // 2. Spec Conformance
          const specFindings = await this.specChecker.check(page, testCase, stepEvidenceList, {
            role: testCase.role,
            breakpoint: bp,
            baseUrl: options.targetUrl,
          });

          // 3. UX Quality
          const uxFindings = await this.uxChecker.check(page, {
            testCaseId: testCase.id,
            role: testCase.role,
            breakpoint: bp,
            urlPath: new URL(page.url(), options.targetUrl).pathname,
            enableAxe: options.enableA11y ?? true,
          });

          // 4. Permission Matrix Check
          const permFindings: Finding[] = [];
          if (permChecker) {
            const currentPath = new URL(page.url(), options.targetUrl).pathname;
            const permFinding = permChecker.checkAccess({
              target: currentPath,
              role: testCase.role,
              breakpoint: bp,
              statusCode: 200,
              testCaseId: testCase.id,
            });
            if (permFinding) {
              permFindings.push(permFinding);
            }
          }

          // 5. Design tokens (Tier 1) and visual baseline (Tier 2)
          const designFindings: Finding[] = [];
          const urlPath = new URL(page.url(), options.targetUrl).pathname;
          if (designTokens) {
            designFindings.push(
              ...(await this.designChecker.check(page, designTokens, {
                testCaseId: testCase.id,
                role: testCase.role,
                breakpoint: bp,
                urlPath,
              }))
            );
          }
          // Only a flow that completed reaches the screen the baseline was taken of.
          const baselinePath = path.join(baselineDir, `${testCase.id}-${bp}.png`);
          if (testPointPassed) {
            if (options.updateBaselines) {
              await fs.mkdir(baselineDir, { recursive: true });
              await page.screenshot({ path: baselinePath, animations: 'disabled', caret: 'hide' });
            } else {
              const baseline = await fs.readFile(baselinePath).catch(() => null);
              if (baseline) {
                const current = await page.screenshot({ animations: 'disabled', caret: 'hide' });
                const diff = await this.designChecker.checkVisualDiff(current, baseline, {
                  maxDiffPercent: options.profile?.visualDiffMaxPercent,
                  diffOutputPath: path.join(testCaseEvidenceDir, 'visual-diff.png'),
                });
                if (!diff.match) {
                  designFindings.push(
                    this.designChecker.visualDiffFinding(diff, {
                      testCaseId: testCase.id,
                      role: testCase.role,
                      breakpoint: bp,
                      urlPath,
                      baselinePath: path.relative(process.cwd(), baselinePath).replace(/\\/g, '/'),
                    })
                  );
                }
              }
            }
          }

          const pointFindings = [...bugFindings, ...specFindings, ...uxFindings, ...permFindings, ...designFindings];

          // Enrich findings with Source Code Locator and Repro Script
          for (const f of pointFindings) {
            if (f.where.dataTestId) {
              const srcLoc = await sourceLocator.findByTestId(f.where.dataTestId);
              if (srcLoc) {
                f.sourceLocation = srcLoc;
              }
            }

            const reproPath = await reproGenerator.generate(f, testCase, options.targetUrl);
            f.reproScriptPath = path.relative(process.cwd(), reproPath).replace(/\\/g, '/');
            allFindings.push(f);
          }

          const hasStepFailure = !testPointPassed;
          const status = hasStepFailure
            ? 'Failed'
            : pointFindings.length > 0
            ? 'Failed'
            : 'Passed';

          pointResult = {
            testCaseId: testCase.id,
            flowId: testCase.flowId,
            role: testCase.role,
            status,
            durationMs: Date.now() - pointStartTime,
            findings: pointFindings,
            stepEvidence: stepEvidenceList,
            error: stepError,
          };
        } catch (fatalErr: unknown) {
          testPointPassed = false;
          const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
          pointResult = {
            testCaseId: testCase.id,
            flowId: testCase.flowId,
            role: testCase.role,
            status: 'Failed',
            durationMs: Date.now() - pointStartTime,
            findings: [],
            stepEvidence: evidenceCollector.getStepEvidenceList(),
            error: msg,
          };
        } finally {
          // The video file is only finalized once its context closes.
          const video = page.video();
          await context.close().catch(() => {});
          if (video) {
            const videoPath = await video.path().catch(() => undefined);
            if (videoPath && pointResult?.status === 'Failed') {
              pointResult.videoPath = videoPath;
              for (const f of pointResult.findings) f.evidence.videoPath = videoPath;
            } else if (videoPath) {
              await fs.rm(videoPath, { force: true }).catch(() => {});
            }
          }
        }
        results.push(pointResult!);
        onEvent({ type: 'FINDINGS_UPDATED', totalFindings: allFindings.length });
      }
    }

    await this.browserManager.close();

    // Coverage Calculation
    const totalTestPoints = results.length;
    const passed = results.filter((r) => r.status === 'Passed').length;
    const failed = results.filter((r) => r.status === 'Failed').length;
    const blocked = results.filter((r) => r.status === 'Blocked').length;
    const skipped = results.filter((r) => r.status === 'Skipped').length;
    const couldNotVerify = results.filter((r) => r.status === 'Could not verify').length;

    const coverage: RunCoverage = {
      totalTestPoints,
      passed,
      failed,
      blocked,
      skipped,
      couldNotVerify,
      completionRate: totalTestPoints > 0 ? (totalTestPoints / totalTestPoints) * 100 : 100,
    };

    // Apply Suppressions & Compute Delta
    await suppressionsManager.applySuppressions(allFindings);
    const delta = await suppressionsManager.computeDelta(allFindings);
    const activeSuppressions = await suppressionsManager.loadSuppressions();

    // Build Traceability Matrix
    const traceability: TraceabilityEntry[] = [];
    for (const r of results) {
      const tc = testCasesToRun.find((t) => t.id === r.testCaseId);
      const reqId = tc?.requirementId || `REQ-${tc?.flowId || r.flowId}`;
      const lastStep = r.stepEvidence[r.stepEvidence.length - 1];
      traceability.push({
        requirementId: reqId,
        testCaseId: r.testCaseId,
        flowId: r.flowId,
        name: tc?.name,
        status: r.status,
        description:
          tc?.expectations.text?.description ||
          tc?.expectations.url?.description ||
          tc?.name,
        evidencePath: lastStep?.screenshotPath,
      });
    }

    const report: ReleaseReport = {
      runId,
      productId: options.productId,
      targetUrl: options.targetUrl,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      coverage,
      results,
      findings: allFindings,
      traceability,
      suppressions: activeSuppressions,
      delta,
    };

    // Emit reports to .qa-report
    console.log(`[QA Orchestrator] Generating release readiness report in ${outputDir}...`);
    await reportGenerator.generate(report);
    console.log(`[QA Orchestrator] Reports generated: report.md and findings.json`);

    onEvent({ type: 'RUN_COMPLETED', runId, report });

    return report;
  }
}
