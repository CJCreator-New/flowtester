# T-32: A plan runs only what the person saw

## Goal
When expansion yields no tests, the plan says so. It never runs a test the person did not review.

## Gaps covered
Core 2 (empty plan substitutes "Home page sanity check", which passes and was never shown).

## In scope
- `packages/core/src/plan/build.ts` (~94, ~106): `testsFor` no longer substitutes `defaultTestCase()`. An empty expansion yields an empty list, and the plan records a reason (`noTests`).
- `packages/core/src/plan/*`: the planner's empty case has a labelled "Nothing to test" reason that the plan review shows.
- Approval refusal is done in T-35 (it owns `routes/plan.ts`). This ticket only makes the plan honest.

## Acceptance criteria
- [ ] A plan with zero tests has `noTests` set and no default test case.
- [ ] `defaultTestCase` is no longer referenced on any path that produces a runnable plan (grep confirms).

## Tests to update or add (written, not run)
- `packages/core/tests/plan-pipeline.test.ts` and `build` tests: an empty expansion has no test case, and `noTests` is set.
- Any test that relied on the substituted "Home page sanity check".

## Dependencies
None.

## Verification commands (deferred)
`pnpm exec vitest run packages/core/tests/plan-pipeline.test.ts packages/core/tests`

## Status
built
