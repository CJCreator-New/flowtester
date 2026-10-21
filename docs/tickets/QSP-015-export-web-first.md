# QSP-015: F5 export locators and web-first waits

## Goal
The Playwright export uses getByRole/getByText/getByTestId and never a fixed wait.

## In scope
- `packages/core/src/plan/playwright-export.ts`: generated `locatorFor` helper; `sel` uses it; CSS stays `page.locator`; steps with `selectorReason` get a "reason for CSS" comment; a `wait` step with a selector becomes `expect(locator).toBeVisible()`.
- New output only. Refusal helper output unchanged.

## Acceptance criteria
- [x] role=, text=, data-testid and bare-id selectors map to getByRole, getByText, getByTestId.
- [x] No waitForTimeout, sleep or setTimeout in generated files.

## Tests
packages/core/tests/playwright-export.test.ts (new case), plus existing export and refusal-parity tests.

## Dependencies
QSP-014.

## Verification commands
`pnpm exec vitest run packages/core/tests/playwright-export.test.ts packages/core/tests/refusal-parity.test.ts`

## Status
built
