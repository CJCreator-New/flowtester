# T-101 Shared contracts: route telemetry, sign-in step, input rules, shared coverage type

- **Type:** refactor (contract) · **Size:** S · **Wave:** 0 · **Depends on:** none
- **Gaps addressed:** G-003 (type for `failedStep`), G-006 (telemetry type), G-018 (shared header/role rules), G-049 (one `PageCoverage` type)

## Gaps addressed (evidence copied in)
- G-006: `packages/core/src/discovery/deterministic-spider.ts:54-57` `SkippedPage` is `{urlPath, why}` with only `page-limit | did-not-load | robots | sign-in`; no status, final path or detail anywhere.
- G-049: `packages/types/src/discovery.ts:157-161` and `packages/types/src/run-report.ts:86-90` declare the same inline `pageCoverage` literal.
- G-003: `packages/core/src/preflight.ts:275-278` only returns `unreachable` / `no-form`; there is no step name in `packages/types/src/signin.ts`.
- G-018: three separate header parsers (`packages/wizard/src/lib/form.ts:136-143`, `packages/runner/src/run-inputs.ts:190-225`, `packages/runner/src/checkup.ts:166-182`) and no role-name rule.

## Background
Later tickets add telemetry, a sign-in step name and shared input validation. They must agree on one set of types. This ticket adds those types as pure, browser-safe modules so wizard, runner and core can import them. Project conventions (copied): pnpm monorepo, TypeScript, Node 22, vitest. Build order is types, then checkers/core, then runner; run `pnpm build` after touching types. The wizard imports single modules from `@qa/types/src/...`, so new modules must have no Node imports. Never print secrets. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
Add the files and types below; make `discovery.ts` and `run-report.ts` use the shared `PageCoverage`; add the barrel exports; extend `SKIP_WHY` in `packages/core/src/issues-document.ts:127` (typed `Record<... ['why'], string>`, so it must list every new reason or the build fails) with plain wording: `http-error` 'the site answered with an error', `timeout` 'took too long to load', `off-site-redirect` 'sent to another site', `time-limit` 'stopped to avoid an endless crawl', `trap-limit` 'stopped to avoid an endless crawl', `session-lost` 'signed out part-way', `duplicate` 'same page as another'.

## Out of scope
Using the types anywhere else (other tickets do that); changing runtime behaviour.

## Files owned
- `packages/types/src/route-telemetry.ts` (new)
- `packages/types/src/input-rules.ts` (new)
- `packages/types/src/signin.ts`
- `packages/types/src/evidence-finding.ts` (add two optional fields to `RoleCredential`)
- `packages/types/src/discovery.ts`
- `packages/types/src/run-report.ts`
- `packages/types/src/index.ts`
- `packages/core/src/issues-document.ts` (extend `SKIP_WHY` only)
- `packages/types/tests/route-telemetry.test.ts` (new), `packages/types/tests/input-rules.test.ts` (new)

## Files read-only
`packages/core/src/discovery/deterministic-spider.ts`, `packages/runner/src/run-inputs.ts`, `packages/wizard/src/lib/form.ts` (other tickets change them).

## Interface contract
```ts
// packages/types/src/route-telemetry.ts
export type RouteSkipReason =
  | 'page-limit' | 'did-not-load' | 'robots' | 'sign-in'            // existing, keep exact strings
  | 'http-error' | 'timeout' | 'off-site-redirect'
  | 'time-limit' | 'trap-limit' | 'session-lost' | 'duplicate';
export interface RouteTelemetry {
  requestedPath: string;        // redacted path + query, never secrets
  status?: number;              // main-frame HTTP status
  finalPath?: string;           // after redirects (redacted)
  redirectChain?: string[];     // redacted paths/URLs, in order
  outcome: 'recorded' | 'skipped';
  skipReason?: RouteSkipReason;
  detail?: string;              // short fixed wording, never page text
  attempts: number;
  durationMs: number;
  who?: string;                 // 'visitor' or a role name
}
export interface SkippedPageInfo { urlPath: string; why: RouteSkipReason; status?: number; finalPath?: string; detail?: string }
export interface PageCoverage { found: number; reached: number; skipped: SkippedPageInfo[]; routes?: RouteTelemetry[] }

// packages/types/src/signin.ts (add)
export const SIGN_IN_STEPS = ['goto','find-fields','opener','username','next','password','submit','post-submit-check'] as const;
export type SignInStep = typeof SIGN_IN_STEPS[number];
// Existing SignInFailureReason / SIGN_IN_FAILURE_REASONS are unchanged. Do not add free text.

// packages/types/src/evidence-finding.ts: RoleCredential gains two optional, non-secret fields
//   postLoginSelector?: string;  // a selector that exists only when signed in
//   postLoginUrl?: string;       // a path the page should land on after sign-in (relative to the target)

// packages/types/src/input-rules.ts (pure, no Node imports)
export const ROLE_NAME_PATTERN: RegExp;             // /^[A-Za-z0-9_-]{1,40}$/
export const HEADER_NAME_PATTERN: RegExp;           // RFC 7230 token
export const MAX_CUSTOM_HEADERS = 20;
export const MAX_HEADER_VALUE_LENGTH = 2048;
export function isSafeHeaderValue(v: string): boolean;   // no CR, LF, NUL; length cap
export function parseHeaderText(text: string): { headers: Record<string,string>; errors: string[] }; // "Name: value" per line; errors name the 1-based line, never the value
```

## Implementation notes
- Keep the four existing `why` strings byte-identical (wizard and issues docs match on them: `packages/core/src/issues-document.ts` `SKIP_WHY`). New values are additive.
- `discovery.ts` `exploration.pageCoverage` and `run-report.ts` `pageCoverage` become `PageCoverage` imported from `./route-telemetry.js`. `routes` is optional so old reports still parse.
- `index.ts`: add `export * from './route-telemetry.js'` and `'./input-rules.js'`. Keep the existing order/style.
- `parseHeaderText`: split on `\n`, trim, skip empty lines, split at the first `:`; reject names failing `HEADER_NAME_PATTERN`, unsafe values, more than `MAX_CUSTOM_HEADERS`; duplicates: last wins.

## Acceptance criteria
- [x] `pnpm build` passes with the widened union (types, checkers/core, runner, wizard still compile); `SKIP_WHY` has an entry for all 11 reasons.
- [x] `grep -rn "why: 'page-limit'" packages/types/src` shows the inline union is gone from `discovery.ts` and `run-report.ts` (they import `PageCoverage`).
- [x] The evidence for G-049 no longer holds: only one declaration of the coverage shape exists in `packages/types/src`.
- [x] `parseHeaderText('X-A: 1\nbad line\nX B: 2')` returns `X-A` and two errors that name lines 2 and 3 and never contain the value text.
- [x] `isSafeHeaderValue('a\r\nb')` is false; `ROLE_NAME_PATTERN.test('../x')` is false.
- [x] Existing wizard bundle still builds (`pnpm --filter @qa/wizard build` or `pnpm build`): no Node import in the new modules.

## Test plan
```
pnpm exec vitest run packages/types/tests/route-telemetry.test.ts packages/types/tests/input-rules.test.ts
pnpm build
pnpm exec vitest run packages/core/tests/page-coverage.test.ts
```

## Definition of done
All acceptance boxes checked; build green; changes only in the files owned. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-101 in the QA Flow Tester repo (pnpm monorepo, TypeScript). Read docs/plan/tickets/T-101-shared-contracts.md fully and implement exactly it. Only edit the files listed under "Files owned" (including `issues-document.ts` `SKIP_WHY`). Add pure browser-safe type modules (route-telemetry.ts, input-rules.ts), extend signin.ts with SIGN_IN_STEPS/SignInStep, make discovery.ts and run-report.ts use the shared PageCoverage, export from index.ts, and add the two test files. Keep the four existing skip reason strings unchanged. Run the commands in "Test plan"; if .claude/work/DEFER_TESTS exists, write tests but do not run them. Never print secrets. Work on a branch, not main. If something blocks you, stop and report the blocker instead of editing files you do not own.
```
