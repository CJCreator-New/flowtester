import { chromium, type Page } from 'playwright';
import path from 'path';
import { promises as fs } from 'fs';
import type { Finding, ReferenceFlow, ReferenceFlowStep, StepEvidence } from '@qa/types';
import { BugDetectionChecker, UXQualityChecker } from '@qa/checkers';
import { EvidenceCollector } from '../evidence.js';
import { RobotsPolicy } from './robots.js';

export interface SafeCrawlerOptions {
  entryUrl: string;
  flowName?: string;
  maxSteps?: number;
  outputDir?: string;
  actionDelayMs?: number;
  headless?: boolean;
  /** Honor the site's robots.txt. Default true; disable only for our own staging targets. */
  respectRobots?: boolean;
  /** Called before each step is recorded (1-based), with a short description of what led to it. */
  onStepStarted?: (stepIndex: number, action: string) => void;
  /** Called after each step, with the findings collected so far (only when checks run). */
  onStepCompleted?: (stepIndex: number, findingsSoFar: number) => void;
}

export interface SafeScanResult {
  flow: ReferenceFlow;
  findings: Finding[];
  stepEvidence: StepEvidence[];
  /** Mutating requests or off-site navigations the interceptor refused, as "METHOD url". */
  blockedRequests: string[];
}

const USER_AGENT_TOKEN = 'QA-Benchmarking-Bot';
/** Hard ceiling on interaction hops for external sites. */
const MAX_CRAWL_STEPS = 5;
const MUTATING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Runs in every document before site scripts: swallows submit events and turns the
 * programmatic submit APIs into no-ops, so no form can be sent by any path.
 */
const BLOCK_FORM_SUBMISSION_SCRIPT = `
  document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
  HTMLFormElement.prototype.submit = function () {};
  HTMLFormElement.prototype.requestSubmit = function () {};
`;

export class SafePublicCrawler {
  /**
   * Crawls a public website in Safe Interaction Mode.
   * Interacts with non-destructive UI controls (tabs, accordions, toggles)
   * while deterministically blocking form submissions and mutating HTTP calls.
   */
  async crawl(options: SafeCrawlerOptions): Promise<ReferenceFlow> {
    return (await this.explore(options, false)).flow;
  }

  /**
   * Same read-only crawl, additionally running the bug-detection and accessibility checkers
   * at every step it reaches. Checkers only observe the page; they never interact with it.
   */
  async scan(options: SafeCrawlerOptions): Promise<SafeScanResult> {
    return this.explore(options, true);
  }

  private async explore(options: SafeCrawlerOptions, runChecks: boolean): Promise<SafeScanResult> {
    const entryUrl = options.entryUrl;
    const maxSteps = Math.min(Math.max(options.maxSteps ?? MAX_CRAWL_STEPS, 1), MAX_CRAWL_STEPS);
    const actionDelayMs = options.actionDelayMs ?? 400;
    const outputDir = path.resolve(options.outputDir || path.join(process.cwd(), '.qa-compare'));
    const evidenceDir = path.join(outputDir, 'evidence');
    await fs.mkdir(evidenceDir, { recursive: true });

    const targetUrlObj = new URL(entryUrl);
    const targetHost = targetUrlObj.hostname;

    const robots =
      options.respectRobots === false
        ? RobotsPolicy.allowAll()
        : await RobotsPolicy.fetch(targetUrlObj.origin, USER_AGENT_TOKEN);
    if (!robots.isAllowed(targetUrlObj.pathname + targetUrlObj.search)) {
      throw new Error(`robots.txt on ${targetUrlObj.origin} disallows crawling ${targetUrlObj.pathname}`);
    }

    const browser = await chromium.launch({
      headless: options.headless !== false,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ${USER_AGENT_TOKEN}/1.0`,
    });
    await context.addInitScript(BLOCK_FORM_SUBMISSION_SCRIPT);

    const page = await context.newPage();
    const blockedRequests: string[] = [];

    // 1. Strict Security Interceptor: Block mutating HTTP methods & external domain escapes
    await page.route('**/*', (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      const reqUrl = request.url();
      const block = () => {
        blockedRequests.push(`${method} ${reqUrl}`);
        return route.abort();
      };

      // Block all mutating HTTP requests on external websites
      if (MUTATING_METHODS.includes(method)) {
        return block();
      }

      // Block third-party redirects / navigation outside target host
      try {
        const u = new URL(reqUrl);
        if (request.isNavigationRequest() && u.hostname !== targetHost && !u.hostname.endsWith(`.${targetHost}`)) {
          return block();
        }
        if (request.isNavigationRequest() && u.hostname === targetHost && !robots.isAllowed(u.pathname + u.search)) {
          return block();
        }
      } catch {
        // Continue
      }

      return route.continue();
    });

    const collector = new EvidenceCollector(evidenceDir);
    const bugChecker = new BugDetectionChecker();
    const uxChecker = new UXQualityChecker();
    if (runChecks) collector.attach(page);

    const steps: ReferenceFlowStep[] = [];
    const stepEvidence: StepEvidence[] = [];
    let findings: Finding[] = [];
    let lastAction = 'Navigate to entry page';

    try {
      options.onStepStarted?.(1, lastAction);
      await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(actionDelayMs);

      for (let stepIndex = 1; stepIndex <= maxSteps; stepIndex++) {
        const stepStartedAt = Date.now();
        const currentUrl = page.url();
        const pageTitle = await page.title();
        const pageMetrics = await readPageMetrics(page);

        // Capture step screenshot
        const screenshotFileName = `step-${stepIndex}-${Date.now()}.png`;
        const screenshotFilePath = path.join(evidenceDir, screenshotFileName);
        try {
          await page.screenshot({ path: screenshotFilePath, fullPage: false });
        } catch {
          // If screenshot fails, continue
        }

        steps.push({
          stepIndex,
          action: lastAction,
          url: currentUrl,
          title: pageTitle,
          screenshotPath: screenshotFilePath,
          interactiveControlsFound: pageMetrics.interactiveControls,
          fieldsCount: pageMetrics.fieldsCount,
          requiredFieldsCount: pageMetrics.requiredFieldsCount,
        });

        if (runChecks) {
          findings.push(
            ...(await this.checkStep(page, collector, bugChecker, uxChecker, blockedRequests, {
              stepIndex,
              action: lastAction,
              urlBefore: steps[stepIndex - 2]?.url ?? entryUrl,
              screenshotPath: screenshotFilePath,
              startedAt: stepStartedAt,
              stepEvidence,
            }))
          );
          findings = uxChecker.deduplicateFindings(findings);
        }
        options.onStepCompleted?.(stepIndex, findings.length);

        if (stepIndex >= maxSteps) {
          break;
        }

        const clickedSafeElement = await clickNextSafeControl(page);
        if (!clickedSafeElement) {
          // No more safe interactive controls found on page
          break;
        }
        lastAction = clickedSafeElement;
        options.onStepStarted?.(stepIndex + 1, lastAction);

        await page.waitForTimeout(actionDelayMs);
      }
    } finally {
      await browser.close();
    }

    return {
      flow: {
        id: `ref_${targetHost}_${Date.now()}`,
        targetDomain: targetHost,
        entryUrl,
        name: options.flowName || 'reference-flow',
        steps,
        timestamp: new Date().toISOString(),
      },
      findings,
      stepEvidence,
      blockedRequests,
    };
  }

  private async checkStep(
    page: Page,
    collector: EvidenceCollector,
    bugChecker: BugDetectionChecker,
    uxChecker: UXQualityChecker,
    blockedRequests: string[],
    step: {
      stepIndex: number;
      action: string;
      urlBefore: string;
      screenshotPath: string;
      startedAt: number;
      stepEvidence: StepEvidence[];
    }
  ): Promise<Finding[]> {
    // Requests our own interceptor aborted are not site defects.
    const blocked = new Set(blockedRequests);
    const evidence: StepEvidence = {
      stepIndex: step.stepIndex,
      stepName: step.action,
      action: step.stepIndex === 1 ? 'navigate' : 'click',
      urlBefore: step.urlBefore,
      urlAfter: page.url(),
      screenshotPath: step.screenshotPath,
      consoleErrors: collector.getConsoleLogs().filter((l) => l.type === 'error'),
      failedRequests: collector
        .getNetworkLogs()
        .filter((n) => (n.status >= 400 || n.status === 0) && !blocked.has(`${n.method.toUpperCase()} ${n.url}`)),
      durationMs: Date.now() - step.startedAt,
      passed: true,
    };
    // Each step reports only what happened since the previous one.
    collector.clearLogs();
    step.stepEvidence.push(evidence);

    const context = {
      testCaseId: `SAFE-${step.stepIndex}`,
      flowId: 'safe-website-scan',
      role: 'visitor',
      breakpoint: '1440px' as const,
      urlPath: new URL(page.url()).pathname,
    };
    const bugFindings = bugChecker.check([evidence], context);
    const uxFindings = await uxChecker.check(page, { ...context, enableAxe: true });
    for (const f of [...bugFindings, ...uxFindings]) {
      f.flowId = context.flowId;
      f.evidence.screenshotPath ??= step.screenshotPath;
    }
    return [...bugFindings, ...uxFindings];
  }
}

async function readPageMetrics(page: Page) {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
    const requiredCount = inputs.filter((el) => {
      return (
        el.hasAttribute('required') ||
        el.getAttribute('aria-required') === 'true' ||
        (el.getAttribute('placeholder') || '').includes('*')
      );
    }).length;

    const buttonTexts = Array.from(document.querySelectorAll('button')).map((b) => (b.textContent || '').trim());
    const controls: string[] = [];
    if (document.querySelector('[role="tab"]') || buttonTexts.some((t) => /^(monthly|annual|yearly)\b/i.test(t))) {
      controls.push('pricing-frequency-tabs');
    }
    if (document.querySelector('details, [aria-expanded]')) {
      controls.push('expandable-accordion');
    }
    if (document.querySelector('button[aria-label*="google" i], a[href*="google.com/o/oauth2" i]')) {
      controls.push('google-sso');
    }
    if (document.querySelector('button[aria-label*="github" i], a[href*="github.com/login" i]')) {
      controls.push('github-sso');
    }

    return {
      fieldsCount: inputs.length,
      requiredFieldsCount: requiredCount,
      interactiveControls: controls,
    };
  });
}

/** Clicks one not-yet-clicked tab, pricing toggle, or accordion. Returns a description, or null if none is left. */
async function clickNextSafeControl(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const CLICKED = 'data-qa-safe-clicked';
    const forbiddenSubmitRegex = /submit|pay|place order|buy now|purchase|checkout|sign up|register|delete/i;

    // A <button> inside a form defaults to type=submit; never touch those.
    const wouldSubmit = (el: Element) =>
      (el instanceof HTMLButtonElement && el.type === 'submit' && !!el.form) ||
      (el instanceof HTMLInputElement && ['submit', 'image'].includes(el.type));
    const isVisible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const eligible = (el: Element) =>
      !el.hasAttribute(CLICKED) &&
      !wouldSubmit(el) &&
      isVisible(el) &&
      !forbiddenSubmitRegex.test((el.textContent || '').trim());
    const click = (el: Element, description: string) => {
      el.setAttribute(CLICKED, 'true');
      (el as HTMLElement).click();
      return description;
    };

    // 1. Unselected tab or pricing-frequency toggle (e.g. Monthly/Annual, Features)
    const tabs = Array.from(document.querySelectorAll('[role="tab"], button'));
    for (const tab of tabs) {
      if (!eligible(tab)) continue;
      const text = (tab.textContent || '').trim();
      const isTab = tab.getAttribute('role') === 'tab';
      const isToggle = /\b(annual|yearly|monthly|features)\b/i.test(text);
      if (tab.getAttribute('aria-selected') !== 'true' && (isTab || isToggle)) {
        return click(tab, `Switched to “${text.slice(0, 40)}”`);
      }
    }

    // 2. Collapsed accordion or disclosure
    const summaries = Array.from(document.querySelectorAll('summary, [aria-expanded="false"]'));
    const summary = summaries.find(eligible);
    if (summary) {
      const text = (summary.textContent || '').trim().slice(0, 40);
      return click(summary, text ? `Expanded “${text}”` : 'Expanded a collapsed section');
    }

    return null;
  });
}
