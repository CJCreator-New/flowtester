import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { ContextParser } from '../src/discovery/context-parser.js';
import { planFromSpec } from '../src/plan/spec-plan.js';
import { expandPlan } from '../src/plan/expand.js';
import { crawlOf, el, page } from './helpers/spec-crawl.js';

const dir = path.join(__dirname, 'fixtures', 'checkindaily');
const docs = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((f) => ({ name: f, text: readFileSync(path.join(dir, f), 'utf8') }));
const ROLES = ['Employee', 'Team Lead', 'Manager', 'HR/Admin', 'Alumni'];
const routes = ['/home', '/mark', '/report', '/my-payslips', '/payroll-runs', '/profile', '/employees', '/requests', '/approvals'];
const pages = routes.map((r) => page(r, [el('Save', `#save-${r.slice(1)}`)]));

describe('checkindaily fixtures, no AI', () => {
  const parsed = new ContextParser().parseDocuments(docs);
  const out = planFromSpec({
    hints: parsed.requirements,
    roles: ROLES,
    crawls: ROLES.map((r) => crawlOf(r, pages)),
    readOnly: false,
  });
  const flows = out.flows.filter((f) => !f.id.startsWith('spec-rules-'));
  const count = (role: string) => {
    const f = flows.filter((x) => x.role === role).length;
    const reach = out.pageTests.filter((t) => t.test.role === role && t.test.intent !== 'denied').length;
    const denial = out.pageTests.filter((t) => t.test.role === role && t.test.intent === 'denied').length;
    return [f, reach, denial];
  };

  it('by-role counts (flows, reach, denials)', () => {
    expect(count('Employee')).toEqual([2, 4, 3]);
    expect(count('Team Lead')).toEqual([1, 5, 1]);
    expect(count('Manager')).toEqual([0, 5, 1]);
    expect(count('HR/Admin')).toEqual([1, 6, 0]);
    expect(count('Alumni')).toEqual([1, 3, 3]);
  });

  it('runnable test cases keep docSource and role', () => {
    const draft: any = {
      version: '1',
      productId: 'p',
      targetUrl: 'http://x',
      timestamp: '',
      pages: [],
      sensitiveActions: [],
      ambiguityQuestions: [],
      flows,
      plan: {
        pages: pages.map((p) => ({
          id: `page:${p.urlPath}`,
          urlPath: p.urlPath,
          title: p.title,
          coverage: 'tested',
          reachedBy: ['Employee'],
          tests: out.pageTests.filter((t) => t.urlPath === p.urlPath).map((t) => t.test),
          source: 'fallback',
        })),
        navigation: [],
        layoutGroups: [],
        otherHosts: [],
      },
    };
    const exp = expandPlan(draft, { readOnly: false, screenSizes: ['1440px'] });
    const tests = exp.testCases.filter((tc) => tc.kind === 'page-test');
    expect(tests.length).toBe(out.pageTests.length);
    for (const tc of tests) {
      expect(tc.docSource?.requirementId).toBeTruthy();
      expect(tc.role).toBeTruthy();
    }
  });
});
