import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { chromium, type Browser } from 'playwright';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';

const PORT = 3538;

describe('DeterministicSpider: concurrency, delay and bypass headers (FR-1.7)', () => {
  let server: http.Server;
  let browser: Browser;
  const receivedHeaders: Record<string, string | undefined>[] = [];
  const requestTimes: number[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      receivedHeaders.push(req.headers as Record<string, string | undefined>);
      requestTimes.push(Date.now());
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (req.url === '/') {
        res.end(`<!doctype html><html><body><h1>Home</h1><a href="/p1">P1</a><a href="/p2">P2</a></body></html>`);
      } else if (req.url === '/p1') {
        res.end(`<!doctype html><html><body><h1>Page 1</h1><a href="/p3">P3</a></body></html>`);
      } else if (req.url === '/p2') {
        res.end(`<!doctype html><html><body><h1>Page 2</h1></body></html>`);
      } else if (req.url === '/p3') {
        res.end(`<!doctype html><html><body><h1>Page 3</h1></body></html>`);
      } else {
        res.end(`<!doctype html><html><body><h1>Other</h1></body></html>`);
      }
    });
    await new Promise<void>((resolve) => server.listen(PORT, resolve));
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('crawls multi-page site with concurrency = 2 and sends custom bypass headers', async () => {
    const context = await browser.newContext({
      extraHTTPHeaders: {
        'x-qa-bypass-token': 'allow-me-123',
      },
    });
    const spider = new DeterministicSpider();
    const result = await spider.crawl(context, `http://localhost:${PORT}/`, {
      concurrency: 2,
      pageDelayMs: 50,
    });
    await context.close();

    // Verify all pages discovered
    const paths = result.pages.map((p) => p.urlPath).sort();
    expect(paths).toContain('/');
    expect(paths).toContain('/p1');
    expect(paths).toContain('/p2');
    expect(paths).toContain('/p3');

    // Verify custom header received on server
    const hasHeader = receivedHeaders.some((h) => h['x-qa-bypass-token'] === 'allow-me-123');
    expect(hasHeader).toBe(true);
  });
});
