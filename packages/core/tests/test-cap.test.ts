/** Test cap edges through expandPlan (ADR 0024). Fuller cases live in rejects-gating.test.ts. */
import { describe, it, expect } from 'vitest';
import type { DiscoveryDraft, PlanPage, PlanPageTest } from '@qa/types';
import { expandPlan, OVER_TEST_CAP } from '../src/plan/expand.js';
import { deriveRejects } from '../src/plan/rejects.js';

const form = {
  urlPath: '/lab/signup',
  method: 'POST',
  submitButtonSelector: '#go',
  inputs: [{ selector: '#email', label: 'Email', type: 'email', required: true }],
};
const page = (tests: PlanPageTest[]): PlanPage => ({
  id: 'page:/lab/signup',
  urlPath: '/lab/signup',
  title: 'Signup',
  coverage: 'tested',
  reachedBy: ['visitor'],
  tests,
  source: 'fallback',
});
const draft = (tests: PlanPageTest[]) =>
  ({
    version: '1.0',
    targetUrl: 'https://x.example/',
    timestamp: '',
    siteType: 'app',
    pages: [],
    forms: [],
    flows: [],
    sensitiveActions: [],
    ambiguityQuestions: [],
    plan: { pages: [page(tests)], navigation: [], layoutGroups: [], otherHosts: [] },
  }) as unknown as DiscoveryDraft;
const rejects = () => deriveRejects([page([])], [form]).map((o) => o.test);

describe('Test cap edges', () => {
  it('a cap equal to the planned total trims nothing', () => {
    const opts = { readOnly: false, screenSizes: ['1440px' as const] };
    const full = expandPlan(draft(rejects()), opts);
    const same = expandPlan(draft(rejects()), { ...opts, testCap: full.summary.tests });
    expect(same.summary.overCap).toBeUndefined();
    expect(same.testCases).toEqual(full.testCases);
  });

  it('one under the total trims at least one Test and labels it', () => {
    const opts = { readOnly: false, screenSizes: ['1440px' as const] };
    const full = expandPlan(draft(rejects()), opts);
    const out = expandPlan(draft(rejects()), { ...opts, testCap: full.summary.tests - 1 });
    expect(out.summary.overCap).toBeGreaterThan(0);
    expect(out.wontRun.filter((w) => w.reason === OVER_TEST_CAP).length).toBeGreaterThan(0);
  });

  it('does not trim Rejects that are already off for the Test Copy reason', () => {
    const out = expandPlan(draft(rejects()), { readOnly: true, screenSizes: ['1440px'], testCap: 1 });
    expect(out.wontRun.some((w) => w.reason === OVER_TEST_CAP)).toBe(false);
  });
});
