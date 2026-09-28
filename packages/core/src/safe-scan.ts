import path from 'path';
import type { ReleaseReport, TestPointResult } from '@qa/types';
import { SafePublicCrawler } from './competitive/safe-crawler.js';
import { ReportGenerator } from './reporter.js';
import type { OrchestratorEvent } from './orchestrator.js';

export interface SafeWebsiteScanOptions {
  targetUrl: string;
  productId?: string;
  outputDir?: string;
  runId?: string;
  headless?: boolean;
  /** Default true: public sites' robots.txt is honored. */
  respectRobots?: boolean;
  onEvent?: (event: OrchestratorEvent) => void;
}

const SCAN_TEST_CASE_ID = 'SAFE-SCAN';

/**
 * Read-only scan of a public website: Safe Interaction Mode crawl plus bug-detection and
 * accessibility checks, written as the same report.md / findings.json a product run produces.
 * Never signs in, submits a form, or sends a mutating request.
 */
export async function runSafeWebsiteScan(options: SafeWebsiteScanOptions): Promise<ReleaseReport> {
  const startTime = Date.now();
  const runId = options.runId || `run-${Date.now()}`;
  const productId = options.productId || new URL(options.targetUrl).hostname;
  const outputDir = options.outputDir || path.join(process.cwd(), '.qa-report');
  const onEvent = options.onEvent || (() => {});

  onEvent({ type: 'RUN_STARTED', runId, targetUrl: options.targetUrl, productId, testCaseCount: 1, mode: 'safe-public' });

  let stepIndex = 0;
  let stepStartedAt = Date.now();
  const scan = await new SafePublicCrawler().scan({
    entryUrl: options.targetUrl,
    flowName: 'Safe website scan',
    outputDir,
    headless: options.headless,
    respectRobots: options.respectRobots,
    onStepStarted: (index, action) => {
      stepIndex = index - 1;
      stepStartedAt = Date.now();
      onEvent({ type: 'STEP_STARTED', stepIndex, stepName: action, action: index === 1 ? 'navigate' : 'click', testCaseId: SCAN_TEST_CASE_ID });
    },
    onStepCompleted: (_index, findingsSoFar) => {
      onEvent({ type: 'STEP_COMPLETED', stepIndex, passed: true, durationMs: Date.now() - stepStartedAt });
      onEvent({ type: 'FINDINGS_UPDATED', totalFindings: findingsSoFar });
    },
  });

  const result: TestPointResult = {
    testCaseId: SCAN_TEST_CASE_ID,
    flowId: 'safe-website-scan',
    role: 'visitor',
    status: scan.findings.length > 0 ? 'Failed' : 'Passed',
    durationMs: Date.now() - startTime,
    findings: scan.findings,
    stepEvidence: scan.stepEvidence,
  };

  const report: ReleaseReport = {
    runId,
    productId,
    targetUrl: options.targetUrl,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    coverage: {
      totalTestPoints: 1,
      passed: result.status === 'Passed' ? 1 : 0,
      failed: result.status === 'Failed' ? 1 : 0,
      blocked: 0,
      skipped: 0,
      couldNotVerify: 0,
      completionRate: 100,
    },
    results: [result],
    findings: scan.findings,
    scanMode: 'safe-public',
  };

  await new ReportGenerator(outputDir).generate(report);
  onEvent({ type: 'RUN_COMPLETED', runId, report });
  return report;
}
