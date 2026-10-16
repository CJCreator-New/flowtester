# Plan: sign-in and crawling

The findings this plan answers, with evidence and dispositions, are in [`GAPS.md`](GAPS.md). Tickets:
[`tickets/`](tickets/), machine-readable in [`tickets.json`](tickets.json), waves in [`BOARD.md`](BOARD.md), the
mapping both ways in [`TRACEABILITY.md`](TRACEABILITY.md), how to work in [`HANDOFF.md`](HANDOFF.md). What the code
looks like today: [`CONTEXT.md`](CONTEXT.md).

Ten findings (`LC-001`…`LC-010`), all ticketed or explicitly deferred; nine tickets, `T-301`…`T-309`. Ticket ids
continue after the completed `docs/plan/` set (`T-101`…`T-119`) and the architecture review's
`docs/plan/checkup-session/` (`T-201`…`T-211`); nothing collides. This plan sits beside both — it does not move
them, and it does not read either as truth.

Audited at `8d41601`, on the working tree, 2026-10-15. **Another session has uncommitted edits in five of the files
these tickets own**: `deterministic-spider.ts`, `discovery-agent.ts`, `preflight.ts`,
`packages/types/src/evidence-finding.ts` and the wizard screens. The findings are about the code as it is on disk,
including that work; the tickets say so in their first lines.

## Goal

Make the sign-in and crawling path tell the truth: crawl what we say we crawl, skip what we say we skip, report a
session that stopped working only when it did, and never claim a Role is signed in when no sign-in was attempted.

## Why now

Two of the ten are **high**, and both are silent: `robots.txt` is fetched and then asked about a URL instead of a
path, so nothing is ever disallowed (LC-001, verified against the built policy); and a page that shows a password
field for a legitimate reason is treated as a sign-in wall, dropped from the Plan entirely, and — three in a row —
ends that Role's crawl (LC-002, verified against the built route key). Both land on a third-party site, where a
Check-up is least forgiving and hardest to reproduce by hand. Four more are medium and share one theme: the result
shapes this path hands to the Plan say more than the code checked (LC-005, LC-006, LC-007) or say less than it knew
(LC-003, LC-004).

## Scope

In: `packages/core/src/discovery/deterministic-spider.ts`, `packages/core/src/discovery/discovery-agent.ts`,
`packages/core/src/preflight.ts`, `packages/core/src/orchestrator.ts` (the re-login branch only),
`packages/types/src/evidence-finding.ts`, `packages/runner/src/server.ts` (the `POST /api/runner/preflight` handler
body only), `packages/wizard/src/screens/NewCheckupScreen.tsx`, `packages/wizard/src/api.ts`,
`fixtures/test-app/server.js`, the tests listed per ticket, and `CONTEXT.md`, `docs/ARCHITECTURE.md`,
`docs/CONFIGURATION.md`, `docs/API.md`, `docs/TESTING.md`, `CHANGELOG.md`.

## Non-goals

- **The route base of the runner.** `docs/plan/checkup-session/` is rewriting `server.ts`'s dispatch into a route
  table. T-306 touches one handler body and never the `if (pathname …)` chain; if that plan has merged first, put
  the change in the route module instead, in the same shape (say which in the PR).
- **One Role Session module.** The three implementations of “the session stopped working” stay three
  (`GAPS.md` D-002, and D-002 of `docs/plan/checkup-session/AUDIT.md`); T-305 removes only the duplicated _restore_
  step.
- **The sign-in step order, the selectors, the retry count and the failure wording.** `docs/adr/0026` and
  `signInReasonText` settle them; nothing here changes what a sign-in attempt does.
- **The AI planner, the Plan Item shape, checkers, scoring, reports.** Findings `LC-001`…`LC-010` are all upstream
  of those; where a fix changes what the Plan is told (T-305's route row, T-301's paths), the shape it is told in is
  already in `packages/types/src/route-telemetry.ts`.
- **Sitemap seeding's HTTP identity** (`GAPS.md` D-001) — suspected, not established; it gets an experiment, not a
  ticket.
- **Performance of the crawl itself** beyond the wasted page-limit work (LC-008). Sequential Role sign-ins are an
  accepted risk (N-003) until there is a measurement.

## Approach

A small, ordered set of honesty fixes, one owner per file per wave:

1. **Wave 0 — the two high-value fixes and the fixture (parallel).** T-301 makes the wall classifier compare like
   with like and report the path that was asked for (LC-002, LC-009). T-302 makes the pre-flight result stop
   asserting what it did not check (LC-005…LC-007). T-303 gives the fixture App the pages the tests need. Nothing
   here depends on anything.
2. **Wave 1 — enforcement and the visible warning (parallel).** T-304 makes `robots.txt` actually bind (LC-001).
   T-306 carries the 4xx start warning to the person (LC-007 surface).
3. **Wave 2 — recovery.** T-305 keeps the recovered route and restores the whole session through one helper
   (LC-003, LC-004). It edits the spider after T-304, so it goes next.
4. **Wave 3 — the wasted work.** T-307 checks the page limit before doing a page's work (LC-008).
5. **Wave 4 — the words.** T-308 documents the vocabulary and the contracts the waves changed.
6. **Wave 5 — proof.** T-309 crawls the fixture App end to end with all of it in place and asserts the notes and the
   route table, with a revert-and-fail step per fix (LC-010).

Four tickets touch `deterministic-spider.ts` (T-301, T-304, T-305, T-307) and therefore serialize on it: one owner
per wave, one branch or worktree each, merged in wave order. Everything else is parallel.

## Key decisions and trade-offs

| Decision                                                                                  | Why                                                                                                       | Trade-off                                                                    |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Fix the classifier rather than lower `stopAfterWalls`                                     | The bug is a wrong question, not a wrong threshold; raising the threshold would hide the same pages later | Needs a careful rule and a fixture page that is not a sign-in page           |
| Keep the route key for dedupe, report the requested path                                  | The key exists to stop a route being crawled twice; it was never a path a person reads                    | Two values travel together through `evaluatePage`                            |
| `robots.txt` asked per route, before the page opens, with one policy for the start origin | The gate already sits there; a second policy for a rebased origin is a follow-up                          | A site that rebases to another host is judged by the start origin's rules    |
| Pre-flight fails closed with no browser                                                   | A result shape a reader cannot distinguish from a verified one is worse than an error                     | Any future headless pre-flight path must say why it cannot verify            |
| `loginReachable`: check it or delete it, not leave it                                     | A field that is always true is a claim, not data                                                          | Deleting it is a (small) type change; checking it costs one request per Role |
| One session-restore helper, used by both call sites                                       | The orchestrator's copy is why the bug had two homes                                                      | A new export from `@qa/core`, typed `type`-only for the browser              |
| Recovery resumes rather than restarts a Role's crawl                                      | A restart re-crawls everything and can double the run's cost                                              | A page that fails again after recovery is skipped the second time            |
| Page limit checked early, late check kept                                                 | Workers share `pages`; the race is real                                                                   | Two checks, so one helper holds the wording                                  |
| One docs ticket at the end                                                                | Five PRs changing contracts land as one consistent vocabulary                                             | The docs lag the code until wave 4                                           |
| One end-to-end ticket on the fixture App                                                  | The unit tests each prove a line; only a crawl proves the notes                                           | The slowest ticket in the plan (browser)                                     |

## Risks and mitigations

- **Colliding with the other session.** Five owned files already carry uncommitted edits, and the same lines are
  where the fixes go. Mitigation: worktrees under `.claude/worktrees/`, `git diff` before starting, one file per
  ticket per wave, and the rule that **merged code wins** — adapt and note it in the PR rather than reverting
  someone else's work.
- **The wall fix could under-detect real walls.** A looser rule might crawl a page it should have left alone.
  Mitigation: T-301's acceptance criteria keep the real cases asserted (a Role bounced to `/login`, a visitor
  reaching one), and T-309's fixture scenario asserts the note is still produced when it should be.
- **Enforcing `robots.txt` changes what a known site's Check-up contains.** That is the point, but it is a visible
  change: T-308's CHANGELOG entry says so in the person's words, and the politeness note already names the paths.
- **Deleting or checking `loginReachable` surprises a consumer.** Mitigation: T-302 greps both packages and the
  wizard and runs `pnpm build`; the field has no reader today, so the only risk is a branch in flight.
- **Serializing four tickets on one 1120-line file.** Mitigation: each ticket names the block it touches by function
  name and leaves the rest alone; T-309 is the net that catches a merge that half-applied.
- **A test that passes either way.** Mitigation: every fixing ticket carries a falsification step (revert the fix,
  show the failure, revert the revert) and T-309 repeats it end to end.

## Open questions (the plan proceeds on the stated assumptions; answer before wave 0 starts)

1. **Do these fixes land on top of the other session's uncommitted login/crawl work?** Assumption: yes — they are
   written against the working tree, and if that session changes the same lines, the later PR adapts. If instead
   their work should merge first, say so and hold wave 0; nothing else in the plan changes.
2. **`loginReachable`: check it or delete it?** Assumption: T-302's owner decides, preferring a real check if
   `checkUrlReachable` can be reused without a second per-Role round trip, and deleting it otherwise.
3. **One robots policy, from the start origin?** Assumption: yes for now (T-304 notes the limitation); a second
   fetch for a rebased origin is a follow-up.
4. **After a recovery, resume or restart the Role's crawl?** Assumption: resume, with the recovered route retried
   once (T-305).
5. **Ticket range `T-301`…`T-309`?** Assumption: yes, continuing after `T-211`. If the team keeps one register, add
   one row per ticket there and keep these ids in the ticket files.

## Gates that end this plan

- `pnpm build` green (the type-check rides on it), across types, core and runner.
- `pnpm exec vitest run packages/core packages/runner` green, including the six new test files, with no test
  weakened, skipped or edited to pass.
- `pnpm test:url-first` green, and `pnpm smoke` green with no browser installed.
- The fixture App serves the new routes and `packages/runner/tests/fixture-app.test.ts` passes unchanged.
- Each `LC-###` in [`GAPS.md`](GAPS.md) has its evidence re-checked and marked closed in
  [`TRACEABILITY.md`](TRACEABILITY.md).
- `CONTEXT.md` carries the new glossary terms and `docs/API.md` the new preflight field (T-308).
