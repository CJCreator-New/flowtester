import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';
import { chromium, type Browser } from 'playwright';
import { server } from '../../../fixtures/test-app/server.js';
import { DiscoveryAgent } from '../src/discovery/discovery-agent.js';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';

let serverPort = 0;
let stubPort = 0;
const outputDir = path.join(process.cwd(), '.tmp-page-coverage');

describe('page coverage: found = reached + skipped', () => {
  let stub: http.Server;
  let browser: Browser;

  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, () => {
        serverPort = (server.address() as any).port;
        resolve();
      })
    );
    stub = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://x');
      if (url.pathname === '/broken') {
        req.socket.destroy();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
      res.end(
        url.pathname === '/'
          ? '<html><head><title>Home</title></head><body><a href="/ok">Ok</a><a href="/broken?token=secret">Broken</a></body></html>'
          : '<html><head><title>Ok</title></head><body>ok</body></html>'
      );
    });
    await new Promise<void>((resolve) =>
      stub.listen(0, () => {
        stubPort = (stub.address() as any).port;
        resolve();
      })
    );
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => stub.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  });

  it('maxPages 3: skipped pages are page-limit and the numbers add up', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const draft = await new DiscoveryAgent().discover({
        targetUrl: `http://localhost:${serverPort}`,
        productId: 'coverage',
        outputDir,
        maxPages: 3,
        profile: { name: 'Coverage', productId: 'coverage', roles: [] },
      } as never);
      const coverage = draft.exploration?.pageCoverage;
      expect(coverage).toBeTruthy();
      expect(coverage!.found).toBe(coverage!.reached + coverage!.skipped.length);
      expect(coverage!.reached).toBeLessThanOrEqual(3);
      // Independent of the coverage arithmetic: reached is the draft site map's page count, and the
      // skipped count is every page that was queued but never opened (links found on reached pages).
      expect(coverage!.reached).toBe(draft.pages.length);
      const reachedPaths = new Set(draft.pages.map((p) => p.urlPath));
      const linked = new Set<string>();
      for (const p of draft.pages)
        for (const l of p.links || []) if (!l.leavesSite) linked.add(new URL(l.to, 'http://x').pathname);
      const unvisited = [...linked].filter((l) => !reachedPaths.has(l));
      const skippedPaths = new Set(coverage!.skipped.map((s) => s.urlPath));
      for (const u of unvisited) {
        expect(skippedPaths.has(u)).toBe(true);
      }
      expect(coverage!.skipped.length).toBeGreaterThanOrEqual(unvisited.length);
      expect(coverage!.skipped.some((s) => s.why === 'page-limit')).toBe(true);
      expect(JSON.stringify(coverage)).not.toContain('?');
    } finally {
      log.mockRestore();
    }
  }, 120000);

  it('a page that fails to load is skipped as did-not-load, path only', async () => {
    const context = await browser.newContext();
    const result = await new DeterministicSpider().crawl(context, `http://localhost:${stubPort}`, {
      exploreClicks: false,
    });
    await context.close();
    expect(result.pages.map((p) => p.urlPath)).toContain('/ok');
    expect(result.skipped).toMatchObject([{ urlPath: '/broken', why: 'did-not-load' }]);
  }, 60000);
});
