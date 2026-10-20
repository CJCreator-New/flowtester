import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';

let base: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    fixtureServer.listen(0, () => {
      const addr = fixtureServer.address();
      if (addr && typeof addr === 'object') base = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});
afterAll(async () => {
  await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
});

const get = (path: string, cookie?: string) =>
  fetch(`${base}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} });

describe('QSP-011 access and security lab routes', () => {
  it('open-account is 200 with content and no sign-in; closed-account redirects; 401 is 401', async () => {
    const open = await get('/lab/open-account');
    expect(open.status).toBe(200);
    expect(await open.text()).toContain('Account balance');
    const closed = await get('/lab/closed-account');
    expect(closed.status).toBe(302);
    expect(closed.headers.get('location')).toBe('/signin');
    expect((await get('/lab/closed-account', 'fixture_session=admin')).status).toBe(200);
    expect((await get('/lab/401')).status).toBe(401);
  });

  it('mirror shows each session its own name; mirror-leak shows the first name to everyone', async () => {
    expect(await (await get('/lab/mirror', 'fixture_session=admin')).text()).toContain('admin@example.com');
    expect(await (await get('/lab/mirror', 'fixture_session=viewer')).text()).toContain('viewer@example.com');
    expect((await get('/lab/mirror')).status).toBe(302);
    expect(await (await get('/lab/mirror-leak', 'fixture_session=admin')).text()).toContain('admin@example.com');
    const b = await (await get('/lab/mirror-leak', 'fixture_session=viewer')).text();
    expect(b).toContain('admin@example.com');
    await fetch(`${base}/lab/reset`, { method: 'POST' });
  });

  it('csrf-form has no token, csrf-ok has one; cookie routes set cookies with and without flags', async () => {
    expect(await (await get('/lab/csrf-form')).text()).not.toContain('csrf_token');
    expect(await (await get('/lab/csrf-ok')).text()).toContain('name="csrf_token"');
    expect((await get('/lab/cookie-good')).headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Lax/);
    expect((await get('/lab/cookie-bad')).headers.get('set-cookie')).not.toMatch(/HttpOnly|SameSite|Secure/);
  });

  it('GET visits to the lab routes count no POST or DELETE', async () => {
    await fetch(`${base}/lab/stats/reset`);
    for (const p of ['/lab/open-account', '/lab/closed-account', '/lab/csrf-form', '/lab/mirror-leak']) await get(p);
    const stats = (await (await get('/lab/stats')).json()) as { posts: number; deletes: number };
    expect(stats.posts + stats.deletes).toBe(0);
  });
});
