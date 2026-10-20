# QSP-007: F3 smoke preset types

## Goal
Start body can ask for a Smoke Check-up; report can list what it did not check.

## In scope
- `packages/types/src/checkup-api.ts`: `RunStartBody.preset?: 'smoke'`, `healthPath?`, `expectedVersion?`.
- `packages/types/src/run-report.ts`: optional `ReleaseReport.notChecked`.
- `PlanPatchBody.preset` stays `'quick'`.

## Acceptance criteria
- [x] Optional only.
- [x] `PlanPatchBody['preset']` test unchanged and green.
- [x] `pnpm build` green.

## Tests
packages/types/tests/qaskills-types.test.ts (type test).

## Dependencies
None.

## Verification commands
`pnpm build`; `pnpm exec vitest run packages/types/tests/qaskills-types.test.ts packages/types/tests/checkup-api.test.ts`

## Status
built
