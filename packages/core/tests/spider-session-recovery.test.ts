/**
 * T-305 (LC-003, LC-004). A session that dies mid-crawl is a normal path, not an edge case: the route that
 * triggered recovery must not vanish from the route table, and the restore must put back the whole session —
 * cookies *and* `localStorage` — not cookies alone.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { StorageStateData } from '@qa/types';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';
import { restoreSession } from '../src/discovery/discovery-agent.js';

const PORT = 3541;
const BASE = `http://localhost:${PORT}`;

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;

const SIGN_IN_FORM = `<form method="post" action="/signin">
  <label for="email">Email</label><input id="email" name="email" type="email">
  <label for="password">Password</label><input id="password" name="password" type="password">
  <button type="submit">Sign in</button>
</form>`;

type StorageKind = 'cookie' | 'local-storage';

/** What the site's session looks like when it is healthy: a cookie, or a token in localStorage. */
const healthySession = (kind: StorageKind): StorageStateData =>
  kind === 'cookie'
    ? { cookies: [{ name: 'spider_session', value: 'member', domain: 'localhost', path: '/' }], origins: [] }
    : { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: 'spider_token', value: 'member' }] }] };

describe('mid-crawl session recovery (T-305)', () => {
  let server: http.Server;
  let browser: Browser;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const pathname = new URL(req.url || '/', BASE).pathname;
      const signedIn = (req.headers.cookie || '').includes('spider_session=member');
      const send = (body: string, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'text/html' });
        res.end(body);
      };
      if (pathname === '/signin') return send(page('Sign in', SIGN_IN_FORM));
      // The session lives in a cookie: the site itself turns a signed-out visitor away.
      if (pathname === '/cookie-gated') {
        if (!signedIn) {
          res.writeHead(302, { Location: '/signin' });
          res.end();
          return;
        }
        return send(page('Orders', '<p>Your orders.</p>'));
      }
      // The session lives in localStorage: the page decides, not the server.
      if (pathname === '/ls-gated') {
        if (signedIn) return send(page('Orders', '<p>Your orders.</p>'));
        return send(
          page(
            'Orders',
            `<script>if (!localStorage.getItem('spider_token')) location.replace('/signin');</script>`
          )
        );
      }
      return send(page('Home', '<p>Home.</p>'));
    });
    await new Promise<void>((resolve) => server.listen(PORT, resolve));
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const crawlGated = async (kind: StorageKind, gatedPath: string) => {
    const context = await browser.newContext();
    try {
      let recoveryCalls = 0;
      const result = await new DeterministicSpider().crawl(context, `${BASE}${gatedPath}`, {
        concurrency: 1,
        exploreClicks: false,
        seedSitemap: false,
        isSignedIn: true,
        role: 'member',
        knownLoginPaths: ['/signin'],
        stopAfterWalls: 1,
        reloginHandler: async () => {
          recoveryCalls++;
          await restoreSession(context, healthySession(kind));
          return true;
        },
      });
      return { result, recoveryCalls };
    } finally {
      await context.close();
    }
  };

  for (const [kind, gatedPath] of [
    ['cookie', '/cookie-gated'],
    ['local-storage', '/ls-gated'],
  ] as const) {
    it(`keeps the route a mid-crawl recovery saved (${kind} session)`, async () => {
      const { result, recoveryCalls } = await crawlGated(kind, gatedPath);

      expect(recoveryCalls).toBe(1);
      expect(result.sessionLost).toBeFalsy();
      // One row for the route, not two: the retry's row is the only one, and it says it was recovered.
      const rows = (result.routes || []).filter((r) => r.requestedPath === gatedPath);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ outcome: 'recorded', detail: 'session-recovered' });
      // Recorded once, and not left behind as a wall.
      expect(result.pages.map((p) => p.urlPath)).toEqual([gatedPath]);
      expect(result.signInWalls).toEqual([]);
    }, 60000);
  }

  it('restores cookies and localStorage, and leaves no other host’s cookie behind', async () => {
    const context: BrowserContext = await browser.newContext();
    try {
      await context.addCookies([
        { name: 'other_host', value: 'x', domain: 'example.com', path: '/' },
        { name: 'stale', value: 'y', domain: 'localhost', path: '/' },
      ]);

      await restoreSession(context, {
        cookies: [{ name: 'spider_session', value: 'member', domain: 'localhost', path: '/' }],
        origins: [{ origin: BASE, localStorage: [{ name: 'spider_token', value: 'member' }] }],
      });

      // What was there is gone first, so nothing from another host rides along.
      expect((await context.cookies()).map((c) => c.name).sort()).toEqual(['spider_session']);

      const fresh = await context.newPage();
      await fresh.goto(`${BASE}/`);
      expect(await fresh.evaluate(() => localStorage.getItem('spider_token'))).toBe('member');
      await fresh.close();
    } finally {
      await context.close();
    }
  }, 60000);
});
