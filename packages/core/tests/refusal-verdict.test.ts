/** AC10 (ADR 0024): Limits accepted without a Source (ai-guess) never count toward the verdict. */
import { describe, it, expect } from 'vitest';
import { releaseVerdict } from '@qa/types';
import { buildIssuesModel } from '../src/issues-document.js';
import { finding, report } from './helpers/issues-fixtures.js';

const guessedLimit = (id: string, severity: 'Blocker' | 'Major' | 'Minor' | 'Suggestion' = 'Major') =>
  finding({
    id,
    severity,
    checker: 'spec-conformance',
    title: 'Could not verify: "name" accepted more than 50 characters',
    needsConfirmation: true,
    needsJudgement: true,
    where: { urlPath: '/lab/signup', role: 'visitor', breakpoint: '1440px' },
  });

describe('Limits without a Source stay out of the verdict', () => {
  it('releaseVerdict ignores unconfirmed Limits findings, even at Blocker severity', () => {
    const v = releaseVerdict([guessedLimit('F-L1', 'Blocker'), guessedLimit('F-L2', 'Major')]);
    expect(v.ready).toBe(true);
    expect(v.breaches ?? []).toEqual([]);
    expect(v.toConfirm).toBeGreaterThan(0);
  });

  it('a confirmed Blocker still breaks the verdict next to the guessed Limits', () => {
    const real = finding({ id: 'F-R', severity: 'Blocker', title: 'Real problem' });
    const v = releaseVerdict([guessedLimit('F-L1'), real]);
    expect(v.ready).toBe(false);
  });

  it('the issues document lists them under Needs your judgement, not in the role issues', () => {
    const model = buildIssuesModel(report([guessedLimit('F-L1'), guessedLimit('F-L2', 'Minor')]));
    expect(model.roles).toEqual([]);
    expect(model.judgement.visitor).toHaveLength(2);
  });

  it('once accepted, the Limits finding counts again', () => {
    const accepted = { ...guessedLimit('F-L1', 'Blocker'), needsConfirmation: false, judgementAccepted: true };
    expect(releaseVerdict([accepted]).ready).toBe(false);
  });
});
