# T-115 Runner integration: headers to every stage, reuse the sign-in, per-run auth dir, redacted errors

- **Type:** bug / security · **Size:** L · **Wave:** 5 · **Depends on:** T-103, T-104, T-105, T-110, T-113, T-114
- **Gaps addressed:** G-004 (runner half), G-014 (runner half), G-022 (runner half), G-036

## Gaps addressed (evidence copied in)
- G-004: `packages/runner/src/server.ts:3140-3143` passes `customHeaders` to discovery only; `grep -n customHeaders server.ts` matches only `:439, :2743, :3140-3141`; `executeTesting` `orchestrator.run({...})` at `:3548-3582` has no `customHeaders`, `userAgent`, `tunnelAuth`; the run context object (`:3024-3042`) has no header field, so approve / resume / "Test again" lose them; `:1721` sign-in test endpoint `createContext({baseUrl})` and `:4387-4408` / `:4446-4476` (`handleAddSignIn`, `crawlMore`) build contexts without headers; `:4390` `runPreFlight` without headers; `:3140-3143` invalid headers dropped by `ch.ok ? ch.value : undefined`.
- G-014: discovery's preflight result is not kept; `orchestrator.run` signs in again.
- G-022: `server.ts:1808-1817,2981-2983` use `body.roles` unvalidated; `:703` one `<outputDir>/auth` for every run and site, never deleted (no removal of authDir found).
- G-036 (suspected): raw `err.message` forwarded at `:4199, :2583, :2840, :3592, :4720, :4805, :4826, :4946, :5024, :5086, :5101`; only `:4125-4132` builds a `Redactor`; header values may reach the stored plan (`planForDisk`, `:3794-3829`) — unconfirmed.

## Background
`server.ts` (5116 lines) wires the wizard request to discovery, plan review and the test run. After T-103..T-114 the building blocks accept headers, return a reusable preflight result and report session loss; the runner has to feed them. Project conventions (copied): error shape `{error, code, suggestion?}` with `ERR_*`; `run-inputs.ts` returns `Checked<T>`; passwords/sessions stay in memory unless "remember" is ticked; beta mode (shared machine) scopes events per visitor and ignores consent; plan files are written without passwords (`planForDisk`). Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
1. `handleRun`: call `checkRoles(body.roles)` and `checkLoginPath` per role (T-104); return the 400 `{error, code}`; stop swallowing invalid headers: `checkCustomHeaders` failure returns 400 `ERR_INVALID_HEADERS` (it already does at `:2743`; remove the later silent fallback at `:3140-3143`).
2. Run context stores `customHeaders`, `userAgent`, `tunnelAuth`, `headerHosts` (from the Domain Allowlist hosts already known for the run) and keeps `preflight?: PreFlightResult` in memory only. Persist headers in the plan file ONLY as names (`customHeaderNames: string[]`), never values; on approve / resume / Test again after a restart the wizard resends headers (they are not saved); return 409 `ERR_HEADERS_NOT_SAVED` with the names if the plan needs headers and none were sent (mirror the `signInNotSaved` gate, `:3797-3829`).
3. Pass `RunContextOptions` to: `DiscoveryAgent.discoverWithSession` (`:3119`), `orchestrator.run` (`:3548-3582`, plus `preflight`), the sign-in test endpoint (`:1718-1722`), `handleAddSignIn` (`:4387-4408`) and `crawlMore` (`:4446-4476`).
4. Per-run auth dir: `authDir = path.join(this.authDir, runId)` created `0o700`; remove it in the `finally` of `executeRun`/`executeTesting` once the run ends (keep it between discovery and testing while the plan awaits review in memory; if the process restarts the sessions are gone and the existing `sessionNotSaved` gate applies). Beta: never share between visitors (runId is unique already).
5. Errors: add `redactedMessage(err: unknown): string` using the existing `Redactor` + `redactUrl`; use it at every site listed under G-036 (SSE `RUN_FAILED`, `PLAN_UPDATE_FAILED`, HTTP error bodies). Never include header values or cookie names.
6. Pass `QA_RELOGIN`/`QA_DISCOVERY_MAX_MINUTES` through unchanged (read in core); no new runner env.

## Out of scope
Re-approval roles, remembered sign-ins, atomic persistence (T-116); wizard (T-108, T-109); docs (T-119).

## Files owned
- `packages/runner/src/server.ts`
- `packages/runner/tests/url-first.test.ts`, `signin-endpoint.test.ts`, `credentials-crawl.test.ts`, `wizard-endpoints.test.ts`
- `packages/runner/tests/headers-propagation.test.ts` (new), `packages/runner/tests/error-redaction.test.ts` (new)

## Files read-only
`run-inputs.ts` (T-104), core files (T-110, T-113, T-114), `fixtures/test-app/server.js`.

## Interface contract
```ts
// Run request (unchanged shape): roles[], customHeaders (record or "Name: value" string), signInConsent, ...
// New 409: { error, code:'ERR_HEADERS_NOT_SAVED', needsHeaders: string[] }   // names only
// approve, resume and 'Test again' endpoints accept an optional body field `customHeaders` (record or "Name: value" text), validated with checkCustomHeaders, and store it in the run context before continuing.
// Plan file: customHeaderNames?: string[]  (names only, no values)
// RunnerContext: { customHeaders?, userAgent?, headerHosts?, preflight? }  // in memory
```

## Implementation notes
- Line numbers are from the audit; re-locate by function name (`handleRun`, `executeRun`, `executeTesting`, `handleAddSignIn`, `crawlMore`, `handleSignInChange`).
- `userAgent`: the wizard does not send one today; read `body.userAgent` if present (validate as a short string) so CI can set it; leave undefined otherwise.
- Test with the fixture: start the runner on a random port, POST a run with `customHeaders: { 'X-QA-Bypass-Token': 'sentinel-123' }`, roles for the fixture, and assert `/lab/stats.headerHits` counts hits from the sign-in request, crawl, and a test-phase request; and that `sentinel-123` appears in NO file under the run folder, plan file, SSE capture or stdout (grep the folder).

## Acceptance criteria
- [ ] Header sentinel appears in `/lab/stats.headerHits` for sign-in, discovery and test phases, and in zero files of the run folder / plan file / captured SSE / console (test greps recursively).
- [ ] Approve after a simulated restart with no headers resent returns 409 `ERR_HEADERS_NOT_SAVED` listing the name only; approve with `customHeaders` in the body succeeds and the headers reach the test phase.
- [ ] `POST /run` with `roles: [{ role: '../x', ... }]` returns 400 `ERR_INVALID_ROLES`; an absolute off-site `loginPath` returns 400 `ERR_INVALID_LOGIN_PATH`.
- [ ] A check-up against the fixture signs in once per role in total (`/lab/stats.signIns` equals the number of roles) when the plan is auto-approved.
- [ ] The run's auth dir does not exist after the run ends; sessions never appear under the shared `auth` directory.
- [ ] `RUN_FAILED` for a sign-in failure contains no URL query string or header value (test with a failing target URL containing `?token=abc`).
- [ ] Evidence for G-004 no longer holds: `grep -n "customHeaders" packages/runner/src/server.ts` shows it passed to `orchestrator.run`, `handleAddSignIn`, `crawlMore` and the sign-in test.
- [ ] Existing runner tests pass.
- [ ] `pnpm build` passes.
- [ ] Evidence for G-014, G-022, G-036 no longer holds: `orchestrator.run` receives `preflight` (`grep -n "preflight" packages/runner/src/server.ts`); `grep -n "checkRoles" packages/runner/src/server.ts` finds the validation; `err.message` is forwarded only inside the redacting helper (`grep -n "err.message" packages/runner/src/server.ts`).

## Test plan
```
pnpm exec vitest run packages/runner/tests/headers-propagation.test.ts packages/runner/tests/error-redaction.test.ts packages/runner/tests/url-first.test.ts packages/runner/tests/signin-endpoint.test.ts packages/runner/tests/credentials-crawl.test.ts packages/runner/tests/checkups.test.ts packages/runner/tests/wizard-endpoints.test.ts
pnpm build
```

## Definition of done
Boxes checked; no secret in any file or stream; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-115 in the QA Flow Tester repo. Read docs/plan/tickets/T-115-server-integration.md and the relevant functions in packages/runner/src/server.ts (handleRun, executeRun, executeTesting, handleSignInChange, handleAddSignIn, crawlMore). Edit only server.ts and the listed runner tests. Validate roles/loginPath with the T-104 validators; keep customHeaders/userAgent/headerHosts in the run context (names only on disk, 409 ERR_HEADERS_NOT_SAVED when missing after restart); pass RunContextOptions to discovery (use discoverWithSession), orchestrator.run (with the preflight result), the sign-in test endpoint, handleAddSignIn and crawlMore; use a per-run auth dir deleted when the run ends; route every error message through one redacting helper. Never print or store header values or passwords. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main. If blocked, stop and report.
```
