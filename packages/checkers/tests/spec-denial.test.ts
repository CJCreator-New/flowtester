import { describe, it, expect } from 'vitest';
import type { Page } from 'playwright';
import type { TestCase } from '@qa/types';
import { SpecConformanceChecker } from '../src/spec-conformance.js';

const denial = {
  id: 'route-denial:visitor:/admin',
  name: 'visitor cannot open /admin',
  role: 'visitor',
  steps: [],
  startPage: '/admin',
  expectations: { origin: 'user', url: { pattern: '/admin', negate: true, description: 'does not stay' } },
} as unknown as TestCase;

const pageWithStatus = (status: number) =>
  ({
    url: () => 'http://localhost:3000/admin',
    evaluate: async () => status,
  }) as unknown as Page;

const run = (status: number) =>
  new SpecConformanceChecker().check(pageWithStatus(status), denial, [], {
    role: 'visitor',
    breakpoint: '1440px',
    baseUrl: 'http://localhost:3000',
  });

describe('Denial Plan Item', () => {
  it.each([401, 403, 404])('passes when the page is refused with %i', async (status) => {
    expect(await run(status)).toHaveLength(0);
  });

  it('fails with a Blocker when the page opens with 200', async () => {
    const findings = await run(200);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Blocker');
  });
});
