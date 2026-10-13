import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import type { RoleCredential } from '@qa/types';
import { BrowserManager } from '../src/browser.js';
import { PreFlightChecker } from '../src/preflight.js';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';

describe('PreFlightChecker deterministic sign-in (T-110)', () => {
  const FIXTURE_PORT = 3711;
  const EVIL_PORT = 3712;
  const RETRY_PORT = 3713;
  const NO_COOKIE_PORT = 3714;
  const REDIRECT_PORT = 3715;

  const baseUrl = `http://localhost:${FIXTURE_PORT}`;
  const browser = new BrowserManager();
  const checker = new PreFlightChecker();
  const tmpDir = path.join(process.cwd(), '.tmp-signin-determinism');

  let evilServer: http.Server;
  let retryServer: http.Server;
  let noCookieServer: http.Server;
  let redirectServer: http.Server;

  let evilRequests: string[] = [];
  let evilPosts: number = 0;
  let retryRequests: number = 0;

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });

    // Fixture server
    await new Promise<void>((resolve) => fixtureServer.listen(FIXTURE_PORT, () => resolve()));

    // Evil server
    evilServer = http.createServer((req, res) => {
      evilRequests.push(`${req.method} ${req.url}`);
      if (req.method === 'POST') evilPosts++;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body>
        <form method="post" action="/evil-login">
          <input id="email" name="email" type="email">
          <input id="password" name="password" type="password">
          <button type="submit">Evil Login</button>
        </form>
      </body></html>`);
    });
    await new Promise<void>((resolve) => evilServer.listen(EVIL_PORT, () => resolve()));

    // Retry server: hangs on 1st request, answers on 2nd
    retryServer = http.createServer((req, res) => {
      retryRequests++;
      if (retryRequests === 1) {
        // Hang first request
        return;
      }
      const url = new URL(req.url || '/', `http://localhost:${RETRY_PORT}`);
      if (url.pathname === '/login' && req.method === 'POST') {
        res.writeHead(302, { 'Set-Cookie': 'session=retry-ok; Path=/', Location: '/dashboard' });
        res.end();
        return;
      }
      if (url.pathname === '/dashboard') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!DOCTYPE html><html><body><h1>Dashboard</h1><p>Welcome</p></body></html>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body>
        <form method="post" action="/login">
          <input id="signin-email" name="email" type="email">
          <input id="signin-password" name="password" type="password">
          <button type="submit">Sign in</button>
        </form>
      </body></html>`);
    });
    await new Promise<void>((resolve) => retryServer.listen(RETRY_PORT, () => resolve()));

    // No cookie server: returns 200 without cookie and keeps form
    noCookieServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body>
        <form method="post" action="/login">
          <input id="signin-email" name="email" type="email">
          <input id="signin-password" name="password" type="password">
          <button type="submit">Sign in</button>
        </form>
      </body></html>`);
    });
    await new Promise<void>((resolve) => noCookieServer.listen(NO_COOKIE_PORT, () => resolve()));

    // Redirect server: redirects cross-origin before the form
    redirectServer = http.createServer((_req, res) => {
      res.writeHead(302, { Location: `http://localhost:${EVIL_PORT}/foreign-login` });
      res.end();
    });
    await new Promise<void>((resolve) => redirectServer.listen(REDIRECT_PORT, () => resolve()));
  });

  afterAll(async () => {
    await browser.close();
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
    evilServer.closeAllConnections?.();
    await new Promise<void>((resolve) => evilServer.close(() => resolve()));
    retryServer.closeAllConnections?.();
    await new Promise<void>((resolve) => retryServer.close(() => resolve()));
    noCookieServer.closeAllConnections?.();
    await new Promise<void>((resolve) => noCookieServer.close(() => resolve()));
    redirectServer.closeAllConnections?.();
    await new Promise<void>((resolve) => redirectServer.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('/lab/spa-login: sign-in with fixture credentials succeeds after delayed form injection', async () => {
    const context = await browser.createContext({ baseUrl });
    try {
      const result = await checker.signIn(context, baseUrl, {
        role: 'manager',
        username: 'manager@example.com',
        password: 'manager-password',
        loginPath: '/lab/spa-login',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.landingPath).toBe('/account');
        expect(result.attempts).toBe(1);
      }
    } finally {
      await context.close();
    }
  }, 60000);

  it('wrong password: returns wrong-details in 1 attempt with failedStep post-submit-check (no retry)', async () => {
    const context = await browser.createContext({ baseUrl });
    try {
      const result = await checker.signIn(context, baseUrl, {
        role: 'manager',
        username: 'manager@example.com',
        password: 'bad-password',
        loginPath: '/signin',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('wrong-details');
        expect(result.attempts).toBe(1);
        expect(result.failedStep).toBe('post-submit-check');
      }
    } finally {
      await context.close();
    }
  }, 60000);

  it('server hanging first login request and answering second: ok: true, attempts: 2', async () => {
    retryRequests = 0;
    const retryUrl = `http://localhost:${RETRY_PORT}`;
    const context = await browser.createContext({ baseUrl: retryUrl });
    try {
      const result = await checker.signIn(
        context,
        retryUrl,
        {
          role: 'user',
          username: 'test@example.com',
          password: 'secret-password',
          loginPath: '/login',
        },
        undefined,
        { gotoTimeoutMs: 1500 }
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.attempts).toBe(2);
        expect(result.landingPath).toBe('/dashboard');
      }
      expect(retryRequests).toBeGreaterThanOrEqual(2);
    } finally {
      await context.close();
    }
  }, 60000);

  it('login returning 200 but setting no cookie and keeping form: not ok (failedStep post-submit-check)', async () => {
    const noCookieUrl = `http://localhost:${NO_COOKIE_PORT}`;
    const context = await browser.createContext({ baseUrl: noCookieUrl });
    try {
      const result = await checker.signIn(context, noCookieUrl, {
        role: 'user',
        username: 'test@example.com',
        password: 'secret-password',
        loginPath: '/login',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('wrong-details');
        expect(result.failedStep).toBe('post-submit-check');
      }
    } finally {
      await context.close();
    }
  }, 60000);

  it('cross-origin loginPath: returns needs-more and NO request is made to other origin', async () => {
    evilRequests = [];
    const context = await browser.createContext({ baseUrl });
    try {
      const result = await checker.signIn(context, baseUrl, {
        role: 'manager',
        username: 'manager@example.com',
        password: 'manager-password',
        loginPath: `http://localhost:${EVIL_PORT}/login`,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('needs-more');
        expect(result.failedStep).toBe('goto');
      }
      expect(evilRequests.length).toBe(0);
    } finally {
      await context.close();
    }
  }, 60000);

  it('start page that redirects to another origin before form: returns needs-more and password never typed', async () => {
    evilPosts = 0;
    const redirectUrl = `http://localhost:${REDIRECT_PORT}`;
    const context = await browser.createContext({ baseUrl: redirectUrl });
    try {
      const result = await checker.signIn(context, redirectUrl, {
        role: 'user',
        username: 'attacker-test@example.com',
        password: 'secret-password',
        loginPath: '/start',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('needs-more');
        expect(result.failedStep).toBe('goto');
      }
      expect(evilPosts).toBe(0);
    } finally {
      await context.close();
    }
  }, 60000);

  it('role ../x: state file is written inside authDir (slugged) and never outside', async () => {
    const authDir = path.join(tmpDir, 'auth-slug-test');
    await fs.mkdir(authDir, { recursive: true });

    const result = await checker.runPreFlight(
      baseUrl,
      {
        name: 'Slug Test',
        productId: 'slug-test',
        roles: [
          {
            role: '../x',
            username: 'manager@example.com',
            password: 'manager-password',
            loginPath: '/signin',
          },
        ],
      },
      undefined,
      { browserManager: browser, authDir }
    );

    expect(result.roleAuthResults['../x']).toBe(true);
    const files = await fs.readdir(authDir);
    expect(files).toContain('___x.json');
    // Ensure no file was written to parent directory
    const escapedFile = path.join(tmpDir, 'x.json');
    const exists = await fs.stat(escapedFile).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  }, 60000);

  it('custom header sent only to target host during sign-in and reachability', async () => {
    // Reset lab stats
    await fetch(`${baseUrl}/lab/reset`, { method: 'POST' }).catch(() => {});

    const result = await checker.runPreFlight(
      baseUrl,
      {
        name: 'Header Test',
        productId: 'header-test',
        roles: [
          {
            role: 'manager',
            username: 'manager@example.com',
            password: 'manager-password',
            loginPath: '/signin',
          },
        ],
      },
      undefined,
      {
        browserManager: browser,
        authDir: path.join(tmpDir, 'auth-headers'),
        customHeaders: { 'x-qa-bypass-token': 'token-123' },
        headerHosts: [new URL(baseUrl).hostname],
      }
    );

    expect(result.ok).toBe(true);
    const labStats = await (await fetch(`${baseUrl}/lab/stats`)).json();
    expect(labStats.headerHits['/']).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('throwing signIn does not leave an open context', async () => {
    const context = await browser.createContext({ baseUrl });
    const closeSpy = vi.spyOn(context, 'close');

    vi.spyOn(browser, 'createContext').mockResolvedValueOnce(context);
    vi.spyOn(checker, 'signIn').mockRejectedValueOnce(new Error('Synthetic signIn error'));

    const res = await checker.runPreFlight(
      baseUrl,
      {
        name: 'Crash Test',
        productId: 'crash-test',
        roles: [
          {
            role: 'crasher',
            username: 'crasher@example.com',
            password: 'password',
            loginPath: '/signin',
          },
        ],
      },
      undefined,
      {
        browserManager: browser,
        authDir: path.join(tmpDir, 'auth-crash'),
      }
    );

    expect(res.roleAuthResults.crasher).toBe(false);
    expect(closeSpy).toHaveBeenCalled();
  }, 60000);
});
