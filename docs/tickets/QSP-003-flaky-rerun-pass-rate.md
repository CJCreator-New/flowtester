# QSP-003: F1 rerun, pass rate, likely cause

## Goal
A failing test reruns up to N times in a clean context; Flaky Passed shows the pass rate and a likely cause. Verdict unchanged.

## In scope
- `packages/core/src/retry-runner.ts`: passes, attempts, passRate, likelyCause on telemetry; error text through `redactUrl`; stops at first pass.
- `packages/core/src/flaky-cause.ts` (new): `categoriseFlakyCause`, timing / state-leakage / network / unknown, from evidence only.
- `packages/core/src/orchestrator.ts`: run option `flakyReruns` (default 3; link tests 0); SendGuard still declines a retry after a send.
- `packages/core/src/reporter.ts`: "N of M passed; likely cause: X" lines under the flaky note.
- `docs/CONFIGURATION.md`: `flakyReruns`.
- Out of scope: quarantine, skipping, timeout changes, gate or `releaseVerdict` edits.

## Acceptance criteria
- [x] Failing test reruns up to 3 times by default; 1 + 3 attempts then FAILED.
- [x] Stops at first pass; pass rate = passes / attempts made ("1 of 2").
- [x] Flaky Passed adds no Finding; verdict unchanged.
- [x] No quarantine or skip field; no timeout raised by the retry code.
- [x] Error text redacted before it is stored.
- [x] `flaky-retry.test.ts` still sees `loads === 2`.

## Tests
packages/core/tests/flaky-cause.test.ts, flaky-rerun.test.ts; existing flaky-retry, parallel-retry, retry-no-duplicates, missing-element (now passes `flakyReruns: 1`, it measures one retry).

## Dependencies
QSP-002.

## Verification commands
`pnpm exec vitest run packages/core/tests/flaky-cause.test.ts packages/core/tests/flaky-rerun.test.ts packages/core/tests/flaky-retry.test.ts packages/core/tests/parallel-retry.test.ts packages/core/tests/retry-no-duplicates.test.ts packages/core/tests/missing-element.test.ts --no-file-parallelism`

## Status
built
