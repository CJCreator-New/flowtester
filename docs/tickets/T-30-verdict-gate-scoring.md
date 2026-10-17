# T-30: One ready-to-release rule, honest grades

## Goal
One definition of "ready to release", used by the verdict, the CLI exit code, the report stamp and the grades. Coverage that did not run is shown, never counted as a pass.

## Gaps covered
Demo review: Core 1 (verdict and gates), Core 2 (coverage and grade of unchecked areas), Core 4 (overall grade contradicts verdict), Core 7 (crash grade from title text), Core 8 (completion always 100%), Core 12 (missing "What this did not check"), Docs 5 (four definitions).

## In scope
- `packages/types/src/verdict.ts`: `DEFAULT_RELEASE_GATES` and `releaseVerdict`. Standard = 0 Blockers and every area C or better (PRD FR-8.2). Lenient and Strict keep their shape, documented in one comment.
- `packages/runner/src/checkup.ts` (exit code, stamp): both call the same gate function.
- `packages/core/src/scoring.ts`: overall grade capped at the worst area grade. An area with no checks run has grade `null`, and the overall grade is `null` when no area was checked.
- `scoring.ts` crash grade: use the structured status (`is5xx` on the finding), not `title.includes('500')` (lines around 160-169).
- `packages/core/src/orchestrator.ts` (completion): `passed / total`, not `total / total`.
- `packages/core/src/reporter.ts` and the HTML report: a "What this did not check" section, listing skipped tests and areas not checked (ADR 0018).
- Coverage passed into the verdict: "Not checked" counts appear in the verdict text.

## Carried over from T-33
- T-33 reports a check that could not run as a `could-not-verify` Suggestion finding (`packages/checkers/src/could-not-verify.ts`). Count those under "Not checked" for the area, not as findings that lower the grade or pass silently. Check the verdict and report agree.

## Out of scope
Wizard copy (T-31). Plan approval (T-32).

## Acceptance criteria
- [ ] `releaseVerdict` is the only place the rule is defined. CLI exit code and stamp agree on every fixture.
- [ ] A Blocker fails; one Major with all areas at C or better does not fail Standard, but lowers that area's grade.
- [ ] An area with zero checks run has grade `null`, never 100.
- [ ] Overall grade cannot exceed the worst area grade.
- [ ] A 404 on `/items/500` does not produce a crash grade.
- [ ] Completion reads passed/total.
- [ ] The report has a "What this did not check" section, and it is empty-safe.

## Tests to update or add (written, not run)
- `packages/types/tests/*verdict*` (or nearest): gate matrix, Blocker vs Major, Strict and Lenient.
- `packages/core/tests/scoring.test.ts`: cap at worst area, `null` for unchecked, crash grade from status.
- `packages/core/tests/recommendations.test.ts`, `html-report.test.ts`: new section, completion wording.
- `packages/runner/tests/checkups.test.ts` or the CLI test: exit code matches stamp.

## Dependencies
None. T-31 depends on this ticket's constants.

## ADR needed
Record the gate decision in ADR 0018's text or a short new ADR (decision 1 in DEMO-READINESS-PLAN).

## Verification commands (deferred)
`pnpm exec vitest run packages/types packages/core/tests/scoring.test.ts packages/runner/tests`

## Status
built
