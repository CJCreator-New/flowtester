# T-307 — The page limit is checked before a page's work, not after

**Type** refactor · **Size** S · **Wave** 3 · **Depends on** T-305 (same spider file, sequential) · **Gaps** LC-008 (Low)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

> **Before you start:** T-305 must be merged (same file).

## Gaps addressed

**LC-008 (Low).** `packages/core/src/discovery/deterministic-spider.ts:862-868`:

```ts
const pageItem: SpiderPageInventoryItem = { … };
if (pages.length >= this.maxPages) {
  telemetry.outcome = 'skipped';
  telemetry.skipReason = 'page-limit';
  …
  return;
}
```

This sits **after** `readPageForms` (`:818`), `readLayoutFingerprint` (`:829`), `collectElementInventory`
(`:802`), `dismissOverlays` (`:741`) and the JPEG screenshot written to `plan-pages/` (`:830-843`) — all discarded.
The screenshot file itself stays on disk for a page that is in no Plan. The main gates are already elsewhere: the
worker loop (`:1027`) and the queue drain (`:1073`), so the late check is a race guard.

## Background

Concurrent workers (`concurrency`, 1-5) share one `pages` array, so a worker can cross the limit while another is
mid-page — which is why the check exists at all. Its job is to keep `pages` at the limit, not to spend a browser
round trip and a file write to discover it is over. `plan-pages/*.jpg` is the folder the Plan's map shows
(`discovery-agent.ts:437`), so a file there for an unrecorded page is also a small correctness wart.

## Scope

1. Check the limit **before** the page's inventory work, and record the skip immediately with today's wording and
   telemetry row.
2. Keep the late check as a race guard, and make it cheap: nothing written to disk for a page it drops.
3. Do not change the drain's `page-limit` handling (`:1073-1078`) or the worker-loop gate.

**Out of scope:** the limit's value, `QA_CRAWL_MAX_MINUTES`, the drain's uncapped loop, `maxAttempts`, the
screenshot format or folder, anything T-301/T-304/T-305 touched (this is the same file — merge order matters).

## Files owned

- `packages/core/src/discovery/deterministic-spider.ts`
- `packages/core/tests/spider-page-limit.test.ts` (new)

## Files read-only

`packages/core/src/discovery/discovery-agent.ts`, `packages/core/src/navigate.ts`,
`packages/core/tests/spider-concurrency.test.ts`, `packages/core/tests/spider-links-and-traps.test.ts`.

## Interface contract

- `SpiderResult.pages.length <= maxPages` (still true, asserted by the new test).
- A page dropped by the limit keeps `skipped[].why: 'page-limit'` and a `RouteTelemetry` row with
  `outcome: 'skipped'`, `skipReason: 'page-limit'`.
- `options.onPage` is called only for pages that are recorded (unchanged).
- No exported signature changes.

## Implementation notes

- Put the early check at the top of the recorded-page path — after the wall/off-site/http-error classifications (a
  route skipped for those reasons must keep **its** reason, not become `page-limit`): the natural place is right
  before `dismissOverlays`/`collectElementInventory`, using the same `telemetry` object that is already in scope.
- Keep one helper for the skip so the wording and the row cannot drift between the two checks, and log once at debug
  level, not twice.
- The screenshot index (`screenshotIndex++`, `:831`) must not advance for a dropped page, so the remaining files stay
  numbered in the order they were recorded.

## Acceptance criteria

- [ ] With `maxPages` small and a site larger than it, `pages.length === maxPages`, every extra route has a
      `page-limit` row, and **no screenshot file exists for a page not in `pages`** (the test counts files in the
      screenshot dir).
- [ ] A route skipped earlier (off-site, http-error, sign-in wall) keeps its own reason even when the limit is
      reached.
- [ ] The concurrency suite still passes (`spider-concurrency.test.ts`) — the late guard is still needed.
- [ ] **Evidence for LC-008 no longer holds:** the limit is checked before the inventory work (show both checks in
      the PR, with the one-line reason the second still exists).

## Test plan

```bash
pnpm exec vitest run packages/core/tests/spider-page-limit.test.ts
pnpm exec vitest run packages/core/tests/spider-concurrency.test.ts packages/core/tests/spider-reliability.test.ts \
  packages/core/tests/spider-links-and-traps.test.ts packages/core/tests/e2e-discovery.test.ts
pnpm build
```

Falsification step in the PR: remove the early check and show the screenshot-count assertion failing; revert.

## Definition of done

Acceptance boxes checked in the PR with evidence; test plan and `pnpm build` green; a reviewer (or the `tester`
agent, which never edits source) confirms the criteria independently; status set to `done` in
[`../BOARD.md`](../BOARD.md) and `../tickets.json`; tell T-309's owner.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-307-page-limit-first.md and do it. You own only
packages/core/src/discovery/deterministic-spider.ts (after T-305 has merged into it) and the new test
packages/core/tests/spider-page-limit.test.ts. Fix LC-008: the maxPages check sits after the page's element
inventory, form reading, layout fingerprint and JPEG screenshot, so the work and the file are wasted — check the
limit before that work (but after the wall/off-site/http-error classifications, which keep their own reason), keep
the late check as the concurrency race guard, keep the page-limit wording and telemetry row identical, and make sure
the screenshot index does not advance for a dropped page. Add the test (cap small, site larger, count files in the
screenshot dir). Run the test plan and pnpm build, add the falsification step to the PR, and report failures honestly.
```
