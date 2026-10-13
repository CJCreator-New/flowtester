import type { Page } from 'playwright';
import type { ElementInventoryItem, TestCaseStep } from '@qa/types';
import type { DiscoveredFormInfo } from './deterministic-spider.js';
import { guardPage } from './guard.js';

/** A form as read off the page right now, with whether a person could see it. */
export type ReadForm = Omit<DiscoveredFormInfo, 'urlPath'> & { visible: boolean };

/** Plain buttons that usually open a dialog or panel (they carry no aria attributes). */
const OPENER_WORDS = /^(new|add|create|open|compose|write|show|more)\b/i;
export const MAX_OPENERS_PER_PAGE = 6;

/** Same form across reads: where it sends, how, and which fields it has. */
export function formKey(f: Pick<DiscoveredFormInfo, 'action' | 'method' | 'inputs'>): string {
  return `${f.method}|${f.action}|${f.inputs.map((i) => i.selector).join(',')}`;
}

/** Controls that open something: tabs, accordions, drawers, dialogs. Pure; the caller applies the Safety Filter. */
export function openerCandidates(elements: ElementInventoryItem[]): ElementInventoryItem[] {
  const seen = new Set<string>();
  const out: ElementInventoryItem[] = [];
  for (const el of elements) {
    const opens =
      el.role === 'tab' ||
      el.tagName.toLowerCase() === 'summary' ||
      el.toggles === true ||
      (el.role === 'button' && OPENER_WORDS.test(el.name));
    if (!opens || seen.has(el.selector)) continue;
    seen.add(el.selector);
    out.push(el);
  }
  return out;
}

/**
 * Opens each tab, accordion, drawer or dialog once and records the forms that only show up then,
 * with the click that opens them. Nothing is submitted, no control inside a form is clicked, and
 * requests that change things are aborted (guardPage). The page is reloaded between openers.
 * Returns the clicks spent.
 */
export async function exploreInteractiveStates(args: {
  page: Page;
  pageUrl: string;
  currentPath: string;
  elements: ElementInventoryItem[];
  /** Safety Filter and risky-name checks; the opener must pass. */
  isSafe: (el: ElementInventoryItem) => boolean;
  readForms: (page: Page) => Promise<ReadForm[]>;
  /** Forms recorded so far for the whole crawl; openings are added to matching ones, new ones are pushed. */
  allForms: DiscoveredFormInfo[];
  reload: () => Promise<void>;
  budget: number;
}): Promise<number> {
  const { page, pageUrl, currentPath, allForms } = args;
  const openers = openerCandidates(args.elements)
    .filter((el) => el.visible && el.enabled && !el.insideForm && !el.transient && args.isSafe(el))
    .slice(0, Math.min(MAX_OPENERS_PER_PAGE, args.budget));
  if (openers.length === 0) return 0;

  const guard = await guardPage(page);
  let spent = 0;
  let dirty = false;
  try {
    for (const el of openers) {
      spent++;
      try {
        // A summary has no button role for Playwright to find it by, so it is found by its text.
        const selector =
          el.tagName.toLowerCase() === 'summary' ? `summary:has-text(${JSON.stringify(el.name)})` : el.selector;
        if (dirty || page.url() !== pageUrl) await args.reload();
        dirty = true;
        const before = await args.readForms(page);
        await page.locator(selector).first().click({ timeout: 3000 });
        await page.waitForTimeout(400);
        if (page.url() !== pageUrl) continue;
        const after = await args.readForms(page);
        const step: TestCaseStep = {
          action: 'click',
          selector,
          name: `Open ${el.name}`,
          opening: true,
        };
        for (const f of after) {
          if (!f.visible) continue;
          const key = formKey(f);
          if (before.some((b) => b.visible && formKey(b) === key)) continue;
          const known = allForms.find((k) => k.urlPath === currentPath && formKey(k) === key);
          if (known) {
            known.opening ??= [step];
          } else {
            const { visible: _visible, ...rest } = f;
            allForms.push({ ...rest, urlPath: currentPath, opening: [step] });
          }
        }
      } catch {
        // Not clickable after all; move on.
      }
    }
  } finally {
    await guard.release();
  }
  return spent;
}
