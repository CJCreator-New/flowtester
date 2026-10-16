# T-208 Plan building moves to `@qa/core`

- **Type:** refactor · **Size:** M · **Wave:** 4 · **Depends on:** T-207

## Evidence (architecture audit, 2026-10-15)

- `packages/runner/src/server.ts:3652-3719` `buildPlan(record, sinceLastRun, aiAvailable, reason)` — writes every
  Plan Item's shape, the per-page tests, the navigation checks, the waiting items and the summary. It calls
  `this.testsFor`, `this.gradedChecksFor`, `this.screenSizesOf`, `this.relativeToRun` (thumbnails) and
  `this.siteMapOf`.
- `:3757` `testsFor(context)` → `{ specTestCases, wontRun, notRun, summary }`; `:3748` `screenSizesOf(context)`;
  `:3720` `gradedChecksFor(record)`; `:3789` `siteMapOf(draft, runId)`; `:3813` `handCheckNotes(draft)`;
  `:3647` `emptyPlan(runId, targetUrl)`.
- Callers today: `executeRun` (`:3335, 3344, 3472-3473, 3519`), `buildPlan` itself (`:3661, 3695, 3697`),
  `executeTesting` (`:3768, 3879`), `handlePatchPlan` (`:4333`), `handleAddSignIn` (`:4902`), `handleApprovePlan`
  (`:5148, 5154, 5162`) — the last three are in `routes/plan.ts` after T-207.
- None of these needs HTTP, a browser or a file. They are the runner knowing how a Plan is built.

## Background

`@qa/core` owns the planner (`plan/ai-planner.ts`, `plan/pipeline.ts`, `plan/expand.ts`, `plan/spec-plan.ts`,
`plan/rejects.ts`, `plan/sampling.ts`). The runner already imports thirty-odd plan symbols from it. The functions
that turn a `DiscoveryDraft` into a `ReviewPlan` sit on the other side of the seam, in a class that also serves
HTTP — which is why a change to plan shape touches the server file.

This ticket moves them, keeping them pure: same inputs, same outputs, no IO, no keys, no browser.

## Scope

- New `packages/core/src/plan/build.ts` with `emptyPlan`, `buildPlan`, `testsFor`, `screenSizesOf`,
  `gradedChecksFor`, `siteMapOf` and `handCheckNotes`, moved verbatim.
- `packages/core/src/index.ts`: export the new module in the existing style.
- `packages/runner/src/server.ts` and `packages/runner/src/routes/plan.ts`: replace the calls with the core
  functions; delete the moved methods and the now-unused private helpers they brought with them.
- New `packages/core/tests/plan-build.test.ts` calling the functions directly with a hand-written draft.

## Out of scope

- `prepareAI` (`:3539`), `aiFor` (`:3639`) and `aiSetup` (`:2706`) stay in the runner: they hand out API keys and
  providers, which is policy and IO, not plan building. `aiBudgetFor` (`:3600`) moves **only if** it is pure (no
  key resolver, no network); if it is not, leave it and say so in the PR.
- `executeRun` (`:3205`), `executeTesting` (`:3821`) and their orchestration stay (T-209 moves them to the session).
- `StoredPlanRecord` (`:543`) is **not** moved to `@qa/types`: it carries memory-only fields (`ai.apiKey`,
  `customHeaders`, `tunnelAuth`, `preflight`). Core declares the input it actually reads and the runner's record
  satisfies it structurally (see the contract).
- Any change to the Plan's shape, ordering, counts or wording.

## Files owned

- `packages/core/src/plan/build.ts` (new)
- `packages/core/src/index.ts`
- `packages/core/tests/plan-build.test.ts` (new)
- `packages/runner/src/server.ts`
- `packages/runner/src/routes/plan.ts`

## Files read-only

`packages/core/src/plan/ai-planner.ts`, `plan/pipeline.ts`, `plan/expand.ts`, `plan/sampling.ts`,
`packages/runner/tests/**` (all must pass unchanged; `plan-pipeline.test.ts`, `complete-plan.test.ts` and
`page-coverage.test.ts` are the closest ones), `packages/types/src/**`.

## Interface contract

```ts
// packages/core/src/plan/build.ts
// The shape these functions read, and nothing more. The runner's `StoredPlanRecord['context']` satisfies it
// structurally, so no secret-bearing record type leaves the runner.
export interface PlanBuildContext {
  runId: string;
  targetUrl: string;
  productId: string;
  draft: DiscoveryDraft;
  profile?: ProductProfile;
  breakpoints?: Breakpoint[];
  reportNotes?: string[];
  pageCoverage?: ReleaseReport['pageCoverage'];
  readOnly?: boolean;
  searchChecks?: boolean;
  visibility?: { search: boolean; answers: boolean; aiSearch: boolean; marketing: boolean };
  customTestCases?: boolean;
  testCap?: number;
  /* …every other field the moved bodies read, named exactly as on the record… */
}

/** Today's `emptyPlan`. */
export function emptyPlan(runId: string, targetUrl: string): ReviewPlan;

/** Today's `buildPlan`. The thumbnail address comes in as a function: no file system, no server. */
export function buildPlan(input: {
  context: PlanBuildContext;
  sinceLastRun?: MemorySummary;
  aiAvailable: boolean;
  reason: string;
  /** Today's `this.relativeToRun`: run-relative evidence path → the address used in the Plan. */
  relative?: (file?: string) => string | undefined;
}): ReviewPlan;

/** Today's `testsFor`. */
export function testsFor(context: PlanBuildContext): {
  specTestCases: TestCase[];
  wontRun: /* the current shape */;
  notRun: /* the current shape */;
  summary: /* the current shape */;
};

/** Today's `screenSizesOf`. */
export function screenSizesOf(context: PlanBuildContext): Breakpoint[];

/** Today's `gradedChecksFor`. */
export function gradedChecksFor(context: PlanBuildContext): ReviewPlan['gradedChecks'];

/** Today's `siteMapOf`. */
export function siteMapOf(draft: DiscoveryDraft, runId: string): SiteMapSummary;

/** Today's `handCheckNotes`. */
export function handCheckNotes(draft: DiscoveryDraft): string[];
```

Fill the `wontRun` / `notRun` / `summary` shapes from the current return type rather than retyping them loosely.

## Implementation notes

- **Move, do not rewrite.** The Plan's structure, its per-page tests, its order, its strings and its counts are
  the product; a "while I am here" tidy-up here is a regression risk with no test to catch it beyond the existing
  suites. Port each body line for line and keep the comments.
- `buildPlan` uses `this.relativeToRun(...)` for evidence thumbnails: pass the callback in (`relative`), keep the
  address format `/api/evidence/runs/<runId>/<path>` unchanged.
- Core must not import from the runner and must not read files, keys or the network. If a body needs something
  only the runner has, take it as a parameter and report what you added.
- `@qa/core/src/index.ts` is a barrel of `export *` (~69 lines): add one line, keep the style and the grouping.
  Run `pnpm build` (build order is types → checkers/core → runner).
- The new test file builds a small `DiscoveryDraft` by hand (no crawl, no browser — the point of the move) and
  asserts: `emptyPlan` shape; `screenSizesOf` defaults and explicit values; `testsFor` on a draft with a form, a
  Navigation Check and one Reject; `buildPlan` produces the same structure the runner produced before (diff the
  object from `packages/runner/tests/complete-plan.test.ts`'s fixture if one is usable — read-only).
- If a moved function turns out to depend on `this` state beyond the fields listed, stop and report it rather than
  inventing a parameter.

## Acceptance criteria

- [ ] `pnpm build` passes.
- [ ] `pnpm exec vitest run packages/core/tests/plan-build.test.ts` passes with no browser and no server.
- [ ] `pnpm exec vitest run packages/core` is green and `pnpm exec vitest run packages/runner` is green **with no
      test file edited** — in particular `complete-plan.test.ts`, `plan-pipeline.test.ts`, `pipelined-discovery.test.ts`,
      `page-coverage.test.ts`, `wizard-endpoints.test.ts`, `test-cap-endpoints.test.ts`, `sources-reload.test.ts`.
- [ ] `grep -n "private buildPlan\|private testsFor\|private screenSizesOf\|private gradedChecksFor\|private siteMapOf\|private handCheckNotes\|private emptyPlan" packages/runner/src/server.ts` returns nothing.
- [ ] `grep -rn "from '@qa/core'" packages/runner/src/server.ts` now covers the moved calls (state it in the PR).
- [ ] `packages/core/src/plan/build.ts` contains no `fs`, no `node:` import and no `server`/`http` reference
      (`grep -nE "node:|from 'fs|ServerResponse" packages/core/src/plan/build.ts` returns nothing).
- [ ] No Plan shape, string, order or count changed: the PR shows the existing suites pass untouched.

## Test plan

```
pnpm build
pnpm exec vitest run packages/core/tests/plan-build.test.ts
pnpm exec vitest run packages/core packages/runner
pnpm test:url-first
```

## Definition of done

All boxes checked; the five owned files are the only changes; the runner and core suites pass untouched. Stay
within the files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-208 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Node 22, vitest). Read
docs/plan/checkup-session/tickets/T-208-plan-building-to-core.md and docs/adr/0027-... fully, then implement
exactly the ticket. Move emptyPlan, buildPlan, testsFor, screenSizesOf, gradedChecksFor, siteMapOf and
handCheckNotes out of packages/runner/src/server.ts into a new packages/core/src/plan/build.ts, exporting them
from packages/core/src/index.ts, and update the runner's callers in server.ts and routes/plan.ts. Move the bodies
line for line and keep every Plan structure, string, order and count unchanged; pass the thumbnail address as a
`relative` callback instead of using the server; declare in core only the input fields the bodies actually read.
Do not move prepareAI/aiFor/aiSetup, do not move StoredPlanRecord into @qa/types, and do not edit any existing
test. Add packages/core/tests/plan-build.test.ts, which builds a draft by hand with no browser. Run the commands in
"Test plan". If .claude/work/DEFER_TESTS exists, write the test but do not run tests. Never print secrets. Work on
a branch, not main. If a moved body needs runner-only state, stop and report it.
```
