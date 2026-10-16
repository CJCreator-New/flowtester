# T-305 — One session-restore path, and a recovered route is not dropped

**Type** bug · **Size** M · **Wave** 2 · **Depends on** T-304 (same spider file, sequential) · **Gaps** LC-003 (Medium), LC-004 (Medium)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

> **Before you start:** T-304 must be merged (same spider file). Another session has uncommitted edits in
> `deterministic-spider.ts` and `discovery-agent.ts`; run `git diff` on both and start from the working tree.

## Gaps addressed

**LC-003 (Medium) — the recovered route leaves a hole.** `deterministic-spider.ts:589-605`: when
`consecutiveWalls >= stopAfterWalls` and the re-login succeeds, the handler `return`s at `:596` — before the route's
`RouteTelemetry` row is built (`:606-625`) and without re-enqueuing the page. `signInWalls.push(requestedPath)`
(`:586`) has already happened. So the page that triggered recovery is reported as not reached, has **no** route row,
and is never retried: `routes.length` drops below the number of attempts and the Plan's map has a silent hole.

**LC-004 (Medium) — recovery restores cookies only.** `discovery-agent.ts:519-536`:

```ts
await roleContext.addCookies(newState.cookies);
```

Only cookies are copied from the fresh session. `signIn` supports `localStorageEntries`
(`packages/core/src/preflight.ts:264-278`) and the `StorageStateData` it saves carries `origins[].localStorage`, so a
site that keeps its token in `localStorage` — supported at sign-in — can never recover mid-crawl; the old cookies are
also left in place, and cookies for other hosts come along. `packages/core/src/orchestrator.ts:737-748` is a second,
independent copy of the same restore idea.

## Background

A Check-up on a long-lived site meets sessions that expire mid-crawl, so recovery is a normal path, not an edge case.
Its three parts live in three files: the spider decides _when_ to ask (twice-in-a-row walls), the Discovery Agent
supplies the handler, the orchestrator has its own version for a bounced start page. `docs/adr/0026` fixes the
rule — deterministic, no AI — and the wording rules live in `signInReasonText`.

## Scope

1. After a successful recovery, the route is **not** lost: record its telemetry and put it back at the front of the
   queue exactly once (a second visit to the same route must not loop).
2. One **session-restore helper** that puts a whole saved session (cookies _and_ `localStorage` per origin) into a
   context, clearing what is there first; used by both the Discovery Agent's re-login handler and the orchestrator's
   mid-run re-login.
3. Keep `consecutiveWalls` resetting on success so recovery is not attempted again immediately.

**Out of scope:** the sign-in flow itself and `PreFlightChecker.signIn` (T-302 owns that file); the wall classifier
(T-301); the page-limit check (T-307); folding the three “session died” implementations into one Role Session module
(a follow-up, `GAPS.md` D-002); whether a Role's crawl should restart rather than resume.

## Files owned

- `packages/core/src/discovery/deterministic-spider.ts`
- `packages/core/src/discovery/discovery-agent.ts`
- `packages/core/src/orchestrator.ts`
- `packages/core/tests/spider-session-recovery.test.ts` (new)

## Files read-only

`packages/core/src/preflight.ts`, `packages/core/src/browser.ts`, `packages/core/src/redact.ts`,
`packages/types/src/signin.ts`, `packages/types/src/route-telemetry.ts`,
`packages/core/tests/orchestrator-session.test.ts`, `packages/core/tests/require-sign-in.test.ts`.

## Interface contract

- `CrawlOptions.reloginHandler?: () => Promise<boolean>` keeps its signature; `true` now means “the session is
  usable again”, which the spider treats as: this route goes back to the front of the queue once.
- The helper is a named export from `@qa/core` (or a small module the barrel exposes) with a shape like
  `restoreSession(context: BrowserContext, state: StorageStateData): Promise<void>`; state the final signature in the
  PR so the follow-up plan can find it. `BrowserManager`/`BrowserContext` must be typed via a `type`-only import so
  the wizard bundle rule is respected.
- `RouteTelemetry` is unchanged; the recovered route gets an ordinary row whose `detail` says it was recovered
  (short fixed wording, no page text).
- `SpiderResult.sessionLost` keeps its meaning: the crawl ended because the session could not be restored.

## Implementation notes

- Re-enqueueing: use `enqueue(requestedItem.url, requestedItem.depth)` — the frontier's `admit` refuses a duplicate
  key, so the guard against a loop is already there; assert that in the test rather than adding a new set.
- Clearing the old cookie jar: create the fresh context, sign in, take its `storageState()`, then
  `context.clearCookies()` and `addCookies(state.cookies)`, and add an init script for each `origins[]` entry's
  `localStorage` before the next `newPage()` (the spider's pages are already open, so new pages are what matters).
- The orchestrator path (`:719-770`) already has the session path on disk (`statePath`) — pass a state that the same
  helper can consume, and keep `QA_RELOGIN=0` working exactly as now (`GAPS.md` N-004).
- When recovery fails, keep today's behaviour: `sessionLost = true`, and the drain marks the rest `session-lost`
  (`:1063-1072`). The role's note (`discovery-agent.ts:561-575`) stays.
- Never log a cookie value or the session object: `debugLog('auth', …)` with the role name only.

## Acceptance criteria

- [ ] A crawl whose first page walls, recovers, and succeeds has a `routes` row for that page and the page in
      `pages`; the test asserts the row exists and its `detail` says it was recovered.
- [ ] The same page is not crawled twice after recovery (no duplicate page entry, one route row).
- [ ] Recovery with a **cookie-only** site works, and recovery with a **`localStorage`-token** site works: two
      variants of the same test, one per storage kind, both ending with the Role's crawl continuing.
- [ ] No cookie from another host survives the restore (assert the context's cookies after the helper runs).
- [ ] `QA_RELOGIN=0` still disables the orchestrator's re-login (existing test
      `packages/core/tests/orchestrator-session.test.ts` passes unchanged).
- [ ] **Evidence for LC-003 no longer holds:** the recovery branch no longer returns before the route's telemetry is
      built (show the new code path in the PR).
- [ ] **Evidence for LC-004 no longer holds:** no `addCookies(newState.cookies)`-only restore remains in
      `discovery-agent.ts` or `orchestrator.ts`; both call the one helper.

## Test plan

```bash
pnpm exec vitest run packages/core/tests/spider-session-recovery.test.ts
pnpm exec vitest run packages/core/tests/orchestrator-session.test.ts packages/core/tests/signed-in-discovery.test.ts \
  packages/core/tests/spider-reliability.test.ts packages/core/tests/require-sign-in.test.ts \
  packages/core/tests/auth-crawl-e2e.test.ts
pnpm exec vitest run packages/runner/tests/auth-crawl-run.test.ts packages/runner/tests/credentials-crawl.test.ts
pnpm build
```

Falsification step in the PR: (a) drop the re-enqueue and show the route-row assertion failing; (b) restore
cookie-only copying and show the `localStorage` variant failing. Revert both.

## Definition of done

Acceptance boxes checked in the PR with evidence; test plan and `pnpm build` green; a reviewer (or the `tester`
agent, which never edits source) confirms the criteria independently; status set to `done` in
[`../BOARD.md`](../BOARD.md) and `../tickets.json`; tell T-307's owner (it waits on the spider file).

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-305-session-restore.md and do it. You own
packages/core/src/discovery/deterministic-spider.ts, packages/core/src/discovery/discovery-agent.ts,
packages/core/src/orchestrator.ts and the new test packages/core/tests/spider-session-recovery.test.ts. Start after
T-304 has merged; another session may have uncommitted edits in the first two — check git diff first.
Two fixes: (1) LC-003 — when the mid-crawl re-login succeeds the spider returns before building the route's
telemetry row and never retries the page, so record the row and put the route back at the front of the queue once
(the frontier's admit already refuses duplicates); (2) LC-004 — replace the cookie-only restore
(discovery-agent.ts addCookies(newState.cookies) and orchestrator.ts's own copy) with one helper that clears the
context and restores cookies and per-origin localStorage, used by both. Add tests for both storage kinds and for the
recovered route's row, with falsification steps in the PR. Never log cookie values, tokens or page text; keep
QA_RELOGIN=0 working. Do not change preflight.ts. Run the test plan and pnpm build; report failures honestly and any
needed change outside your files as a blocker.
```
