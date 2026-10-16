# Traceability

Finding → ticket, and the check that shows a finding is closed. Finding IDs are from [`AUDIT.md`](AUDIT.md);
ticket ids from [`tickets.json`](tickets.json). Every finding has exactly one disposition: ticketed, deferred (with
a reason in `AUDIT.md` §Deferred), or accepted risk (recorded in `AUDIT.md` §Not a gap).

## Finding → ticket

| Finding | Tickets (wave)                     | Disposition                                                                   |
| ------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| A-001   | T-204 (W1), T-206 (W2)             | Partial — the plan routes and the state move; the other 36 branches are D-001 |
| A-002   | T-207 (W3)                         | Complete                                                                      |
| A-003   | T-208 (W4)                         | Complete, except the deliberate remainder (keys and provider policy)          |
| A-004   | T-203 (W0), T-206 (W2), T-207 (W3) | Partial — three server-free test files land; the other areas are D-001        |
| A-005   | T-209 (W5)                         | Complete                                                                      |
| A-006   | T-201 (W0), T-207 (W3), T-209 (W5) | Complete                                                                      |
| A-007   | —                                  | Deferred: D-002                                                               |
| A-008   | —                                  | Deferred: D-002                                                               |
| A-009   | —                                  | Deferred: D-003                                                               |
| A-010   | T-202 (W0)                         | Complete                                                                      |
| A-011   | —                                  | Deferred: D-001                                                               |
| A-012   | T-211 (W1)                         | Complete                                                                      |
| A-013   | —                                  | Deferred: D-003                                                               |
| A-014   | —                                  | Accepted risk: N-001                                                          |

## Ticket → finding

| Ticket | Size | Wave | Findings it acts on                                                            | Contributes to Phase 1 gates                                       |
| ------ | ---- | ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| T-201  | S    | 0    | A-006                                                                          | Contracts exist once; both ends compile                            |
| T-202  | S    | 0    | A-010                                                                          | Zero import cycles in `packages/*/src`                             |
| T-203  | M    | 0    | A-001, A-004 (as the guard for the rewrite)                                    | Every documented route still reachable                             |
| T-204  | L    | 1    | A-001, A-004                                                                   | `session-state.test.ts` needs no server                            |
| T-206  | M    | 2    | A-001, A-004                                                                   | Plan routes match through the table                                |
| T-207  | L    | 3    | A-002, A-004                                                                   | `plan-routes.test.ts` needs no server                              |
| T-208  | M    | 4    | A-003                                                                          | `plan-build.test.ts` runs with no browser                          |
| T-209  | L    | 5    | A-005                                                                          | `checkup.ts` binds no port; parity test unchanged                  |
| T-210  | S    | 6    | — (documentation consequence; the repo rule is to fix docs in the same change) | `docs/API.md`, `docs/ARCHITECTURE.md`, `CONTEXT.md` match the code |
| T-211  | S    | 1    | A-012                                                                          | The browser boundary is enforced by a test                         |

Every ticket cites evidence (its own "Evidence" section, quoting `AUDIT.md`'s `path:line`), so no ticket rests on
the goal alone.

## Closure check per finding

A finding is closed when its evidence no longer holds. For this plan, that is:

- **A-001** — `grep -c "if (pathname" packages/runner/src/server.ts` is 36 (from 47); `packages/runner/src/session/`
  exists; `server.ts` is smaller. **Partial by design**: 36 branch rows remain for D-001, and the count returning to
  0 is the follow-up plan's gate.
- **A-002** — `grep -n "handleGetPlan\|handlePatchPlan\|handleApprovePlan\|handleInterpret\|handleWaitingPlans"
packages/runner/src/server.ts` returns nothing; `packages/runner/src/routes/plan.ts` is the home;
  `plan-routes.test.ts` imports no `RunnerServer`.
- **A-003** — `grep -n "private buildPlan\|private testsFor\|private screenSizesOf\|private gradedChecksFor\|private emptyPlan\|private siteMapOf\|private handCheckNotes" packages/runner/src/server.ts` returns nothing;
  `packages/core/src/plan/build.ts` exists and contains no `node:` import.
- **A-004** — `route-table.test.ts`, `plan-routes.test.ts` and `session-state.test.ts` exist and pass without a
  server. **Partial by design**: the count of runner test files that boot a server drops by the areas D-001 moves.
- **A-005** — `grep -n "new RunnerServer\|fetch(\|listen(" packages/runner/src/checkup.ts` returns nothing, and
  `checkup-vs-api.test.ts` still passes (the CLI and the API must agree).
- **A-006** — no declaration of `PatchPlanBody`, `TriggerRunBody`, `StartRunRequest` or `RunnerStatus` is left in
  `packages/runner/src/server.ts` or `packages/wizard/src/api.ts`; both ends import from
  `packages/types/src/checkup-api.ts` (the wizard may extend the reply with its own `busy` flag, which is a client
  concern, not a second contract).
- **A-010** — `grep -rn "from '../screens" packages/wizard/src/lib` returns nothing, and a cycle scan over
  `packages/*/src` reports no strongly-connected component.
- **A-012** — `grep -rn "@qa/types/src" packages/wizard` names only `browser.js` (plus that module itself), and
  `packages/types/tests/browser-entry.test.ts` walks the entry's transitive imports and fails on any `node:` import.
- **Deferred findings (A-007, A-008, A-009, A-011, A-013)** — closed only by D-002/D-003; they stay listed in
  `AUDIT.md` so the successor plans start from their evidence rather than re-discovering it.
- **A-014** — deliberately left; re-suggesting it needs a reason that beats N-001.

## Coverage statement

- Every finding in the review of 2026-10-15 is in `AUDIT.md` with evidence and a disposition: 14 findings, 8
  ticketed, 5 deferred, 1 accepted risk.
- Every ticket cites at least one finding, except T-210 (`docs`), which is the documentation consequence of the
  plan. Its "Evidence" quotes the stale lines in `docs/API.md`.
- No finding is ticketed twice by accident, and no ticket is ticketed for a finding that is not in the register:
  checked by script (`findings` in `tickets.json` against `AUDIT.md`).
- Nothing in this plan claims a performance change; the audit took no measurements (see `AUDIT.md` §Coverage
  statement).
