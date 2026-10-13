/** The exported expectRefused embeds the Check-up's refusal rule; both must judge the /lab pages the same way (ADR 0024). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import { chromium, type Browser } from 'playwright';
import { CAPTURE_BASELINE_SOURCE, REFUSAL_RULE_SOURCE, judgeRefusal, readRefusal, captureRefusalBaseline } from '@qa/checkers';
import type { ReviewPlan, TestCase } from '@qa/types';
import { planToPlaywrightProject } from '../src/plan/playwright-export.js';
import { server } from '../../../fixtures/test-app/server.js';

const rejectsCase: TestCase = {
  id: 'TC-R1',
  flowId: 'rejects',
  name: 'Sign up rejects an empty name',
  role: 'visitor',
  startPage: '/lab/signup?mode=server',
  steps: [
    { action: 'click', selector: 'button[type="submit"]', name: 'Press Sign up' },
  ],
  expectations: { refusal: { formPath: '/lab/signup', submitSelector: 'button[type="submit"]', message: 'valid email' } },
  kind: 'page-test',
  intent: 'rejects',
};
const plan: ReviewPlan = {
  runId: 'r',
  targetUrl: 'https://shop.example/',
  discoveredAt: '2026-10-01T00:00:00Z',
  pages: [],
  flows: [],
  questions: [],
  testCases: [rejectsCase],
};

function helperSource(name: 'CAPTURE_BASELINE_SOURCE' | 'REFUSAL_RULE_SOURCE'): string {
  const helpers = planToPlaywrightProject(plan).find((f) => f.path === 'support/helpers.ts')!.content;
  const m = helpers.match(new RegExp('const ' + name + ' = String\.raw`([^`]*)`;'));
  if (!m) throw new Error(name + ' not found in support/helpers.ts');
  return m[1]!;
}

describe('expectRefused parity', () => {
  let browser: Browser;
  let base: string;
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('the exported helpers embed the rule byte for byte', () => {
    expect(helperSource('REFUSAL_RULE_SOURCE')).toBe(REFUSAL_RULE_SOURCE);
    expect(helperSource('CAPTURE_BASELINE_SOURCE')).toBe(CAPTURE_BASELINE_SOURCE);
  });

  const cases: Array<{ path: string; refused: boolean }> = [
    { path: '/lab/signup?mode=server', refused: true },
    { path: '/lab/lenient', refused: false },
    { path: '/lab/toast', refused: false },
  ];
  for (const c of cases) {
    it(`${c.path}: exported rule and checker agree (refused: ${c.refused})`, async () => {
      const page = await browser.newPage();
      try {
        await page.goto(base + c.path);
        const exportedBaseline = await page.evaluate('(' + helperSource('CAPTURE_BASELINE_SOURCE') + ')()');
        expect(exportedBaseline).toEqual(await captureRefusalBaseline(page));
        await page.click('button[type="submit"]');
        await page.waitForLoadState('load');
        const input = { baseline: exportedBaseline, message: 'valid email' };
        const exported = await page.evaluate('(' + helperSource('REFUSAL_RULE_SOURCE') + ')(' + JSON.stringify(input) + ')');
        const checker = await readRefusal(page, input as Parameters<typeof readRefusal>[1]);
        expect(exported).toEqual(checker);
        expect(judgeRefusal(checker as Parameters<typeof judgeRefusal>[0]).refused).toBe(c.refused);
      } finally {
        await page.close();
      }
    });
  }
});
