import { describe, it, expect } from 'vitest';
import type { PageCoverage, RouteTelemetry, RouteSkipReason } from '../src/route-telemetry.js';
import { SIGN_IN_STEPS, type SignInStep } from '../src/signin.js';
import type { RoleCredential } from '../src/evidence-finding.js';

describe('route-telemetry and coverage contracts', () => {
  it('defines the 11 route skip reasons', () => {
    const reasons: RouteSkipReason[] = [
      'page-limit',
      'did-not-load',
      'robots',
      'sign-in',
      'http-error',
      'timeout',
      'off-site-redirect',
      'time-limit',
      'trap-limit',
      'session-lost',
      'duplicate',
    ];
    expect(reasons).toHaveLength(11);
  });

  it('allows building a compliant PageCoverage object', () => {
    const coverage: PageCoverage = {
      found: 10,
      reached: 8,
      skipped: [
        { urlPath: '/blocked', why: 'robots' },
        { urlPath: '/broken', why: 'http-error', status: 500, detail: 'Server Error' },
      ],
      routes: [
        {
          requestedPath: '/app',
          status: 200,
          finalPath: '/app',
          attempts: 1,
          durationMs: 120,
          outcome: 'recorded',
          who: 'visitor',
        },
      ],
    };
    expect(coverage.found).toBe(10);
    expect(coverage.reached).toBe(8);
    expect(coverage.skipped).toHaveLength(2);
    expect(coverage.routes?.[0].outcome).toBe('recorded');
  });

  it('defines SIGN_IN_STEPS in order', () => {
    expect(SIGN_IN_STEPS).toEqual([
      'goto',
      'find-fields',
      'opener',
      'username',
      'next',
      'password',
      'submit',
      'post-submit-check',
    ]);
    const step: SignInStep = 'goto';
    expect(SIGN_IN_STEPS.includes(step)).toBe(true);
  });

  it('supports postLoginSelector and postLoginUrl in RoleCredential', () => {
    const cred: RoleCredential = {
      role: 'admin',
      username: 'admin@example.com',
      postLoginSelector: '#dashboard',
      postLoginUrl: '/admin/dashboard',
    };
    expect(cred.postLoginSelector).toBe('#dashboard');
    expect(cred.postLoginUrl).toBe('/admin/dashboard');
  });
});
