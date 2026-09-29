import { describe, it, expect } from 'vitest';
import { PerformanceChecker, SPEED_THRESHOLDS } from '../src/performance.js';
import type { Page } from 'playwright';

describe('PerformanceChecker', () => {
  const checker = new PerformanceChecker();

  function createMockPage(metricsOverride: any): Page {
    return {
      evaluate: async () => metricsOverride,
      url: () => 'http://localhost:3050/reports',
      context: () => ({
        cookies: async () => [],
      }),
    } as unknown as Page;
  }

  it('flags slow Largest Contentful Paint (LCP >= 4s as Major, > 2.5s as Minor)', async () => {
    // 1. Slow LCP = 4200ms -> Major
    const slowPage = createMockPage({
      lcpMs: 4200,
      cls: 0.02,
      slowestRequests: [],
      overflowElements: [],
      hasHorizontalScroll: false,
      overlappingElements: [],
    });

    const findings = await checker.checkPage(slowPage, {
      testCaseId: 'TC-SLOW',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/reports',
    });

    const lcpFinding = findings.find((f) => f.title.includes('Largest Contentful Paint'));
    expect(lcpFinding).toBeDefined();
    expect(lcpFinding?.severity).toBe('Major');
    expect(lcpFinding?.expectedVsActual.expected).toContain('Measured in a test browser, not by real visitors');

    // 2. Fast page (LCP = 1200ms) -> No finding
    const fastPage = createMockPage({
      lcpMs: 1200,
      cls: 0.01,
      slowestRequests: [],
      overflowElements: [],
      hasHorizontalScroll: false,
      overlappingElements: [],
    });

    const fastFindings = await checker.checkPage(fastPage, {
      testCaseId: 'TC-FAST',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/home',
    });

    expect(fastFindings.find((f) => f.title.includes('Largest Contentful Paint'))).toBeUndefined();
  });

  it('flags high Cumulative Layout Shift (CLS)', async () => {
    const shiftingPage = createMockPage({
      lcpMs: 1500,
      cls: 0.35,
      slowestRequests: [],
      overflowElements: [],
      hasHorizontalScroll: false,
      overlappingElements: [],
    });

    const findings = await checker.checkPage(shiftingPage, {
      testCaseId: 'TC-CLS',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/news',
    });

    const clsFinding = findings.find((f) => f.title.includes('Cumulative Layout Shift'));
    expect(clsFinding).toBeDefined();
    expect(clsFinding?.severity).toBe('Major');
    expect(clsFinding?.expectedVsActual.actual).toContain('0.35');
  });

  it('flags slow requests taking 2 seconds or longer', async () => {
    const pageWithSlowAsset = createMockPage({
      lcpMs: 1500,
      cls: 0.05,
      slowestRequests: [{ url: 'http://localhost:3050/api/reports?slow=true', durationMs: 2400 }],
      overflowElements: [],
      hasHorizontalScroll: false,
      overlappingElements: [],
    });

    const findings = await checker.checkPage(pageWithSlowAsset, {
      testCaseId: 'TC-SLOWREQ',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/reports',
    });

    const reqFinding = findings.find((f) => f.title.includes('Slow request'));
    expect(reqFinding).toBeDefined();
    expect(reqFinding?.title).toContain('2.4s');
  });

  it('flags horizontal overflow as Major on mobile (375px)', async () => {
    const overflowingPage = createMockPage({
      lcpMs: 1500,
      cls: 0.02,
      slowestRequests: [],
      overflowElements: [{ tag: 'table', selector: '.wide-data-table', right: 460 }],
      hasHorizontalScroll: true,
      overlappingElements: [],
    });

    const findings = await checker.checkPage(overflowingPage, {
      testCaseId: 'TC-MOBILE',
      role: 'visitor',
      breakpoint: '375px',
      urlPath: '/pricing',
    });

    const overflowFinding = findings.find((f) => f.title.includes('overflows the screen horizontally'));
    expect(overflowFinding).toBeDefined();
    expect(overflowFinding?.severity).toBe('Major');
    expect(overflowFinding?.where.breakpoint).toBe('375px');
    expect(overflowFinding?.where.cssSelector).toBe('.wide-data-table');
  });

  it('flags overlapping interactive elements', async () => {
    const overlappingPage = createMockPage({
      lcpMs: 1500,
      cls: 0.02,
      slowestRequests: [],
      overflowElements: [],
      hasHorizontalScroll: false,
      overlappingElements: [{ tag: 'button', selector: '[data-testid="submit-btn"]', overlapsWith: '[data-testid="cancel-btn"]' }],
    });

    const findings = await checker.checkPage(overlappingPage, {
      testCaseId: 'TC-OVERLAP',
      role: 'visitor',
      breakpoint: '768px',
      urlPath: '/modal',
    });

    const overlapFinding = findings.find((f) => f.title.includes('Interactive elements overlap'));
    expect(overlapFinding).toBeDefined();
    expect(overlapFinding?.severity).toBe('Major');
  });
});
