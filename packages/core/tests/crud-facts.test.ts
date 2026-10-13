/** CRUD facts come from structure; the Delete probe cancels at the confirm and sends nothing (ADR 0025). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { chromium, type Browser } from 'playwright';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';
import { inferCrud } from '../src/discovery/crud-facts.js';
import { server as fixture } from '../../../fixtures/test-app/server.js';

describe('inferCrud', () => {
  it('reads a list with Add, row Edit and row Delete', () => {
    expect(
      inferCrud({ listRows: 2, addNames: ['Home', 'Add item'], rowControlNames: ['Edit', 'Delete', 'Edit', 'Delete'] })
    ).toEqual({ list: true, add: 'Add item', editFromRow: true });
  });
  it('is nothing for a page with no rows, or rows with no managing controls', () => {
    expect(inferCrud({ listRows: 0, addNames: ['Add item'], rowControlNames: [] })).toBeUndefined();
    expect(inferCrud({ listRows: 3, addNames: ['Home'], rowControlNames: ['View'] })).toBeUndefined();
  });
});

describe('CRUD facts and the Delete probe', () => {
  let browser: Browser;
  let base: string;
  let noConfirm: http.Server;
  let noConfirmBase: string;
  const hits: string[] = [];

  beforeAll(async () => {
    await new Promise<void>((resolve) => fixture.listen(0, resolve));
    base = `http://localhost:${(fixture.address() as AddressInfo).port}`;
    noConfirm = http.createServer((req, res) => {
      if (req.method !== 'GET') {
        hits.push(req.method ?? '');
        res.writeHead(200).end('{}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><html lang="en"><head><title>Rows</title></head><body><h1>Rows</h1>
<table><tbody><tr><td>A</td><td><button id="d">Delete</button></td></tr></tbody></table>
<script>document.getElementById('d').addEventListener('click', () => fetch('/x', { method: 'DELETE' }));</script></body></html>`);
    });
    await new Promise<void>((resolve) => noConfirm.listen(0, resolve));
    noConfirmBase = `http://localhost:${(noConfirm.address() as AddressInfo).port}`;
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => fixture.close(() => resolve()));
    await new Promise<void>((resolve) => noConfirm.close(() => resolve()));
  });

  async function crawl(url: string, forbidden: string[] = []) {
    const context = await browser.newContext();
    try {
      return await new DeterministicSpider(forbidden, 1).crawl(context, url);
    } finally {
      await context.close();
    }
  }

  it('reports the list, Add, Edit and a Delete confirm on /lab/crud, and deletes nothing', async () => {
    await fetch(`${base}/lab/stats/reset`);
    const { pages } = await crawl(`${base}/lab/crud`);
    expect(pages[0].crud).toEqual({ list: true, add: 'Add item', editFromRow: true, deleteConfirm: true });
    expect(await (await fetch(`${base}/lab/stats`)).json()).toMatchObject({ deletes: 0, posts: 0 });
  });

  it('reports no confirm when Delete acts at once, and the request never leaves the browser', async () => {
    hits.length = 0;
    const { pages } = await crawl(`${noConfirmBase}/`);
    expect(pages[0].crud?.deleteConfirm).toBe(false);
    expect(hits).toEqual([]);
  });

  it('does not probe when the person forbade deleting', async () => {
    hits.length = 0;
    const { pages } = await crawl(`${noConfirmBase}/`, ['delete']);
    expect(pages[0].crud?.deleteConfirm).toBeUndefined();
    expect(hits).toEqual([]);
  });
});
