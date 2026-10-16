/**
 * T-307 (LC-008). Concurrent workers share `pages`, so the limit needs a race guard — but it belongs before a
 * page's inventory and before its screenshot, not after both. A dropped page must leave no file behind and must
 * not steal another route's reason.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { chromium, type Browser } from 'playwright';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';

const PORT = 3542;
const BASE = `http://localhost:${PORT}`;
const SHOT_DIR = path.join(process.cwd(), '.tmp-page-limit-shots');
const MAX_PAGES = 3;
const LINK_COUNT = 12;

describe('the page limit is checked before a page’s work (T-307)', () => {
  let server: http.Server;
  let browser: Browser;

  beforeAll(async () => {
    await fs.rm(SHOT_DIR, { recursive: true, force: true }).catch(() => {});
    server = http.createServer((req, res) => {
      const pathname = new URL(req.url || '/', BASE).pathname;
      const send = (title: string, body: string, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'text/html' });
        res.end(
          `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main>${body}</main></body></html>`
        );
      };
      if (pathname === '/') {
        const links = ['/dead', ...Array.from({ length: LINK_COUNT }, (_, i) => `/page/${i + 1}`)]
          .map((href) => `<a href="${href}">${href}</a>`)
          .join(' ');
        return send('Home', `<h1>Home</h1>${links}`);
      }
      if (pathname.startsWith('/page/')) return send('Page', '<h1>Page</h1>');
      return send('Not found', 'Not found', 404);
    });
    await new Promise<void>((resolve) => server.listen(PORT, resolve));
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(SHOT_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('stops at the limit, keeps every route’s own reason, and writes no orphan screenshot', async () => {
    const context = await browser.newContext();
    let result: Awaited<ReturnType<DeterministicSpider['crawl']>>;
    try {
      result = await new DeterministicSpider([], MAX_PAGES).crawl(context, `${BASE}/`, {
        concurrency: 4,
        exploreClicks: false,
        seedSitemap: false,
        screenshotDir: SHOT_DIR,
      });
    } finally {
      await context.close();
    }

    expect(result.pages).toHaveLength(MAX_PAGES);

    // One screenshot per recorded page, and none for a page the limit dropped.
    const shots = (await fs.readdir(SHOT_DIR)).filter((name) => name.endsWith('.jpg'));
    expect(shots).toHaveLength(MAX_PAGES);

    // Every route the limit dropped is reported in both shapes.
    for (const row of (result.routes || []).filter((r) => r.skipReason === 'page-limit')) {
      expect(result.skipped?.find((s) => s.urlPath === row.requestedPath && s.why === 'page-limit')).toBeTruthy();
    }

    // A route skipped for its own reason keeps it, even once the limit is reached.
    expect((result.routes || []).find((r) => r.requestedPath === '/dead')).toMatchObject({
      outcome: 'skipped',
      skipReason: 'http-error',
    });
  }, 60000);
});
