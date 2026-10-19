import { describe, it, expect } from 'vitest';
import type { TestCase } from '@qa/types';
import { SpecConformanceChecker } from '../../checkers/src/spec-conformance.js';
import { expandPlan } from '../src/plan/expand.js';
import { planFromSpec } from '../src/plan/spec-plan.js';
import { reachedRequirementIds, documentedUnits } from '../src/plan/sources.js';
import { crawlOf, el, page } from './helpers/spec-crawl.js';

const denial = (pattern: string): TestCase => ({
  id: 'TEST-001',
  flowId: 'page-test',
  role: 'Employee',
  startPage: '/report',
  steps: [{ action: 'navigate', value: '/report', name: 'Try to open /report' }],
  expectations: { origin: 'user', url: { pattern, negate: true } },
});
const at = (url: string) =>
  ({ url: () => url, title: async () => 't', innerText: async () => '', evaluate: async () => 200 }) as any;
const ctx = { role: 'Employee', breakpoint: '1440px' as const, baseUrl: 'http://app.test' };

describe('url expectation negate', () => {
  it('passes when the role was redirected', async () => {
    const f = await new SpecConformanceChecker().check(at('http://app.test/home'), denial('/report'), [], ctx);
    expect(f).toEqual([]);
  });
  it('fails when the route loads', async () => {
    const f = await new SpecConformanceChecker().check(at('http://app.test/report'), denial('/report'), [], ctx);
    expect(f).toHaveLength(1);
    expect(f[0].title).toContain('/report');
  });
});

describe('spec items reach the test cases', () => {
  const hints = [
    {
      id: 'REQ-1',
      name: 'Leave',
      description: '',
      rules: [],
      document: 'spec.md',
      section: 'S > Leave',
      kind: 'journey' as const,
      persona: 'Employee',
      steps: ['open `/home`'],
      assert: ['land on /home'],
    },
  ];
  const pages = [page('/home', [el('Save', '#s')])];
  const out = planFromSpec({ hints, roles: ['Employee'], crawls: [crawlOf('Employee', pages)], readOnly: false });

  it('flow docSource and role reach the journey test case', () => {
    const draft: any = {
      version: '1',
      productId: 'p',
      targetUrl: 'http://x',
      timestamp: '',
      pages: [],
      sensitiveActions: [],
      ambiguityQuestions: [],
      flows: out.flows,
      plan: { pages: [], navigation: [], layoutGroups: [], otherHosts: [] },
    };
    const tc = expandPlan(draft, { readOnly: false, screenSizes: ['1440px'] }).testCases.find(
      (t) => t.kind === 'journey'
    )!;
    expect(tc.docSource?.requirementId).toBe('REQ-1');
    expect(tc.role).toBe('Employee');
  });

  it('units the AI reached are left out and counted once', () => {
    const reached = reachedRequirementIds([], out.flows);
    expect([...reached]).toEqual(['REQ-1']);
    const again = planFromSpec({
      hints,
      roles: ['Employee'],
      crawls: [crawlOf('Employee', pages)],
      readOnly: false,
      skipRequirementIds: reached,
    });
    expect(again.flows).toEqual([]);
    expect(documentedUnits(hints)).toHaveLength(1);
  });
});
