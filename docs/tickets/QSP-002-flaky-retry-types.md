# QSP-002: F1 retry telemetry fields

## Goal
Room for pass rate and likely cause on retry telemetry.

## In scope
- `packages/types/src/hub.ts`: optional `passes`, `attempts`, `passRate`, `likelyCause` on `RetryTelemetryEntry`.

## Acceptance criteria
- [x] Optional only; old entries type-check.
- [x] `pnpm build` green.

## Tests
packages/types/tests/qaskills-types.test.ts (type test).

## Dependencies
None.

## Verification commands
`pnpm build`; `pnpm exec vitest run packages/types/tests/qaskills-types.test.ts packages/types/tests/checkup-api.test.ts`

## Status
built
