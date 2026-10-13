/** Ambiguity Question for Sensitive Action submits: edges (ADR 0024). Main cases live in rejects-gating.test.ts. */
import { describe, it, expect } from 'vitest';
import type { PlanPage } from '@qa/types';
import { deriveRejects } from '../src/plan/rejects.js';
import { intentQuestionsFor, INTENT_ANSWERS } from '../src/discovery/questions.js';
import { SafetyFilter } from '../src/discovery/safety-filter.js';

const page = (tests: PlanPage['tests']): PlanPage => ({
  id: 'page:/lab/signup',
  urlPath: '/lab/signup',
  title: 'Signup',
  coverage: 'tested',
  reachedBy: ['visitor'],
  tests,
  source: 'fallback',
});
const form = (submit: string) => ({
  urlPath: '/lab/signup',
  method: 'POST',
  submitButtonSelector: submit,
  inputs: [{ selector: '#email', label: 'Email', type: 'email', required: true }],
});
const sensitive = (submit: string, name: string) =>
  page(
    deriveRejects([page([])], [form(submit)], {
      inventory: [{ urlPath: '/lab/signup', elements: [{ selector: submit, name, role: 'button' }] } as never],
    }).map((o) => o.test)
  );

describe('intentQuestionsFor', () => {
  it('asks one question per Sensitive submit, however many Rejects it has', () => {
    const qs = intentQuestionsFor([sensitive('#del', 'Delete account')], new SafetyFilter([]));
    expect(qs).toHaveLength(1);
  });

  it('asks nothing for a Plan with no Rejects', () => {
    expect(intentQuestionsFor([page([])], new SafetyFilter([]))).toEqual([]);
  });

  it('the safe answer is one of the options', () => {
    const [q] = intentQuestionsFor([sensitive('#del', 'Delete account')], new SafetyFilter([]));
    expect(q.options).toContain(q.safeAnswer);
    expect(q.safeAnswer).toBe(INTENT_ANSWERS.off);
  });
});
