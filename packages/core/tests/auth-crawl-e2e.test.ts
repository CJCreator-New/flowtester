import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';
import { DiscoveryAgent } from '../src/discovery/discovery-agent.js';
import { FlowTestOrchestrator } from '../src/orchestrator.js';
import { PreFlightChecker } from '../src/preflight.js';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';
import { BrowserManager } from '../src/browser.js';
import type { TestCase, ProductProfile } from '@qa/types';

describe('T-117 Auth and crawl end-to-end (auth-crawl-e2e.test.ts)', () => {
  let port: number;
  let base: string;
  const tmpDir = path.join(process.cwd(), '.tmp-auth-crawl-e2e');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await new Promise<void>((resolve) => {
      fixtureServer.listen(0, () => {
        const addr = fixtureServer.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
          base = `http://localhost:${port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    await fetch(`${base}/lab/reset`, { method: 'POST' });
  });

  it('end-to-end: discovers with session, hands off to orchestrator, single sign-in, headers on all phases, secrets redacted', async () => {
    const sentinelToken = 'secret-sentinel-bypass-val-999';
    const sentinelPassword = 'manager-password';
    const outputDir = path.join(tmpDir, 'e2e-run');
    const authDir = path.join(outputDir, 'auth');
    await fs.mkdir(outputDir, { recursive: true });

    const consoleLogs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleLogs.push(args.join(' '));
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      consoleLogs.push(args.join(' '));
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      consoleLogs.push(args.join(' '));
    });

    try {
      const profile: ProductProfile = {
        name: 'Manager',
        productId: 'auth-e2e',
        roles: [
          {
            role: 'manager',
            username: 'manager@example.com',
            password: sentinelPassword,
            loginPath: '/signin',
          },
        ],
      };

      // 1. Run DiscoveryAgent.discoverWithSession
      const outcome = await DiscoveryAgent.discoverWithSession({
        targetUrl: `${base}/lab/index`,
        productId: 'auth-e2e',
        outputDir,
        authDir,
        maxPages: 15,
        useAI: false,
        profile,
        customHeaders: {
          'x-qa-bypass-token': sentinelToken,
        },
      });

      expect(outcome.draft).toBeTruthy();
      expect(outcome.preflight).toBeTruthy();
      expect(outcome.preflight?.roleStorageStates?.['manager']).toBeTruthy();

      // Check SPA late links found
      const pagePaths = outcome.draft.pages.map((p) => p.urlPath);
      expect(pagePaths.some((p) => p.startsWith('/lab/spa-late'))).toBe(true);

      // Check 500 and 403 recorded with status in telemetry / skipped
      const skipped = outcome.draft.exploration?.pageCoverage?.skipped || [];
      const err500 = skipped.find((s) => s.urlPath === '/lab/always-500');
      const err403 = skipped.find((s) => s.urlPath === '/lab/forbidden');
      expect(err500).toBeTruthy();
      expect(err500?.status).toBe(500);
      expect(err403).toBeTruthy();
      expect(err403?.status).toBe(403);

      // Check trap bounded
      const traps = skipped.filter((s) => s.urlPath.startsWith('/lab/trap/'));
      expect(traps.length).toBeGreaterThan(0);
      expect(traps.length).toBeLessThan(10);

      // 2. Run FlowTestOrchestrator.run with handed off preflight session
      const testCase: TestCase = {
        id: 'TC-AUTH-1',
        flowId: 'auth-flow',
        name: 'Protected Area Verification',
        role: 'manager',
        startPage: '/account',
        steps: [{ action: 'wait', name: 'Wait on protected page' }],
        expectations: {},
      };

      const orchestrator = new FlowTestOrchestrator();
      const report = await orchestrator.run({
        targetUrl: `${base}/lab/index`,
        productId: 'auth-e2e',
        specTestCases: [testCase],
        outputDir,
        authDir,
        profile,
        preflight: outcome.preflight,
        suppliedSessions: outcome.preflight?.roleStorageStates,
        enableSecurity: false,
        enablePerformance: false,
        enableSeo: false,
        enableA11y: false,
        customHeaders: {
          'x-qa-bypass-token': sentinelToken,
        },
      });

      expect(report.results.length).toBeGreaterThan(0);
      expect(report.results[0]?.status).toBe('Passed');

      // Assert single sign-in across both discovery and run phases
      const statsRes = await fetch(`${base}/lab/stats`);
      const stats = await statsRes.json();
      expect(stats.signIns).toBe(1);

      // Assert bypass header hit during signin, discovery, and test phases
      expect(stats.headerHits['/signin']).toBeGreaterThanOrEqual(1);
      expect(stats.headerHits['/account']).toBeGreaterThanOrEqual(1);

      // Assert NO secrets (password, token, cookie) in draft JSON, report JSON or console output
      const draftJson = JSON.stringify(outcome.draft);
      const reportJson = JSON.stringify(report);
      const allLogs = consoleLogs.join('\n');

      expect(draftJson).not.toContain(sentinelPassword);
      expect(draftJson).not.toContain(sentinelToken);
      expect(draftJson).not.toContain('fixture_session=manager');

      expect(reportJson).not.toContain(sentinelPassword);
      expect(reportJson).not.toContain(sentinelToken);
      expect(reportJson).not.toContain('fixture_session=manager');

      expect(allLogs).not.toContain(sentinelPassword);
      expect(allLogs).not.toContain(sentinelToken);
      expect(allLogs).not.toContain('fixture_session=manager');
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errSpy.mockRestore();
    }
  }, 120000);

  // Regression test 1: Login against /lab/spa-login (late-rendered form)
  it('regression: sign-in succeeds against late-rendered /lab/spa-login', async () => {
    const browserManager = new BrowserManager();
    const authDir = path.join(tmpDir, 'spa-login-auth');
    await fs.mkdir(authDir, { recursive: true });

    try {
      const checker = new PreFlightChecker();
      const profile: ProductProfile = {
        name: 'Manager',
        productId: 'spa-login-test',
        roles: [
          {
            role: 'manager',
            username: 'manager@example.com',
            password: 'manager-password',
            loginPath: '/lab/spa-login',
          },
        ],
      };

      const result = await checker.runPreFlight(base, profile, undefined, {
        browserManager,
        authDir,
      });

      expect(result.roleAuthResults['manager']).toBe(true);
      expect(result.roleStorageStates?.['manager']).toBeTruthy();
    } finally {
      await browserManager.close();
    }
  }, 60000);

  // Regression test 2: Zero-link SPA
  it('regression: zero-link SPA does not stall or crash crawl', async () => {
    const browserManager = new BrowserManager();
    const context = await browserManager.createContext({ baseUrl: base });

    try {
      const spider = new DeterministicSpider([], 5);
      const result = await spider.crawl(context, `${base}/lab/hash`, {
        maxPages: 5,
        exploreClicks: false,
      });

      expect(result.pages.length).toBeGreaterThanOrEqual(1);
      expect(result.pages[0]?.urlPath).toBe('/lab/hash');
    } finally {
      await context.close();
      await browserManager.close();
    }
  }, 30000);

  // Regression test 3: Dead-link budget
  it('regression: dead links (500/403/broken) are bounded and recorded under skipped', async () => {
    const browserManager = new BrowserManager();
    const context = await browserManager.createContext({ baseUrl: base });

    try {
      const spider = new DeterministicSpider([], 20);
      const result = await spider.crawl(context, `${base}/lab/index`, {
        maxPages: 20,
        exploreClicks: false,
      });

      const err500 = result.skipped.find((s) => s.urlPath === '/lab/always-500');
      const err403 = result.skipped.find((s) => s.urlPath === '/lab/forbidden');
      expect(err500).toBeTruthy();
      expect(err500?.why).toBe('http-error');
      expect(err500?.status).toBe(500);
      expect(err403).toBeTruthy();
      expect(err403?.why).toBe('http-error');
      expect(err403?.status).toBe(403);
    } finally {
      await context.close();
      await browserManager.close();
    }
  }, 30000);

  // Regression test 4: Session expiry mid-crawl and mid-run
  it('regression: session expiry mid-run reports session-expired and skips with fixed wording', async () => {
    const outputDir = path.join(tmpDir, 'expiry-run');
    const authDir = path.join(outputDir, 'auth');
    await fs.mkdir(outputDir, { recursive: true });

    // Pre-flight gets valid manager session
    const profile: ProductProfile = {
      name: 'Manager',
      productId: 'expiry-test',
      roles: [
        {
          role: 'manager',
          username: 'manager@example.com',
          password: 'manager-password',
          loginPath: '/signin',
        },
      ],
    };

    const browserManager = new BrowserManager();
    let preflight;
    try {
      preflight = await new PreFlightChecker().runPreFlight(base, profile, undefined, {
        browserManager,
        authDir,
      });
      expect(preflight.roleAuthResults['manager']).toBe(true);
    } finally {
      await browserManager.close();
    }

    // Expire the session on server immediately before test execution
    await fetch(`${base}/lab/expire-session`, { method: 'POST' });

    const prevRelogin = process.env.QA_RELOGIN;
    process.env.QA_RELOGIN = '0';

    try {
      const testCase: TestCase = {
        id: 'TC-EXPIRY-1',
        flowId: 'expiring-flow',
        name: 'Access Expiring Page',
        role: 'manager',
        startPage: '/lab/expiring',
        steps: [{ action: 'wait', name: 'Wait on expiring area' }],
        expectations: {},
      };

      const orchestrator = new FlowTestOrchestrator();
      const report = await orchestrator.run({
        targetUrl: base,
        productId: 'expiry-test',
        specTestCases: [testCase],
        outputDir,
        authDir,
        profile,
        preflight,
        suppliedSessions: preflight.roleStorageStates,
        enableSecurity: false,
        enablePerformance: false,
        enableSeo: false,
        enableA11y: false,
      });

      const result = report.results[0];
      expect(result).toBeTruthy();
      expect(result?.status).toBe('Skipped');
      expect(result?.skipReason).toBe('Signed out part-way: the session stopped working');
      expect(report.notes?.some((n) => n.includes('stopped working part-way through testing'))).toBe(true);
    } finally {
      process.env.QA_RELOGIN = prevRelogin;
    }
  }, 60000);

  // Regression test 5: Custom headers propagation on test run
  it('regression: custom headers propagate to every request during test run', async () => {
    const outputDir = path.join(tmpDir, 'header-run');
    await fs.mkdir(outputDir, { recursive: true });

    const testCase: TestCase = {
      id: 'TC-HEADER-1',
      flowId: 'header-flow',
      name: 'Header verification flow',
      role: 'anonymous',
      startPage: '/lab/headers',
      steps: [{ action: 'wait', name: 'Wait on lab headers page' }],
      expectations: {},
    };

    const orchestrator = new FlowTestOrchestrator();
    await orchestrator.run({
      targetUrl: base,
      productId: 'header-test',
      specTestCases: [testCase],
      outputDir,
      enableSecurity: false,
      enablePerformance: false,
      enableSeo: false,
      enableA11y: false,
      customHeaders: {
        'x-qa-bypass-token': 'token-run-verify-123',
      },
    });

    const statsRes = await fetch(`${base}/lab/stats`);
    const stats = await statsRes.json();
    expect(stats.headerHits['/lab/headers']).toBeGreaterThanOrEqual(1);
  }, 45000);
});
