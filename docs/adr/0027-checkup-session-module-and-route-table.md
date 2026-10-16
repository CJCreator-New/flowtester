# 0027: Check-up Session Module and a Route Table for the Runner

Status: Accepted and implemented (tickets T-201 to T-211, all done; the plan files were removed once closed).

Builds on [0008](0008-single-local-server.md) (one local server), [0010](0010-one-app-with-details-on-demand.md)
(one app, details on demand), [0016](0016-evidence-redaction.md) (Redaction), [0021](0021-saved-sessions-memory-only-and-confined-docs-fetch.md)
(Saved Sessions), [0022](0022-test-sign-in-as-consent.md) (Test sign-in as consent) and
[0026](0026-deterministic-sign-in-and-session-handling.md) (session lifecycle, origin-scoped headers). None of the
rules in those ADRs change here.

## Context

`packages/runner/src/server.ts` is 5587 lines and does four jobs at once:

- **Transport.** The dispatch chain inside `start()` (lines 960-1385) is 47 `if (pathname …) { … return; }`
  conditionals. The file makes 162 `sendJson` and 28 `readJsonBody` calls, and declares its request bodies inline
  (`interface PatchPlanBody` at line 4225, inside `handlePatchPlan`).
- **The state of one Check-up.** 51 fields hold it: the run slot (`isRunning`, `phase`, `activeAbortController`,
  `runGeneration`), the Plan under review (`currentPlanRecord`, `parkedPlans`, `planUpdate`), the report
  (`lastReport`, `lastRunError`, `lastErrorCode`), the event log and streams (`runEvents`, `streamClients`,
  `runOwners`), and the run's session secrets (`currentCustomHeaders`, `currentTunnelAuth`,
  `currentHeaderHosts`, `savedSessions`, `authDir`).
- **The Plan's operations.** Read, edit, validate, park, re-plan and approve it: `ensurePlanLoaded` (3999),
  `handleGetPlan` (4208), `handlePatchPlan` (4218), `handlePlanExport` (4461), `startPlanUpdate` (4512),
  `handleReplan` (4581), `handleAddPage` (4621), `handleIncludeHost` (4670), `handleAddSignIn` (4719),
  `handleInterpret` (4911), `handleApprovePlan` (4949), `handleWaitingPlans` (4077).
- **Plan building.** `buildPlan` (3652), `gradedChecksFor` (3720), `screenSizesOf` (3748), `testsFor` (3757),
  `prepareAI` (3539), `aiBudgetFor` (3600) — none of which needs HTTP, and all of which belong to `@qa/core`
  with the rest of the AI Planner.

Three costs follow from that shape, all present in the code today:

1. **The transport is the test surface.** 28 of the 41 test files in `packages/runner/tests/` boot a real
   `RunnerServer` (data dir, output dir, fake OpenRouter) to assert one behaviour. There is no way to test a Plan
   edit without a server.
2. **The CI route talks to itself over HTTP.** `checkup.ts` boots the same server on `QA_CHECKUP_PORT` (`new
   RunnerServer` at line 426, `await server.start()` at 433) and then calls `/api/runner/run` with `fetch` (458).
   Binding a port has already cost us a flaky test (commit `c10f5e8`, "Fix the flaky test-cap fixture bind by using
   an ephemeral port instead of hard-coded 3722").
3. **The check-up's contract is declared on both ends, by hand.** `TriggerRunBody` (server.ts:422) against
   `StartRunRequest` (`packages/wizard/src/api.ts:359`); `PatchPlanBody` (server.ts:4225, inline) against
   `PatchPlanBody` (`packages/wizard/src/api.ts:490`, exported, comments copied); the status reply (server.ts:1099)
   against `RunnerStatus` (`packages/wizard/src/api.ts:70`).

Adding one endpoint means editing the 425-line `start()` chain and a 107-method class. Adding one field to a
request means editing two packages.

## Decision

1. **A Check-up Session owns the state and the operations.** `packages/runner/src/session/checkup-session.ts`
   holds the run slot, the Plan under review (waiting Plans included), the report, the event log and the run's
   session secrets, and exposes them as one interface: `beginRun`, `status`, `readPlan`, `editPlan`,
   `approvePlan`, `events`, `report`, `stop` (the exact shape is fixed by the tickets). `RunnerServer` keeps no
   state of its own beyond transport.
2. **Routes are data.** `packages/runner/src/routes/*.ts` declares `{ method, path, handle }` rows, and `handle`
   is a function of the session, not a private method on the server. `start()` keeps what it already owns — access
   token and cookie, origin check, beta scoping and closed routes, the loopback rules of 0008 — matches the table,
   and gives up everything else. The house style stays `node:http`: one matcher, no framework, no runtime route
   discovery.
3. **The Plan's routes go first.** The plan routes (Plan Review in `docs/API.md`) are converted before the other
   areas — runs, reports, sites, AI settings, OpenRouter, baselines, benchmarks, schedules, evidence — which
   follow in a later plan using the pattern this one establishes.
4. **Plan building moves into `@qa/core`.** `core/src/plan/build.ts` takes `buildPlan`, `testsFor`,
   `screenSizesOf`, `gradedChecksFor`, `prepareAI` and `aiBudgetFor`. The runner keeps IO and transport; it stops
   knowing how a Plan is built.
5. **The check-up API contract is declared once, in `@qa/types`.** `types/src/checkup-api.ts` holds the request
   and reply shapes both ends maintain by hand today. Both ends import it.
6. **The CLI uses the session directly.** `checkup.ts` stops booting a server; it creates the session and calls it.

## What was rejected, and why

- **A web framework (Express, Fastify).** The table needs a matcher of about 30 lines. A dependency and its
  conventions buy nothing for 47 routes on one local port, and would rewrite the transport for no testability
  gain: the seam comes from the session, not from the router library.
- **Separate processes for the engine and the API.** Contradicts 0008/0010 (one process, one port, one origin) and
  beta mode, whose per-session secrets live in process memory (`runner/src/beta.ts`).
- **Converting the whole 47-conditional chain in one change.** `server.ts` needs one owner per wave; a change of that
  size cannot be reviewed, bisected or rolled back per area.
- **Keeping `RunnerServer` and only moving helper functions inside the same file.** That moves code, not the seam:
  tests would still need a booted server to reach a Plan edit.
- **Leaving the CLI on HTTP.** It keeps a port, a client and an error taxonomy to travel a distance of zero, and
  it has already produced a flaky bind.

## Consequences

- **Easier:** a new route is one table row and one handler; Plan edits are testable as function calls over a
  session; the CLI needs no port; the two ends of the check-up API cannot drift.
- **Harder:** more files under `packages/runner/src` (session, routes), so changing a reply shape now spans
  `@qa/types` and the session.
- **Watch — the session must not become the next god object.** The rule is: **the session owns state and
  operations, never policy.** Access tokens, allowed origins, beta limits, closed routes and host policy
  (`runner/src/beta.ts`, `runner/src/host-policy.ts`) stay in the transport. If the session's public surface
  passes roughly 15 methods, split it by area (Plan, Run, Report) rather than growing it.
- **Watch — the gate order.** The table must keep the current order of gates (access, origin, beta, closed
  routes) exactly. The route inventory test written before the dispatch rewrite pins every documented
  (method, path) pair.
- **Unchanged:** single server, single port, loopback rules (0008, 0010); one sign-in per Check-up and
  origin-scoped headers (0026); consent rules (0022); redaction (0016); the Findings contract (0017).
