# T-33: Checkers report only what they verified

## Goal
A check that could not run is reported as not verified, never as passed. A refused page passes a Denial check. AI findings cannot block a release.

## Gaps covered
Core 3 (Denial item refused counted as a Blocker, `spec-plan.ts:190-206`, `spec-conformance.ts:225-245`), Core 5 (AI visual findings count in the verdict, `visual-review.ts:86`, `scoring.ts:139-148`), Core 6 (failed performance probe passes silently, `performance.ts:369-375`, `orchestrator.ts:220-223`; same for seo, geo, aeo, marketing returning `null`), Core 9 (`mergeDuplicateFindings` drops a confirmed Major, `finding-groups.ts:22-31`), Core 13 (skipped results still count their checkers, `orchestrator.ts:1322`), Docs 6 (security header checks never receive response headers, `orchestrator.ts:1074-1081`, `security.ts:273`).

## In scope
- `packages/checkers/src/spec-conformance.ts`: in the negate branch, a 401, 403 or 404 response counts as refused (pass). Only a 2xx raises the Blocker.
- `packages/checkers/src/performance.ts` and the callers of seo, geo, aeo, marketing: a `null` result becomes a "Could not verify" outcome, shown in the report and counted under "Not checked" (T-30).
- `packages/core/src/visual-review.ts`: clamp AI-proposed severity to Minor or Suggestion, and mark every AI finding advisory.
- `packages/core/src/scoring.ts` (AI exemption): AI-advisory findings do not change the verdict or the grade caps.
- `packages/core/src/finding-groups.ts`: merge keeps the highest severity and `needsConfirmation: false` if any member is confirmed.
- `packages/core/src/orchestrator.ts`: skipped results carry no checks; pass `responseHeaders` of the main document to `securityChecker.checkPage`.

## Acceptance criteria
- [ ] A Denial item on a page that returns 403 passes; a 200 fails with a Blocker.
- [ ] A performance probe that errors shows "Could not verify", never "Fast and mobile-ready" passed.
- [ ] AI-advisory findings do not change the verdict.
- [ ] Merging duplicates keeps the confirmed Major.
- [ ] HSTS and nosniff checks receive headers and can fire.

## Tests to update or add (written, not run)
- `packages/checkers/tests/spec-conformance*.test.ts`: refused vs served.
- `packages/checkers/tests/performance.test.ts`: null result is "could not verify".
- `packages/core/tests/visual-review.test.ts`: severity clamp; AI advisory excluded from verdict.
- `packages/core/tests/finding-groups.test.ts`: confirmed Major survives a Minor duplicate.
- `packages/checkers/tests/security.test.ts`: headers reach the HSTS and nosniff checks.

## Dependencies
Uses T-30's `Not checked` counts. Can be built in parallel.

## Verification commands (deferred)
`pnpm exec vitest run packages/checkers packages/core/tests/visual-review.test.ts packages/core/tests/finding-groups.test.ts`

## Status
todo
