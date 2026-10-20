# QSP-004: F2 wcagCoverage types

## Goal
Report type can carry per-criterion WCAG status.

## In scope
- `packages/types/src/run-report.ts`: `WcagCriterionStatus`, `WcagCoverageEntry`, optional `ReleaseReport.wcagCoverage` and `wcagUnmappedTags`.

## Acceptance criteria
- [x] Optional only; old reports load.
- [x] `pnpm build` green.

## Tests
packages/types/tests/qaskills-types.test.ts (type test).

## Dependencies
None.

## Verification commands
`pnpm build`; `pnpm exec vitest run packages/types/tests/qaskills-types.test.ts packages/types/tests/checkup-api.test.ts`

## Status
built
