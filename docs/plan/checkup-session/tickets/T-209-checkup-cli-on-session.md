# T-209 The check-up CLI runs on the session, without a port

- **Type:** refactor · **Size:** L · **Wave:** 5 · **Depends on:** T-204, T-208

## Evidence (architecture audit, 2026-10-15)

- `packages/runner/src/checkup.ts:426` `const server = new RunnerServer({ port, outputDir, dataDir, authDir })`,
  `:433` `await server.start()`, `:458` `await fetch(\`${base}/api/runner/run\`, { … })`, `:505` `await server.stop()`
  — the CI route boots a whole HTTP server and calls it over loopback.
- The port comes from `QA_CHECKUP_PORT` (with `DEFAULT_PORT`); binding it has already cost a flaky test: commit
  `c10f5e8`, "Fix the flaky test-cap fixture bind by using an ephemeral port instead of hard-coded 3722".
- The run operation itself: `handleTriggerRun` (`packages/runner/src/server.ts:2949`), `executeRun` (`:3205`,
  ~330 lines), `handleAbortRun` (`:3140`), `executeTesting` (`:3821`, ~180 lines).
- The authorization decision the run depends on: `resolveReadOnly` (`:670`), `readOnlyReason` (`:684`),
  `testCopyOf` (`:1539`), `betaScope` (`:1413`), `refuseTarget` (`:1477`), `betaLimitHit` (`:1498`),
  `signInAccount` (`:1729`). ADR 0022 makes consent and read-only resolution safety-critical: it must exist once.
- Parity gate that already exists: `packages/runner/tests/checkup-vs-api.test.ts` (headless and API runs must
  report the same issues).

## Background

The runner's most important caller is a CLI in the same package, and it reaches the engine through HTTP. That
costs a port, a client, a JSON round trip and an error mapping — and it means the CI path and the UI path can drift
apart in how they authorize a run.

This ticket gives the run operation one home (`session/checkup-run.ts`), keeps authorization to **one** function
that both callers use, and lets `checkup.ts` call it directly.

ADR [0027](../../../adr/0027-checkup-session-module-and-route-table.md): the HTTP handler keeps what is
transport's business — reading the body, beta scoping, ownership, status codes — and computes the authorization;
the CLI computes the same authorization from its arguments and environment. The run operation receives the
decision as data and never asks who is calling.

## Scope

- New `packages/runner/src/session/checkup-run.ts`: `CheckupRun` (`start`, `stop`, `waitFor`) with the bodies of
  `handleTriggerRun` (minus HTTP), `executeRun` and `executeTesting`, plus the private helpers only they use
  (`nothingNew` `:3198`, and whatever else moves with them).
- Authorization in one place: `resolveAuthorization(...)` — today's read-only/Test-Copy/consent/beta decision
  (`resolveReadOnly`, `readOnlyReason`, `testCopyOf`) becomes a function both callers use. Put it in the same
  module unless it grows past the point of clarity, in which case a new `runner/src/authorization.ts`.
- `RunnerServer`: `handleTriggerRun` and `handleAbortRun` keep their HTTP concerns and delegate; the moved methods
  and helpers are deleted.
- `packages/runner/src/checkup.ts`: creates a session and the run operation, calls `start`, waits, reads the report
  through the session and writes its files as it does today. No server, no port, no `fetch`.
- `server.ts` stops declaring the request body: delete `TriggerRunBody` (`:422`) and use `RunStartBody` from
  `@qa/types` (T-201) on both sides of the call.
- `packages/runner/tests/checkups.test.ts`: keep it green (this ticket owns it, in case the harness needs a change).

## Out of scope

Moving the runs _routes_ (`GET /api/runs`, `/api/runs/<id>/triage`, `/api/report/download/...`) into the route
table — the follow-up plan. Also out: changing what the CLI prints, its exit codes, its GitHub annotations, its
warnings, the files it writes and their names, `cli.ts`, and any authorization rule.

## Files owned

- `packages/runner/src/session/checkup-run.ts` (new)
- `packages/runner/src/session/checkup-session.ts`
- `packages/runner/src/server.ts`
- `packages/runner/src/checkup.ts`
- `packages/runner/tests/checkups.test.ts`

## Files read-only

`packages/runner/tests/checkup-vs-api.test.ts` (**must pass unchanged** — it is the parity gate),
`packages/runner/tests/checkup-annotations.test.ts`, `checkup-credentials.test.ts`, `checkup-debug.test.ts`,
`checkup-docs.test.ts`, `planted-defect-gate.test.ts`, `packages/runner/src/cli.ts`, `packages/runner/src/beta.ts`,
`packages/runner/src/host-policy.ts`, `docs/CONFIGURATION.md` (T-210 documents the change).

## Interface contract

```ts
// packages/runner/src/session/checkup-run.ts
/** What a run is allowed to do, decided by the caller (transport or CLI). */
export interface RunAuthorization {
  readOnly: boolean;
  readOnlyReason: string;
  /** The address is a Test Copy: full testing is allowed (ADRs 0014, 0022). */
  testCopy: boolean;
  owner: boolean;
  signInConsent: boolean;
}

export interface CheckupRun {
  /** Today's handleTriggerRun + executeRun, as one call. Resolves when the run has been claimed and started. */
  start(input: {
    body: RunStartBody;
    authorization: RunAuthorization;
  }): Promise<{ runId: string; awaitingReview: boolean }>;
  /** Today's handleAbortRun. `finish: true` stops after the current stage. */
  stop(input?: { finish?: boolean }): Promise<{ aborted: boolean; planKept?: boolean; finishing?: boolean }>;
  /** Resolves when the current run is over, or when the deadline passes (today's CLI poll loop). */
  waitFor(deadlineMs: number): Promise<void>;
}

export function createCheckupRun(session: CheckupSession, deps: RunDeps): CheckupRun;

/** Whatever the moved bodies need that is not state: the AI provider factory, the key resolver, host checks,
 *  the step timeout, the scheduler. Keep it explicit; no module-level singletons. */
export interface RunDeps {
  /* … */
}

/** The one place that decides read-only, Test Copy and consent. Used by handleTriggerRun and by checkup.ts. */
export function resolveAuthorization(input: {
  targetUrl: string;
  owner: boolean;
  signInConsent: boolean;
  roles: RoleCredential[];
  testCopyMarked: boolean;
  /* plus whatever the decision needs today: unverified targets, beta, host policy results */
}): RunAuthorization;
```

`RunStartBody` is T-201's shared type (`packages/types/src/checkup-api.ts`).

## Implementation notes

- **Move, do not rewrite.** `executeRun` and `executeTesting` keep their order of operations, their events, their
  retries and their error codes (`ERR_SIGN_IN_FAILED`, `ERR_PLAN_WAITING`, `ERR_BETA_LIMIT`, …). The HTTP-visible
  behaviour must not change at all; `checkup-vs-api.test.ts` and the checkup test files are the proof.
- HTTP stays HTTP: `handleTriggerRun` still reads the body, checks `Owner`/consent, refuses a target, counts beta
  limits, sets the status code and returns `runId`. What moves is the running, not the answering.
- The CLI must reach the **same** authorization as the HTTP path for the same inputs. Do not copy the rules: call
  `resolveAuthorization`. If a CLI input makes a rule unreachable (its `--staging` flag, env-only credentials), pass
  it in as data and work out the equivalent value from the CLI's own arguments.
- `checkup.ts` keeps its outputs exactly: the same console lines, the same warnings, the same annotations, the same
  exit codes (`0`, `1`, `2`), the same files in the output folder. Read them once, then port them.
- `QA_CHECKUP_PORT` is no longer used. Keep reading it without failing if it is set (some workflows export it), and
  say in the PR that it is now ignored — T-210 documents it.
- The CLI must not open a listening socket: `grep -n "listen(\|fetch(" packages/runner/src/checkup.ts` must return
  nothing after this ticket.
- Add one case to `checkups.test.ts`: two CLI check-ups for the same fixture started **at the same time**, each with
  its own temp output folder, both exit `0`. This is the behaviour the port removal buys; it cannot pass today.
- If `executeRun` needs something the session does not expose, extend the session (six accessors maximum) and list
  what you added in the PR.

## Acceptance criteria

- [ ] `pnpm build` passes.
- [ ] `grep -n "new RunnerServer\|fetch(\|listen(" packages/runner/src/checkup.ts` returns nothing.
- [ ] A CLI check-up against the fixture produces the same file list and the same verdict as before the change
      (state both in the PR: the file list before and after, and the verdict line).
- [ ] `pnpm exec vitest run packages/runner/tests/checkup-vs-api.test.ts` passes **unchanged**.
- [ ] `pnpm exec vitest run packages/runner/tests/checkups.test.ts` passes, including the new concurrent case.
- [ ] `pnpm exec vitest run packages/runner` is green apart from the one test file this ticket owns.
- [ ] No CLI console line, exit code, annotation or output file name changed (PR shows the CLI diff).
- [ ] `packages/runner/src/server.ts` no longer declares `executeRun`, `executeTesting` or `handleTriggerRun`'s
      bodies, and no longer declares `TriggerRunBody` (`grep -n "interface TriggerRunBody" packages/runner/src/server.ts` returns nothing); `grep -c "if (pathname" packages/runner/src/server.ts` is unchanged at 36.
- [ ] `pnpm smoke` passes.

## Test plan

```
pnpm build
pnpm exec vitest run packages/runner/tests/checkup-vs-api.test.ts packages/runner/tests/checkups.test.ts
pnpm exec vitest run packages/runner
pnpm test:url-first
pnpm smoke
```

## Definition of done

All boxes checked; the owned files are the only changes; the parity test and `checkup-vs-api.test.ts` pass
untouched. Stay within the files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-209 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Node 22, vitest). Read
docs/plan/checkup-session/tickets/T-209-checkup-cli-on-session.md and docs/adr/0027-... fully, then implement
exactly the ticket. Create packages/runner/src/session/checkup-run.ts with CheckupRun (start, stop, waitFor) and
resolveAuthorization, moving the bodies of handleTriggerRun, executeRun, executeTesting and the helpers only they
use out of packages/runner/src/server.ts (leaving the HTTP handler with its body reading, beta scope, ownership and
status codes, delegating to the run operation); make packages/runner/src/checkup.ts create the session and call the
run operation directly with no RunnerServer, no listening socket and no fetch, keeping the same console lines,
warnings, annotations, exit codes, output files and file names; and add one case to
packages/runner/tests/checkups.test.ts that starts two CLI check-ups at once and expects both to exit 0.Move, do not rewrite; keep every event, retry and error code. Delete TriggerRunBody and use RunStartBody from
@qa/types on both sides. Do not change authorization rules: both callers must use resolveAuthorization. Do not touch the runs routes, cli.ts or any read-only file, and do not edit
checkup-vs-api.test.ts. Run the commands in "Test plan". If .claude/work/DEFER_TESTS exists, write the test but do
not run tests. Never print secrets. Work on a branch, not main.
```
