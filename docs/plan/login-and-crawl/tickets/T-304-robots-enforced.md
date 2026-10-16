# T-304 — The spider actually honours `robots.txt`

**Type** security · **Size** S · **Wave** 1 · **Depends on** T-301 (same file, sequential), T-303 (fixture route)
· **Gaps** LC-001 (High)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

> **Before you start:** T-301 must be merged — you own the same file. Another session may also have uncommitted
> edits there; run `git diff` on it and start from the working tree.

## Gaps addressed

**LC-001 (High).** `packages/core/src/discovery/deterministic-spider.ts:494`:

```ts
if (options.robots && !options.robots.isAllowed(requested)) {
```

`requested` is the queued **absolute URL** (`enqueue` stores `u.toString()`, `:374`; the worker passes
`requestedItem.url`, `:1011`). `RobotsPolicy.isAllowed` (`packages/core/src/competitive/robots.ts:60`) is documented
as `isAllowed(pathAndQuery)` and anchors every pattern at `^` — so a `/`-rooted rule can never match an
`https://…` string. Every other caller passes a path: `competitive/safe-crawler.ts:168`, `:213`, `:302`,
`discovery/docs-fetch.ts:213`.

Verified against the built `packages/core/dist/competitive/robots.js` with
`User-agent: * / Disallow: /admin / Disallow: /*? / Allow: /admin/public`:

```
false /admin                      true  https://example.com/admin
true  /admin/public               true  https://example.com/admin/public
```

So as used by the spider the policy is a no-op: nothing is ever disallowed. The policy is only passed when the host
is **not** private (`packages/core/src/discovery/discovery-agent.ts:435`), i.e. exactly on the third-party sites the
rule exists for, and the `skippedByRobots` note (`discovery-agent.ts:235-240`) is therefore never produced.

## Background

`RobotsPolicy` is a small RFC-9309 reader (longest-match Allow/Disallow, `*` and `$` wildcards) with a unit test
(`packages/core/tests/robots.test.ts`) that only ever calls it with paths — which is why the bug survived. The
crawler's own politeness switch (`discovery-agent.ts:426-440`) reads as if robots were enforced; only the argument
is wrong.

## Scope

1. Ask the policy about the route's path and query, in the form every other call site uses.
2. Keep the skip recorded exactly as now (`skippedByRobots`, `skipped[].why: 'robots'`, the `RouteTelemetry` row
   with `skipReason: 'robots'`, and the debug line) — only the question changes.
3. Add the test the path has never had: a real crawl against a site whose `robots.txt` disallows a path the links
   point at, asserting the page is not recorded and the skip is reported.

**Out of scope:** `RobotsPolicy` itself (its parsing and matching are correct and tested); where the policy is
fetched and who is exempt (`discovery-agent.ts:430-440`, deliberate, `GAPS.md` N-001); the crawler's own pacing;
robots handling for the competitive crawler or docs fetching (already correct); T-301's wall classifier.

## Files owned

- `packages/core/src/discovery/deterministic-spider.ts`
- `packages/core/tests/spider-robots.test.ts` (new)

## Files read-only

`packages/core/src/competitive/robots.ts`, `packages/core/src/discovery/discovery-agent.ts`,
`packages/core/src/discovery/frontier.ts`, `packages/core/tests/robots.test.ts`,
`fixtures/test-app/server.js` (T-303 adds `Disallow: /private/`).

## Interface contract

- `CrawlOptions.robots?: RobotsPolicy` keeps its type and meaning: **the policy is asked per route before the page is
  opened**.
- `SpiderResult.skippedByRobots?: string[]` keeps its meaning: the requested paths that were left alone, in the same
  path form as `SkippedPageInfo.urlPath` after T-301.
- The robots branch stays **before** `navigate`, and its telemetry row keeps `attempts: 0, durationMs: 0`.
- No exported signature changes; `@qa/core`'s barrel is untouched.

## Implementation notes

- The value to pass is the path and query of the route being opened, built from the requested URL the same way the
  other call sites do it: `new URL(requested, site)` then `u.pathname + u.search`. Do not pass `norm.key` — that is
  the dedupe key (lower-cased, query-filtered, `frontier.ts:44-58`), and robots patterns are case-sensitive.
- `RobotsPolicy` is per-origin and fetched once for the start origin (`discovery-agent.ts:435`), while the crawl
  rebases `site` to the landing origin (`deterministic-spider.ts:636-660`). Keep today's behaviour (one policy, from
  the target origin) and note the limitation in a comment; fetching a second policy for a rebased origin is a
  follow-up, not this ticket.
- Keep the debug line's shape (`debugLog('crawl', 'route skipped by robots', {...})`) so log scraping does not
  change.

## Acceptance criteria

- [ ] A crawl with a policy that disallows `/private/` does not record `/private/…` in `pages`, and reports it in
      `skippedByRobots` and in `skipped` with `why: 'robots'`.
- [ ] The same crawl **without** a policy (or with `RobotsPolicy.allowAll()`) records `/private/`, proving the gate
      is what changed and not the fixture.
- [ ] A route no rule matches is still crawled, and `Allow` beating `Disallow` on a longer pattern still holds
      (`Allow: /private/ok` while `Disallow: /private/`).
- [ ] A `Disallow: /*?` rule skips a URL with a query string.
- [ ] **Evidence for LC-001 no longer holds:** `deterministic-spider.ts` no longer passes the absolute URL to
      `isAllowed` (show the new line next to the three correct call sites).
- [ ] The existing spider suites pass unchanged.

## Test plan

```bash
pnpm exec vitest run packages/core/tests/spider-robots.test.ts
pnpm exec vitest run packages/core/tests/robots.test.ts packages/core/tests/spider-links-and-traps.test.ts \
  packages/core/tests/auth-crawl-e2e.test.ts
pnpm build
```

Falsification step in the PR: put the absolute URL back and show the new test failing (it passed before because
nothing asserted this), then revert.

## Definition of done

Acceptance boxes checked in the PR with evidence; test plan and `pnpm build` green; a reviewer (or the `tester`
agent, which never edits source) confirms the criteria independently; status set to `done` in
[`../BOARD.md`](../BOARD.md) and `../tickets.json`; tell T-305's owner (it waits on this file) and T-309's.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-304-robots-enforced.md and do it. You own only
packages/core/src/discovery/deterministic-spider.ts and the new test packages/core/tests/spider-robots.test.ts, and
you start after T-301 has merged into that same file. Fix LC-001: the robots gate at the top of evaluatePage asks
RobotsPolicy.isAllowed about the queued absolute URL, so no Disallow rule ever matches — pass the route's path and
query (new URL(requested, site), then pathname + search), the form the other three call sites use. Add a real crawl
test with an in-test server whose robots.txt disallows a linked path, plus the allow/allowAll contrast, and the
falsification step in the PR. Do not change RobotsPolicy, where the policy is fetched, or any other file. Run the
test plan and report failures honestly.
```
