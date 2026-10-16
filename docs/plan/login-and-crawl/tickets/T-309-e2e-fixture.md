# T-309 — End to end: the fixture App proves the fixes hold together

**Type** test · **Size** M · **Wave** 5 · **Depends on** T-303, T-304, T-305, T-307 (the behaviour it exercises) · **Gaps** LC-010 (Medium)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

## Gaps addressed

**LC-010 (Medium).** Each fixing ticket adds a unit-level test against a throwaway server. Nothing crawls the App
the product actually tests against with the new behaviour in place, and nothing checks the _wording_ the person reads
(`discovery-agent.ts:199-240`, `:561-575`) — which is where four of these findings became visible in the first
place:

- LC-001: a page `robots.txt` disallows must be left alone and named in the politeness note
  (`discovery-agent.ts:235-240`).
- LC-002: the `/account/security` page (a password field, not a sign-in page) must be in the Plan, and the “asks for
  a sign-in” note must **not** name it.
- LC-003: a route recovered mid-crawl must have a route row and a recorded page.
- LC-004: a Role whose session dies mid-crawl must keep exploring when the session can be restored.

## Background

`packages/core/tests/auth-crawl-e2e.test.ts` (361 lines) already runs the Discovery Agent against the fixture App
with a profile and sign-ins, and `packages/runner/tests/auth-crawl-run.test.ts` runs the same through the runner.
Both are the right place: this ticket extends the existing end-to-end coverage rather than inventing a parallel
harness. The fixture's new routes come from T-303; the behaviour from T-301, T-304, T-305, T-307.

## Scope

1. Extend the core end-to-end test with one scenario that crawls the fixture App as visitor + one Role and asserts:
   the disallowed `/private/…` pages are absent and named in the robots note; `/account/security` is present and not
   named as a sign-in wall; the route table has a row for every page and every skip.
2. A second scenario where the Role's session is invalidated mid-crawl (the fixture can drop `fixture_session`, or a
   test-local server can be used) asserts the recovery: the crawl continues, the recovered route is recorded, and the
   “stopped working” note is **not** produced.
3. Extend the runner end-to-end test with the same crawl, asserting the run finishes and the Plan carries the same
   pages.

**Out of scope:** the crawler, the sign-in code and the fixture (owned by T-301…T-307, T-303); new fixture routes
beyond T-303's; the AI planner, the Plan Item shape and the report; performance; the smoke run's script (it keeps
using the fixture as it is).

## Files owned

- `packages/core/tests/auth-crawl-e2e.test.ts`
- `packages/runner/tests/auth-crawl-run.test.ts`

## Files read-only

`fixtures/test-app/server.js`, `packages/core/src/discovery/**`, `packages/core/src/preflight.ts`,
`packages/runner/src/server.ts`, `packages/core/tests/signed-in-discovery.test.ts`,
`packages/core/tests/require-sign-in.test.ts`.

## Interface contract

- The tests use the existing helpers and fixtures of those two files; no new exported test helper in `src/`.
- Assertions are on the Agent's returned shape and notes (`exploration.notes`, `skipped`, `routes`, `pages`) and on
  the run's Plan — never on a log line, a screenshot, or page text.
- No test may depend on the other session's uncommitted work in `site-type.ts` / `test-planner.ts` /
  `plan/journeys.ts`; if the Plan shape they produce differs, assert on `pages`/`skipped`/`routes` instead of the
  Plan's prose.

## Implementation notes

- The fixture is started the way the existing test already starts it (in-process `node:http` on a free port); do not
  add a global setup file.
- For the mid-crawl invalidation, prefer a small in-test server over changing the fixture: the fixture is shared and
  T-303 already touches it. If the fixture must change, stop and raise it with T-303's owner.
- The robots scenario needs the crawl to actually be given a policy: build it with
  `RobotsPolicy.fetch(origin, CRAWLER_TOKEN)` (or `RobotsPolicy.parse` on the fixture's own text) and pass it in
  `CrawlOptions.robots` — the production path only passes one on a non-private host
  (`discovery-agent.ts:435`), so assert it at the spider level or use the Agent with the fixture host treated as
  non-private, and say in the PR which route you took.
- Keep runtime sane: cap `maxPages` and reuse one browser for the scenarios (the file's existing pattern), and mark
  the recovery scenario so it does not need a second Chromium launch if the file already shares one.

## Acceptance criteria

- [ ] The robots scenario: `/private/` and `/private/reports` are not in `pages`; `skippedByRobots` names them; the
      politeness note exists and names them; the same crawl with `RobotsPolicy.allowAll()` **does** include them.
- [ ] The password-field scenario: `/account/security` is in `pages` and its form is in `forms`; the “asks for a
      sign-in” note does not mention it or the Role's landing page.
- [ ] The recovery scenario: the Role's crawl continues past the invalidation; the recovered route has a
      `RouteTelemetry` row; `sessionLost` is not set and the “stopped working” note is absent.
- [ ] Every route the crawl attempted has exactly one `routes` row (the test asserts `routes.length === attempts`, or
      the closest observable equivalent) — the LC-003 hole cannot reappear silently.
- [ ] The runner end-to-end scenario finishes and its Plan carries the same page set as the core scenario.
- [ ] **Evidence for LC-010 no longer holds:** each of LC-001, LC-002, LC-003 and LC-004 has an end-to-end assertion
      naming it in a comment, and the PR lists them.
- [ ] No test weakened, skipped or edited to pass; the suites fail if any fix is reverted (show one revert in the PR).

## Test plan

```bash
pnpm exec vitest run packages/core/tests/auth-crawl-e2e.test.ts
pnpm exec vitest run packages/runner/tests/auth-crawl-run.test.ts
pnpm exec vitest run packages/core/tests/signed-in-discovery.test.ts packages/core/tests/require-sign-in.test.ts
pnpm exec vitest run packages/core packages/runner     # both suites, needs Chromium
pnpm test:url-first
pnpm build
```

Falsification step in the PR: revert one fix (say, T-304's robots argument) and show the matching scenario failing;
revert the revert and paste both runs.

## Definition of done

Acceptance boxes checked in the PR with command output; both suites, `pnpm test:url-first` and `pnpm build` green; a
reviewer (or the `tester` agent, which never edits source, and which is the right owner for the falsification run)
confirms the criteria independently; status set to `done` in [`../BOARD.md`](../BOARD.md) and `../tickets.json`. This
is the last ticket of the plan; after it, re-run the checks in
[`../TRACEABILITY.md`](../TRACEABILITY.md) and mark the findings closed there.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-309-e2e-fixture.md and do it. You own only
packages/core/tests/auth-crawl-e2e.test.ts and packages/runner/tests/auth-crawl-run.test.ts. Extend the existing
end-to-end coverage against the fixture App (fixtures/test-app, its new /private/, /account/security and /Settings
routes come from T-303) so it proves the four fixes together: a path disallowed by robots.txt is left alone and named
in the note; /account/security (a password field, not a sign-in page) is planned and not called a sign-in wall; a
route recovered after the session dies has a route row and a recorded page, with no "stopped working" note; and every
attempted route has exactly one route row. Assert on returned shapes and notes only, never on logs or page text. Do
not change src or the fixture; if the fixture must change, stop and report it. Run the test plan (Chromium is
installed), include the revert-and-fail falsification evidence in the PR, and report failures honestly.
```
