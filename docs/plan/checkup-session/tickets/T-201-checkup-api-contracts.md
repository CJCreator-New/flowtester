# T-201 Check-up API contracts in `@qa/types`

- **Type:** refactor (contract) · **Size:** S · **Wave:** 0 · **Depends on:** none

## Evidence (architecture audit, 2026-10-15)

- `packages/runner/src/server.ts:422` `export interface TriggerRunBody { … }` — the run-start body (`targetUrl`,
  `roles`, `contextDocuments`, `contextUrl`, `customHeaders`, `aiCap`, `maxPages`, `testCap`, `skipReview`, `mode`,
  `owner`, `signInConsent`, …).
- `packages/wizard/src/api.ts:359` `export interface StartRunRequest { … }` — the same request body, a different
  name and a different field list, maintained by hand at the other end.
- `packages/runner/src/server.ts:4225` `interface PatchPlanBody` is declared _inside_ `handlePatchPlan`;
  `packages/wizard/src/api.ts:490` declares the same interface again, exported, comments copied.
  `PlanActions` indexes into it (`packages/wizard/src/components/plan/PlanDocument.tsx:60,88-91`).
- `packages/wizard/src/api.ts:70` `export interface RunnerStatus` against the inline object written at
  `packages/runner/src/server.ts:1099`; `RunnerPhase` shows both ends _can_ share a type (it already lives in
  `@qa/types` and is imported by `server.ts`).
- `packages/runner/src/server.ts:4949-5205` `handleApprovePlan` writes its reply as a bare literal, and the
  wizard's `approvePlan` (`packages/wizard/src/api.ts:609`) declares its own return type.

## Background

The check-up API is the contract between `packages/runner` and `packages/wizard`, and between the runner and
`checkup.ts`. Today both ends carry copies, so a field added on one side is invisible on the other until something
fails at run time. The layer that exists for shared types (`packages/types`) is where the copies belong.

Conventions (copied): pnpm monorepo, TypeScript (`strict`, NodeNext), Node 22, vitest. Build order is
`types` → `checkers`/`core` → `runner`; run `pnpm build` after touching types. `packages/types/src/index.ts` is a
barrel of `export *` over area files. The wizard imports browser-safe modules from source
(`@qa/types/src/x.js`), so **a module the wizard may import must not use `node:` built-ins** — this one is
types-only, so keep it that way (`import type` only, no runtime code, no `node:crypto`).

## Scope

- New `packages/types/src/checkup-api.ts` holding: `RunStartBody` (from `TriggerRunBody`), `PlanPatchBody` (from
  the wizard's exported copy, which carries the comments), `RunnerStatusReply`, `RunStartReply`, `ApprovalReply`.
- `packages/types/src/index.ts`: add the barrel export in the existing style.
- `packages/wizard/src/api.ts`: keep its exported names working (`PatchPlanBody`, `RunnerStatus`, `StartRunRequest`)
  but make them aliases of the shared ones instead of declarations — `export type { PatchPlanBody } from '@qa/types'`,
  `StartRunRequest` as `RunStartBody` (plus wizard-only fields, if any, as an intersection), and the client's
  `RunnerStatus` built on `RunnerStatusReply` plus its own client-only field (`busy`). The wizard keeps its client;
  it stops carrying the contract.
- New `packages/types/tests/checkup-api.test.ts` pinning the shapes so a field cannot disappear unnoticed.
- Report, in the PR, every field where the two existing declarations disagree (name, type or presence) instead of
  silently picking one.

## Out of scope

Changing the runner or the wizard to use the new types (T-207 does the server; the wizard's `api.ts` is a later,
separate change), changing any reply body or status code, moving `RunnerStatus.busy` (beta-only, see notes), and
any behaviour.

## Files owned

- `packages/types/src/checkup-api.ts` (new)
- `packages/types/src/index.ts`
- `packages/types/tests/checkup-api.test.ts` (new)
- `packages/wizard/src/api.ts` (only the shape declarations and their imports)

## Files read-only

`packages/runner/src/server.ts`, `packages/types/src/plan.ts`,
`packages/types/src/discovery.ts`, `packages/types/src/verdict.ts`, `docs/API.md` (the documented bodies are the
reference for names; the handlers are the source of truth).

## Interface contract

```ts
// packages/types/src/checkup-api.ts — pure types, no runtime code, no node: imports
/** POST /api/runner/run body. Moved from server.ts:422 (TriggerRunBody). */
export interface RunStartBody {
  targetUrl: string;
  /* … every field and comment of TriggerRunBody, unchanged in name and type … */
}
/** POST /api/runner/run reply. */
export interface RunStartReply {
  runId: string;
  /* … every other field the success branch writes … */
}
/** PATCH /api/runner/plan body. Moved from wizard/src/api.ts:490 (kept names, kept comments). */
export interface PlanPatchBody {
  flows?: DiscoveredFlow[];
  questions?: Array<{ id: string; selectedAnswer: string }>;
  answers?: Record<string, string>;
  testCases?: TestCase[];
  productContext?: string;
  designNotes?: string;
  items?: Array<{ id: string; skipped: boolean }>;
  screenSizes?: Breakpoint[];
  expectations?: Array<{ id: string; text?: string }>;
  preset?: 'quick';
  sourceEdits?: Array<{
    itemId: string;
    roles?: string[];
    severity?: FindingSeverity;
    stale?: boolean;
    confirm?: boolean;
  }>;
  notFoundEdits?: Array<{ id: string; remove?: boolean }>;
  intentsOff?: PlanIntent[];
}
/** GET /api/runner/status reply, exactly the fields server.ts:1099 writes. */
export interface RunnerStatusReply {
  isRunning: boolean;
  hasReport: boolean;
  lastRunError: string | null;
  lastErrorCode: string | null;
  phase: RunnerPhase;
  hasPlan: boolean;
  runId: string | null;
  targetUrl: string | null;
  reportRunId: string | null;
  beta: boolean;
}
/** POST /api/runner/plan/approve reply (success), from handleApprovePlan's success branch. */
export interface ApprovalReply {
  /* fields read off the success sendJson calls; no invention */
}
```

## Implementation notes

- Take the _wire_ names from the handlers, not from the wizard, when the two differ: the runner is what answers.
  `RunStartBody` therefore comes from `TriggerRunBody`; if `StartRunRequest` has a field `TriggerRunBody` lacks,
  add it (optional, if the runner ignores it) and note it in the PR.
- `PlanPatchBody` — the two copies are textually the same today; use the wizard's (it documents each field).
- `RunnerStatusReply.phase` is `RunnerPhase`, already exported from `@qa/types` (server.ts imports it). Do not
  declare a second phase union.
- Do not move `RunnerStatus.busy`: the server's status branch does not write it. If the wizard derives it
  elsewhere, leave it in the wizard and say so in the PR.
- `PATCH /api/runner/plan` also accepts `intentsOff: string[]` on the wire before validation; the type stays
  `PlanIntent[]` (the handler validates and refuses unknown values with `ERR_INVALID_INTENTS`).
- Keep the module free of values: interfaces and type aliases only, so the wizard bundle cannot grow a Node
  dependency through it.
- Keep the existing `index.ts` ordering style; add one line.

## Acceptance criteria

- [ ] `pnpm build` passes (types, checkers, core, runner, wizard).
- [ ] `packages/types/src/checkup-api.ts` contains no `import` of a `node:` module and no runtime statement other
      than type declarations (`grep -n "node:" packages/types/src/checkup-api.ts` returns nothing).
- [ ] Every field of the five interfaces is asserted in `packages/types/tests/checkup-api.test.ts` with
      `expectTypeOf` (object literal `satisfies` per interface), so removing or retyping a field fails the test.
- [ ] The PR lists any field where `TriggerRunBody` and `StartRunRequest`, or the two `PatchPlanBody` copies, or
      the wizard's `RunnerStatus` and the status branch, disagree — with the decision taken.
- [ ] `grep -nE "^(export )?interface (PatchPlanBody|StartRunRequest|RunnerStatus)" packages/wizard/src/api.ts` returns
      nothing: the wizard re-exports or aliases the shared types instead of declaring them.- [ ] `pnpm --filter @qa/wizard build` passes and the wizard's tests pass unchanged (the commands are in
      "Test plan").
- [ ] No file other than the four owned ones changed.

## Test plan

```
pnpm exec vitest run packages/types/tests/checkup-api.test.ts
pnpm build
pnpm exec vitest run packages/runner/tests/runner-server.test.ts packages/wizard/tests/start-run.test.ts
pnpm exec vitest run packages/wizard/tests
```

## Definition of done

All boxes checked; the three files are the only changes; the PR carries the disagreement list. Stay within the
files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-201 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Node 22, vitest). Read
docs/plan/checkup-session/tickets/T-201-checkup-api-contracts.md fully and implement exactly it. Create
packages/types/src/checkup-api.ts with RunStartBody (moved from packages/runner/src/server.ts:422), PlanPatchBody
(moved from packages/wizard/src/api.ts:490), RunnerStatusReply (exactly the fields written at
packages/runner/src/server.ts:1099), RunStartReply and ApprovalReply (read the success branches of
handleTriggerRun and handleApprovePlan; do not invent fields). Add the barrel export to
packages/types/src/index.ts and a test in packages/types/tests/checkup-api.test.ts using expectTypeOf. Then make
packages/wizard/src/api.ts re-export or alias the shared shapes (PatchPlanBody, StartRunRequest, RunnerStatus) so
the wizard stops carrying its own copies, keeping its exported names working and its client-only `busy` flag. The
module must be types-only: no node: imports, no runtime code. Do not change the runner or any behaviour; if the two
existing declarations disagree, report it in your PR instead of choosing silently. Run the commands in
"Test plan". If .claude/work/DEFER_TESTS exists, write tests but do not run them. Never print secrets. Work on a
branch, not main.
```
