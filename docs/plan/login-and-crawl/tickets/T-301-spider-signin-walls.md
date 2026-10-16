# T-301 — The spider stops calling ordinary pages sign-in walls

**Type** bug · **Size** M · **Wave** 0 · **Depends on** none · **Gaps** LC-002 (findings: High), LC-009 (Low)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

> **Before you start:** another session has uncommitted edits in the file you own. Run `git status` and
> `git diff packages/core/src/discovery/deterministic-spider.ts` first, and start from that working tree. Line
> numbers below are from 2026-10-15; if the wall block has already changed, say so in the PR and close the part that
> is fixed.

## Gaps addressed

**LC-002 (High).** `packages/core/src/discovery/deterministic-spider.ts:583`:

```ts
const isWall = (hasSignInForm && (landed.pathname !== requestedPath || isLoginPath)) || navRes.status === 401;
```

`hasSignInForm` is true when **any visible password input** is on the page (`packages/core/src/navigate.ts:96-126`);
`requestedPath` is not a path but the frontier's route key (assigned at `deterministic-spider.ts:1009` as
`norm.key`), which `normalizeRoute` (`packages/core/src/discovery/frontier.ts:44-58`) lower-cases, strips a trailing
slash from and filters the query of; `landed.pathname` is the raw pathname after redirects
(`deterministic-spider.ts:559`). Verified against the built code: `normalizeRoute('/settings/')` → `"/settings"` vs
pathname `"/settings/"`; `normalizeRoute('/Settings')` → `"/settings"` vs `"/Settings"`.

Consequence today: a page that shows a password field for a legitimate reason and is reached through a redirect, a
trailing slash or different casing is not recorded at all, is pushed to `signInWalls` (`:586`), is reported to the
person as asking for a sign-in (`packages/core/src/discovery/discovery-agent.ts:224-226`), and three in a row set
`sessionLost` and stop the rest of that Role's crawl (`:589-605`, drain `:1063-1072`).

**LC-009 (Low).** The same `requestedPath` (route key) is what `SkippedPageInfo.urlPath` and `signInWalls` carry
(`:496`, `:541`, `:565`, `:586`, `:610`, `:642`, `:684`, `:866`) — so the Plan lists `/settings` for `/Settings`, a
path a case-sensitive site does not serve.

## Background

The Deterministic Spider (`CONTEXT.md`) is rule-based and must find every reachable page; it never decides what to
test. A page it cannot open is fine — it is reported and skipped. A page it _thinks_ it cannot open, without saying
so correctly, is not: the person reads the note and adds a sign-in that would not have helped. The route key exists
so the same page is not crawled twice; it was never meant to be a path shown to a person.

## Scope

1. Decide “is this a sign-in wall?” from comparable values, on the page's own terms.
2. Keep the requested path as asked (redacted with `redactUrl`) next to the route key, and report **that** path in
   `SkippedPageInfo.urlPath` and `signInWalls`; the key stays the frontier's dedupe value.
3. Add a regression test with a page that has a password field plus something else on it, reached through a
   redirect, and with a page reached by a case-different path.

**Out of scope:** the re-login handler and what it restores (T-305); the missing telemetry row for a recovered route
(T-305); the robots gate (T-304); the page-limit check (T-307); the queue drain's `redactUrl(norm.path)` shape
(correct once the requested path is kept); any change to `frontier.ts`.

## Files owned

- `packages/core/src/discovery/deterministic-spider.ts`
- `packages/core/tests/spider-signin-walls.test.ts` (new)

## Files read-only

`packages/core/src/discovery/frontier.ts`, `packages/core/src/navigate.ts`, `packages/core/src/redact.ts`,
`packages/core/src/discovery/discovery-agent.ts`, `packages/core/tests/spider-links-and-traps.test.ts` (the pattern
for an in-test HTTP server), `packages/types/src/route-telemetry.ts`.

## Interface contract

- `CrawlOptions` and `SpiderResult` keep their shapes: `signInWalls: string[]`, `skipped?: SkippedPageInfo[]`,
  `routes?: RouteTelemetry[]` (`packages/types/src/route-telemetry.ts`) are unchanged.
- `SkippedPageInfo.urlPath` becomes the **requested path** (redacted), not the route key. `RouteTelemetry.requestedPath`
  keeps its current value (`toTelemetry` already redacts it) — do not change `navigate.ts`.
- `PageInventoryItem.hasSignInForm` keeps meaning “a visible password field was on this page” (`:847`).
- No exported function signature changes, so `@qa/core`'s barrel is untouched.

## Implementation notes

- Keep the classification order in `evaluatePage` as it is (wall → first-landing rebase → off-site → http-error →
  duplicate → record): the ordering is deliberate, see the doc comments at `:575-582` and `:636-660`.
- Compare like with like. Simplest correct rule: build `requestedUrl = new URL(requested, site)` and compare
  `landed.origin + landed.pathname` with that, ignoring the trailing slash on both; or pass the caller's raw
  `requestedPath` through `normalizeRoute(...).path` before comparing. Whichever you choose, say it in a comment.
- Tighten “a wall”: keep `navRes.status === 401` and “the URL is a known login path” as they are; treat a password
  field as a wall **only** when the page is not a page the crawl would otherwise record — the practical test is the
  login path itself, its redirect target, or a page whose password form is the page's only form and which carries no
  other navigation the crawl follows. Record the decision in the route's `detail` so the reason survives.
- Do not let a wall stop counting: `consecutiveWalls` must still reset on a page that is not a wall.
- `redactUrl` is the only redactor here; call it once, at the point the value enters `skipped` / `signInWalls`.

## Acceptance criteria

- [ ] A page with a password field **and** other content, reached through a redirect, is recorded as a page
      (`routes` row `outcome: 'recorded'`, the page in `pages`, its forms in `forms`) and is not in `signInWalls`.
- [ ] The same page requested by a case-different or trailing-slash path is recorded once, under its real path.
- [ ] A real sign-in wall (a role signed in, the site bouncing to `/login`) still yields `skipReason: 'session-lost'`
      for a role and `'sign-in'` for the visitor, and still appears in `signInWalls`.
- [ ] `skipped[].urlPath` and `signInWalls` hold the requested path, not the lower-cased key — the test asserts the
      exact string for a mixed-case path.
- [ ] **Evidence for LC-002 no longer holds:** the `isWall` expression no longer compares
      `landed.pathname` with the route key (show the new line in the PR).
- [ ] **Evidence for LC-009 no longer holds:** no `signInWalls.push(requestedPath)` remains in the file, and no `skipped.push` passes `requestedPath` as its `urlPath`.
- [ ] The existing suites pass **unchanged** — `spider-*.test.ts`, `signed-in-discovery.test.ts`,
      `auth-crawl-e2e.test.ts`. No test may be weakened, skipped or edited to pass.

## Test plan

```bash
pnpm exec vitest run packages/core/tests/spider-signin-walls.test.ts
pnpm exec vitest run packages/core/tests/spider-links-and-traps.test.ts \
  packages/core/tests/spider-reliability.test.ts packages/core/tests/spider-site-edge.test.ts \
  packages/core/tests/signed-in-discovery.test.ts packages/core/tests/auth-crawl-e2e.test.ts
pnpm exec vitest run packages/core        # needs Chromium installed
pnpm build
```

Add a **falsification step** to the PR: put the old `isWall` line back, or restore `requestedPath` in
`signInWalls.push`, and show the new test failing. Revert. A test that passes either way is not evidence.

## Definition of done

Acceptance boxes checked in the PR with the command output or the file:line; the test plan green; `pnpm build`
green (no `packages/types` change here, but the build type-checks the new test); a reviewer (or the `tester` agent,
which never edits source) confirms the criteria independently; then set the status to `done` in
[`../BOARD.md`](../BOARD.md) and `../tickets.json`. Stay inside the files you own — if a fix needs a change
elsewhere, stop and report a blocker instead.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-301-spider-signin-walls.md and do it. You own only
packages/core/src/discovery/deterministic-spider.ts and the new test packages/core/tests/spider-signin-walls.test.ts.
Start from the current working tree (another session has uncommitted edits there — check git diff first).
Fix LC-002 and LC-009: the sign-in-wall test must not compare the raw landed pathname with the frontier route key,
and the paths reported in SkippedPageInfo.urlPath and SpiderResult.signInWalls must be the requested path (redacted),
not the lower-cased route key. Add the regression test with an in-test HTTP server (pattern:
packages/core/tests/spider-links-and-traps.test.ts), including the falsification step in the PR. Do not change
frontier.ts or navigate.ts. Run the test plan; report what passed, what failed, and anything outside your two files
as a blocker.
```
