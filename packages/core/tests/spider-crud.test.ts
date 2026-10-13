/** Delete probe safety (ADR 0025): the Spider reports CRUD facts and cancels at the confirm; nothing is deleted or sent. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import { chromium, type Browser } from 'playwright';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';
import { guardPage } from '../src/discovery/guard.js';
import { server } from '../../../fixtures/test-app/server.js';

let browser: Browser;
let base: string;
const stats = async () => (await fetch(`${base}/lab/stats`)).json() as Promise<{ posts: number; deletes: number; cancelledDeletes: number }>;

describe('Spider: CRUD facts and Delete probe', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('reports CRUD facts for /lab/crud, sends no POST/DELETE, and the rows survive', async () => {
    await fetch(`${base}/lab/stats/reset`);
    const context = await browser.newContext();
    let pages;
    try {
      ({ pages } = await new DeterministicSpider([], 1).crawl(context, `${base}/lab/crud`));
    } finally {
      await context.close();
    }
    const crud = pages.find((p) => p.urlPath === '/lab/crud')?.crud;
    expect(crud).toMatchObject({ list: true, editFromRow: true, deleteConfirm: true });
    const s = await stats();
    expect(s.deletes).toBe(0);
    expect(s.posts).toBe(0);
  });

  it('guardPage aborts a delete sent with no confirm, and dismisses dialogs', async () => {
    await fetch(`${base}/lab/stats/reset`);
    const page = await browser.newPage();
    try {
      await page.goto(`${base}/lab/done`);
      const guard = await guardPage(page);
      const result = await page.evaluate(async () => {
        try {
          await fetch('/lab/items/1', { method: 'DELETE' });
          return 'sent';
        } catch {
          return 'blocked';
        }
      });
      const confirmed = await page.evaluate(() => confirm('sure?'));
      await guard.release();
      expect(result).toBe('blocked');
      expect(confirmed).toBe(false);
      expect(guard.blocked).toContain('DELETE');
      expect((await stats()).deletes).toBe(0);
    } finally {
      await page.close();
    }
  });
});
