import type { Page } from 'playwright';
import type { Breakpoint, Finding, FindingSeverity, StepEvidence } from '@qa/types';

export interface PerformanceContext {
  testCaseId?: string;
  flowId?: string;
  role: string;
  breakpoint: Breakpoint;
  urlPath: string;
  /** Navigation / load duration in ms if measured externally */
  loadDurationMs?: number;
}

export interface PagePerformanceMetrics {
  lcpMs?: number;
  cls?: number;
  inpMs?: number;
  totalWeightBytes: number;
  slowestRequests: Array<{ url: string; durationMs: number }>;
  overflowElements: Array<{ tag: string; selector: string; right: number }>;
  hasHorizontalScroll: boolean;
  overlappingElements: Array<{ tag: string; selector: string; overlapsWith: string }>;
}

export const SPEED_THRESHOLDS = {
  LCP_GOOD_MS: 2500,
  LCP_POOR_MS: 4000,
  CLS_GOOD: 0.1,
  CLS_POOR: 0.25,
  INP_GOOD_MS: 200,
  INP_POOR_MS: 500,
  SLOW_REQUEST_MS: 2000,
  MAX_PAGE_WEIGHT_BYTES: 4 * 1024 * 1024, // 4MB
};

const TEST_BROWSER_NOTE = 'Measured in a test browser, not by real visitors.';

export class PerformanceChecker {
  /**
   * Run speed, vitals, and mobile layout checks on the current page.
   */
  async checkPage(
    page: Page,
    context: PerformanceContext,
    stepEvidenceList?: StepEvidence[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    const metrics = await this.collectMetrics(page);

    // 1. External navigation load duration or StepEvidence duration
    let pageLoadDuration = context.loadDurationMs;
    if (!pageLoadDuration && stepEvidenceList && stepEvidenceList.length > 0) {
      const navStep = stepEvidenceList.find((s) => s.action === 'navigate' || s.action === 'goto');
      if (navStep) {
        pageLoadDuration = navStep.durationMs;
      }
    }

    // 2. Largest Contentful Paint (LCP)
    const effectiveLcp = metrics?.lcpMs || pageLoadDuration;
    if (effectiveLcp && effectiveLcp > SPEED_THRESHOLDS.LCP_GOOD_MS) {
      const isPoor = effectiveLcp >= SPEED_THRESHOLDS.LCP_POOR_MS;
      const severity: FindingSeverity = isPoor ? 'Major' : 'Minor';
      findings.push({
        id: `F-PERF-${context.testCaseId || 'GEN'}-LCP-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity,
        checker: 'performance',
        title: `Slow Largest Contentful Paint (${(effectiveLcp / 1000).toFixed(1)}s)`,
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: `Largest Contentful Paint should be under ${(SPEED_THRESHOLDS.LCP_GOOD_MS / 1000).toFixed(1)}s (${TEST_BROWSER_NOTE})`,
          actual: `Measured ${(effectiveLcp / 1000).toFixed(1)}s to render the largest visible element (${TEST_BROWSER_NOTE})`,
        },
        stepsToReproduce: [`Visit ${context.urlPath} at screen width ${context.breakpoint}`, 'Measure page render timing'],
        evidence: {},
        resolution: 'Optimize server response time, defer heavy non-critical scripts, and compress hero images.',
        verifyCommand: `qa-test verify F-PERF-${context.testCaseId || 'GEN'}-LCP`,
      });
    }

    // 3. Cumulative Layout Shift (CLS)
    if (metrics?.cls !== undefined && metrics.cls > SPEED_THRESHOLDS.CLS_GOOD) {
      const isPoor = metrics.cls >= SPEED_THRESHOLDS.CLS_POOR;
      const severity: FindingSeverity = isPoor ? 'Major' : 'Minor';
      findings.push({
        id: `F-PERF-${context.testCaseId || 'GEN'}-CLS-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity,
        checker: 'performance',
        title: `Cumulative Layout Shift of ${metrics.cls.toFixed(2)} causes visible jumping`,
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: `Cumulative Layout Shift should be under ${SPEED_THRESHOLDS.CLS_GOOD} (${TEST_BROWSER_NOTE})`,
          actual: `Measured CLS of ${metrics.cls.toFixed(2)} during page visit (${TEST_BROWSER_NOTE})`,
        },
        stepsToReproduce: [`Open ${context.urlPath} at ${context.breakpoint}`, 'Observe content shifting during loading'],
        evidence: {},
        resolution: 'Set explicit width and height dimensions on images and banners to reserve space before loading.',
        verifyCommand: `qa-test verify F-PERF-${context.testCaseId || 'GEN'}-CLS`,
      });
    }

    // 4. Slow network requests (> 2s)
    if (metrics?.slowestRequests && metrics.slowestRequests.length > 0) {
      for (const req of metrics.slowestRequests) {
        if (req.durationMs >= SPEED_THRESHOLDS.SLOW_REQUEST_MS) {
          findings.push({
            id: `F-PERF-${context.testCaseId || 'GEN'}-SLOWREQ-${findings.length + 1}`,
            testCaseId: context.testCaseId,
            flowId: context.flowId,
            severity: 'Minor',
            checker: 'performance',
            title: `Slow request: ${truncateUrl(req.url)} took ${(req.durationMs / 1000).toFixed(1)}s`,
            where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
            expectedVsActual: {
              expected: `Asset requests should complete in under ${(SPEED_THRESHOLDS.SLOW_REQUEST_MS / 1000).toFixed(1)}s (${TEST_BROWSER_NOTE})`,
              actual: `Request to ${req.url} took ${(req.durationMs / 1000).toFixed(1)}s`,
            },
            stepsToReproduce: [`Visit ${context.urlPath}`, `Inspect network waterfall for ${req.url}`],
            evidence: {},
            resolution: 'Enable compression (gzip/brotli), optimize query performance, or use edge caching.',
            verifyCommand: `qa-test verify F-PERF-SLOWREQ`,
          });
          break; // Flag the most severe one per page
        }
      }
    }

    // 5. Mobile viewport horizontal overflow (especially 375px)
    if (metrics?.hasHorizontalScroll || (metrics?.overflowElements && metrics.overflowElements.length > 0)) {
      const target = metrics.overflowElements[0]?.selector || 'body';
      findings.push({
        id: `F-PERF-${context.testCaseId || 'GEN'}-OVERFLOW-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: context.breakpoint === '375px' ? 'Major' : 'Minor',
        checker: 'performance',
        title: `Content overflows the screen horizontally at ${context.breakpoint}`,
        where: {
          urlPath: context.urlPath,
          role: context.role,
          breakpoint: context.breakpoint,
          cssSelector: target,
        },
        expectedVsActual: {
          expected: `Page content fits within the ${context.breakpoint} viewport without horizontal scroll`,
          actual: `Content exceeds viewport width, forcing the user to scroll sideways`,
        },
        stepsToReproduce: [
          `Open ${context.urlPath} with viewport width set to ${context.breakpoint}`,
          `Notice horizontal scrollbar and overflowing element: ${target}`,
        ],
        evidence: {},
        resolution: 'Ensure all containers use max-width: 100% or overflow: hidden, and avoid fixed pixel widths wider than 375px.',
        verifyCommand: `qa-test verify F-PERF-OVERFLOW`,
      });
    }

    // 6. Overlapping interactive elements
    if (metrics?.overlappingElements && metrics.overlappingElements.length > 0) {
      const overlap = metrics.overlappingElements[0];
      findings.push({
        id: `F-PERF-${context.testCaseId || 'GEN'}-OVERLAP-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: 'Major',
        checker: 'performance',
        title: `Interactive elements overlap: ${overlap.selector} covers ${overlap.overlapsWith}`,
        where: {
          urlPath: context.urlPath,
          role: context.role,
          breakpoint: context.breakpoint,
          cssSelector: overlap.selector,
        },
        expectedVsActual: {
          expected: 'Interactive elements must have distinct bounding boxes without colliding',
          actual: `Element ${overlap.selector} overlaps with ${overlap.overlapsWith} at ${context.breakpoint}`,
        },
        stepsToReproduce: [
          `View ${context.urlPath} at ${context.breakpoint}`,
          `Inspect ${overlap.selector} and ${overlap.overlapsWith}`,
        ],
        evidence: {},
        resolution: 'Adjust CSS margins, z-index, or flex/grid stacking order so interactive controls do not cover each other.',
        verifyCommand: `qa-test verify F-PERF-OVERLAP`,
      });
    }

    return findings;
  }

  private async collectMetrics(page: Page): Promise<PagePerformanceMetrics | null> {
    try {
      return await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth || window.innerWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const hasHorizontalScroll = scrollWidth > docWidth + 5;

        // Resource timing
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        let totalWeight = 0;
        const slowest: Array<{ url: string; durationMs: number }> = [];

        for (const r of resources) {
          const size = r.transferSize || (r.encodedBodySize ?? 0);
          totalWeight += size;
          if (r.duration > 1500) {
            slowest.push({ url: r.name, durationMs: Math.round(r.duration) });
          }
        }
        slowest.sort((a, b) => b.durationMs - a.durationMs);

        // LCP
        let lcpMs: number | undefined;
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as any[];
        if (lcpEntries.length > 0) {
          lcpMs = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
        } else {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          if (nav && nav.domContentLoadedEventEnd) {
            lcpMs = Math.round(nav.domContentLoadedEventEnd);
          }
        }

        // CLS
        let cls = 0;
        const shiftEntries = performance.getEntriesByType('layout-shift') as any[];
        for (const s of shiftEntries) {
          if (!s.hadRecentInput) {
            cls += s.value;
          }
        }

        // Overflow elements
        const overflowElements: Array<{ tag: string; selector: string; right: number }> = [];
        const all = document.querySelectorAll('body *');
        for (let i = 0; i < Math.min(all.length, 300); i++) {
          const el = all[i] as HTMLElement;
          if (typeof el.getBoundingClientRect !== 'function') continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.right > docWidth + 10) {
            const selector = el.getAttribute('data-testid')
              ? `[data-testid="${el.getAttribute('data-testid')}"]`
              : el.id
              ? `#${el.id}`
              : el.tagName.toLowerCase();
            overflowElements.push({ tag: el.tagName.toLowerCase(), selector, right: Math.round(r.right) });
            if (overflowElements.length >= 2) break;
          }
        }

        // Overlapping interactives
        const overlappingElements: Array<{ tag: string; selector: string; overlapsWith: string }> = [];
        const interactives = Array.from(document.querySelectorAll('button, a, input, select, textarea'))
          .filter((el): el is HTMLElement => {
            if (typeof el.getBoundingClientRect !== 'function') return false;
            if (el.classList.contains('sr-only') || el.closest('.sr-only')) return false;
            if (el.closest('details:not([open])')) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });

        for (let i = 0; i < Math.min(interactives.length, 30); i++) {
          const a = interactives[i];
          const rA = a.getBoundingClientRect();
          for (let j = i + 1; j < Math.min(interactives.length, 30); j++) {
            const b = interactives[j];
            if (a.contains(b) || b.contains(a)) continue;
            const rB = b.getBoundingClientRect();
            const overlap = !(rA.right <= rB.left || rA.left >= rB.right || rA.bottom <= rB.top || rA.top >= rB.bottom);
            if (overlap) {
              const area =
                (Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left)) *
                (Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top));
              if (area > 80) {
                // Verify that at least one of the elements is actually hit-tested at the overlap center
                const midX = (Math.max(rA.left, rB.left) + Math.min(rA.right, rB.right)) / 2;
                const midY = (Math.max(rA.top, rB.top) + Math.min(rA.bottom, rB.bottom)) / 2;
                const topEl = document.elementFromPoint(midX, midY);
                if (!topEl || (!a.contains(topEl) && !b.contains(topEl))) {
                  // Both elements are clipped by an overflow container or hidden behind another layer
                  continue;
                }

                const selA = a.getAttribute('data-testid') ? `[data-testid="${a.getAttribute('data-testid')}"]` : a.tagName.toLowerCase();
                const selB = b.getAttribute('data-testid') ? `[data-testid="${b.getAttribute('data-testid')}"]` : b.tagName.toLowerCase();
                overlappingElements.push({ tag: a.tagName.toLowerCase(), selector: selA, overlapsWith: selB });
                break;
              }
            }
          }
          if (overlappingElements.length >= 2) break;
        }

        return {
          lcpMs,
          cls: Math.round(cls * 100) / 100,
          totalWeightBytes: totalWeight,
          slowestRequests: slowest.slice(0, 5),
          overflowElements,
          hasHorizontalScroll,
          overlappingElements,
        };
      });
    } catch {
      return null;
    }
  }
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.length > 30 ? u.pathname.slice(0, 27) + '...' : u.pathname;
  } catch {
    return url.length > 30 ? url.slice(0, 27) + '...' : url;
  }
}
