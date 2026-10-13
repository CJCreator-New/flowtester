# T-105 Redacted debug logger and CI/CLI debug switch

- **Type:** feature · **Size:** S · **Wave:** 1 · **Depends on:** T-101
- **Gaps addressed:** G-006 (switch and log sink), G-003 (log sink for step names), G-018 (CLI side)

## Gaps addressed (evidence copied in)
- G-006: `grep -rn "DEBUG\|QA_DEBUG\|VERBOSE" packages/*/src docs/CONFIGURATION.md .env.example` returns 0 matches; `deterministic-spider.ts` has 0 `console.` calls; crawl logging is only totals at `discovery-agent.ts:358,451`.
- G-003: `preflight.ts` has no `console` call; failures leave no trace.
- G-018: `packages/runner/src/checkup.ts:172-174` ignores an invalid `QA_CUSTOM_HEADERS` JSON silently; `checkup.ts:9` header comment says `QA_FAIL_ON` default is "blocker" while `:141-143` defaults to `standard`; `QA_CONCURRENCY`, `QA_DELAY_MS`, `QA_CUSTOM_HEADERS` are not in the header comment (`:7-20`).

## Background
Other tickets emit per-route and per-sign-in-step diagnostics. They need one place that checks whether debugging is on and redacts what it prints. Project conventions (copied): never print passwords, typed text, page text or header values; use `redactUrl` from `packages/core/src/redact.ts` for URLs; log to stderr. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
New `debug-log.ts`; `checkup.ts` option `--debug [areas]` that sets `process.env.QA_DEBUG`; error (exit 2) on invalid `QA_CUSTOM_HEADERS` / `--header`; correct the header comment.

## Out of scope
Adding log calls to preflight/spider/orchestrator (T-110, T-111, T-114); docs (T-119); exporting from `packages/core/src/index.ts` (not needed: core files import it by relative path, `checkup.ts` only sets the env var).

## Files owned
- `packages/core/src/debug-log.ts` (new)
- `packages/core/tests/debug-log.test.ts` (new)
- `packages/runner/src/checkup.ts`
- `packages/runner/tests/checkup-credentials.test.ts`, `packages/runner/tests/checkup-debug.test.ts` (new)

## Files read-only
`packages/core/src/redact.ts`, `packages/types/src/input-rules.ts`.

## Interface contract
```ts
// packages/core/src/debug-log.ts
export type DebugArea = 'crawl' | 'auth' | 'nav';
export function debugEnabled(area: DebugArea): boolean;
//   QA_DEBUG is a comma list of areas, or 'all', '1', 'true'. Read lazily on every call (tests change the env).
export function debugLog(area: DebugArea, message: string, fields?: Record<string, string | number | boolean | undefined>): void;
//   When enabled: console.error(`[qa:${area}] ${message} k=v ...`). String fields named /url|path|from|to|location/i go through redactUrl.
//   Fields whose key matches /pass|secret|token|cookie|header|authorization/i are never printed (key shown, value '[hidden]').
//   No-op when disabled. Never throws.
```
`checkup.ts`: `--debug` (all areas) or `--debug crawl,auth`; sets `process.env.QA_DEBUG` before the runner starts. Invalid `QA_CUSTOM_HEADERS` JSON or invalid `--header` line prints `QA_CUSTOM_HEADERS is not valid` (no value) and exits 2.

## Implementation notes
- Use `parseHeaderText` from `@qa/types` for `--header` lines; keep the existing JSON parse for `QA_CUSTOM_HEADERS` but surface failure.
- Fix the header comment so it lists `QA_CONCURRENCY`, `QA_DELAY_MS`, `QA_CUSTOM_HEADERS`, `QA_DEBUG`, and says `QA_FAIL_ON` default is `standard` (match the code at `:141-143`).

## Acceptance criteria
- [x] `QA_DEBUG=crawl` enables only `crawl`; unset or `''` disables all; `all` enables all (unit test).
- [x] A field `{ url: 'https://a.test/x?token=abc' }` prints the redacted URL; a field `{ authorization: 'Bearer z' }` prints `[hidden]`; the text `Bearer z` never appears in captured stderr.
- [x] `checkup` with `QA_CUSTOM_HEADERS='{bad'` exits 2 with a message that does not contain `{bad`.
- [x] Evidence for G-006 (no debug switch) no longer holds: `grep -rn QA_DEBUG packages/core/src packages/runner/src` finds the new code.
- [x] `pnpm build` passes.

## Test plan
```
pnpm exec vitest run packages/core/tests/debug-log.test.ts packages/runner/tests/checkup-debug.test.ts packages/runner/tests/checkup-credentials.test.ts
pnpm build
```

## Definition of done
Boxes checked; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-105 in the QA Flow Tester repo. Read docs/plan/tickets/T-105-debug-telemetry-logger.md and implement it. Create packages/core/src/debug-log.ts (debugEnabled/debugLog, reads QA_DEBUG lazily, redacts URL fields with redactUrl, hides secret-looking keys), add --debug and strict header parsing to packages/runner/src/checkup.ts, fix its header comment, and add the listed tests. Edit only the files under "Files owned". Never print secret values or header values. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main.
```
