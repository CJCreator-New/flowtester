import { promises as fs } from 'fs';
import path from 'path';
import type { BrowserContext, Page } from 'playwright';
import type {
  TestCaseStep,
  PageInventoryItem,
  SensitiveAction,
  AmbiguityQuestion,
  ElementInventoryItem,
  PageLink,
  RouteTelemetry,
  SkippedPageInfo,
  RouteSkipReason,
} from '@qa/types';
import { SafetyFilter } from './safety-filter.js';
import { collectElementInventory, TEST_ID_ATTRIBUTES } from './element-inventory.js';
import { redactUrl } from '../redact.js';
import { isSameSite } from '../same-site.js';
import { readLayoutFingerprint } from '../competitive/safe-crawler.js';
import type { RobotsPolicy } from '../competitive/robots.js';
import { exploreInteractiveStates, type ReadForm } from './interactive-states.js';
import { inferCrud, readCrudStructure, probeDeleteConfirm } from './crud-facts.js';
import { navigate, toTelemetry, looksLikeLogin } from '../navigate.js';
import { debugLog } from '../debug-log.js';

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

export interface SpiderPageInventoryItem extends PageInventoryItem {
  exploreErrors?: number;
}

export interface SpiderResult {
  pages: SpiderPageInventoryItem[];
  forms: DiscoveredFormInfo[];
  sensitiveActions: SensitiveAction[];
  ambiguityQuestions: AmbiguityQuestion[];
  /** Pages that sent the crawler to a sign-in form instead of opening. */
  signInWalls: string[];
  /** Same-site pages robots.txt asked crawlers to leave alone. */
  skippedByRobots?: string[];
  /** Pages found but not reached, and why. Paths only, never a query string. */
  skipped?: SkippedPageInfo[];
  routes?: RouteTelemetry[];
  sessionLost?: boolean;
  startRedirectedOffSite?: boolean;
}

export type SkippedPage = SkippedPageInfo;

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
  /** Maximum navigation attempts before giving up (default maxPages * 3) */
  maxAttempts?: number;
  /** Known login paths for detecting bounce / auth walls */
  knownLoginPaths?: string[];
  /** How many consecutive sign-in walls / 401s before session is declared lost (default 3) */
  stopAfterWalls?: number;
  /** Role name (e.g. 'visitor', 'admin', 'manager') */
  role?: string;
  /** Whether the crawl is signed in */
  isSignedIn?: boolean;
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

function isLoopback(h: string): boolean {
  const hostWithoutPort = h.replace(/:\d+$/, '').toLowerCase();
  return hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1';
}

function isSameSiteOrLoopback(h1: string, h2: string): boolean {
  if (isSameSite(h1, h2)) return true;
  const p1 = h1.match(/:(\d+)$/)?.[1] || '';
  const p2 = h2.match(/:(\d+)$/)?.[1] || '';
  if (p1 === p2 && isLoopback(h1) && isLoopback(h2)) return true;
  return false;
}

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
        const inputs = Array.from(f.querySelectorAll('input:not([type="hidden"]), select, textarea')).map((inp) => {
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
        });

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
    const maxAttempts = options.maxAttempts ?? this.maxPages * 3;
    const stopAfterWalls = options.stopAfterWalls ?? 3;
    const isRoleSignedIn = Boolean(options.isSignedIn || (options.role && options.role !== 'visitor'));

    const baseUrlObj = new URL(targetUrl);
    // The site is where the start address lands: example.com that redirects to www.example.com is
    // crawled as www.example.com. Until a page has opened, it's the address as typed.
    let site = new URL(baseUrlObj.origin);
    let landedOnce = false;
    let startRedirectedOffSite = false;
    let sessionLost = false;
    let consecutiveWalls = 0;
    const onSite = (u: URL) => isSameSiteOrLoopback(u.host, site.host);
    const exploreClicks = options.exploreClicks ?? true;

    // Pages are told apart by path; the first query string seen for a path is kept so the page
    // can be reopened (e.g. /item?id=4 in a single-page app).
    const visited = new Set<string>();
    const queued = new Set<string>();
    const queue: string[] = [];

    let activeWorkers = 0;
    let attemptsCount = 0;
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

    const pages: SpiderPageInventoryItem[] = [];
    const forms: DiscoveredFormInfo[] = [];
    const sensitiveActions: SensitiveAction[] = [];
    const ambiguityQuestions: AmbiguityQuestion[] = [];
    const signInWalls: string[] = [];
    const skippedByRobots: string[] = [];
    const skipped: SkippedPageInfo[] = [];
    const routes: RouteTelemetry[] = [];
    /** Addresses the site redirected elsewhere on the site, so a link to one is expected to land on the other. */
    const redirects = new Map<string, string>();
    let questionCounter = 1;
    let clickBudget = MAX_EXPLORATION_CLICKS;
    let screenshotIndex = 0;
    if (options.screenshotDir) await fs.mkdir(options.screenshotDir, { recursive: true });

    // Shared pacing clock across all workers
    let lastLoadAt = 0;
    const waitForPacing = async () => {
      if (pageDelayMs > 0) {
        const now = Date.now();
        const waitMs = Math.max(0, lastLoadAt + pageDelayMs - now);
        if (waitMs > 0) {
          lastLoadAt = Math.max(lastLoadAt, now) + pageDelayMs;
          await new Promise((res) => setTimeout(res, waitMs));
        } else {
          lastLoadAt = now;
        }
      }
    };

    const waitForWork = () =>
      new Promise<void>((resolve) => {
        if (options.signal?.aborted || sessionLost || startRedirectedOffSite) return resolve();
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

    const evaluatePage = async (page: Page, requested: string, requestedPath: string) => {
      const fullUrl = new URL(requested, site).toString();
      if (options.robots && !options.robots.isAllowed(requested)) {
        skippedByRobots.push(requestedPath);
        skipped.push({ urlPath: requestedPath, why: 'robots' });
        const rTel: RouteTelemetry = {
          requestedPath: redactUrl(requestedPath),
          outcome: 'skipped',
          skipReason: 'robots',
          attempts: 0,
          durationMs: 0,
          who: options.role || (isRoleSignedIn ? 'signed-in' : 'visitor'),
        };
        routes.push(rTel);
        debugLog('crawl', 'route skipped by robots', {
          path: rTel.requestedPath,
          outcome: 'skipped',
          reason: 'robots',
          attempts: 0,
          ms: 0,
        });
        return;
      }

      let recorded = false;
      let exploreErrors = 0;

      try {
        await waitForPacing();

        let navRes;
        try {
          navRes = await navigate(page, fullUrl, {
            timeoutMs: 10000,
            needLinks: true,
            who: options.role || (isRoleSignedIn ? 'signed-in' : 'visitor'),
          });
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.name : 'other';
          const rTel: RouteTelemetry = {
            requestedPath: redactUrl(requestedPath),
            outcome: 'skipped',
            skipReason: 'did-not-load',
            detail,
            attempts: 1,
            durationMs: 0,
            who: options.role || (isRoleSignedIn ? 'signed-in' : 'visitor'),
          };
          routes.push(rTel);
          skipped.push({ urlPath: requestedPath, why: 'did-not-load', detail });
          debugLog('crawl', 'route navigation failed', {
            path: rTel.requestedPath,
            outcome: 'skipped',
            reason: 'did-not-load',
            attempts: 1,
            ms: 0,
          });
          return;
        }

        const landed = new URL(navRes.finalUrl || page.url());
        const telemetry = toTelemetry(navRes, requestedPath, {
          who: options.role || (isRoleSignedIn ? 'signed-in' : 'visitor'),
        });

        // Classification 1: Navigation did not succeed (timeout, network error)
        if (!navRes.ok) {
          const skipWhy: RouteSkipReason = navRes.error?.kind === 'timeout' ? 'timeout' : 'did-not-load';
          const detail = navRes.error?.kind || 'net';
          telemetry.outcome = 'skipped';
          telemetry.skipReason = skipWhy;
          telemetry.detail = detail;
          routes.push(telemetry);
          skipped.push({ urlPath: requestedPath, why: skipWhy, status: navRes.status, detail });
          debugLog('crawl', 'route failed to load', {
            path: telemetry.requestedPath,
            status: telemetry.status,
            finalPath: telemetry.finalPath,
            outcome: 'skipped',
            reason: skipWhy,
            attempts: telemetry.attempts,
            ms: telemetry.durationMs,
          });
          return;
        }

        // Classification 2: Bounce / sign-in wall / session loss (Scope 6)
        // Must be checked before first-landing rebase so a start URL sent to another host's sign-in
        // service does not move the site to that service.
        const hasSignInForm = await looksLikeLogin(page, options.knownLoginPaths);
        const isLoginPath = options.knownLoginPaths?.includes(landed.pathname);
        const isWall = (hasSignInForm && (landed.pathname !== requestedPath || isLoginPath)) || navRes.status === 401;

        if (isWall) {
          signInWalls.push(requestedPath);
          if (isRoleSignedIn) {
            consecutiveWalls++;
            if (consecutiveWalls >= stopAfterWalls) {
              sessionLost = true;
            }
          }
          const skipWhy: RouteSkipReason = isRoleSignedIn ? 'session-lost' : 'sign-in';
          telemetry.outcome = 'skipped';
          telemetry.skipReason = skipWhy;
          routes.push(telemetry);
          skipped.push({ urlPath: requestedPath, why: skipWhy, status: navRes.status });
          debugLog('crawl', 'route hit sign-in wall or session loss', {
            path: telemetry.requestedPath,
            status: telemetry.status,
            finalPath: telemetry.finalPath,
            outcome: 'skipped',
            reason: skipWhy,
            attempts: telemetry.attempts,
            ms: telemetry.durationMs,
          });

          // Only enqueue if the sign-in form is on the exact same site/host as the crawl
          if (!isRoleSignedIn && onSite(landed) && landed.host.toLowerCase() === site.host.toLowerCase()) {
            redirects.set(requestedPath, landed.pathname);
            enqueue(landed.pathname + landed.search);
          }
          return;
        } else {
          consecutiveWalls = 0;
        }

        // Classification 3: First landing rebase rule (Scope 7)
        if (!landedOnce && (navRes.status === undefined || navRes.status < 400)) {
          if (isSameSiteOrLoopback(landed.host, site.host)) {
            landedOnce = true;
            site = new URL(landed.origin);
          } else {
            // First landing redirected off-site!
            startRedirectedOffSite = true;
            telemetry.outcome = 'skipped';
            telemetry.skipReason = 'off-site-redirect';
            routes.push(telemetry);
            skipped.push({ urlPath: requestedPath, why: 'off-site-redirect', status: navRes.status });
            debugLog('crawl', 'start address redirected off-site', {
              path: telemetry.requestedPath,
              status: telemetry.status,
              finalPath: telemetry.finalPath,
              outcome: 'skipped',
              reason: 'off-site-redirect',
              attempts: telemetry.attempts,
              ms: telemetry.durationMs,
            });
            return;
          }
        }

        // Classification 4: Off-site redirect
        if (!onSite(landed)) {
          telemetry.outcome = 'skipped';
          telemetry.skipReason = 'off-site-redirect';
          routes.push(telemetry);
          skipped.push({
            urlPath: requestedPath,
            why: 'off-site-redirect',
            status: navRes.status,
            finalPath: redactUrl(landed.pathname + landed.search),
          });
          debugLog('crawl', 'route redirected off-site', {
            path: telemetry.requestedPath,
            status: telemetry.status,
            finalPath: telemetry.finalPath,
            outcome: 'skipped',
            reason: 'off-site-redirect',
            attempts: telemetry.attempts,
            ms: telemetry.durationMs,
          });
          return;
        }

        // Classification 5: HTTP >= 400 (not recorded in pages)
        if (navRes.status && navRes.status >= 400) {
          telemetry.outcome = 'skipped';
          telemetry.skipReason = 'http-error';
          routes.push(telemetry);
          skipped.push({ urlPath: requestedPath, why: 'http-error', status: navRes.status });
          debugLog('crawl', 'route returned http-error', {
            path: telemetry.requestedPath,
            status: telemetry.status,
            finalPath: telemetry.finalPath,
            outcome: 'skipped',
            reason: 'http-error',
            attempts: telemetry.attempts,
            ms: telemetry.durationMs,
          });
          return;
        }

        // Redirected within the site: the page is recorded once, under the address it really has.
        if (landed.pathname !== requestedPath) {
          redirects.set(requestedPath, landed.pathname);
          if (visited.has(landed.pathname)) {
            telemetry.outcome = 'skipped';
            telemetry.skipReason = 'duplicate';
            routes.push(telemetry);
            debugLog('crawl', 'route redirected to already-visited path', {
              path: telemetry.requestedPath,
              status: telemetry.status,
              finalPath: telemetry.finalPath,
              outcome: 'skipped',
              reason: 'duplicate',
              attempts: telemetry.attempts,
              ms: telemetry.durationMs,
            });
            return;
          }
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

        const pageItem: SpiderPageInventoryItem = {
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
        if (pages.length >= this.maxPages) {
          telemetry.outcome = 'skipped';
          telemetry.skipReason = 'page-limit';
          routes.push(telemetry);
          skipped.push({ urlPath: requestedPath, why: 'page-limit' });
          return;
        }
        pages.push(pageItem);
        recorded = true;
        telemetry.outcome = 'recorded';
        telemetry.skipReason = undefined;
        routes.push(telemetry);
        debugLog('crawl', 'route recorded', {
          path: telemetry.requestedPath,
          status: telemetry.status,
          finalPath: telemetry.finalPath,
          outcome: 'recorded',
          reason: undefined,
          attempts: telemetry.attempts,
          ms: telemetry.durationMs,
        });
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
          const pageClickLimit = Math.min(MAX_CLICKS_PER_PAGE, candidates.length);
          for (const el of candidates.slice(0, pageClickLimit)) {
            if (clickBudget-- <= 0) break;
            try {
              if (page.url() !== pageUrl) {
                await waitForPacing();
                await navigate(page, pageUrl, { timeoutMs: 10000 });
              }
              const urlBefore = page.url();
              await page.locator(el.selector).first().click({ timeout: 3000 });
              await Promise.race([
                page.waitForURL((u) => u.toString() !== urlBefore, { timeout: 1500 }),
                page.waitForTimeout(250),
              ]).catch(() => {});
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
              exploreErrors++;
            }
          }
        }

        // 5. Tabs, accordions, drawers and dialogs hide forms; list pages show how they are managed.
        // Guarded (ADR 0025): nothing is submitted, changing requests are aborted, dialogs dismissed.
        if (exploreClicks && clickBudget > 0 && onSite(landed)) {
          const reload = async () => {
            await waitForPacing();
            await navigate(page, pageUrl, { timeoutMs: 10000 });
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
            exploreErrors++;
          }
        }

        if (exploreErrors > 0) {
          pageItem.exploreErrors = exploreErrors;
        }
      } catch {
        // Double-record fix: only record as skipped if page was not already recorded
        if (!recorded) {
          skipped.push({ urlPath: requestedPath, why: 'did-not-load' });
        }
      }
    };

    const runWorker = async () => {
      let workerPage: Page | null = null;
      try {
        workerPage = await context.newPage();
      } catch {
        return;
      }
      try {
        while (
          !options.signal?.aborted &&
          !sessionLost &&
          !startRedirectedOffSite &&
          pages.length < this.maxPages &&
          attemptsCount < maxAttempts
        ) {
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
            attemptsCount++;
            activeWorkers++;
            try {
              await evaluatePage(workerPage, requested, requestedPath);
            } finally {
              activeWorkers--;
              notifyWork();
            }
          } else {
            if (
              activeWorkers === 0 ||
              pages.length >= this.maxPages ||
              attemptsCount >= maxAttempts ||
              sessionLost ||
              startRedirectedOffSite ||
              options.signal?.aborted
            ) {
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

    // If session was lost, drain remaining queue entries into skipped with session-lost (up to 50)
    if (sessionLost) {
      let count = 0;
      for (const left of queue) {
        const leftPath = new URL(left, targetUrl).pathname;
        if (!visited.has(leftPath)) {
          skipped.push({ urlPath: leftPath, why: 'session-lost' });
          count++;
          if (count >= 50) break;
        }
      }
    } else if (pages.length >= this.maxPages && !options.signal?.aborted) {
      // Still queued when the page limit ended the crawl: found, never opened.
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
      routes,
      sessionLost,
      startRedirectedOffSite,
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
