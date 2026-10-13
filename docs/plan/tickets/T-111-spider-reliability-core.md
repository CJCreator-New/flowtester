# T-111 Spider reliability core: settle, status + telemetry, retry, budget, bounce, rebase, pacing

- **Type:** bug · **Size:** L · **Wave:** 2 · **Depends on:** T-101, T-102, T-103, T-105, T-107
- **Gaps addressed:** G-005, G-006, G-007 (spider half), G-009, G-015, G-021, G-038, G-040, G-027 (`spider-form-facts.test.ts` port)

## Gaps addressed (evidence copied in)
- G-005: `packages/core/src/discovery/deterministic-spider.ts:331` `goto(domcontentloaded, 10000)`, `:368` immediate `$$eval('a[href]')`, `:386` inventory, `:401` forms; no hydration wait (grep).
- G-006: `:331` Response discarded; `:529-532` bare catch -> `did-not-load`; `:54-57` `SkippedPage = {urlPath, why}`; no `console.` calls; redirects only in a local Map (`:342,:358`).
- G-007: `:333-337` bounce needs path change AND a password input present immediately.
- G-009: `:544` loop bound `visited.size < maxPages`; `:550-553` `visited.add` before the load; robots (`:318-322`), wall (`:337`), off-site (`:352`) and failure (`:529`) still consumed a slot; no retry.
- G-015: `:238-240` `context.setExtraHTTPHeaders(options.customHeaders).catch(() => {})` duplicates the context option (`browser.ts`).
- G-021: `:347-350` the first landing sets `site` (even to another host) before the off-site test at `:352`; `landedOnce` is set even for an error page.
- G-038: `:542` `let lastLoadAt` inside `runWorker` (per worker, not global); `:464` fixed `waitForTimeout(600)` after each click; `clickBudget` first-come across workers (`:285,:453`).
- G-040: `:440` `pages.push` then `:529-531` pushes `did-not-load` for the same path; empty catches at `:380-382,:479-481,:525-527`.
- G-027: `spider-form-facts.test.ts:7` shares port 3532 with `narrow-look.test.ts:12`.

## Background
The spider (`DeterministicSpider.crawl`) is the Plan's crawl. It must wait for the page to be usable, record why every route succeeded or failed, spend its page budget only on pages, detect a lost session, and not move its scope on a redirect. Project conventions (copied): paths stored redacted (`redactUrl`); fixed skip reasons; read-only crawl (`blockChanges`, `guardPage`); concurrency 1-5; polite delay on public hosts (ADR 0025 limits stay); real-Chromium tests with local servers. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
1. Navigate with `navigate()` (T-107) using `needLinks: true` at `:331`, and the same helper at `:461` and `:494`; keep the polite pacing before each load.
2. Build a `RouteTelemetry` (T-101) per route via `toTelemetry`; record `status`, `finalPath`, `redirectChain`, `attempts`, `durationMs`, `skipReason`, `detail` (fixed words). `SpiderResult` gains `routes: RouteTelemetry[]`; `skipped` entries use `SkippedPageInfo` (extra optional fields). Emit `debugLog('crawl', ...)` per route (T-105): path (redacted), status, final path, outcome, reason, attempts, ms. No other log text.
3. Classification: HTTP >= 400 -> record skipped `http-error` with status (do not add to `pages`), except 401/403 on a signed-in role crawl -> `session-lost` counter (see 6); timeout -> `timeout`; off-site redirect -> `off-site-redirect`; other failures -> `did-not-load` with `detail` = error kind only.
4. Budget: count `pages.length` (recorded) against `maxPages`; separate `maxAttempts = maxPages * 3` guard; replace the loop bound at `:544` and the check at `:568`. Retry a failed load once (the helper's retry) and re-queue nothing else.
5. Remove `context.setExtraHTTPHeaders(...)` at `:238-240` (headers now come from the context, T-103).
6. Bounce / session loss: after `navigate`, treat as a wall when `looksLikeLogin(page, knownLoginPaths)` AND (path differs OR page is the login path); also when status is 401. Track `consecutiveWalls` per crawl for a signed-in role; at 3 in a row stop the crawl and set `SpiderResult.sessionLost = true` (new field) with `skipped` entries `session-lost` for the rest of the queue (up to 50 listed). Keep the existing `signInWalls` list and `why: 'sign-in'` for the visitor crawl.
7. Rebase rule: only set `site` from the first landing when `isSameSite(landed.host, site.host)` (www/apex) or protocol/port changed on the same host; if the first landing is off-site mark the start `off-site-redirect` and stop with `sessionLost=false`, `startRedirectedOffSite=true`. Do not set `landedOnce` for HTTP >= 400.
8. Pacing: make `lastLoadAt` a crawl-scope variable shared by all workers (pass getters bound to the shared one); replace the fixed `waitForTimeout(600)` after clicks with `await Promise.race([page.waitForURL(u => u.toString() !== before, {timeout: 1500}), page.waitForTimeout(250)])`; split `clickBudget` per page first (`MAX_CLICKS_PER_PAGE`), shared remainder second (keep 8 and 100).
9. Double-record fix: set `let recorded = false` when `pages.push` happens; in the outer catch, skip `skipped.push` if `recorded`; count swallowed exploration errors in `exploreErrors` on the page entry (new optional number field on `PageInventoryItem`, add to the spider's local type only if the shared type is not touched; if it needs the shared type, add it as an optional field in the spider's own `PageInventoryItem` extension).

## Out of scope
Link discovery changes, sitemap, hash/query routes, frontier, depth/time/trap budgets (T-112 owns this file next); discovery-agent merge and logging of sign-in walls (T-113).

## Files owned
- `packages/core/src/discovery/deterministic-spider.ts`
- `packages/core/tests/spider-concurrency.test.ts`, `spider-crud.test.ts`, `spider-form-facts.test.ts`, `spider-site-edge.test.ts`
- `packages/core/tests/spider-reliability.test.ts` (new)

## Files read-only
`navigate.ts` (T-107), `debug-log.ts` (T-105), `browser.ts` (T-103), `packages/types/src/route-telemetry.ts` (T-101), `fixtures/test-app/server.js` (T-102 routes).

## Interface contract
```ts
// deterministic-spider.ts (exports used by T-112, T-113)
export interface SpiderResult { /* existing */ pages; forms; skipped: SkippedPageInfo[]; signInWalls: string[];
  routes: RouteTelemetry[]; sessionLost: boolean; startRedirectedOffSite: boolean; }
// CrawlOptions gains: maxAttempts?: number; knownLoginPaths?: string[]; stopAfterWalls?: number (default 3)
```

## Implementation notes
- Fixture routes to test against: `/lab/spa-late` (needs settle), `/lab/index` -> `/lab/always-500`, `/lab/forbidden`, `/lab/redirect-chain`, `/lab/expiring` (302 to `/signin` after N requests).
- The pacing test must count requests per second with `crawlConcurrency: 4` and `crawlDelayMs: 300` and assert the average gap is >= 300 ms across all workers.
- Keep `skipped[].why` strings that existed. `issues-document.ts` `SKIP_WHY` is extended by T-101 for every new reason, so nothing to do there.

## Acceptance criteria
- [x] `/lab/spa-late`: the crawl finds the two late-rendered links (`/lab/spa-late/a`, `/b`); before this change it finds none (regression test).
- [x] `/lab/always-500` and `/lab/forbidden` are not in `pages`; `routes` has status 500 and 403 and `skipReason: 'http-error'`.
- [x] 200 dead links (404) with `maxPages: 20` still records up to 20 real pages (budget counts pages, not attempts).
- [x] A page whose first load times out and second succeeds is recorded with `attempts: 2`.
- [x] `/lab/expiring` as a signed-in role: after the session dies the crawl stops, `sessionLost === true`, the remaining queue is reported `session-lost`, and no login page is recorded as content.
- [x] A start address that redirects to another host: `startRedirectedOffSite === true` and `site` is unchanged.
- [x] Average gap between page loads with 4 workers and a 300 ms delay is >= 300 ms.
- [x] A recorded page never also appears in `skipped`.
- [x] `grep -n "setExtraHTTPHeaders" packages/core/src/discovery/deterministic-spider.ts` returns 0 (G-015 evidence gone).
- [x] With `QA_DEBUG=crawl`, one log line per route is printed; with it unset, nothing is printed; no line contains a query string value, cookie or header value.
- [x] Existing spider tests pass (updated only where behaviour changed on purpose).
- [x] `grep -n "page.goto(" packages/core/src/discovery/deterministic-spider.ts` returns 0 (G-030 evidence for the spider is gone).
- [x] `SpiderResult` and `skipped` changes are additive: `pipelined-discovery.test.ts` and `safe-crawl-links.test.ts` (owned by T-113 / unowned) pass unchanged; if one cannot, report a blocker.
- [x] `pnpm build` passes.
- [x] Evidence for G-005, G-006, G-007, G-009, G-021, G-038, G-040 no longer holds: `grep -n "navigate(" deterministic-spider.ts` finds the loads; `SpiderResult` has `routes` and `sessionLost`; `grep -n "let lastLoadAt" deterministic-spider.ts` is not inside `runWorker`; a recorded page never also appears in `skipped` (tests above).

## Test plan
```
pnpm exec vitest run packages/core/tests/spider-reliability.test.ts packages/core/tests/spider-concurrency.test.ts packages/core/tests/spider-crud.test.ts packages/core/tests/spider-form-facts.test.ts packages/core/tests/spider-site-edge.test.ts packages/core/tests/safe-crawl-links.test.ts packages/core/tests/pipelined-discovery.test.ts
pnpm build
```

## Definition of done
Boxes checked; ADR 0025 limits unchanged (8 clicks/page, 100/crawl, read-only guard); only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-111 in the QA Flow Tester repo. Read docs/plan/tickets/T-111-spider-reliability-core.md and packages/core/src/discovery/deterministic-spider.ts, then implement it. Edit only the spider and the listed spider tests. Use navigate() from T-107 (settle + status + retry), record a RouteTelemetry per route, classify http-error/timeout/off-site-redirect/did-not-load, count recorded pages (not attempts) against maxPages, remove setExtraHTTPHeaders, detect a lost session (3 consecutive walls on a signed-in crawl -> sessionLost), fix the first-redirect rebase, share one pacing clock across workers, fix the double record, and log via debugLog('crawl', ...) with redacted paths only. Keep ADR 0025 click limits and the read-only guard. Use the /lab/* fixture routes from T-102. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Never print secrets. Work on a branch, not main. If blocked, stop and report.
```
