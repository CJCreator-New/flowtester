import { describe, it, expect } from 'vitest';
import { categoriseFlakyCause } from '../src/flaky-cause.js';

describe('categoriseFlakyCause', () => {
  it('timing: timeout and wait text', () => {
    expect(categoriseFlakyCause({ errors: ['Timeout 5000ms exceeded while waiting for locator'] })).toBe('timing');
  });
  it('network: failed requests, 5xx, aborts', () => {
    expect(categoriseFlakyCause({ errors: ['net::ERR_CONNECTION_RESET at /api'] })).toBe('network');
    expect(categoriseFlakyCause({ errors: ['request answered 503'] })).toBe('network');
  });
  it('state-leakage: shared entities, already exists, a send', () => {
    expect(categoriseFlakyCause({ errors: ['Email already exists'] })).toBe('state-leakage');
    expect(categoriseFlakyCause({ errors: ['Element not found'], sentAny: true })).toBe('state-leakage');
  });
  it('unknown: no evidence or no match', () => {
    expect(categoriseFlakyCause({ errors: [] })).toBe('unknown');
    expect(categoriseFlakyCause({ errors: [' '] })).toBe('unknown');
    expect(categoriseFlakyCause({ errors: ['something odd'] })).toBe('unknown');
  });
});
