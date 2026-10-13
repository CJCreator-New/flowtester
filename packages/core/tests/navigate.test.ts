import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { chromium, type Browser } from 'playwright';
import { navigate, settlePage, looksLikeLogin, toTelemetry } from '../src/navigate.js';

describe('navigate helper', () => {
  let server: http.Server;
  let base: string;
  let browser: Browser;
  let hangOnceCount = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost`);
      if (url.pathname === '/404') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      if (url.pathname === '/500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
        return;
      }
      if (url.pathname === '/r1') {
        res.writeHead(302, { Location: '/r2' });
        res.end();
        return;
      }
      if (url.pathname === '/r2') {
        res.writeHead(302, { Location: '/final' });
        res.end();
        return;
      }
      if (url.pathname === '/final') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><html><body><p>Final Page</p></body></html>');
        return;
      }
      if (url.pathname === '/late-links') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!doctype html><html><body><div id="c"></div>
          <script>
            setTimeout(() => {
              document.getElementById('c').innerHTML = '<a href="/test">Late link</a>';
            }, 1500);
          </script>
        </body></html>`);
        return;
      }
      if (url.pathname === '/hang-once') {
        hangOnceCount++;
        if (hangOnceCount === 1) {
          // hang on first attempt (let client timeout)
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><html><body><p>Answered on retry</p></body></html>');
        return;
      }
      if (url.pathname === '/hang-always') {
        // never respond
        return;
      }
      if (url.pathname === '/login-pw') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><html><body><form><input type="password" name="pw"></form></body></html>');
        return;
      }
      if (url.pathname === '/normal') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><html><body><p>No password here</p></body></html>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><html><body><h1>Root</h1></body></html>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('captures 404, 500, and 302 redirect chain', async () => {
    const page = await browser.newPage();
    try {
      const res404 = await navigate(page, `${base}/404`);
      expect(res404.ok).toBe(true);
      expect(res404.status).toBe(404);

      const res500 = await navigate(page, `${base}/500`);
      expect(res500.ok).toBe(true);
      expect(res500.status).toBe(500);

      const resRedirect = await navigate(page, `${base}/r1`);
      expect(resRedirect.ok).toBe(true);
      expect(resRedirect.status).toBe(200);
      expect(resRedirect.finalUrl).toBe(`${base}/final`);
      expect(resRedirect.redirectChain).toHaveLength(2);
      expect(resRedirect.redirectChain[0]).toBe(`${base}/r1`);
      expect(resRedirect.redirectChain[1]).toBe(`${base}/r2`);
    } finally {
      await page.close();
    }
  });

  it('settles late hydrated links when needLinks is true', async () => {
    const page = await browser.newPage();
    try {
      const res = await navigate(page, `${base}/late-links`, { needLinks: true, settleMs: 3000 });
      expect(res.ok).toBe(true);
      expect(res.settled).toBe(true);
      expect(res.linkCount).toBeGreaterThanOrEqual(1);
    } finally {
      await page.close();
    }
  });

  it('retries when the first request hangs and succeeds on second attempt', async () => {
    const page = await browser.newPage();
    try {
      hangOnceCount = 0;
      const res = await navigate(page, `${base}/hang-once`, { timeoutMs: 600, retries: 1 });
      expect(res.ok).toBe(true);
      expect(res.attempts).toBe(2);
      expect(res.status).toBe(200);
    } finally {
      await page.close();
    }
  });

  it('returns ok false and timeout error when request always hangs', async () => {
    const page = await browser.newPage();
    try {
      const res = await navigate(page, `${base}/hang-always`, { timeoutMs: 400, retries: 1 });
      expect(res.ok).toBe(false);
      expect(res.attempts).toBe(2);
      expect(res.error).toBeDefined();
      expect(res.error?.kind).toBe('timeout');
      expect(Object.keys(res.error!)).toEqual(['kind']);
    } finally {
      await page.close();
    }
  });

  it('detects login page with looksLikeLogin', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${base}/login-pw`);
      expect(await looksLikeLogin(page)).toBe(true);

      await page.goto(`${base}/normal`);
      expect(await looksLikeLogin(page)).toBe(false);
      expect(await looksLikeLogin(page, ['/normal'])).toBe(true);
    } finally {
      await page.close();
    }
  });

  it('maps NavigateResult to RouteTelemetry with redacted paths', () => {
    const navResult = {
      ok: true,
      status: 200,
      finalUrl: 'https://app.test/dashboard?token=secret123',
      redirectChain: ['https://app.test/login?token=secret123'],
      attempts: 1,
      durationMs: 120,
      settled: true,
    };
    const tel = toTelemetry(navResult, '/login?token=secret123');
    expect(tel.requestedPath).toBe('/login?token=***');
    expect(tel.finalPath).toBe('/dashboard?token=***');
    expect(tel.redirectChain).toEqual(['/login?token=***']);
    expect(tel.outcome).toBe('recorded');
    expect(tel.status).toBe(200);
  });
});
