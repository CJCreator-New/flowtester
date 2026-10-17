import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { chromium, type Browser } from 'playwright';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';

describe('DeterministicSpider link discovery and trap protection (T-112)', () => {
  const FIXTURE_PORT = 3831;
  const SITEMAP_PORT = 3832;

  const fixtureUrl = `http://localhost:${FIXTURE_PORT}`;
  const sitemapServerUrl = `http://localhost:${SITEMAP_PORT}`;

  let browser: Browser;
  let sitemapServer: http.Server;

  beforeAll(async () => {
    browser = await chromium.launch();

    // Start fixture server
    await new Promise<void>((resolve) => fixtureServer.listen(FIXTURE_PORT, () => resolve()));

    // Dedicated sitemap in-test server
    sitemapServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', sitemapServerUrl);
      if (url.pathname === '/sitemap.xml') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${sitemapServerUrl}/hidden</loc>
  </url>
</urlset>`);
        return;
      }
      if (url.pathname === '/hidden') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><body><h1>Hidden Page from Sitemap</h1></body></html>`);
        return;
      }
      // Root page without links to /hidden
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body><h1>Root Page</h1><p>No links here</p></body></html>`);
    });

    await new Promise<void>((resolve) => sitemapServer.listen(SITEMAP_PORT, () => resolve()));
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
    await new Promise<void>((resolve) => sitemapServer.close(() => resolve()));
  });

  it('/lab/trap/1: stops at maxPerShape (25) pages of that shape and skipped contains trap-limit entries', async () => {
    const context = await browser.newContext();
    try {
      const spider = new DeterministicSpider([], 100);
      const result = await spider.crawl(context, `${fixtureUrl}/lab/trap/1`, {
        maxPerShape: 25,
        maxDepth: 50,
        seedSitemap: false,
        pageDelayMs: 0,
      });
      const trapPages = result.pages.filter((p) => p.urlPath.startsWith('/lab/trap/'));
      expect(trapPages.length).toBe(25);
      const trapSkips = (result.skipped || []).filter((s) => s.why === 'trap-limit');
      expect(trapSkips.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  }, 90000); // 25 trap pages at about a second each on a shared runner

  it('with routeQueryParams: ["month"] the calendar is bounded by the shape cap; without it collapses to one page', async () => {
    const context = await browser.newContext();
    try {
      const spider = new DeterministicSpider([], 100);

      // Without routeQueryParams: collapses to 1 page because key is just /lab/calendar
      const resDefault = await spider.crawl(context, `${fixtureUrl}/lab/calendar`, {
        maxPerShape: 5,
        seedSitemap: false,
        pageDelayMs: 0,
      });
      const calDefault = resDefault.pages.filter((p) => p.urlPath.startsWith('/lab/calendar'));
      expect(calDefault.length).toBe(1);

      // With routeQueryParams: ['month']: month parameter is preserved in key, shape cap bounds it
      const resWithQuery = await spider.crawl(context, `${fixtureUrl}/lab/calendar?month=2026-10`, {
        routeQueryParams: ['month'],
        maxPerShape: 5,
        seedSitemap: false,
        pageDelayMs: 0,
      });
      const calWithQuery = resWithQuery.pages.filter((p) => p.urlPath.startsWith('/lab/calendar'));
      expect(calWithQuery.length).toBe(5);
      expect((resWithQuery.skipped || []).some((s) => s.why === 'trap-limit')).toBe(true);
    } finally {
      await context.close();
    }
  }, 90000); // two crawls, each bounded by the shape cap

  it('/lab/hash with includeHash: true records two routes; without it, none', async () => {
    const context = await browser.newContext();
    try {
      const spider = new DeterministicSpider([], 10);

      // Without includeHash: hash routes #/one, #/two are stripped
      const resWithout = await spider.crawl(context, `${fixtureUrl}/lab/hash`, {
        includeHash: false,
        exploreClicks: false,
        pageDelayMs: 0,
      });
      const hashRoutesWithout = resWithout.pages.filter((p) => p.urlPath.includes('#/'));
      expect(hashRoutesWithout.length).toBe(0);

      // With includeHash: true
      const resWith = await spider.crawl(context, `${fixtureUrl}/lab/hash`, {
        includeHash: true,
        exploreClicks: false,
        pageDelayMs: 0,
      });
      const hashRoutesWith = resWith.pages.filter((p) => p.urlPath.includes('#/'));
      expect(hashRoutesWith.length).toBe(2);
    } finally {
      await context.close();
    }
  });

  it('/lab/onclick target pages are found via data-href and click exploration', async () => {
    const context = await browser.newContext();
    try {
      const spider = new DeterministicSpider([], 10);
      const res = await spider.crawl(context, `${fixtureUrl}/lab/onclick`, {
        exploreClicks: true,
        seedSitemap: false,
        pageDelayMs: 0,
      });
      const paths = res.pages.map((p) => p.urlPath);
      expect(paths).toContain('/lab/onclick/target'); // found via data-href / role=link
      expect(paths).toContain('/lab/onclick/target2'); // found via button click exploration
    } finally {
      await context.close();
    }
  });

  it('a page with a fixed cookie banner (/lab/overlay) is crawled and its links are found', async () => {
    const context = await browser.newContext();
    try {
      const spider = new DeterministicSpider([], 10);
      const res = await spider.crawl(context, `${fixtureUrl}/lab/overlay`, {
        pageDelayMs: 0,
      });
      const paths = res.pages.map((p) => p.urlPath);
      expect(paths).toContain('/lab/overlay');
      expect(paths).toContain('/lab/overlay/inner');
    } finally {
      await context.close();
    }
  });

  it('in-test server with /sitemap.xml listing unlinked /hidden page: crawled when seeded, skipped when seedSitemap: false', async () => {
    const context = await browser.newContext();
    try {
      const spider = new DeterministicSpider([], 10);

      const resSeeded = await spider.crawl(context, sitemapServerUrl, {
        seedSitemap: true,
        pageDelayMs: 0,
      });
      const seededPaths = resSeeded.pages.map((p) => p.urlPath);
      expect(seededPaths).toContain('/hidden');

      const resUnseeded = await spider.crawl(context, sitemapServerUrl, {
        seedSitemap: false,
        pageDelayMs: 0,
      });
      const unseededPaths = resUnseeded.pages.map((p) => p.urlPath);
      expect(unseededPaths).not.toContain('/hidden');
    } finally {
      await context.close();
    }
  });

  it('maxDurationMs: 2000 against /lab/trap/1 ends in about 2s with a time-limit skip entry', async () => {
    const context = await browser.newContext();
    try {
      const spider = new DeterministicSpider([], 100);
      const start = Date.now();
      const res = await spider.crawl(context, `${fixtureUrl}/lab/trap/1`, {
        maxDurationMs: 2000,
        pageDelayMs: 50,
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(8000);
      expect((res.skipped || []).some((s) => s.why === 'time-limit')).toBe(true);
    } finally {
      await context.close();
    }
  });
});
