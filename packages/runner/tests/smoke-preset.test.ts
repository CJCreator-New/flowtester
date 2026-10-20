import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/checkup.js';

describe('smoke preset CLI', () => {
  it('reads --preset smoke with its options', () => {
    const a = parseArgs(
      ['https://x.test', '--preset', 'smoke', '--health-path', '/up', '--expected-version', '1.2.3', '--confirm-live'],
      {}
    );
    expect(a).toMatchObject({ preset: 'smoke', healthPath: '/up', expectedVersion: '1.2.3', confirmLive: true });
    expect(a.url).toBe('https://x.test');
  });

  it('rejects any other preset', () => {
    expect(() => parseArgs(['https://x.test', '--preset', 'full'], {})).toThrow('--preset must be smoke');
  });

  it('leaves the normal check-up alone without the flag', () => {
    expect(parseArgs(['https://x.test'], {}).preset).toBeUndefined();
  });
});
