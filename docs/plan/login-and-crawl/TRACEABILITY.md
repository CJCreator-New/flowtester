# Traceability: findings ↔ tickets

Both directions, for the ten findings in [`GAPS.md`](GAPS.md) and the nine tickets in [`tickets.json`](tickets.json).
Every finding has exactly one disposition: **ticketed** (a ticket id), **deferred** (a `D-###` in `GAPS.md`), or
**accepted risk** (`N-###`). No ticket exists without a finding or a named dependency on one.

## Finding → ticket → wave

| Finding                                    | Severity | Disposition | Ticket(s)                                     | Wave  | Evidence that must stop holding                                                                                                            |
| ------------------------------------------ | -------- | ----------- | --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| LC-001 robots never enforced               | high     | ticketed    | T-304 (fixture route from T-303)              | 1     | `deterministic-spider.ts` passes the absolute URL to `isAllowed` — now the only call site that does                                        |
| LC-002 password-field page read as a wall  | high     | ticketed    | T-301 (fixture route from T-303)              | 0     | `isWall` compares `landed.pathname` with the route key                                                                                     |
| LC-003 recovered route dropped             | medium   | ticketed    | T-305                                         | 2     | The recovery branch returns before the route's telemetry row is built                                                                      |
| LC-004 cookie-only recovery                | medium   | ticketed    | T-305                                         | 2     | `addCookies(newState.cookies)` is the whole restore, in two files                                                                          |
| LC-005 unverified Roles reported signed in | medium   | ticketed    | T-302                                         | 0     | `roleResults[role.role] = true` with `attempts: 0` and no sign-in                                                                          |
| LC-006 `loginReachable` hard-coded         | low      | ticketed    | T-302 (docs half in T-308)                    | 0     | `loginReachable: true` with no login-page fetch and no reader                                                                              |
| LC-007 4xx start address reads as fine     | medium   | ticketed    | T-302 (core), T-306 (runner + wizard)         | 0 / 1 | `startWarning` produced and consumed by nobody                                                                                             |
| LC-008 page limit checked last             | low      | ticketed    | T-307                                         | 3     | `pages.length >= this.maxPages` sits after the inventory and the screenshot                                                                |
| LC-009 reported paths are route keys       | low      | ticketed    | T-301                                         | 0     | `signInWalls.push(requestedPath)` / `skipped.push({ urlPath: requestedPath`                                                                |
| LC-010 the behaviours above are untested   | medium   | ticketed    | one test per fixing ticket, plus T-303, T-309 | 0-5   | `grep` still finds no test that hands a `RobotsPolicy` to the spider, no test mentioning `startWarning`, no test mentioning `localStorage` |

## Ticket → findings

| Ticket | Wave | Findings                               | Also unblocks       |
| ------ | ---- | -------------------------------------- | ------------------- |
| T-301  | 0    | LC-002, LC-009                         | T-304, T-308, T-309 |
| T-302  | 0    | LC-005, LC-006, LC-007 (core)          | T-306               |
| T-303  | 0    | LC-010 (fixture routes)                | T-304, T-309        |
| T-304  | 1    | LC-001                                 | T-305, T-308, T-309 |
| T-306  | 1    | LC-007 (surface)                       | T-308               |
| T-305  | 2    | LC-003, LC-004                         | T-307, T-308, T-309 |
| T-307  | 3    | LC-008                                 | T-308, T-309        |
| T-308  | 4    | LC-005, LC-006, LC-009 (documentation) | —                   |
| T-309  | 5    | LC-010 (end to end)                    | —                   |

## Deferred and accepted, with their successors

| Id    | What                                                                                            | Why not now                                                                                             | Where it goes                                                    |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| D-001 | Sitemap seeding may not carry the crawl's HTTP identity (`deterministic-spider.ts:397`, `:416`) | Suspected, not established; the check is an experiment, and the impact is an optimisation not happening | A follow-up plan; the experiment is named in `GAPS.md` §Deferred |
| D-002 | Three implementations of “the session stopped working”                                          | A Role Session module is Phase 2 of the architecture review; T-305 removes only the duplicated restore  | `docs/plan/checkup-session/AUDIT.md` D-002                       |
| N-001 | No robots policy and no delay on a private host                                                 | Deliberate: the person's machine is the Test Copy case                                                  | `discovery-agent.ts:430-440`; stated in T-308                    |
| N-002 | 401/403 counts as reachable                                                                     | Deliberate: a site that asks for a sign-in is a real site                                               | `preflight.ts:176`; the warning half is LC-007                   |
| N-003 | Roles sign in sequentially, one context each                                                    | Deliberate: seconds, and no added risk of tripping a site's throttling                                  | Revisit only with a measurement                                  |

## Closure checklist

Run after wave 5, in one pass. Each line is the command or the file:line that shows the finding is gone; if it still
holds, the finding comes back to the board.

1. **LC-001** `grep -n "isAllowed(" packages/core/src/discovery/deterministic-spider.ts
packages/core/src/competitive/safe-crawler.ts packages/core/src/discovery/docs-fetch.ts` — every argument is a
   path, none an `http(s)://` string. Plus `pnpm exec vitest run packages/core/tests/spider-robots.test.ts`.
2. **LC-002** `grep -n "isWall" packages/core/src/discovery/deterministic-spider.ts` — the expression no longer
   compares `landed.pathname` with a route key. Plus the fixture scenario in
   `packages/core/tests/auth-crawl-e2e.test.ts` naming `/account/security`.
3. **LC-003** the recovery branch records the route and re-enqueues once; `routes.length` matches attempts in
   `spider-session-recovery.test.ts`.
4. **LC-004** `grep -rn "addCookies" packages/core/src` — one call site, inside the restore helper, which also
   writes `localStorage`.
5. **LC-005** `grep -n "roleResults" packages/core/src/preflight.ts` — no branch sets `true` without a sign-in; the
   no-browser path reports a failure and the test asserts it.
6. **LC-006** `grep -rn "loginReachable" packages` — either absent from the type, or set from a real check.
7. **LC-007** `grep -rn "startWarning" packages/*/src` — at least one runner and one wizard consumer; the runner
   route test asserts a 404 produces it.
8. **LC-008** `grep -n "maxPages" packages/core/src/discovery/deterministic-spider.ts` — an early check exists before
   the inventory; `spider-page-limit.test.ts` counts the screenshot files.
9. **LC-009** no `signInWalls.push(requestedPath)` / `skipped.push({ urlPath: requestedPath` remains.
10. **LC-010** the five new test files exist and assert what their ticket says; `pnpm exec vitest run packages/core
packages/runner` and `pnpm test:url-first` are green with nothing skipped.

Then tick each row above and say in the PR which line closed it.

## Coverage statement

- **Every finding is mapped**, one disposition each: 8 ticketed, 0 deferred-as-finding, 2 deferred items (`D-001`,
  `D-002`) and 3 accepted risks (`N-001`…`N-003`) recorded in `GAPS.md`.
- **Every ticket cites** either a finding (T-301…T-309 all do, several more than one) or a dependency on a ticket
  that does.
- **Nothing in this plan is ticketed without evidence**: each finding carries a `path:line`, two of them a
  reproduction run against the built `packages/core/dist` output.
- **What could not be mapped**: the other session's uncommitted work in `site-type.ts`, `test-planner.ts` and
  `plan/journeys.ts` is outside this audit's scope by the owner's instruction (sign-in and crawling only), so no
  finding here describes it and no ticket edits it. If those files change the Plan's prose, T-309 asserts on
  `pages` / `skipped` / `routes` instead, and the mapping above is unaffected.
