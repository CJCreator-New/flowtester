import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { BrowserManager, setBrowserPolicy } from '../src/browser.js';

describe('T-103 browser context scoped headers and restart guard', () => {
  let serverA: http.Server;
  let serverB: http.Server;
  let portA: number;
  let portB: number;
  let headersSeenA: Record<string, string | undefined>[] = [];
  let headersSeenB: Record<string, string | undefined>[] = [];
  const browser = new BrowserManager();

  beforeAll(async () => {
    // Server A: Host A (target)
    serverA = http.createServer((req, res) => {
      headersSeenA.push(req.headers as Record<string, string | undefined>);
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        // loads a script from Server B
        res.end(
          `<!DOCTYPE html><html><head><script src="http://127.0.0.1:${portB}/script.js"></script></head><body><h1>Host A</h1></body></html>`
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });

    // Server B: Host B (third party)
    serverB = http.createServer((req, res) => {
      headersSeenB.push(req.headers as Record<string, string | undefined>);
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end('console.log("script from B");');
    });

    await new Promise<void>((resolve) => serverA.listen(0, '127.0.0.1', () => resolve()));
    await new Promise<void>((resolve) => serverB.listen(0, '127.0.0.1', () => resolve()));
    portA = (serverA.address() as { port: number }).port;
    portB = (serverB.address() as { port: number }).port;
  });

  afterAll(async () => {
    await browser.close();
    setBrowserPolicy(null);
    await new Promise<void>((resolve) => serverA.close(() => resolve()));
    await new Promise<void>((resolve) => serverB.close(() => resolve()));
  });

  it('sends X-QA-Bypass-Token only to target host A and NOT to third-party host B', async () => {
    headersSeenA = [];
    headersSeenB = [];
    const context = await browser.createContext({
      baseUrl: `http://127.0.0.1:${portA}`,
      customHeaders: {
        'X-QA-Bypass-Token': 'secret-token-12345',
      },
    });

    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${portA}/`);

      expect(headersSeenA.length).toBeGreaterThan(0);
      expect(headersSeenB.length).toBeGreaterThan(0);

      // Server A saw the token
      expect(headersSeenA.some((h) => h['x-qa-bypass-token'] === 'secret-token-12345')).toBe(true);

      // Server B did NOT see the token
      expect(headersSeenB.some((h) => h['x-qa-bypass-token'] === 'secret-token-12345')).toBe(false);
    } finally {
      await context.close();
    }
  });

  it('sends headers to B when headerHosts allows host B', async () => {
    headersSeenA = [];
    headersSeenB = [];
    const context = await browser.createContext({
      baseUrl: `http://127.0.0.1:${portA}`,
      headerHosts: [`127.0.0.1:${portB}`],
      customHeaders: {
        'X-QA-Bypass-Token': 'secret-token-allowed-to-b',
      },
    });

    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${portA}/`);

      expect(headersSeenA.length).toBeGreaterThan(0);
      expect(headersSeenB.length).toBeGreaterThan(0);

      expect(headersSeenA.some((h) => h['x-qa-bypass-token'] === 'secret-token-allowed-to-b')).toBe(true);
      expect(headersSeenB.some((h) => h['x-qa-bypass-token'] === 'secret-token-allowed-to-b')).toBe(true);
    } finally {
      await context.close();
    }
  });

  it('request guard still aborts rejected requests (guard runs first in route chain)', async () => {
    setBrowserPolicy({
      guard: async (url) => {
        // Reject requests to Server B
        if (url.includes(`127.0.0.1:${portB}`)) return false;
        return true;
      },
    });

    const context = await browser.createContext({
      baseUrl: `http://127.0.0.1:${portA}`,
      customHeaders: {
        'X-QA-Bypass-Token': 'token-with-guard',
      },
    });

    try {
      headersSeenB = [];
      const page = await context.newPage();
      let failedB = false;
      page.on('requestfailed', (req) => {
        if (req.url().includes(`127.0.0.1:${portB}`)) failedB = true;
      });

      await page.goto(`http://127.0.0.1:${portA}/`);
      expect(failedB).toBe(true);
      // Host B should not have received the request
      expect(headersSeenB.some((h) => h['x-qa-bypass-token'] === 'token-with-guard')).toBe(false);
    } finally {
      setBrowserPolicy(null);
      await context.close();
    }
  });

  it('openPage with a nonexistent storageState path throws without killing the shared browser', async () => {
    // Attempt openPage with bad storageState
    await expect(
      browser.openPage({ storageState: '/nonexistent/fake-path-to-storage-state-12345.json' })
    ).rejects.toThrow();

    // The shared browser is still alive and usable for another context
    const { context, page } = await browser.openPage({ baseUrl: `http://127.0.0.1:${portA}` });
    try {
      await page.setContent('<h1>Alive</h1>');
      expect(await page.textContent('h1')).toBe('Alive');
    } finally {
      await context.close();
    }
  });
});
