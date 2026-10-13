import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';

let port: number;
let base: string;

beforeAll(async () => {
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
});

describe('T-102 fixture failure modes routes', () => {
  it('/lab/redirect-chain follows 302 twice to a 200', async () => {
    // Check hop 1
    const res1 = await fetch(`${base}/lab/redirect-chain`, { redirect: 'manual' });
    expect(res1.status).toBe(302);
    expect(res1.headers.get('location')).toBe('/lab/redirect-chain/2');

    // Check hop 2
    const res2 = await fetch(`${base}/lab/redirect-chain/2`, { redirect: 'manual' });
    expect(res2.status).toBe(302);
    expect(res2.headers.get('location')).toBe('/lab/redirect-chain/final');

    // Follow automatically to final 200
    const finalRes = await fetch(`${base}/lab/redirect-chain`);
    expect(finalRes.status).toBe(200);
    const text = await finalRes.text();
    expect(text).toContain('Redirect Final');
  });

  it('/lab/always-500 is 500 and /lab/forbidden is 403 with HTML bodies', async () => {
    const errRes = await fetch(`${base}/lab/always-500`);
    expect(errRes.status).toBe(500);
    const errText = await errRes.text();
    expect(errText).toContain('Server Error 500');

    const forbRes = await fetch(`${base}/lab/forbidden`);
    expect(forbRes.status).toBe(403);
    const forbText = await forbRes.text();
    expect(forbText).toContain('Forbidden 403');
  });

  it('/lab/trap/5 links to /lab/trap/6', async () => {
    const res = await fetch(`${base}/lab/trap/5`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('/lab/trap/6');
  });

  it('/lab/spa-late has no <a href in raw HTML', async () => {
    const res = await fetch(`${base}/lab/spa-late`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('<a href');
    expect(text).toContain('id="root"');
  });

  it('/lab/headers never contains the bypass token value and records hit', async () => {
    const secretToken = 'super-secret-bypass-token-xyz-999';
    const res = await fetch(`${base}/lab/headers`, {
      headers: {
        'X-QA-Bypass-Token': secretToken,
        'User-Agent': 'TestAgent/1.0',
      },
    });
    expect(res.status).toBe(200);
    const rawText = await res.text();
    expect(rawText).not.toContain(secretToken);

    const json = JSON.parse(rawText);
    expect(json['x-qa-bypass-token']).toBe('present');
    expect(json['user-agent']).toBe('TestAgent/1.0');
    expect(json.cookie).toBe('absent');

    const statsRes = await fetch(`${base}/lab/stats`);
    const stats = await statsRes.json();
    expect(stats.headerHits['/lab/headers']).toBeGreaterThanOrEqual(1);
  });

  it('handles expiring sessions after n requests', async () => {
    await fetch(`${base}/lab/reset`, { method: 'POST' });

    // Sign in to get a valid session
    const signinRes = await fetch(`${base}/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=manager%40example.com&password=manager-password',
      redirect: 'manual',
    });
    expect(signinRes.status).toBe(302);
    const setCookie = signinRes.headers.get('set-cookie');
    expect(setCookie).toContain('fixture_session=manager');
    const cookieHeader = setCookie?.split(';')[0] || '';

    // Set max requests to 2
    const startRes = await fetch(`${base}/lab/expiring/start?n=2`, { method: 'POST' });
    expect(startRes.status).toBe(200);

    // Request 1: 200 OK
    const req1 = await fetch(`${base}/lab/expiring`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    });
    expect(req1.status).toBe(200);

    // Request 2: 200 OK
    const req2 = await fetch(`${base}/lab/expiring`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    });
    expect(req2.status).toBe(200);

    // Request 3: 302 to /signin
    const req3 = await fetch(`${base}/lab/expiring`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    });
    expect(req3.status).toBe(302);
    expect(req3.headers.get('location')).toContain('/signin');

    // Request 4: still 302 to /signin
    const req4 = await fetch(`${base}/lab/expiring`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    });
    expect(req4.status).toBe(302);
    expect(req4.headers.get('location')).toContain('/signin');
  });

  it('signIns increments on POST /signin and resets on POST /lab/reset', async () => {
    await fetch(`${base}/lab/reset`, { method: 'POST' });

    const statsBefore = await (await fetch(`${base}/lab/stats`)).json();
    expect(statsBefore.signIns).toBe(0);

    const signinRes = await fetch(`${base}/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=manager%40example.com&password=manager-password',
      redirect: 'manual',
    });
    expect(signinRes.status).toBe(302);

    const statsAfter = await (await fetch(`${base}/lab/stats`)).json();
    expect(statsAfter.signIns).toBe(1);

    await fetch(`${base}/lab/reset`, { method: 'POST' });
    const statsReset = await (await fetch(`${base}/lab/stats`)).json();
    expect(statsReset.signIns).toBe(0);
  });

  it('serves SPA login, hash, calendar, and onclick routes', async () => {
    const spaLogin = await (await fetch(`${base}/lab/spa-login`)).text();
    expect(spaLogin).toContain('id="login-container"');

    const hash = await (await fetch(`${base}/lab/hash`)).text();
    expect(hash).toContain('id="heading"');
    expect(hash).toContain('#/one');

    const cal = await (await fetch(`${base}/lab/calendar?month=2026-10`)).text();
    expect(cal).toContain('month=2026-09');
    expect(cal).toContain('month=2026-11');

    const onclick = await (await fetch(`${base}/lab/onclick`)).text();
    expect(onclick).toContain('/lab/onclick/target');

    const overlay = await (await fetch(`${base}/lab/overlay`)).text();
    expect(overlay).toContain('id="accept"');

    const index = await (await fetch(`${base}/lab/index`)).text();
    expect(index).toContain('/lab/spa-late');
    expect(index).toContain('/lab/expiring');
  });
});
