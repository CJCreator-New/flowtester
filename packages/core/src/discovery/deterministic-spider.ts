import { promises as fs } from 'fs';
import path from 'path';
import type { BrowserContext, Page } from 'playwright';
import type { TestCaseStep, PageInventoryItem, SensitiveAction, AmbiguityQuestion, ElementInventoryItem, PageLink } from '@qa/types';
import { SafetyFilter } from './safety-filter.js';
import { collectElementInventory, TEST_ID_ATTRIBUTES } from './element-inventory.js';
import { redactUrl } from '../redact.js';
import { isSameSite } from '../same-site.js';
import { readLayoutFingerprint } from '../competitive/safe-crawler.js';
import type { RobotsPolicy } from '../competitive/robots.js';
import { exploreInteractiveStates, type ReadForm } from './interactive-states.js';
import { inferCrud, readCrudStructure, probeDeleteConfirm } from './crud-facts.js';

export interface FormInputInfo {
  /** The HTML name attribute (may be empty). */
  name: string;
  /** What a person would call the field: its label, then placeholder, then id, then name attribute. */
  label: string;
  type: string;
  selector: string;
  defaultValue?: string;
  required?: boolean;
  pattern?: string;
  min?: string;
  max?: string;
  minLength?: number;
  maxLength?: number;
}

export interface DiscoveredFormInfo {
  id?: string;
  action: string;
  method: string;
  urlPath: string;
  inputs: FormInputInfo[];
  submitButtonSelector?: string;
  /** Steps that open the form first (a tab, drawer or dialog), recorded while exploring. */
  opening?: TestCaseStep[];
}

export interface SpiderResult {
  pages: PageInventoryItem[];
  forms: DiscoveredFormInfo[];
  sensitiveActions: SensitiveAction[];
  ambiguityQuestions: AmbiguityQuestion[];
  /** Pages that sent the crawler to a sign-in form instead of opening. */
  signInWalls: string[];
  /** Same-site pages robots.txt asked crawlers to leave alone. */
  skippedByRobots?: string[];
  /** Pages found but not reached, and why. Paths only, never a query string. */
  skipped?: SkippedPage[];
}

export interface SkippedPage {
  urlPath: string;
  why: 'page-limit' | 'did-not-load' | 'robots' | 'sign-in';
}

export interface CrawlOptions {
  /** Where to start besides the target URL, e.g. the page a role landed on after signing in. */
  startPaths?: string[];
  /** Click script-driven links and navigation buttons to find pages links alone don't reach. Default true. */
  exploreClicks?: boolean;
  /** Pages robots.txt asks crawlers to leave alone are skipped (public sites). */
  robots?: RobotsPolicy;
  /** Minimum pause between page loads, to go easy on a site we don't own. Default 100ms. */
  pageDelayMs?: number;
  /** Number of concurrent page evaluations (1 to 5, default 2). */
  concurrency?: number;
  /** Custom HTTP headers sent with every request (e.g. X-QA-Bypass-Token). */
  customHeaders?: Record<string, string>;
  /** Folder for a small screenshot of each page, shown on the plan map. None when absent. */
  screenshotDir?: string;
  /** Start of each screenshot's file name, so crawls as different roles don't overwrite each other. */
  screenshotPrefix?: string;
  /** Told about each page as it's recorded, for progress. */
  onPage?: (page: PageInventoryItem, pagesSoFar: number, forms: SpiderResult['forms']) => void;
  /** Once aborted, no more pages are opened: the crawl returns what it found so far. */
  signal?: AbortSignal;
}

/** Links and buttons that would end a signed-in session. */
export const SESSION_ENDING = /log\s*-?\s*out|sign\s*-?\s*out|log\s*off|signoff/i;
/** Never clicked while exploring: they change or send things. */
export const RISKY_TO_CLICK =
  /reset|delete|remove|destroy|clear|cancel|pay|purchase|buy|place order|subscribe|send|submit|finish|confirm|save|apply|upload|download|print|share|invite|deactivate|close/i;
/** Buttons whose name suggests they only move to another screen. */
const NAVIGATION_WORDS =
  /checkout|cart|basket|bag|view|details|more|next|continue|back|browse|shop|start|explore|profile|account|settings|dashboard|home|open/i;
const MAX_CLICKS_PER_PAGE = 8;
const MAX_EXPLORATION_CLICKS = 100;
/** Pages a crawl visits at most: enough to list a whole site, not so many that a shop's catalogue runs for hours. */
export const DEFAULT_MAX_PAGES = 200;

/**
 * The page's visible links and where each goes, from its element inventory: the facts Navigation
 * Checks are planned from. Links that end a session, open mail or phone apps, or point at the same
 * page from its content are left out. A link on the site keeps only its path, the way pages are told apart.
 */
export function pageLinks(elements: ElementInventoryItem[], pageUrl: string, onSite: (u: URL) => boolean): PageLink[] {
  const here = new URL(pageUrl);
  const links: PageLink[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (el.role !== 'link' || !el.href || !el.visible || el.transient) continue;
    if (el.href.startsWith('#') || /^(javascript|mailto|tel|sms):/i.test(el.href)) continue;
    if (SESSION_ENDING.test(el.name) || SESSION_ENDING.test(el.href)) continue;
    let target: URL;
    try {
      target = new URL(el.href, pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(target.protocol) || seen.has(el.selector)) continue;
    const leavesSite = !onSite(target);
    // A link to this same page is kept in a menu (the menu is the same on every page) but not in the content.
    if (!leavesSite && target.pathname === here.pathname && !el.landmark) continue;
    seen.add(el.selector);
    links.push({
      name: el.name,
      selector: el.selector,
      to: leavesSite ? redactUrl(target.origin + target.pathname + target.search) : target.pathname,
      leavesSite: leavesSite || undefined,
      landmark: el.landmark,
    });
  }
  return links;
}

/** A short fingerprint of a page's controls and forms: the same on the next run when the page hasn't changed. */
export function contentKeyOf(elements: ElementInventoryItem[], formCount: number): string {
  const text = [...elements.map((el) => `${el.role}|${el.name}|${el.selector}`).sort(), `forms:${formCount}`].join(
    '\n'
  );
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

/** Every form on the page as it is now, with whether a person could see it. */
export async function readPageForms(page: Page): Promise<ReadForm[]> {
  return page.$$eval(
      'form',
      (formEls, testIdAttributes) =>
        formEls.map((f) => {
          const action = f.getAttribute('action') || '';
          const method = (f.getAttribute('method') || 'GET').toUpperCase();
          const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();
          const testIdSelector = (el: Element) => {
            const attr = testIdAttributes.find((a) => el.hasAttribute(a));
            return attr ? `[${attr}="${el.getAttribute(attr)}"]` : null;
          };
          const inputs = Array.from(f.querySelectorAll('input:not([type="hidden"]), select, textarea')).map(
            (inp) => {
              const name = inp.getAttribute('name') || '';
              const type = inp.getAttribute('type') || inp.tagName.toLowerCase();
              const id = inp.getAttribute('id');
              const ariaLabel = clean(inp.getAttribute('aria-label'));
              const placeholder = clean(inp.getAttribute('placeholder'));
              const selector =
                testIdSelector(inp) ||
                (id
                  ? `#${id}`
                  : name
                    ? `[name="${name}"]`
                    : ariaLabel
                      ? `[aria-label="${ariaLabel}"]`
                      : placeholder
                        ? `[placeholder="${placeholder}"]`
                        : `${inp.tagName.toLowerCase()}[type="${type}"]`);
              const required = inp.hasAttribute('required');
              const forLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
              const wrapping = inp.closest('label')?.cloneNode(true) as Element | undefined;
              wrapping?.querySelectorAll('input, select, textarea').forEach((c) => c.remove());
              // What a person would call the field: its label, then placeholder, then id, then name.
              const label =
                clean(inp.getAttribute('aria-label')) ||
                clean(forLabel?.textContent) ||
                clean(wrapping?.textContent) ||
                clean(inp.getAttribute('placeholder')) ||
                clean(id) ||
                name;
              const attr = (n: string) => inp.getAttribute(n) ?? undefined;
              const num = (n: string) => {
                const v = inp.getAttribute(n);
                return v !== null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
              };
              return {
                name,
                label,
                type,
                selector,
                required,
                pattern: attr('pattern'),
                min: attr('min'),
                max: attr('max'),
                minLength: num('minlength'),
                maxLength: num('maxlength'),
              };
            }
          );

          const submitBtn = f.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
          let submitSelector: string | undefined;
          if (submitBtn) {
            const sTestId = testIdSelector(submitBtn);
            const sId = submitBtn.getAttribute('id');
            submitSelector = sTestId
              ? sTestId
              : sId
                ? `#${sId}`
                : submitBtn.tagName.toLowerCase() === 'input'
                  ? 'input[type="submit"]'
                  : 'button[type="submit"]';
          }

          // checkVisibility also sees through a closed <details>, which keeps its content out of the layout.
          const visible = f.getClientRects().length > 0 && f.checkVisibility({ checkVisibilityCSS: true });
          return { action, method, inputs, submitButtonSelector: submitSelector, visible };
        }),
      TEST_ID_ATTRIBUTES
    );
}

export class DeterministicSpider {
  private safetyFilter: SafetyFilter;
  private maxPages: number;

  constructor(forbiddenActions: string[] = [], maxPages = DEFAULT_MAX_PAGES) {
    this.safetyFilter = new SafetyFilter(forbiddenActions);
    this.maxPages = maxPages;
  }

  async crawl(context: BrowserContext, targetUrl: string, options: CrawlOptions = {}): Promise<SpiderResult> {
    const concurrency = Math.max(1, Math.min(5, options.concurrency ?? 2));
    const pageDelayMs = options.pageDelayMs !== undefined ? options.pageDelayMs : 100;

    if (options.customHeaders && Object.keys(options.customHeaders).length > 0) {
      await context.setExtraHTTPHeaders(options.customHeaders).catch(() => {});
    }

    const baseUrlObj = new URL(targetUrl);
    // The site is where the start address lands: example.com that redirects to www.example.com is
    // crawled as www.example.com. Until a page has opened, it's the address as typed.
    let site = new URL(baseUrlObj.origin);
    let landedOnce = false;
    const onSite = (u: URL) => isSameSite(u.host, site.host);
    const exploreClicks = options.exploreClicks ?? true;

    // Pages are told apart by path; the first query string seen for a path is kept so the page
    // can be reopened (e.g. /item?id=4 in a single-page app).
    const visited = new Set<string>();
    const queued = new Set<string>();
    const queue: string[] = [];

    let activeWorkers = 0;
    let idleResolvers: (() => void)[] = [];
    const notifyWork = () => {
      const resolvers = idleResolvers;
      idleResolvers = [];
      for (const r of resolvers) r();
    };
    const onAbort = () => notifyWork();
    options.signal?.addEventListener('abort', onAbort, { once: true });

    const enqueue = (pathAndSearch: string) => {
      const key = new URL(pathAndSearch, targetUrl).pathname;
      if (visited.has(key) || queued.has(key)) return;
      queued.add(key);
      queue.push(pathAndSearch);
      notifyWork();
    };
    for (const start of [...(options.startPaths || []), baseUrlObj.pathname + baseUrlObj.search || '/']) enqueue(start);

    const pages: PageInventoryItem[] = [];
    const forms: DiscoveredFormInfo[] = [];
    const sensitiveActions: SensitiveAction[] = [];
    const ambiguityQuestions: AmbiguityQuestion[] = [];
    const signInWalls: string[] = [];
    const skippedByRobots: string[] = [];
    const skipped: SkippedPage[] = [];
    /** Addresses the site redirected elsewhere on the site, so a link to one is expected to land on the other. */
    const redirects = new Map<string, string>();
    let questionCounter = 1;
    let clickBudget = MAX_EXPLORATION_CLICKS;
    let screenshotIndex = 0;
    if (options.screenshotDir) await fs.mkdir(options.screenshotDir, { recursive: true });

    const waitForWork = () =>
      new Promise<void>((resolve) => {
        if (options.signal?.aborted) return resolve();
        let done = false;
        const timer = setTimeout(() => {
          if (!done) {
            done = true;
            idleResolvers = idleResolvers.filter((r) => r !== onWake);
            resolve();
          }
        }, 50);
        const onWake = () => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve();
          }
        };
        idleResolvers.push(onWake);
      });

    const evaluatePage = async (
      page: Page,
      requested: string,
      requestedPath: string,
      getLastLoadAt: () => number,
      setLastLoadAt: (t: number) => void
    ) => {
      const fullUrl = new URL(requested, site).toString();
      if (options.robots && !options.robots.isAllowed(requested)) {
        skippedByRobots.push(requestedPath);
        skipped.push({ urlPath: requestedPath, why: 'robots' });
        return;
      }

      try {
        // Go easy on sites we don't own: a pause between page loads (default 100ms per FR-1.7).
        if (pageDelayMs > 0) {
          const waitMs = Math.max(0, getLastLoadAt() + pageDelayMs - Date.now());
          if (waitMs > 0) await page.waitForTimeout(waitMs);
        }
        setLastLoadAt(Date.now());
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const landed = new URL(page.url());
        const hasSignInForm = (await page.locator('input[type="password"]').count()) > 0;

        // Sent somewhere else to sign in: the requested page is behind a sign-in. A start address
        // that lands on another host's sign-in form (a company sign-in service) doesn't move the site.
        if (landed.pathname !== requestedPath && hasSignInForm) {
          signInWalls.push(requestedPath);
          skipped.push({ urlPath: requestedPath, why: 'sign-in' });
          if (onSite(landed)) {
            // A link there lands on the sign-in page for whoever is exploring.
            redirects.set(requestedPath, landed.pathname);
            enqueue(landed.pathname + landed.search);
          }
          return;
        }
        if (!landedOnce) {
          landedOnce = true;
          if (/^https?:$/.test(landed.protocol)) site = new URL(landed.origin);
        }
        // Redirected off the site: not one of its pages.
        if (!onSite(landed)) {
          skipped.push({ urlPath: requestedPath, why: 'did-not-load' });
          return;
        }
        // Redirected within the site: the page is recorded once, under the address it really has.
        if (landed.pathname !== requestedPath) {
          redirects.set(requestedPath, landed.pathname);
          if (visited.has(landed.pathname)) return;
          visited.add(landed.pathname);
        }
        const pageUrl = page.url();
        // Recorded without secrets: some sign-in forms put the password in the address.
        const currentPath = redactUrl(landed.pathname + landed.search);
        const title = await page.title().catch(() => currentPath);

        // 1. Discover links (never the ones that would end a signed-in session or are transient)
        const hrefs = await page.$$eval('a[href]', (anchors) =>
          anchors
            .filter((a) => !a.closest('[data-transient="true"]'))
            .map((a) => ({ href: a.getAttribute('href') || '', text: (a.textContent || '').trim() }))
        );

        for (const { href, text } of hrefs) {
          try {
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
            if (SESSION_ENDING.test(href) || SESSION_ENDING.test(text)) continue;
            const resolved = new URL(href, pageUrl);
            if (onSite(resolved)) enqueue(resolved.pathname + resolved.search);
          } catch {
            // invalid URL ignored
          }
        }

        // 2. Discover interactive elements and check safety
        const elements = await collectElementInventory(page);
        const links = pageLinks(elements, pageUrl, onSite);

        for (const el of elements) {
          if (el.role !== 'button' && el.role !== 'link' && el.inputType !== 'submit') continue;
          const sensitive = this.safetyFilter.isSensitive(el.name, el.selector);
          if (sensitive) {
            sensitive.urlPath = currentPath;
            sensitiveActions.push(sensitive);
            const q = this.safetyFilter.createAmbiguityQuestion(sensitive, questionCounter++);
            ambiguityQuestions.push(q);
          }
        }

        // 3. Discover Forms
        const pageForms = (await readPageForms(page)).map(({ visible: _v, ...f }) => f);

        for (const f of pageForms) {
          forms.push({
            action: f.action,
            method: f.method,
            urlPath: currentPath,
            inputs: f.inputs,
            submitButtonSelector: f.submitButtonSelector,
          });
        }

        // The fingerprint itself names the group: the same template gets the same name in every
        // crawl (signed out or as any role) and on every run.
        const fingerprint = await readLayoutFingerprint(page);
        let screenshotPath: string | undefined;
        if (options.screenshotDir) {
          screenshotIndex++;
          screenshotPath = path.join(
            options.screenshotDir,
            `${options.screenshotPrefix || 'page'}-${screenshotIndex}.jpg`
          );
          await page
            .screenshot({ path: screenshotPath, type: 'jpeg', quality: 55 })
            .catch(() => (screenshotPath = undefined));
        }

        const pageItem: PageInventoryItem = {
          urlPath: currentPath,
          title,
          interactiveElementsCount: elements.length,
          formsCount: pageForms.length,
          elements,
          hasSignInForm: hasSignInForm || undefined,
          layoutGroup: fingerprint ? `layout-${fingerprint}` : undefined,
          screenshotPath,
          links,
          contentKey: contentKeyOf(elements, pageForms.length),
        };
        pages.push(pageItem);
        options.onPage?.(pageItem, pages.length, forms.slice(forms.length - pageForms.length));

        // 4. Single-page apps navigate by script: try the controls that look like navigation.
        if (exploreClicks && clickBudget > 0) {
          const tried = new Set<string>();
          const candidates = elements.filter((el) => {
            const key = el.name.toLowerCase();
            if (tried.has(key) || !this.isSafeToExplore(el)) return false;
            tried.add(key);
            return true;
          });
          for (const el of candidates.slice(0, MAX_CLICKS_PER_PAGE)) {
            if (clickBudget-- <= 0) break;
            try {
              if (page.url() !== pageUrl) {
                if (pageDelayMs > 0) {
                  const waitMs = Math.max(0, getLastLoadAt() + pageDelayMs - Date.now());
                  if (waitMs > 0) await page.waitForTimeout(waitMs);
                }
                setLastLoadAt(Date.now());
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
              }
              await page.locator(el.selector).first().click({ timeout: 3000 });
              await page.waitForTimeout(600);
              const after = new URL(page.url());
              if (onSite(after) && after.pathname !== landed.pathname) {
                enqueue(after.pathname + after.search);
                // A button or script link that moved to another page is navigation too.
                if (!links.some((l) => l.selector === el.selector)) {
                  links.push({
                    name: el.name,
                    selector: el.selector,
                    to: after.pathname,
                    scripted: true,
                    landmark: el.landmark,
                  });
                }
              }
            } catch {
              // Not clickable after all; move on.
            }
          }
        }

        // 5. Tabs, accordions, drawers and dialogs hide forms; list pages show how they are managed.
        // Guarded (ADR 0025): nothing is submitted, changing requests are aborted, dialogs dismissed.
        if (exploreClicks && clickBudget > 0 && onSite(landed)) {
          const reload = async () => {
            if (pageDelayMs > 0) {
              const waitMs = Math.max(0, getLastLoadAt() + pageDelayMs - Date.now());
              if (waitMs > 0) await page.waitForTimeout(waitMs);
            }
            setLastLoadAt(Date.now());
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          };
          try {
            clickBudget -= await exploreInteractiveStates({
              page,
              pageUrl,
              currentPath,
              elements,
              isSafe: (el) => this.isSafeOpener(el),
              readForms: readPageForms,
              allForms: forms,
              reload,
              budget: clickBudget,
            });
            if (page.url() !== pageUrl) await reload();
            const structure = await readCrudStructure(page);
            const crud = structure && inferCrud(structure);
            if (crud) {
              pageItem.crud = crud;
              // Heavily guarded probe: only a plain per-row delete, only when the Safety Filter sees an
              // ordinary deletion (a forbidden action keyword switches the probe off).
              if (
                structure.hasProbeTarget &&
                clickBudget > 0 &&
                this.safetyFilter.isSensitive('Delete', '')?.type === 'deletion'
              ) {
                clickBudget--;
                const confirmed = await probeDeleteConfirm(page);
                if (confirmed !== undefined) crud.deleteConfirm = confirmed;
              }
            }
          } catch {
            // Exploring states is a bonus; the page itself is already recorded.
          }
        }
      } catch {
        // Skip page on navigation failure
        skipped.push({ urlPath: requestedPath, why: 'did-not-load' });
      }
    };

    const runWorker = async () => {
      let workerPage: Page | null = null;
      try {
        workerPage = await context.newPage();
      } catch {
        return;
      }
      let lastLoadAt = 0;
      try {
        while (!options.signal?.aborted && visited.size < this.maxPages) {
          let requested: string | null = null;
          let requestedPath = '';

          while (queue.length > 0) {
            const item = queue.shift()!;
            const p = new URL(item, targetUrl).pathname;
            if (!visited.has(p)) {
              visited.add(p);
              requested = item;
              requestedPath = p;
              break;
            }
          }

          if (requested) {
            activeWorkers++;
            try {
              await evaluatePage(workerPage, requested, requestedPath, () => lastLoadAt, (t) => { lastLoadAt = t; });
            } finally {
              activeWorkers--;
              notifyWork();
            }
          } else {
            if (activeWorkers === 0 || visited.size >= this.maxPages || options.signal?.aborted) {
              break;
            }
            await waitForWork();
          }
        }
      } finally {
        await workerPage.close().catch(() => {});
      }
    };

    const workers = Array.from({ length: concurrency }, () => runWorker());
    await Promise.all(workers);
    options.signal?.removeEventListener('abort', onAbort);

    // When the person stops the scan (abort), the queue left over is not listed as skipped on purpose:
    // 'page-limit' would be inaccurate, and the report carries a "you stopped the scan" note instead.
    // Still queued when the page limit ended the crawl: found, never opened.
    if (visited.size >= this.maxPages && !options.signal?.aborted) {
      for (const left of queue) {
        const leftPath = new URL(left, targetUrl).pathname;
        if (!visited.has(leftPath)) skipped.push({ urlPath: leftPath, why: 'page-limit' });
      }
    }

    // A link to an address the site redirects is expected to land where the redirect goes.
    for (const recorded of pages) {
      for (const link of recorded.links || []) {
        const lands = link.leavesSite ? undefined : redirects.get(link.to);
        if (lands && lands !== link.to) link.landsOn = lands;
      }
    }

    return {
      pages,
      forms,
      sensitiveActions,
      ambiguityQuestions,
      signInWalls,
      skippedByRobots: skippedByRobots.length > 0 ? skippedByRobots : undefined,
      skipped: skipped.length > 0 ? skipped : undefined,
    };
  }

  /** Controls that may be opened to look for forms: not risky, not sensitive, not ending a session. */
  private isSafeOpener(el: ElementInventoryItem): boolean {
    if (!el.visible || !el.enabled || el.insideForm) return false;
    if (RISKY_TO_CLICK.test(el.name) || SESSION_ENDING.test(el.name)) return false;
    return !this.safetyFilter.isSensitive(el.name, el.selector);
  }

  /** Controls worth clicking to find script-driven pages: navigation-like, never risky. */
  private isSafeToExplore(el: ElementInventoryItem): boolean {
    if (!el.visible || !el.enabled || el.insideForm) return false;
    if (RISKY_TO_CLICK.test(el.name) || SESSION_ENDING.test(el.name)) return false;
    if (this.safetyFilter.isSensitive(el.name, el.selector)) return false;
    const scriptLink = el.role === 'link' && (!el.href || el.href === '#' || el.href.startsWith('javascript:'));
    const navButton = el.role === 'button' && NAVIGATION_WORDS.test(el.name);
    return scriptLink || navButton;
  }
}
