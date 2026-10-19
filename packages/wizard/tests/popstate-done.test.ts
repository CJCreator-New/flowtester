import { describe, expect, it } from 'vitest';
import { addressForPhase } from '../src/lib/phase-address';

// The App's popstate rule: Back/Forward onto a check-up address after the check-up is done goes to /check.
describe('popstate in the done phase', () => {
  it('sends a check-up address to /check', () => {
    for (const path of ['/check/scan', '/check/plan', '/check/testing']) {
      expect(addressForPhase('done', path, true)).toBe('/check');
    }
  });

  it('leaves non-check addresses alone, so Forward onto /check cannot loop', () => {
    expect(addressForPhase('done', '/check', true)).toBeNull();
    expect(addressForPhase('done', '/reports', true)).toBeNull();
    expect(addressForPhase('done', '/', true)).toBeNull();
  });

  it('does nothing outside the done phase on pop', () => {
    expect(addressForPhase('failed', '/check/plan', true)).toBeNull();
    expect(addressForPhase(undefined, '/check/plan', true)).toBeNull();
  });

  it('keeps a done check-up where it is when not popped (reconcile)', () => {
    expect(addressForPhase('done', '/check/plan')).toBeNull();
  });

  it('puts a running phase on its own address', () => {
    expect(addressForPhase('scanning', '/check/plan')).toBe('/check/scan');
    expect(addressForPhase('awaiting-review', '/check/scan')).toBe('/check/plan');
    expect(addressForPhase('testing', '/check/plan')).toBe('/check/testing');
    expect(addressForPhase('testing', '/reports')).toBeNull();
  });

  it('does not snap forward on Back or Forward during a running check-up', () => {
    expect(addressForPhase('awaiting-review', '/check/scan', true)).toBe('/check');
    expect(addressForPhase('testing', '/check/plan', true)).toBe('/check');
    // already on its own address: stays put
    expect(addressForPhase('awaiting-review', '/check/plan', true)).toBe('/check/plan');
  });
});
