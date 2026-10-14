# T-112 Spider link discovery and trap protection: frontier, route keys, sitemap, overlays, budgets

- **Type:** feature · **Size:** M · **Wave:** 3 · **Depends on:** T-102, T-111
- **Gaps addressed:** G-010, G-020, G-031

## Gaps addressed (evidence copied in)

- G-031: `packages/core/src/discovery/deterministic-spider.ts:267,273,342-343,359-360,379,467,550` each re-derive pathname/search by hand; `crawl()` (from `:234`) is one closure with shared mutable state (`visited`, `queued`, `site`, `redirects`).
- G-010: loop ends only on abort or `visited.size >= maxPages` (`:544`, `DEFAULT_MAX_PAGES = 200` at `:93`); `grep -n "deadline\|maxDepth\|maxDuration\|depth" deterministic-spider.ts` returns nothing (check again after T-111); `discovery-agent.ts:375-413` runs one crawl for the visitor and one per role, each with its own cap; `/a/1../a/N` and `/cal/2031/05` shapes are bounded only by the cap.
- G-020: `:368` reads `a[href]` only; `:376` skips `#` links; `:267,:550` path-only key (`/item?id=1` and `?id=2` collapse; `#/route` skipped); `grep -rn sitemap packages/core/src/discovery/` returns 0; `[role=link]` elements are inventoried (`discovery/element-inventory.ts:10`) but never enqueued; a form `action` is never enqueued; no overlay/consent dismissal in the main crawl (dialog handling exists only in `exploreInteractiveStates`, `interactive-states.ts:41`).

## Background

After T-111 the spider is reliable per page. It still lacks a single idea of "which route is this", so it cannot bound traps or follow query/hash routes safely, and it only follows plain anchors. This ticket extracts a canonical route key and a frontier, then uses them for budgets and extra link sources. Project conventions (copied): ADR 0025 limits stay (8 clicks/page, 100/crawl, read-only guard, never click risky names); the page key stays path-based by default (documented choice at `:250-251`); paths are stored redacted; real-Chromium tests. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope

1. New `discovery/frontier.ts`: `normalizeRoute(url, base, opts)` and `CrawlFrontier` (queued, visited, per-shape counts, depth).
   - Key = lower-cased host-less path, trailing slash removed (except `/`), duplicate slashes collapsed, plus an opt-in list of query parameter names (`routeQueryParams`, default `[]`) and `includeHash` (default false; when true, `#/segment` hash routes become `path#/segment`).
   - Shape = path with digit runs, UUIDs and 6+ char hex tokens replaced by `:n`, `:id`; `/calendar?month=...` handled through `routeQueryParams`.
   - `CrawlFrontier.admit(url, depth)` returns `{ admit: boolean; reason?: 'duplicate' | 'trap-limit' | 'depth-limit' }`.
2. Budgets in `CrawlOptions`: `maxDepth` (default 8), `maxPerShape` (default 25), `maxDurationMs` (default 10 min per crawl; env override `QA_CRAWL_MAX_MINUTES`), shared across explorers via an optional `deadlineAt` (epoch ms) that `discovery-agent` passes (T-113). Skipped reasons `trap-limit`, `time-limit`; log the cut once per shape via `debugLog('crawl', ...)`.
3. Link sources added to `evaluatePage`: (a) `[role=link][data-href]`, `[data-href]`, `[role=link]` with a resolvable `href`/`data-href`; (b) `<form method=get action=...>` actions without fields that need input (skip forms with password/file fields); (c) sitemap seeding: at crawl start fetch `/sitemap.xml` (and `Sitemap:` lines from robots when robots is fetched) with the context's request API (so headers/cookies apply), accept same-site `<loc>` entries, cap 200, depth 1; (d) when `includeHash` is true enqueue `#/…` links of the same page.
4. Overlay handling before link extraction: `dismissOverlays(page)` in `discovery/overlay.ts`: click the first visible button inside a fixed/sticky element whose accessible name matches `/^(accept( all)?|agree|got it|ok|allow( all)?|i understand|close)$/i`, only if it is not inside a `<form>`, and only once per page; never match names in `RISKY_TO_CLICK`.
5. Replace the hand-rolled path logic at the listed lines with the frontier; keep behaviour identical for default options (default tests must pass unchanged).

## Out of scope

Page-load, retry, telemetry, bounce logic (T-111); discovery-agent merge (T-113); wizard display.

## Files owned

- `packages/core/src/discovery/deterministic-spider.ts`
- `packages/core/src/discovery/frontier.ts` (new), `packages/core/src/discovery/overlay.ts` (new)
- `packages/core/tests/frontier.test.ts` (new), `packages/core/tests/spider-links-and-traps.test.ts` (new)

## Files read-only

`discovery/element-inventory.ts`, `discovery/interactive-states.ts`, `discovery/guard.ts`, `competitive/robots.ts`, `fixtures/test-app/server.js`.

## Interface contract

```ts
// discovery/frontier.ts
export interface RouteKeyOptions {
  routeQueryParams?: string[];
  includeHash?: boolean;
}
export function normalizeRoute(
  url: string,
  base: string,
  opts?: RouteKeyOptions
): { key: string; shape: string; path: string; search: string; hash: string };
export class CrawlFrontier {
  constructor(opts: { maxPerShape: number; maxDepth: number } & RouteKeyOptions);
  admit(
    url: string,
    base: string,
    depth: number
  ): { admit: boolean; key: string; reason?: 'duplicate' | 'trap-limit' | 'depth-limit' };
  markVisited(key: string): void;
  has(key: string): boolean;
}
// CrawlOptions additions (consumed by T-113): maxDepth?, maxPerShape?, maxDurationMs?, deadlineAt?, routeQueryParams?, includeHash?, seedSitemap?: boolean (default true)
```

## Implementation notes

- Queue items become `{ url, depth }`; depth of the start page is 0, a link's depth is parent + 1.
- `RISKY_TO_CLICK` and `NAVIGATION_WORDS` are in the spider (`:85,:88`); reuse them in the overlay helper by importing or exporting them from the spider (export only, no behaviour change).
- Sitemap fetch failure is silent but logged under `crawl` debug; it never fails the crawl.
- Traps from the fixture: `/lab/trap/<n>` (path shape `/lab/trap/:n`) and `/lab/calendar?month=` (use `routeQueryParams: ['month']` to prove the cap, and the default to prove it collapses).

## Acceptance criteria

- [x] `/lab/trap/1` crawl stops at `maxPerShape` (25) pages of that shape and `skipped` contains `trap-limit` entries (test).
- [x] With `routeQueryParams: ['month']` the calendar is bounded by the shape cap; without it the calendar collapses to one page (test).
- [x] `/lab/hash` with `includeHash: true` records two routes; without it, none (test).
- [x] `/lab/onclick` target pages are found via `data-href`; the inline `onclick` button target is found through click exploration (existing mechanism) (test).
- [x] A page with a fixed cookie banner (`/lab/overlay`) is crawled and its links are found with the banner present; the "Accept" click happens once (test).
- [x] An in-test server with `/sitemap.xml` listing an unlinked `/hidden` page: the page is crawled; with `seedSitemap: false` it is not.
- [x] `maxDurationMs: 2000` against `/lab/trap/1` ends in about 2 s with a `time-limit` skip entry.
- [x] Default options: all existing spider and pipelined-discovery tests pass unchanged.
- [x] Evidence for G-031 no longer holds: `grep -n "new URL(.*).pathname" packages/core/src/discovery/deterministic-spider.ts` shows no hand-rolled key derivation outside `frontier.ts`.
- [x] `pnpm build` passes.
- [x] Evidence for G-010 and G-020 no longer holds: `grep -n "maxDepth\|maxPerShape\|maxDurationMs" packages/core/src/discovery/deterministic-spider.ts` finds the budgets; `grep -rn "sitemap" packages/core/src/discovery/` finds the seeding.

## Test plan

```
pnpm exec vitest run packages/core/tests/frontier.test.ts packages/core/tests/spider-links-and-traps.test.ts packages/core/tests/spider-reliability.test.ts packages/core/tests/spider-concurrency.test.ts packages/core/tests/pipelined-discovery.test.ts packages/core/tests/safe-crawl-links.test.ts
pnpm build
```

## Definition of done

Boxes checked; ADR 0025 limits and read-only guard unchanged; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-112 in the QA Flow Tester repo. Read docs/plan/tickets/T-112-spider-discovery-and-traps.md and the current packages/core/src/discovery/deterministic-spider.ts (already changed by T-111). Create discovery/frontier.ts (normalizeRoute, CrawlFrontier) and discovery/overlay.ts, replace the hand-rolled path/key logic with the frontier, add depth, per-shape and wall-clock budgets, sitemap seeding, data-href/role=link/get-form discovery, opt-in query/hash route keys, and one-shot cookie-banner dismissal. Defaults must keep existing behaviour. Keep ADR 0025 limits and the read-only guard. Use the /lab/* routes from T-102 in tests. Edit only the files under "Files owned". Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main. If blocked, stop and report.
```
