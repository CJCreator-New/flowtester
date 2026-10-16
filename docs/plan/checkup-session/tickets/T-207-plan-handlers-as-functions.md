# T-207 Plan handlers become functions over the session

- **Type:** refactor · **Size:** L · **Wave:** 3 · **Depends on:** T-206, T-201

## Evidence (architecture audit, 2026-10-15)

- The plan handlers, all private methods on `RunnerServer`:
  `handleWaitingPlans` (`packages/runner/src/server.ts:4077`), `handleGetPlan` (`:4208`), `handlePatchPlan` (`:4218`,
  224 lines), `handlePlanMarkdown` (`:4442`), `handlePlanExport` (`:4461`), `replanOptions` (`:4489`),
  `startPlanUpdate` (`:4512`), `handleReplan` (`:4581`), `handleAddPage` (`:4621`), `handleIncludeHost` (`:4670`),
  `handleAddSignIn` (`:4719`), `handleInterpret` (`:4911`), `handleApprovePlan` (`:4949`, ~256 lines).
- They are the reason a Plan edit cannot be tested without a server: they read `this.currentPlanRecord`,
  `this.phase`, `this.planUpdate`, `this.recentApprovals`, `this.readJsonBody`, `this.sendJson`, and call
  `new PlanValidator(...)`, `asFlow` (`:698`), `replaceCredentialsWithPlaceholders`, `replanPage`/`replanAll`.
- `interface PatchPlanBody` is declared inline inside `handlePatchPlan` (`:4225`) — T-201 moves it to
  `@qa/types`; this ticket switches the handler to the shared type.
- Test coverage today is HTTP-level: `packages/runner/tests/wizard-endpoints.test.ts` (430 lines) and
  `test-cap-endpoints.test.ts`, `sources-endpoints.test.ts`, `sources-reload.test.ts`, `reapproval-roles.test.ts`.

## Background

T-206 put the plan rows in a table but left the bodies on the class. This ticket finishes the slice: the handlers
become plain functions over the `CheckupSession`, the class methods disappear, and — the payoff — a Plan edit can
be driven from a test with no HTTP server, no port and no response object to fake.

ADR [0027](../../../adr/0027-checkup-session-module-and-route-table.md): handlers take the session; they do not
reach into transport. `sendJson`/`readJsonBody` become ordinary helpers in `routes/body.ts` (the class keeps its
methods delegating to them, so the 37 branches that have not moved keep working).

Conventions (copied): `sendJson(res, status, body)` sets `Content-Type: application/json`; `readJsonBody` caps at
`MAX_BODY_CHARS = 5_000_000` (`:194`) and rejects invalid JSON; unsafe plan edits are refused with 422 and no
change is applied; credentials are replaced with placeholders before a Plan is stored; error text is fixed wording
and never contains a username or password. `pnpm build` after exported API changes.

## Scope

- New `packages/runner/src/routes/body.ts`: `readJsonBody<T>(req, maxChars?)`, `sendJson(res, status, body)`,
  `MAX_BODY_CHARS` — moved from the class; the class methods become one-line delegations.
- `packages/runner/src/routes/plan.ts`: the thirteen handlers above as exported functions, each taking
  `{ session, req, res, url }` and using the session's `plan`/`run`/`report`/`events` accessors. The ten table rows
  from T-206 now call them directly.
- `packages/runner/src/session/checkup-session.ts`: only what the handlers need and do not have yet (for example
  an approval-idempotency accessor, or a way to mark a plan update as running). Report anything you add beyond the
  T-204 contract, and do not exceed six facade accessors.
- `packages/runner/src/server.ts`: delete the moved methods and their helper `replanOptions`; keep
  `startPlanUpdate` if a non-plan caller uses it, otherwise move it too.
- New `packages/runner/tests/plan-routes.test.ts`: drives the handlers directly over a session, with no
  `RunnerServer` and no port.

## Out of scope

`handleTriggerRun`, `executeRun`, `executeTesting` and the runs routes (T-209 and the follow-up plan); the route
table beyond the plan rows; planner behaviour (`replanPage`, `replanAll`, `replanMenus`, `replanJourneys` stay
where they are, in `@qa/core`); any change to what the plan routes accept, refuse, return or store.

## Files owned

- `packages/runner/src/routes/body.ts` (new)
- `packages/runner/src/routes/plan.ts`
- `packages/runner/src/routes/index.ts` (only if the row shape changes)
- `packages/runner/src/session/checkup-session.ts`
- `packages/runner/src/server.ts`
- `packages/runner/tests/plan-routes.test.ts` (new)

## Files read-only

`packages/types/src/checkup-api.ts` (T-201's contract — use `PlanPatchBody`, do not redeclare it),
`packages/runner/tests/**` (all existing tests must pass unchanged), `packages/core/src/plan/**`,
`packages/wizard/src/api.ts`.

## Interface contract

```ts
// packages/runner/src/routes/body.ts
export const MAX_BODY_CHARS = 5_000_000;
export function readJsonBody<T>(req: http.IncomingMessage, maxChars?: number): Promise<T>;
export function sendJson(res: http.ServerResponse, status: number, body: unknown): void;

// packages/runner/src/routes/plan.ts — one exported function per row
export interface PlanRouteContext {
  readonly session: CheckupSession;
  readonly req: http.IncomingMessage;
  readonly res: http.ServerResponse;
  readonly url: URL;
}
export function getPlan(c: PlanRouteContext): Promise<void>;
export function patchPlan(c: PlanRouteContext): Promise<void>;
export function approvePlan(c: PlanRouteContext): Promise<void>;
export function interpret(c: PlanRouteContext): Promise<void>;
export function planMarkdown(c: PlanRouteContext): Promise<void>;
export function planExport(c: PlanRouteContext): Promise<void>;
export function replan(c: PlanRouteContext): Promise<void>;
export function addPage(c: PlanRouteContext): Promise<void>;
export function addSignIn(c: PlanRouteContext): Promise<void>;
export function includeHost(c: PlanRouteContext): Promise<void>;
export function waitingPlans(c: PlanRouteContext): Promise<void>;
```

`patchPlan` uses the shared `PlanPatchBody` from `@qa/types` (T-201) instead of the inline interface.

## Implementation notes

- **Move, do not rewrite.** Keep every status code, body, `code`, header (`idempotency-key`) and side effect in
  the same order. The 409/422/404 paths and their messages are contract (`docs/API.md` documents many of them).
- Handlers must not import `RunnerServer`. If one needs something the server owns (beta limits, the event bus's
  transports, the AI provider factory), pass it in the context or call it through the session — and if that means
  extending the session, say so in the PR.
- `handlePlanExport` zips a Playwright project (`planToPlaywrightProject`, `zipFiles`) and streams it: keep the
  response writing in the handler, and keep the 404/409 behaviour when no Plan is awaiting review.
- `handleAddSignIn` runs a browser sign-in (`PreFlightChecker`): it stays in the handler, but the session holds the
  result (the role and its saved session), never the handler's local copy.
- The new test file must be the first place a Plan edit is tested as a function: create a session with temp
  folders, write a `StoredPlanRecord` through `session.plan`, then call `patchPlan` with a fake `req`/`res`
  (Buffer body + a minimal `ServerResponse` recorder) and assert on what the session holds and writes. Cover at
  least: items switched off, `intentsOff` with an invalid value refused (400 `ERR_INVALID_INTENTS`), a step aimed
  at something not on the page refused (422) with nothing applied, `approvePlan` with no Plan (404), and the
  credential placeholder replacement on stored steps.
- If a fake `res` is needed, keep it small and local to the test file; do not add a test utility to the source.

## Acceptance criteria

- [ ] `pnpm build` passes.
- [ ] `pnpm exec vitest run packages/runner` is green, with no existing test edited — in particular
      `wizard-endpoints.test.ts`, `test-cap-endpoints.test.ts`, `sources-endpoints.test.ts`,
      `sources-reload.test.ts`, `reapproval-roles.test.ts`, `remembered-signins.test.ts`, `signin-endpoint.test.ts`.
- [ ] `plan-routes.test.ts` imports no `RunnerServer` and opens no port, and covers the five cases listed above.
- [ ] `grep -n "handlePatchPlan\|handleGetPlan\|handleApprovePlan\|handleInterpret\|handleWaitingPlans" packages/runner/src/server.ts` returns nothing (the methods are gone; the rows call `routes/plan.ts`).
- [ ] `packages/runner/src/server.ts` no longer declares `interface PatchPlanBody`; the handler imports the shared
      type.
- [ ] `grep -c "if (pathname" packages/runner/src/server.ts` is still 36, and no reply body, status code or file
      name changed (PR shows the diff).
- [ ] `pnpm exec vitest run packages/runner/tests/route-inventory.test.ts packages/runner/tests/session-state.test.ts`
      still green.
- [ ] The PR states the new line count of `server.ts` and of `routes/plan.ts`.

## Test plan

```
pnpm build
pnpm exec vitest run packages/runner/tests/plan-routes.test.ts
pnpm exec vitest run packages/runner
pnpm test:url-first
```

## Definition of done

All boxes checked; the owned files are the only changes; every existing test passes untouched. Stay within the
files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-207 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Node 22, vitest). Read
docs/plan/checkup-session/tickets/T-207-plan-handlers-as-functions.md and docs/adr/0027-... fully, then implement
exactly the ticket. Move the plan handlers listed in the ticket (server.ts:4077, 4208, 4218, 4442, 4461, 4489,
4512, 4581, 4621, 4670, 4719, 4911, 4949) out of RunnerServer into exported functions in
packages/runner/src/routes/plan.ts operating on a CheckupSession context, move readJsonBody/sendJson/MAX_BODY_CHARS
into packages/runner/src/routes/body.ts (with the class delegating so the unmoved branches still work), delete the
class methods, switch patchPlan to the shared PlanPatchBody from @qa/types, and add
packages/runner/tests/plan-routes.test.ts that drives the handlers directly with a temp session and no
RunnerServer or port. Move bodies, do not rewrite: keep every status code, body, code, header and side effect in
the same order. Do not edit any existing test, do not touch handleTriggerRun/executeRun/executeTesting, and report
rather than guess if a handler needs something the session does not expose. Run the commands in "Test plan". If
.claude/work/DEFER_TESTS exists, write the test but do not run tests. Never print secrets. Work on a branch, not
main.
```
