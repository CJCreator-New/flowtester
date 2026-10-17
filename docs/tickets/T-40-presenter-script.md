# T-40: Presenter script for the demo

## Goal
A presenter can run the demo from one document: start the app, run the golden path with the right labels, and know what to expect on each page.

## Gaps covered
Docs 14 (no presenter script), Demo walkthrough notes (the golden path, the form journey, expected counts).

## In scope
- `docs/DEMO.md` (new): setup (`pnpm bootstrap`, `pnpm fixture`, `pnpm start`), the golden path step by step with the labels as they appear, the test-copy form journey, and what to say about each step.
- Expected findings per fixture page, taken from `fixtures/benchmarks/fixture.json` (the answer key) and the planted defects in `fixtures/test-app/server.js` (~950-974).
- Expected counts for the run are written as ranges, and the presenter is told that the plan count and the testing count can differ (see T-36 and T-37 for the fixes).
- What to show: the verdict stamp, the must-fix list, the download, the developer details.
- Fallback: the sample report in `packages/wizard/public/sample-report.html`.
- Link `docs/DEMO.md` from `docs/README.md`.

## Acceptance criteria
- [ ] Every label in the script appears in the wizard source (grep check listed in the doc).
- [ ] The golden path in the doc matches the screens after T-36 and T-37.

## Tests to update or add (written, not run)
- None, unless the doc's grep check is added as a test (`packages/runner/tests/checkup-docs.test.ts` already checks docs; extend it to `DEMO.md` labels).

## Dependencies
T-36 and T-37 (labels must be final).

## Verification commands (deferred)
`pnpm exec vitest run packages/runner/tests/checkup-docs.test.ts`

## Status
todo

## Carried over from T-37b
- The command palette item reads "Jump to Requirements and design notes", but its section is now "Product context and design notes". Make the palette item match the section name, and use the section name in the script.
