# QSP-014: F5 selector order and normaliser

## Goal
New generated steps prefer role, text, then test ID; CSS only with a recorded reason.

## In scope
- `packages/core/src/plan/selector-order.ts`: `pickSelector`, `selectorForStep`.
- `packages/core/src/plan/ai-planner.ts`: applied to AI page-test steps and Fixed-Rule Fallback steps (new output only).
- `validator-expander.ts` unchanged: it copies steps, so `selectorReason` carries through (tested).

## Acceptance criteria
- [x] Order role, text, test ID, CSS; "label" folded into role plus accessible name.
- [x] CSS without a reason is never picked; with a reason, `selectorReason` is set.
- [x] No migration and no check at load: a saved plan with CSS and no reason loads, expands and exports unchanged.

## Tests
packages/core/tests/selector-order.test.ts, plan-old-selectors.test.ts.

## Dependencies
QSP-013.

## Verification commands
`pnpm exec vitest run packages/core/tests/selector-order.test.ts packages/core/tests/plan-old-selectors.test.ts packages/core/tests/validator-expander.test.ts packages/core/tests/plan-validator.test.ts`

## Status
built
