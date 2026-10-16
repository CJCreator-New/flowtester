# T-204 Check-up Session: the state and the operations

- **Type:** refactor · **Size:** L · **Wave:** 1 · **Depends on:** none

This ticket merges the two session tickets of the first draft (the former T-204 "state and read paths" and T-205
"the operations that mutate it") into one hand-off, at the owner's request. Suggested execution: two commits in one
pull request — state first, operations second — so a reviewer can read it as the two halves it was split into.

## Evidence (architecture audit, 2026-10-15)

**The state** — `packages/runner/src/server.ts:715-790`, 51 fields on `RunnerServer`, of which 27 are the state of
one Check-up (`:723-726`, `:739-790`): `isRunning`, `phase`, `currentPlanRecord`, `parkedPlans`, `planUpdate`,
`lastReport`, `lastRunError`, `lastErrorCode`, `runEvents`, `streamClients`, `savedSessions`, `currentRunId`,
`currentTargetUrl`, `runGeneration`, `activeAbortController`, `finishController`, `currentCustomHeaders`,
`currentTunnelAuth`, `currentHeaderHosts`, `currentUserAgent`, `authDir`, `recentApprovals`.

**The read paths** — the Plan: `ensurePlanLoaded` (`:3999`), `hostOfPlan` (`:4020`), `parkedFile` (`:4024`),
`listParkedPlans` (`:4051`), `normalizeStoredPlan` (`:524`), `planForClient` (`:618`), `planDelta` (`:633`),
`planForDisk` (`:4126`). The report: `runDir` (`:2166`), `listRuns` (`:2178`), `readRunReport` (`:2261`),
`loadLatestReport` (`:2249`), `siteDir` (`:865`).

**The mutations** — the Plan: `savePlan` (`:4117`), `planForDisk` (`:4126`), `clearPlan` (`:4194`), `parkPlan`
(`:4029`), `unparkPlan` (`:4037`), `planUpdate` (`:778`). The run slot: fields at `:744-770`, written in
`handleTriggerRun` (`:2949`) and `handleAbortRun` (`:3140`). The report: `keepRun` (`:2198`), `pruneRuns` (`:2230`).
The events: `recordRunEvent` (`:900`), `forwardRunEvent` (`:913`), `broadcastRunnerEvent` (`:877`), `runEvents`
(`:780`), `MAX_RUN_EVENTS` (`:310`); the SSE branch replays the log (`:1053-1074`). The run's session secrets:
`currentCustomHeaders` / `currentTunnelAuth` / `currentHeaderHosts` / `currentUserAgent` (`:771-774`),
`savedSessions` (`:759`), `authDir` (`:770`), `runAuthDir` (`:792`), `cleanAuthDir` (`:796`). The approval
idempotency map: `recentApprovals` (`:788`), used by `handleApprovePlan` (`:4949-4960`).

**Why it matters** — 28 of the 41 test files in `packages/runner/tests/` boot a whole `RunnerServer` before they can
touch any of this state.

## Background

One module — the **Check-up Session** — owns the state of one Check-up and the operations on it. ADR
[0027](../../../adr/0027-checkup-session-module-and-route-table.md) records why: the Plan's state, the run slot, the
event log and the run's session secrets currently live in a 5587-line HTTP server, so a Plan edit cannot be tested
without a port.

The rule reviewers must check: **the session owns state and operations, never policy.** Access tokens, allowed
origins, beta limits and closed routes, host policy, the UI apps, the key resolver, the OpenRouter client and the
scheduler stay in `RunnerServer`. So does `runOwners`, which is beta session policy
(`packages/runner/src/beta.ts`, `betaScope`). The event _log_ is state; the _sockets_ are transport, so the session
takes subscriptions and the server keeps the `http.ServerResponse` objects — which is also why no session module may
import `node:http`.

Conventions (copied): TypeScript `strict`, NodeNext, Node 22, vitest; `@qa/core` and `@qa/types` are workspace
dependencies; `RunnerServer` keeps its public surface (`start`, `stop`, `broadcastRunnerEvent`, `runAuthDir`,
`cleanAuthDir`) so tests and `cli.ts` do not change. Secrets (custom headers, saved sessions, cookies) live in
memory only and are never written, logged or returned (ADRs 0016, 0021). `pnpm build` after touching exported APIs.
Never print secrets.

## Scope

- New `packages/runner/src/session/checkup-session.ts`: `SessionPaths`, `CheckupSession` (a facade of six
  accessors) and `createCheckupSession(...)`.
- New `packages/runner/src/session/plan-store.ts` (`PlanStore`): the Plan under review — in-memory record, file
  path, disk shape, client shape, the read of a waiting Plan for a host, and the writes (save, clear, park, unpark,
  update flag) plus the approval-idempotency records.
- New `packages/runner/src/session/report-store.ts` (`ReportStore`): the last report and its error fields, the run
  directories and the run list, reading a past report, `loadLatest`, and the writes (`keep`, `prune`).
- New `packages/runner/src/session/run-slot.ts` (`RunSlot`): whether a run is active, its phase, identity,
  generation and abort/finish controllers.
- New `packages/runner/src/session/run-secrets.ts` (`RunSecrets`): the per-run headers, tunnel auth, header hosts,
  user agent, saved sign-in states and the per-run auth folder — all memory-only.
- New `packages/runner/src/session/run-events.ts` (`RunEvents`): the run's event log plus subscribe/publish.
- `RunnerServer`: the moved state and methods become delegations. Nothing else changes: same methods, same
  behaviour, same replies, same files on disk.
- New `packages/runner/tests/session-state.test.ts` driving `createCheckupSession()` directly, with no server.

## Out of scope

The big run bodies (`executeRun` `:3205`, `executeTesting` `:3821`, `handleTriggerRun` `:2949`,
`handleAbortRun` `:3140`) — they stay in `server.ts` and read/write through the session; T-209 moves them. Also out:
the route table (T-206), the plan handlers (T-207), plan building (T-208), the CLI (T-209), and any behaviour
change of any kind.

## Files owned

- `packages/runner/src/session/checkup-session.ts` (new)
- `packages/runner/src/session/plan-store.ts` (new)
- `packages/runner/src/session/report-store.ts` (new)
- `packages/runner/src/session/run-slot.ts` (new)
- `packages/runner/src/session/run-secrets.ts` (new)
- `packages/runner/src/session/run-events.ts` (new)
- `packages/runner/src/server.ts`
- `packages/runner/tests/session-state.test.ts` (new)

## Files read-only

`packages/runner/src/beta.ts`, `packages/runner/src/host-policy.ts`, `packages/runner/src/scheduler.ts`,
`packages/runner/src/ui-static.ts`, `packages/runner/src/index.ts`, `packages/runner/src/cli.ts`,
`packages/core/src/**`, and `packages/runner/tests/**` other than the new file (**they must pass unchanged** — that
is the acceptance test for this ticket).

## Interface contract

```ts
// packages/runner/src/session/checkup-session.ts
export interface SessionPaths {
  outputDir: string;
  dataDir: string;
  authDir: string;
  /** Pre-migration data folder, moved once on first use (today's moveLegacyData). */
  legacyDataDir?: string;
}

export interface CheckupSession {
  readonly paths: SessionPaths;
  readonly plan: PlanStore;
  readonly report: ReportStore;
  readonly run: RunSlot;
  readonly secrets: RunSecrets;
  readonly events: RunEvents;
}

export function createCheckupSession(input: {
  outputDir: string;
  dataDir: string;
  authDir?: string;
  legacyDataDir?: string;
}): CheckupSession;

// packages/runner/src/session/plan-store.ts
export interface PlanStore {
  /** Where the Plan under review is written (today's `planFile`). */
  readonly file: string;
  /** The Plan awaiting review, read from disk once (today's `ensurePlanLoaded`). */
  current(): Promise<StoredPlanRecord | null>;
  /** Replace the in-memory record; `null` clears it. */
  set(record: StoredPlanRecord | null): void;
  /** Write the record to disk as it is (today's `savePlan`). */
  save(record: StoredPlanRecord): Promise<void>;
  /** Forget the Plan, and its file (today's `clearPlan`). */
  clear(runId?: string): Promise<void>;
  /** The host a record belongs to (today's `hostOfPlan`). */
  hostOf(record: StoredPlanRecord): string;
  /** The waiting-Plan file for a host (today's `parkedFile`). */
  parkedFileFor(host: string): string;
  /** Park a record for its host (today's `parkPlan`) and read the parked ones (today's `listParkedPlans`). */
  park(record: StoredPlanRecord): Promise<void>;
  waiting(): Promise<Array<{ host: string; record: StoredPlanRecord }>>;
  /** Take a waiting record for a host (today's `unparkPlan`). */
  unpark(host: string): Promise<StoredPlanRecord | null>;
  /** The in-flight re-plan, if any (today's `planUpdate`): set it, read it, await it. */
  setUpdate(update: Promise<void> | null): void;
  update(): Promise<void> | null;
  /** Approval idempotency (today's `recentApprovals`). */
  rememberApproval(key: string, runId: string): void;
  recentApproval(key: string): { timestamp: number; runId: string } | undefined;
  /** The Plan as the wizard receives it (today's `planForClient`). */
  forClient(plan: ReviewPlan): ReviewPlan;
  /** The Plan as written to disk, credentials replaced (today's `planForDisk`). */
  forDisk(record: StoredPlanRecord): StoredPlanRecord;
  /** A saved Plan read back into the current shape (today's `normalizeStoredPlan`). */
  normalize(record: StoredPlanRecord): StoredPlanRecord;
}

// packages/runner/src/session/report-store.ts
export interface ReportStore {
  readonly last: ReleaseReport | null;
  set(report: ReleaseReport | null): void;
  /** Today's `lastRunError` / `lastErrorCode`, always set together. */
  error(): { message: string | null; code: string | null };
  setError(message: string | null, code: string | null): void;
  /** Keep a finished run's files, pruning per site (today's `keepRun` / `pruneRuns`). */
  keep(report: ReleaseReport, typedTargetUrl: string, siteHost: string | undefined): Promise<void>;
  prune(host: string): Promise<void>;
  /** Today's `runDir` / `relativeToRun`. */
  dirFor(runId: string): string;
  relativePath(runId: string, file?: string): string | undefined;
  /** Today's `siteDir`: the per-site memory/history folder. */
  siteDirFor(): string;
  /** Today's `listRuns`. */
  list(): Promise<RunSummary[]>;
  /** Today's `readRunReport`. */
  read(runId: string): Promise<ReleaseReport | null>;
  /** Today's `loadLatestReport`. */
  loadLatest(): Promise<void>;
}

// packages/runner/src/session/run-slot.ts
export interface RunSlot {
  readonly isRunning: boolean;
  readonly phase: RunnerPhase;
  readonly runId: string | null;
  readonly targetUrl: string | null;
  /** Bumped by every start; guards events that belong to a run that is over (today's `runGeneration`). */
  readonly generation: number;
  /** Claim the slot for a run. False when one is already running. */
  begin(runId: string, targetUrl: string): boolean;
  /** Give the slot back. */
  release(): void;
  setPhase(phase: RunnerPhase): void;
  abortController(): AbortController | null;
  setAbortController(controller: AbortController | null): void;
  finishController(): AbortController | null;
  setFinishController(controller: AbortController | null): void;
}

// packages/runner/src/session/run-secrets.ts — memory only, never written to disk or logs (ADR 0021)
export interface RunSecrets {
  readonly headers?: Record<string, string>;
  readonly tunnelAuth?: string;
  readonly headerHosts?: string[];
  readonly userAgent?: string;
  set(values: {
    headers?: Record<string, string>;
    tunnelAuth?: string;
    headerHosts?: string[];
    userAgent?: string;
  }): void;
  clear(): void;
  /** Saved sign-in states per role (today's `savedSessions`). */
  readonly savedSessions: Map<string, Record<string, StorageStateData>>;
  /** The per-run auth folder, outside the report folder (today's `runAuthDir`). */
  authDirFor(runId: string): string;
  /** Delete it when the run ends (today's `cleanAuthDir`). */
  clean(runId: string): Promise<void>;
}

// packages/runner/src/session/run-events.ts
export interface RunEvents {
  /** This run's events, oldest first, capped at MAX_RUN_EVENTS; replayed to a reconnecting page. */
  readonly log: ReadonlyArray<Record<string, unknown>>;
  /** Append, drop the oldest past the cap, and notify subscribers (today's `recordRunEvent` + broadcast). */
  publish(event: Record<string, unknown>): void;
  /** Subscribe a transport (the SSE branch) to new events; returns the unsubscribe function. */
  subscribe(listener: (event: Record<string, unknown>) => void): () => void;
  /** Forget the run's events (reset when a run starts). */
  clear(): void;
}
```

`RunnerServer` keeps its methods (`start`, `stop`, `broadcastRunnerEvent`, `runAuthDir`, `cleanAuthDir`, …) and
delegates; `streamClients`, `streamSessions` and `runOwners` stay in `RunnerServer` (transport and beta policy).
Tests call these through the server, so the names and signatures must not change:
`packages/runner/tests/headers-propagation.test.ts:142,261` (`runner.runAuthDir(runId)`),
`packages/runner/tests/beta-privacy.test.ts:80,208` (`broadcastRunnerEvent`).

## Implementation notes

- **Move bodies, do not redesign.** Every method above has an existing body in `server.ts`: copy it, replace
  `this.<field>` with the store's own field, and leave a one-line delegation behind. If a body touches policy (beta,
  origins, host policy, key resolver, scheduler), it does not move: leave it in the server and pass what it needs as
  an argument.
- Keep the paths in `SessionPaths`. **No file moves on disk**: an existing `.qa-data/` keeps working, and the Plan
  file, the waiting-Plan files, the run folders and the baselines folder keep their current names.
- `moveLegacyData` (`:2429`) keeps its behaviour and stays in the server; the session only receives the paths.
- `RunnerServer`'s constructor keeps every option it takes today (`RunnerServerOptions`, `:364`); it creates the
  session internally, so `new RunnerServer({ port, outputDir, dataDir, authDir })` in the tests still works.
- Do not rename methods that tests call through the class. Where a name moves into the session, keep the server
  method with the same name delegating to it.
- The SSE branch (`:1053`) keeps writing responses itself: it replays `events.log` for a reconnecting page,
  registers `streamClients`, and calls `events.subscribe(...)`; it unsubscribes and removes the response on
  `close`. No session module may import `node:http`.
- `MAX_RUN_EVENTS` (`:310`) moves with the log (the cap belongs to the log).
- `RunSecrets.set()` is called at the start of a run and `clear()` when it ends, exactly where the current fields
  are assigned and cleared (`:771-774`). `RunSecrets` must never be serialised — do not add it to any object written
  to disk or sent in a reply.
- `executeRun` / `executeTesting` keep their bodies; where they assign the moved fields, they call the session
  instead (`this.run.setPhase('testing')`, `this.report.setError(...)`, `this.events.publish(...)`).
- The new test file must not import `RunnerServer` at all: create the session with temp folders (`fs.mkdtemp`),
  drive it, assert, clean up in `afterAll`.
- If the diff grows beyond what one agent can hold, do not split the ticket: land the two commits in order and stop
  between them if you need to (state first, operations second).

## Acceptance criteria

- [ ] `pnpm build` passes.
- [ ] `pnpm exec vitest run packages/runner` is green with **no existing test file edited** (41 files, 28 of which
      boot a server).
- [ ] `session-state.test.ts` passes with **no** `RunnerServer` import, and covers: `begin()` refuses while a run is
      active and `release()` frees it; the generation changes between runs; `publish()` appends, caps at
      `MAX_RUN_EVENTS` and reaches a subscriber, and unsubscribing stops it; `plan.park()` / `unpark()` round-trips a
      record to disk and back; `plan.save()` then `plan.clear()` removes the file; `secrets.set()` / `clear()` leaves
      `JSON.stringify` of the session free of header values (assert with a secret-looking value).
- [ ] The moved fields and methods are declared only under `packages/runner/src/session/`
      (`grep -rn "private currentPlanRecord\|private parkedPlans\|private runEvents\|private savedSessions" packages/runner/src/server.ts` returns nothing).
- [ ] `server.ts` still declares `runOwners`, `accessToken`, `allowedOrigins`, `beta`, `betaLimits`, `hostAliases`,
      `uiApps`, `keyResolver`, `openRouter`, `makeAIProvider`, `baselineDir`, `benchmarkJobs` and `scheduler` — the
      policy and transport state that must not move.
- [ ] `grep -c "if (pathname" packages/runner/src/server.ts` is still 47 (this ticket touches no route), and the
      diff touches no `sendJson` payload, no status code and no path string.
- [ ] An existing `.qa-data/` from before this ticket still loads: run `runner-server.test.ts` against a data folder
      made by the pre-change code, or explain in the PR why you could not.
- [ ] The event replay still works: `checkups.test.ts` (which asserts `replayed` events) and `auth-crawl-run.test.ts`
      (which reads the stream) pass unchanged.
- [ ] `pnpm exec vitest run packages/runner/tests/route-inventory.test.ts` (T-203) is green.
- [ ] The PR states the before/after line count of `server.ts` and of the session directory.

## Test plan

```
pnpm build
pnpm exec vitest run packages/runner/tests/session-state.test.ts
pnpm exec vitest run packages/runner
pnpm test:url-first
```

## Definition of done

All boxes checked; the eight owned files are the only changes; the runner suite passes untouched. Stay within the
files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-204 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Node 22, vitest). Read
docs/plan/checkup-session/tickets/T-204-checkup-session.md and docs/adr/0027-checkup-session-module-and-route-table.md
fully, then implement exactly the ticket. Create packages/runner/src/session/checkup-session.ts plus plan-store.ts,
report-store.ts, run-slot.ts, run-secrets.ts and run-events.ts as specified, and move the Check-up's state, its read
paths and the operations that mutate them out of packages/runner/src/server.ts into them, with the server delegating
and its public methods (start, stop, broadcastRunnerEvent, runAuthDir, cleanAuthDir) unchanged. Land it as two
commits: state first, then operations. Move bodies, do not redesign; keep every method name tests call; keep policy
and transport state (access token, origins, beta, uiApps, keyResolver, openRouter, scheduler, baselineDir, runOwners,
host policy) and the SSE response objects in the server; no session module may import node:http; do not change any
file path on disk, any reply body, any status code or any route. Do not edit any existing test: the runner suite must
pass unchanged. Add only packages/runner/tests/session-state.test.ts, driving createCheckupSession() directly with no
RunnerServer. Run the commands in "Test plan". If .claude/work/DEFER_TESTS exists, write the test but do not run
tests. Never print secrets. Work on a branch, not main. If a body you need to move touches policy, stop and report
instead of moving it.
```
