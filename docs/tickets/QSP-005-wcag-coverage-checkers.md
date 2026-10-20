# QSP-005: F2 WCAG criterion coverage and alt-text review (checkers)

## Goal
Each page reports a WCAG status per criterion, and meaningless alt text is "could not verify", never a pass or a defect.

## In scope
- `packages/checkers/src/ux-quality.ts`: pure `summariseWcag`, optional `onCoverage` in `check()`, alt-text review via `couldNotVerifyFinding`. Axe tags unchanged (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa). Severity map and gate unchanged.
- `packages/checkers/src/keyboard-a11y.ts`: optional `onCoverage` reports 2.1.1, 2.1.2, 2.4.11, 1.4.10.
- `packages/checkers/src/could-not-verify.ts`: checker union widened with `'ux-quality'` (the file lives in checkers, not core).

## Acceptance criteria
- [x] Every mapped result carries its WCAG criterion; a violation tag with no criterion goes to `unmappedTags`, the finding is still emitted.
- [x] Statuses: violated, none-found, needs-human-judgment. No "passes" or "compliant" wording, no percentage.
- [x] 1.1.1 is needs-human-judgment when images exist (unless violated).
- [x] Alt such as `IMG_1234.png` gives a Suggestion with `needsConfirmation`.
- [x] Gate untouched: critical -> Blocker, serious -> Major (blocks only under strict).

## Tests
`packages/checkers/tests/wcag-coverage.test.ts`, `packages/checkers/tests/alt-text-quality.test.ts`; existing `design-ux-checkers.test.ts`, `keyboard-a11y.test.ts` stay green.

## Dependencies
QSP-004.

## Verification commands
`pnpm exec vitest run packages/checkers/tests/wcag-coverage.test.ts packages/checkers/tests/alt-text-quality.test.ts packages/checkers/tests/design-ux-checkers.test.ts packages/checkers/tests/keyboard-a11y.test.ts --no-file-parallelism`

## Status
built
