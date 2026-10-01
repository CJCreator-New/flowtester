import { describe, it, expect } from 'vitest';
import { isCheckRoute, matchRoute, PATHS } from '../src/lib/router';

describe('every screen has an address', () => {
  it.each([
    ['/', { name: 'new' }],
    ['/check/scan', { name: 'scan' }],
    ['/check/plan', { name: 'plan' }],
    ['/check/testing/', { name: 'testing' }],
    ['/reports', { name: 'reports' }],
    ['/reports/run-1790000000000', { name: 'report', runId: 'run-1790000000000' }],
    ['/baselines', { name: 'baselines' }],
    ['/benchmark', { name: 'benchmark' }],
    ['/settings', { name: 'settings' }],
    ['/studio', { name: 'not-found', path: '/studio' }],
    ['/reports/a/b', { name: 'not-found', path: '/reports/a/b' }],
    ['/reports/%E0%A4%A', { name: 'not-found', path: '/reports/%E0%A4%A' }],
  ])('%s', (path, route) => {
    expect(matchRoute(path)).toEqual(route);
  });

  it('builds report addresses that read back as the same run', () => {
    expect(matchRoute(PATHS.report('run 1/x'))).toEqual({ name: 'report', runId: 'run 1/x' });
  });

  it('knows which addresses belong to the check-up in progress', () => {
    expect(['/check/scan', '/check/plan', '/check/testing'].map((path) => isCheckRoute(matchRoute(path)))).toEqual([true, true, true]);
    expect(isCheckRoute(matchRoute('/reports/run-1'))).toBe(false);
    expect(isCheckRoute(matchRoute('/'))).toBe(false);
  });
});
