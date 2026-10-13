/** The Spider opens tabs, accordions, drawers and dialogs, records what opens them, and sends nothing (ADR 0025). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import { chromium, type Browser } from 'playwright';
import { DeterministicSpider } from '../src/discovery/deterministic-spider.js';
import { openerCandidates } from '../src/discovery/interactive-states.js';
import { server } from '../../../fixtures/test-app/server.js';

let browser: Browser;
let base: string;

async function crawl(path: string) {
  const context = await browser.newContext();
  try {
    return await new DeterministicSpider([], 1).crawl(context, `${base}${path}`);
  } finally {
    await context.close();
  }
}
const stats = async () => (await fetch(`${base}/lab/stats`)).json() as Promise<{ posts: number; deletes: number }>;

describe('Spider: Interactive States', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('records the click that opens a form hidden in a tab, an accordion and a drawer', async () => {
    await fetch(`${base}/lab/stats/reset`);
    const { forms } = await crawl('/lab/tabs');
    const opening = (field: string) => forms.find((f) => f.inputs.some((i) => i.name === field))?.opening;
    expect(opening('email')?.[0]).toMatchObject({ action: 'click', opening: true, selector: '#tab-b' });
    expect(opening('note')?.[0]).toMatchObject({ action: 'click', opening: true });
    expect(opening('name')?.[0]).toMatchObject({ action: 'click', opening: true, selector: '#open-drawer' });
    expect(await stats()).toMatchObject({ posts: 0, deletes: 0 });
  });

  it('records the button that opens a dialog form', async () => {
    const { forms } = await crawl('/lab/modal');
    const form = forms.find((f) => f.inputs.some((i) => i.name === 'subject'));
    expect(form?.opening?.[0]).toMatchObject({ action: 'click', opening: true, selector: '#open-modal' });
  });

  it('gives a form that is visible from the start no opening steps', async () => {
    const { forms } = await crawl('/lab/modal');
    expect(forms.filter((f) => !f.opening)).toHaveLength(0);
  });

  it('does not offer a control that deletes or sits in a form as an opener', () => {
    const el = (name: string, extra = {}) => ({
      role: 'button',
      name,
      selector: `#${name}`,
      tagName: 'button',
      visible: true,
      enabled: true,
      ...extra,
    });
    const found = openerCandidates([el('Add item'), el('Plain'), el('Menu', { toggles: true })]).map((e) => e.name);
    expect(found).toEqual(['Add item', 'Menu']);
  });
});
