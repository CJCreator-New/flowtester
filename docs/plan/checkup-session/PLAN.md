# Plan: Check-up Session, and a route table for the runner

Phase 1 of the architecture review of 2026-10-15. Decision record:
[`docs/adr/0027`](../../adr/0027-checkup-session-module-and-route-table.md). Tickets:
[`tickets/`](tickets/), machine-readable in [`tickets.json`](tickets.json), waves in [`BOARD.md`](BOARD.md). The
findings this plan answers, with their evidence and dispositions, are in [`AUDIT.md`](AUDIT.md); the mapping both
ways is in [`TRACEABILITY.md`](TRACEABILITY.md).

This plan is separate from the completed `docs/plan/` set (T-101..T-119, all `done`), which those files still
record. Ticket ids continue at `T-201` so nothing collides (`docs/tickets/` uses `T-01..T-24`).

## Goal

Give the runner a **Check-up Session** — one module that owns the state of one Check-up and the operations on it —
and make the HTTP server a transport over it, with routes declared as a table. The plan routes (Plan Review in
`docs/API.md`) are the first slice, and establish the pattern.

## Why now

`packages/runner/src/server.ts` is 5587 lines: a 425-line `if (pathname …)` chain in `start()` (47 conditionals),
51 fields, 107 methods, 162 `sendJson` sites. 28 of 41 runner test files boot a real server to test one behaviour,
and `checkup.ts` boots the same server on a port to call it over `fetch` (a flaky bind already came from that).
Both ends of the check-up API maintain `TriggerRunBody` / `StartRunRequest` and `PatchPlanBody` / `PatchPlanBody` by
hand. Evidence and line numbers: ADR 0027 §Context, and each ticket's own "Evidence".

## Scope

In: `packages/runner/src/server.ts`, new `packages/runner/src/session/`, new `packages/runner/src/routes/`,
`packages/runner/src/checkup.ts`, new `packages/types/src/checkup-api.ts`, `packages/core/src/plan/build.ts` and the
`@qa/core` barrel, `packages/wizard/src/lib/coverage-text.ts` + `ScanningScreen.tsx` (one cycle), the runner and
wizard tests for all of these, and the docs that describe the runner's shape.

## Non-goals

- The other route areas: runs and reports, sites, evidence, AI settings, OpenRouter, baselines, benchmarks,
  schedules, beta scoping, `/healthz`. They keep their `if (pathname …)` branches until a follow-up plan; T-206
  only replaces the _matching mechanics_, and its table lists the plan rows.
- Any behaviour change: reply bodies, status codes, error codes, gate order, redaction, consent rules and the
  `findings.json` contract stay byte-identical. This plan is structure only.
- The Role Session module (Phase 2 of the review) and the wizard Plan Review feature module (Phase 3); both are
  registered in `AUDIT.md` §Deferred (D-002, D-003) with their evidence, so the successor plans start from it.
- The other 36 route branches and the naming of `@qa/core`'s public surface: `AUDIT.md` §Deferred (D-001).
- Moving `RunnerServer` out of `packages/runner`, or introducing a web framework (rejected in ADR 0027).

## Approach

A strangler in seven steps, one owner of `server.ts` at a time:

1. **Contracts and guardrails (Wave 0).** The check-up API contract goes to `@qa/types`; the one import cycle in
   the repo is broken in the wizard; and a route inventory test pins every documented (method, path) pair against
   the server as it is today. After this wave the dispatch rewrite has a regression net and both ends have one
   contract.
2. **The session exists (Wave 1).** `CheckupSession` takes the state and the operations that mutate it (T-204),
   with `RunnerServer` delegating throughout — two commits in one PR, state first, operations second.
   Behaviour-neutral: the 41 runner test files pass unchanged. In parallel, the wizard gets one declared
   browser-safe entry into `@qa/types` (T-211), so the boundary its comments describe is tested.
3. **Routes become data (Wave 2).** `routes/` declares the table, `start()` matches it, and the plan rows appear
   as their own module, delegating to the existing methods for one wave (T-206). No behaviour change, small diff,
   easy review.
4. **The plan slice (Wave 3).** The plan handlers leave the class and become functions over the session (T-207) —
   the step that actually deepens, and the one this plan was asked to lead with.
5. **Plan building leaves the runner (Wave 4).** The functions that turn a `DiscoveryDraft` into a `ReviewPlan`
   move to `core/plan/build.ts` (T-208): the runner stops knowing how a Plan is built.
6. **The run operation gets one home (Wave 5).** `handleTriggerRun`, `executeRun`, `executeTesting` and the
   authorization decision (read-only, Test Copy, consent) move behind the session, and `checkup.ts` calls them
   directly — no server, no port, no `fetch` round trip (T-209).
7. **The docs describe it (Wave 6).** `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/CONFIGURATION.md`, the glossary
   term **Check-up Session**, the changelog (T-210).

The session ticket (T-204) is deliberately limited to the Plan and run state the plan routes need. It was two
tickets in the first draft (state, then operations); the owner merged them into one hand-off, to be landed as two
commits.

## Key decisions and trade-offs

| Decision                                               | Why                                                                    | Trade-off                                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A session module, HTTP as an adapter                   | One home for a Plan edit; Plan edits become testable as function calls | More files; changing a reply shape spans `@qa/types` and the session                   |
| Route table in `routes/`, `node:http` kept             | One row per route; the 30-line matcher is not worth a framework        | Dispatch order becomes data that must keep the gate order (the inventory test pins it) |
| Plan routes first                                      | Highest-traffic area, best test coverage, and it sets the pattern      | The other 8 areas live with the old chain until the follow-up plan                     |
| Gate order preserved in `start()`                      | Access, origin, beta and closed routes are security behaviour          | The table cannot be a pure list: gates stay in the transport, before matching          |
| `PatchPlanBody` and friends move to `@qa/types`        | Two hand-maintained copies today; drift is silent                      | `pnpm build` order: types first, then core, then runner                                |
| Plan building moves to `core/plan/build.ts`            | The runner should not know how a Plan is built                         | `@qa/core`'s barrel grows; T-208 keeps the moved functions pure and IO-free            |
| CLI calls the session directly                         | Removes a port, a client and an error mapping from CI                  | `QA_CHECKUP_PORT` becomes unused (kept for one release, documented in T-209)           |
| Inventory test written **before** the dispatch rewrite | The one thing a table rewrite can silently break is reachability       | One extra test file whose list must be maintained when routes are added                |

## Risks and mitigations

- **A route silently disappears in the rewrite.** T-203's inventory test fails on any pair that starts answering the
  fallback `{"error":"Not found"}`; it runs before and after T-206.
- **The session becomes the next god object.** ADR 0027 sets the rule (state and operations, never policy) and the
  ~15-method threshold: T-204 fixes six facade accessors, each with its own small interface, and a seventh needs a
  reason in the PR.
- **T-204 is the largest hand-off in the plan.** Land it as two commits, state then operations, each leaving the
  runner suite green; `session-state.test.ts` (which imports no `RunnerServer`) is the checkpoint between them.
- **`server.ts` is 5587 lines and every session ticket edits it.** One owner per wave, and each ticket states the
  exact line ranges it touches. Use a worktree per ticket under `.claude/worktrees/`.
- **Behaviour creep while "tidying".** Every acceptance criterion in Waves 1-5 is "identical behaviour" (wave 6 is
  docs only); the
  existing 41 runner test files plus `pnpm test:url-first` are the gate, and no test may be edited to pass.

## Open questions (answer before Wave 0 starts; the plan proceeds on the stated assumptions)

1. **Is ADR 0027 approved as Proposed?** Assumption: yes; tickets are written. If the owner prefers to keep the
   if-chain, T-203 and T-204 (the route inventory test and the session) still stand on their own and T-206..T-209 are
   dropped.
2. **Ticket range `T-201..T-210`.** Assumption: yes, continuing after the completed `T-101..T-119`. If the team
   keeps one global register, renumber and say so in the PR.
3. **Should the completed `docs/plan/` set move to `docs/plan/archive/2026-10-15/`** so this plan owns
   `docs/plan/` directly? Assumption: no, it stays where it is; this plan sits beside it in
   `docs/plan/checkup-session/`.
4. **Does `QA_CHECKUP_PORT` stay documented after T-209?** Assumption: yes for one release (some workflows and
   `packages/runner/tests/checkups.test.ts` may set it), then it is removed with a CHANGELOG note.
5. **Does the route table become the single source for `docs/API.md`?** Assumption: not in this phase; T-210
   documents the table and the "Adding or changing a route" steps, and a generator is a later idea.

## How to work (per ticket)

- Run waves in order; a ticket starts when every `dependsOn` is `done` (merged and verified). Tickets in one wave
  own disjoint files; `server.ts` has exactly one owner per wave.
- Every ticket names the finding it acts on (`AUDIT.md`, `A-###`). If a change you need is not covered by your
  ticket's finding, stop and report it rather than widening the ticket.
- One ticket per agent or person, one branch (`ticket/T-2xx-slug`) or worktree, one PR. Do not merge two tickets
  into one PR.
- Edit only the files under "Files owned". If you need a change elsewhere, stop and report a blocker.
- Follow the interface contract. If merged code differs from a contract, the code wins: adapt and note it in the PR.
- Use `CONTEXT.md` terms in code and docs, and respect the "_Avoid_" lists in UI text. Never read, print or commit
  `.env`, `.qa-keys.json`, `.qa-ai-models.json`, header values, passwords or cookies.
- Run the commands in the ticket's "Test plan". Run `pnpm build` after touching `packages/types` or exported APIs
  (build order: types, then checkers/core, then runner).
- If `.claude/work/DEFER_TESTS` exists, write tests but do not run them (a hook blocks it). It does not exist today.
- Marking a ticket done: acceptance boxes checked in the PR with evidence, "Test plan" and `pnpm build` green, a
  reviewer (or the `tester` agent, which never edits source) confirms the criteria, merge, then set the status to
  `done` in `BOARD.md` and `tickets.json`, and tell the owners of dependents.

## Gates that end Phase 1

- `pnpm build` green (the type-check rides on it).
- `pnpm exec vitest run packages/runner` green, including the new `route-inventory.test.ts` and
  `plan-routes.test.ts`, with no test weakened or skipped.
- `pnpm test:url-first` green.
- `pnpm smoke` green with no browser installed, and `packages/runner/tests/checkup-vs-api.test.ts` green (the
  headless and API paths must still agree after T-209).
- `docs/API.md` "Adding or changing a route" describes the table, not the chain; `docs/ARCHITECTURE.md` names the
  session and the routes directory; `CONTEXT.md` has the term **Check-up Session** (T-210).
