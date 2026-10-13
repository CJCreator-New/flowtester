import { describe, it, expect } from 'vitest';
import { ContextParser } from '../src/discovery/context-parser.js';

const parse = (text: string) => new ContextParser().parseDocuments([{ name: 'spec.md', text }]).requirements;

describe('structured Product Context', () => {
  it('table rows, numbered steps and fenced flow end up in rules/expectedFlow', () => {
    const text = [
      '# Billing',
      '| Plan | Price |',
      '| --- | --- |',
      '| Pro | 10 |',
      '1. Open billing',
      '2. Pick a plan',
      '```',
      'Home → Billing → Done',
      '```',
    ].join('\n');
    const [billing] = parse(text);
    expect(billing.rules).toEqual(['Plan: Pro; Price: 10', 'Open billing', 'Pick a plan', 'Home', 'Billing', 'Done']);
    expect(billing.expectedFlow).toBe('Home → Billing → Done');
  });

  it('bold-line Journey is its own unit with fields; persona from heading; not merged into parent', () => {
    const text = [
      '## 4. Journeys',
      '### 4.1 Employee — Aarav Sharma',
      '**Journey E1: Apply for leave** *(REQ-LEAVE)*',
      '- Preconditions: signed in',
      '- Steps: open `/leave` → click "Apply"; submit',
      '- Assert: land on /home; status "Applied"',
      '**Negative specs:** cannot open /report; cannot open /payroll-runs; no admin menu',
    ].join('\n');
    const out = parse(text);
    const parent = out.find((r) => r.name.startsWith('4.1'))!;
    const j = out.find((r) => r.kind === 'journey')!;
    expect(parent.rules).toEqual([]);
    expect(j).toMatchObject({
      name: 'Apply for leave',
      persona: 'Employee',
      section: '4. Journeys > 4.1 Employee — Aarav Sharma > Apply for leave',
      preconditions: ['signed in'],
      steps: ['open `/leave`', 'click "Apply"', 'submit'],
      assert: ['land on /home', 'status "Applied"'],
    });
    const neg = out.find((r) => r.kind === 'negative')!;
    expect(neg.persona).toBe('Employee');
    expect(neg.rules).toEqual(['cannot open /report', 'cannot open /payroll-runs', 'no admin menu']);
  });

  it('a **Bold** sentence that is not a Journey is not a unit', () => {
    const out = parse('# A\n**Note** this is prose\n- rule');
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('section');
    expect(out[0].rules).toEqual(['rule']);
  });

  it('route table gives route hints; capability table gives capability hints', () => {
    const text = [
      '# Site Map',
      '| Route | Page | Roles |',
      '|---|---|---|',
      '| `/report` | Report | lead / manager / HR |',
      '| /home | Home | all |',
      '# Access',
      '| Capability | Employee | HR |',
      '|---|---|---|',
      '| Run payroll | ❌ | ✅ |',
    ].join('\n');
    const out = parse(text);
    const routes = out.filter((r) => r.kind === 'route');
    expect(routes.map((r) => [r.route, r.rolesText, r.name])).toEqual([
      ['/report', 'lead / manager / HR', 'Report'],
      ['/home', 'all', 'Home'],
    ]);
    expect(routes[0].section).toBe('Site Map');
    const cap = out.find((r) => r.kind === 'capability')!;
    expect(cap).toMatchObject({ name: 'Run payroll', cells: { Employee: '❌', HR: '✅' } });
  });

  it('ids are unique and in document order across documents', () => {
    const out = new ContextParser().parseDocuments([
      { name: 'a.md', text: '# A\n**Journey X: One**\n- Steps: a' },
      { name: 'b.md', text: '# B' },
    ]).requirements;
    expect(out.map((r) => r.id)).toEqual(['REQ-1', 'REQ-2', 'REQ-3']);
  });
});

describe('heading-form journeys through ContextParser', () => {
  it('J<n> headings become journey units under the persona heading', () => {
    const md = [
      '# 1. Employee',
      '## J1 — First login',
      '- Preconditions: invited.',
      '- Steps: open link → set password.',
      '- Expected: home shows.',
      '# 2. Manager',
      '## J2: Approve',
      '- Steps: open queue',
    ].join('\n');
    const reqs = parse(md);
    const j = reqs.filter((r) => r.kind === 'journey');
    expect(j).toHaveLength(2);
    expect(j[0].persona).toBe('Employee');
    expect(j[0].assert).toEqual(['home shows.']);
    expect(j[1].persona).toBe('Manager');
  });
});
