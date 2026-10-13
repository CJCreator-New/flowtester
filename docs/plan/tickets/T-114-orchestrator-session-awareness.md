# T-114 Orchestrator: reuse the sign-in, detect session loss, real status for the Permission Matrix

- **Type:** bug · **Size:** M · **Wave:** 3 · **Depends on:** T-102, T-103, T-107, T-110
- **Gaps addressed:** G-008, G-011, G-014 (run half), G-004 (run half already supported; verifies)

## Gaps addressed (evidence copied in)
- G-008: `packages/core/src/orchestrator.ts:546-556` opens a context per test point with the saved state; `:570` `page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })` with no check of status, final URL or a password field; the attempt-2 retry (`:531-556`) reuses the same dead state; `session-expired` appears only in `preflight.ts:386-392` for supplied sessions.
- G-011: `:904-910` `permChecker.checkAccess({ target, role, breakpoint, statusCode: 200, testCaseId })` with no `redirectedToLogin`; `packages/checkers/src/permission-matrix.ts:67-124` uses both fields to decide granted vs denied.
- G-014: `:370-374` `runPreFlight(...)` signs in again for the run; discovery already did (`discovery-agent.ts:263-270`).
- G-004: `RunOptions.customHeaders`/`userAgent` are read at `:554-555`, but `server.ts:3548-3582` never sets them (T-115 fixes the caller); preflight call at `:370` passes `tunnelAuth` only.

## Background
The test run opens a fresh context per test point from the saved storage state. If the session has expired, the page under test is the login page and the point passes or fails for the wrong reason. The Permission Matrix check is also fed a fake status. Project conventions (copied): fail closed under `requireSignIn` (`SignInFailedError`); roles whose sign-in fails are `rolesNotTested` and never run signed out; skipped points carry a plain "Not tested" reason; findings text uses glossary terms. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
1. `RunOptions` gains `preflight?: PreFlightResult` (from discovery, T-113). If present and every needed role has a state, skip the second sign-in: validate with a cheap check per role (`checkSuppliedSession`-style: load the role's landing path in a context, `looksLikeLogin` false) and re-run `runPreFlight` ONLY for roles whose check fails (one re-login). If absent, behave as today.
2. After `navigate(page, startUrl)` (T-107) for a signed-in role: if `status === 401` or `looksLikeLogin(page, loginPathsOf(role))`, then (a) once per role per run re-sign-in via `PreFlightChecker.signIn` and retry the point; (b) if that fails or already used, mark the point Skipped with reason `Signed out part-way: the session stopped working` and add the role to a run-level `sessionLostRoles` set; remaining points for that role are skipped with the same reason (not failed). Under `requireSignIn` throw `SignInFailedError('session-expired')`. Opt out of the re-login with env `QA_RELOGIN=0`.
3. Permission Matrix: pass the real main-frame status from the same navigation (`navigateResult.status`) and `redirectedToLogin: bounced`; if the point has no navigation result (step-driven pages), pass `statusCode: undefined` and let the checker treat it as unknown (adapt only the call; the checker file is read-only; if its type forbids undefined, pass the last known status or skip the check and note it).
4. Headers: confirm `customHeaders`/`userAgent`/`tunnelAuth`/`headerHosts` from `RunOptions` reach `runPreFlight`, `openPage` and the re-login (spread `RunContextOptions`).
5. Report: add `sessionLostRoles` to the run notes (fixed wording, role name only) via the existing `reportNotes` mechanism.

## Out of scope
Server wiring (T-115); checker logic; changing how retries/flaky handling work apart from the dead-state case.

## Files owned
- `packages/core/src/orchestrator.ts`
- `packages/core/tests/e2e-orchestrator.test.ts`, `packages/core/tests/role-failure-run.test.ts`, `packages/core/tests/orchestrator-session.test.ts` (new)

## Files read-only
`preflight.ts` (T-110), `navigate.ts` (T-107), `browser.ts` (T-103), `packages/checkers/src/permission-matrix.ts`, `fixtures/test-app/server.js`.

## Interface contract
```ts
// RunOptions additions
preflight?: PreFlightResult;        // from DiscoveryOutcome (T-113); never persisted
customHeaders?: Record<string,string>; userAgent?: string; headerHosts?: string[];  // userAgent/customHeaders already exist
// Skip reason text (exact): 'Signed out part-way: the session stopped working'
```

## Implementation notes
- Per-role state lives in a `Map<string, { reloginUsed: boolean; lost: boolean }>`; the check runs at `:570` right after navigation.
- `loginPathsOf(role)`: `preflight.roleLandingPaths` is the post-login path; the login path is `credential.loginPath || '/login'`.
- Do not widen the permission-matrix call for pages reached by `navigate` steps (`:663`); only the start page has the status.

## Acceptance criteria
- [ ] Fixture `/lab/expiring` (T-102): a signed-in point after the session died is Skipped with the exact text above (not Passed/Failed), and with `QA_RELOGIN` unset one re-login is attempted (assert `/lab/stats.signIns` = 2 in total: 1 from discovery's sign-in, 1 re-login during the run).
- [ ] With `preflight` supplied and valid, `/lab/stats.signIns` stays 0 from the run itself (no second sign-in).
- [ ] `QA_RELOGIN=0`: no re-login; points skipped.
- [ ] Under `requireSignIn` a lost session throws `SignInFailedError` with reason `session-expired`.
- [ ] `/lab/forbidden` as a role with an expected-denied rule: the Permission Matrix receives status 403 (spy on `checkAccess`).
- [ ] Evidence for G-011 no longer holds: `grep -n "statusCode: 200" packages/core/src/orchestrator.ts` returns 0.
- [ ] `grep -n "page.goto(startUrl" packages/core/src/orchestrator.ts` returns 0 (the start page uses `navigate()`; G-030 evidence for the orchestrator is gone).
- [ ] Evidence for G-008 no longer holds: a test exists that fails on the old code (the point passes against the login page).
- [ ] Existing orchestrator tests pass.
- [ ] `pnpm build` passes.
- [ ] Evidence for G-014 and G-004 no longer holds: `grep -n "options.preflight" packages/core/src/orchestrator.ts` finds the reuse branch; `customHeaders` is passed to `runPreFlight` and the re-login.

## Test plan
```
pnpm exec vitest run packages/core/tests/orchestrator-session.test.ts packages/core/tests/e2e-orchestrator.test.ts packages/core/tests/role-failure-run.test.ts
pnpm build
```

## Definition of done
Boxes checked; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-114 in the QA Flow Tester repo. Read docs/plan/tickets/T-114-orchestrator-session-awareness.md and packages/core/src/orchestrator.ts (around lines 360-410, 500-600, 895-915), then implement it. Edit only orchestrator.ts and the listed tests. Accept a preflight result from discovery and skip the second sign-in when valid; after navigating to a point's start page detect 401 or a login page for a signed-in role, re-sign-in once (QA_RELOGIN=0 disables), otherwise skip the point with the exact text "Signed out part-way: the session stopped working" (never fail it, never run it against the login page); pass the real status and the login-redirect flag to the Permission Matrix instead of 200; make sure customHeaders/userAgent/headerHosts reach preflight, openPage and the re-login. Use navigate() and looksLikeLogin() from T-107. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Never print secrets. Work on a branch, not main. If blocked, stop and report.
```
