# QSP-013: F5 selectorReason type

## Goal
A step can say why CSS was used.

## In scope
- `packages/types/src/test-case.ts`: optional `selectorReason` on `TestCaseStep`.

## Acceptance criteria
- [x] Optional only; old plans type-check.
- [x] `pnpm build` green.

## Tests
packages/types/tests/qaskills-types.test.ts (type test).

## Dependencies
None.

## Verification commands
`pnpm build`; `pnpm exec vitest run packages/types/tests/qaskills-types.test.ts packages/types/tests/checkup-api.test.ts`

## Status
built
