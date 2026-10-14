# T-109 Wizard: show crawl coverage and crawl health

- **Type:** feature · **Size:** M · **Wave:** 2 · **Depends on:** T-101, T-108
- **Gaps addressed:** G-019, G-053 (optional)

## Gaps addressed (evidence copied in)

- G-019: `grep -rn pageCoverage packages/wizard/src` returns 0 results; `packages/wizard/src/screens/ReportScreen.tsx:1074-1128` (`SourcesSummary`) renders only `rolesNotTested` and documented items; `packages/wizard/src/App.tsx:235` casts the event `as unknown as ScanProgress` while the producer type is `DiscoveryProgress` (`packages/core/src/discovery/discovery-agent.ts:101`); `ScanningScreen.tsx:7-29,127-141` has one `role="status"` line (stage, path, pages found) with no sign-in, skipped-page or stall information and announces every path.
- G-053 (suspected): `ReportScreen.tsx:1115` puts roles-not-tested under "Living Spec Conformance".

## Background

The report data already carries `pageCoverage` (found, reached, skipped with reasons) and, after T-101, optional per-route telemetry. The wizard never shows it, so a crawl that stopped at the login wall looks healthy. This ticket renders it and makes the scanning screen show crawl health. Project conventions (copied): UI text uses CONTEXT.md terms; the wizard imports single modules from `@qa/types/src/...`; sign-in failure wording is fixed text; screens keep loading/empty/error states and use `aria-live="polite"` sparingly. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope

1. Report screen: "Pages reached X of Y" block and a collapsible list of `pageCoverage.skipped` (path, plain-language reason, status when present). Plain wording per reason: `sign-in` "Needs a sign-in", `robots` "Blocked by robots.txt", `did-not-load` "Did not load", `http-error` "The site answered with an error", `timeout` "Took too long", `off-site-redirect` "Sent to another site", `time-limit` / `trap-limit` "Stopped to avoid an endless crawl", `session-lost` "Signed-out part-way", `page-limit` "Over the page limit", `duplicate` "Same page as another".
2. Give `rolesNotTested` its own heading ("Roles not tested, and why") instead of sitting under the spec heading.
3. Scanning screen: add `signedInAs`, a "sign-in failed for <role>" notice, a skipped count, and a "No new pages for N seconds" warning (client-side timer on `pagesFound`); announce only stage changes via `aria-live="polite"`; make the current path a non-live element.
4. `App.tsx`: store the `needsSignIn` role names from `RunnerError` (added to `api.ts` by T-108) and pass them to `PlanReviewScreen` (`boolean | string[]`), replacing the boolean `approveNeedsSignIn` (`App.tsx:141,634,715`). Keep the last-used header text in memory and resend it on approve / resume / test again; if the runner still answers `needsHeaders`, show the notice "Add your headers again to continue: <header names>" (names only, never values).
5. Replace the `as unknown as ScanProgress` cast with a shared type: import `DiscoveryProgress` from a browser-safe module if one exists in `@qa/types`; if it does not, define `ScanProgress` in `ScanningScreen.tsx` as the single source and narrow with a type guard (no cast).

## Out of scope

Sign-in form (T-108); runner/core event changes (T-113 adds the optional fields; this ticket must tolerate their absence).

## Files owned

`packages/wizard/src/screens/ReportScreen.tsx`, `packages/wizard/src/screens/ScanningScreen.tsx`, `packages/wizard/src/App.tsx`, `packages/wizard/src/lib/coverage-text.ts` (new), `packages/wizard/tests/coverage-view.test.tsx` (new), `packages/wizard/tests/scanning-progress.test.tsx` (new).

## Files read-only

`packages/types/src/*`, `packages/core/src/discovery/discovery-agent.ts`, `packages/wizard/src/components/plan/PlanDocument.tsx` (T-108 owns it).

## Interface contract

- Reads `ReleaseReport.pageCoverage?: PageCoverage` (T-101). Missing field renders nothing (old reports).
- `DISCOVERY_PROGRESS` payload may gain optional `signedInAs?: string`, `signInFailedFor?: string[]`, `skipped?: number` (added by T-113). The wizard treats all three as optional.
- `coverage-text.ts`: `skipReasonText(reason: RouteSkipReason): string` (pure).

## Implementation notes

- Pattern for the section: copy the structure of `RolesNotTestedSection` in `PlanDocument.tsx:1663-1682` (do not edit that file).
- Keep the rendered list accessible: `<details>` with a summary, list items with text, no color-only meaning.
- Do not show query strings; paths in `pageCoverage` are already redacted.

## Acceptance criteria

- [x] A report with `pageCoverage: { found: 10, reached: 6, skipped: [{urlPath:'/a', why:'sign-in'}] }` renders "6 of 10" and "/a ... Needs a sign-in" (test).
- [x] A report without `pageCoverage` renders no coverage block and no error (test).
- [x] `grep -rn "as unknown as ScanProgress" packages/wizard/src` returns 0.
- [x] A pure helper `headersNotice(names: string[]): string` returns the notice text without values (unit test); the approve call resends the in-memory header text (helper test).
- [x] Evidence for G-019 no longer holds: `grep -rn pageCoverage packages/wizard/src` finds the new renderer.
- [x] Tests run in node without jsdom (`renderToStaticMarkup` only): the stall warning is computed by a pure helper `stalledForSeconds(history: Array<{ at: number; pagesFound: number }>, now: number): number` in `coverage-text.ts` (unit tests: no growth for 20 s returns >= 20; growth resets to 0) and the warning markup is tested by passing a precomputed value as a prop; the live-region text is built by a pure `statusText(progress)` helper that ignores path changes (unit test).
- [x] `pnpm build` and wizard tests pass.
- [x] Evidence for G-053 no longer holds: `rolesNotTested` renders under its own heading "Roles not tested, and why" (markup test), not inside "Living Spec Conformance".

## Test plan

```
pnpm exec vitest run packages/wizard/tests/coverage-view.test.tsx packages/wizard/tests/scanning-progress.test.tsx
pnpm build
```

## Definition of done

Boxes checked; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-109 in the QA Flow Tester repo. Read docs/plan/tickets/T-109-wizard-coverage-progress.md and implement it. Edit only the files under "Files owned" (not PlanDocument.tsx). Render pageCoverage (reached of found, skipped list with plain-language reasons) in ReportScreen, give roles-not-tested its own heading, add crawl-health information and a stall warning to ScanningScreen with polite live regions, and remove the `as unknown as ScanProgress` cast in App.tsx. Tolerate absent optional fields. Use CONTEXT.md terms; no Node-only imports in the wizard. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main.
```
