# T-110 Deterministic sign-in (preflight): readiness waits, success signals, classification, origin guard, headers

- **Type:** bug / security · **Size:** L · **Wave:** 2 · **Depends on:** T-101, T-102, T-103, T-105, T-107
- **Gaps addressed:** G-001, G-002, G-003, G-004 (preflight half), G-022 (file-path half), G-023, G-037, G-027 (`require-sign-in.test.ts` port)

## Gaps addressed (evidence copied in)
- G-001: `packages/core/src/preflight.ts:175-178` single `domcontentloaded` goto (12 s); `:186-187` one-shot `findField`; `:251-258` 8 s race then `waitForTimeout(400)`; no retry or hydration wait in the file.
- G-002: `:260-273` success = origin unchanged and no visible password input, then `storageState` saved; no cookie/landing-URL/selector signal. `docs/PRD.md:226` promises "validates successful redirect" (claim).
- G-003: `:275-278` timeout/`net::ERR_` -> `unreachable`, anything else -> `no-form`; `:346-349` outer catch -> `unreachable` unlogged; `:195,:228,:255` swallowed clicks; no log lines.
- G-004: `:333-336,:381` `createContext({baseUrl, tunnelAuth})` with no `customHeaders`/`userAgent`; `:93-99` reachability fetch sends no custom headers.
- G-022: `:319` `path.join(options.authDir, \`${role.role}.json\`)`; `:313` `mkdir` without a mode; no cleanup.
- G-023: `:162` `new URL(credential.loginPath || '/login', baseUrl)`; `:180` origin taken from where the page landed; `:217,:244` `fill` before any same-origin check (the check is at `:262`, after submit).
- G-037: `:106-113` `clearTimeout` not in `finally`; `:122` `ok: res.status < 500` (401/403/404 pass); `:333-349` `context.close()` inside `try` (not closed when `signIn` throws).
- G-027: `packages/core/tests/require-sign-in.test.ts:17` uses port 3547, also used by `opening-missing.test.ts:9`.

## Background
Sign-in is the one deterministic form login (`PreFlightChecker.signIn`, `runPreFlight`). Failures must be diagnosable without leaking anything: failure text stays fixed (`packages/types/src/signin.ts`), never built from page text, typed details or error messages (comment at `:143-150`). Project conventions (copied): typed fixed reasons `wrong-details | no-form | unreachable | needs-more | session-expired`; passwords in memory only; `redactUrl` for URLs; build order types, checkers/core, runner; real-Chromium tests against local `http.createServer` or the fixture. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
1. Use `navigate()` (T-107) for the login goto and the supplied-session check; wait for a visible field (cap 6 s) before probing; retry the whole attempt once on a timeout/navigation failure, never after a visible alert (`wrong-details`).
2. Success: after submit wait for (URL changed) OR (password field hidden) OR (new cookie/storage entries), up to 10 s; then require ALL of: origin unchanged, not still on the login path, no visible password field, storage state has at least one cookie or localStorage entry. Optional per-role `postLoginSelector` / `postLoginUrl` (fields added to `RoleCredential` by T-101): when set, success also requires that selector to be visible / the landing path to match.
3. Classification: map errors by kind. Timeout / `net::ERR_` / navigation failure -> `unreachable`. `no-form` only when no sign-in field was found after the readiness wait. Any other unexpected error (closed page, detached element, failed fill) -> `unreachable` with the `failedStep` where it happened, not `no-form`. Add `failedStep: SignInStep` (T-101) to every failure result.
4. Origin guard: resolve `loginPath` against `baseUrl`; if the resolved origin differs from the target origin (www/apex equal), return `{ ok:false, reason:'needs-more', failedStep:'goto' }` before navigating; after goto, if `new URL(page.url()).origin` differs, return `needs-more` BEFORE any `fill`.
5. Headers: `runPreFlight(targetUrl, profile, tunnelAuth?, options)` options gain `customHeaders?`, `userAgent?`, `headerHosts?`; pass them (spread `RunContextOptions`) to every `createContext` and to `checkUrlReachable` (fetch headers only for the target host).
6. Diagnostics: `PreFlightResult` gains `roleDiagnostics: Record<string, { ok: boolean; failedStep?: SignInStep; attempts: number; landedPath?: string }>`; emit `debugLog('auth', ...)` lines (T-105) with step names, attempt counts and landed path only.
7. Role file name: `slug = role.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,40)`; assert `path.resolve(statePath)` is inside `path.resolve(authDir)`; `mkdir(authDir, { recursive:true, mode: 0o700 })`; write state then `chmod 0o600` (ignore on Windows).
8. Cleanup/robustness: `finally` for the timer and for `context.close()` in `runPreFlight`; start-page reachability uses `ok: status < 400 || status === 401 || status === 403` and returns a `startWarning` (`'start-4xx'`) for 4xx instead of treating 404 as fine; a cold-start retry (2 attempts, 4 s backoff, longer first timeout 25 s).

## Out of scope
Calling `runPreFlight` differently (T-113, T-114, T-115 own callers); SSO/OTP/CAPTCHA automation; changing reason text in `packages/types`.

## Files owned
- `packages/core/src/preflight.ts`
- `packages/core/tests/signin.test.ts`, `signin-redaction.test.ts`, `preflight-session.test.ts`, `require-sign-in.test.ts`
- `packages/core/tests/signin-determinism.test.ts` (new)

## Files read-only
`packages/core/src/navigate.ts` (T-107), `debug-log.ts` (T-105), `browser.ts` (T-103), `packages/types/src/signin.ts` (T-101), `fixtures/test-app/server.js` (T-102 routes `/lab/spa-login`, `/lab/headers`).

## Interface contract
```ts
// preflight.ts
export type SignInResult =
  | { ok: true; landingPath: string }
  | { ok: false; reason: SignInFailureReason; failedStep?: SignInStep; attempts?: number };
export interface PreFlightResult { /* existing: ok, roleStorageStates, roleLandingPaths, roleFailures, ... */
  roleDiagnostics: Record<string, { ok: boolean; failedStep?: SignInStep; attempts: number; landedPath?: string }>;
  startWarning?: 'start-4xx'; }
runPreFlight(targetUrl: string, profile: ProductProfile, tunnelAuth?: string,
  options?: { browserManager?: BrowserManager; authDir?: string; suppliedSessions?: ...;
              customHeaders?: Record<string,string>; userAgent?: string; headerHosts?: string[] }): Promise<PreFlightResult>
```
T-113 and T-114 rely on `roleStorageStates`, `roleLandingPaths`, `roleFailures`, `roleDiagnostics` and this options shape.

## Implementation notes
- Failure text never comes from the error: keep `kind = err instanceof Error ? \`${err.name} ${err.message}\` : ''` internal; only the classification leaves the function.
- Retry sketch: wrap the body of `signIn` in `for (attempt = 1; attempt <= 2; attempt++)`; on a thrown timeout/navigation error `continue`; on `wrong-details` (visible `[role=alert]` or still-on-form after settle) `return` immediately.
- Success sketch:
```ts
await Promise.race([
  live.waitForURL((u) => u.toString() !== urlBefore, { timeout: 10000 }),
  password.waitFor({ state: 'hidden', timeout: 10000 }),
  live.waitForFunction(() => document.cookie.length > 0 || localStorage.length > 0, undefined, { timeout: 10000 }),
]).catch(() => {});
const state = await context.storageState();
const hasSession = state.cookies.length > 0 || state.origins.some((o) => o.localStorage.length > 0);
if (!hasSession || landed.pathname === loginUrl.pathname || stillOnSignInForm) -> failure (wrong-details if form still visible, else needs-more)
```
- `HttpOnly` auth cookies are not in `document.cookie`, so use the Playwright `storageState()` count, not the page function, for the final check.
- Existing tests assert reason strings; keep reason strings unchanged and update expectations only where behaviour intentionally changed (document why in the PR).
## Acceptance criteria
- [x] `/lab/spa-login` (form appears after ~1200 ms, T-102): sign-in with the fixture credentials succeeds; with the old code it returns `no-form` (regression test).
- [x] Wrong password: `wrong-details`, one attempt only (no retry after a visible alert); failure includes `failedStep: 'post-submit-check'`.
- [x] A server that hangs the first login request and answers the second: `ok: true`, `attempts: 2`.
- [x] A login that returns 200 but sets no cookie and keeps the form: not `ok`.
- [x] `loginPath: 'https://evil.example/login'`: returns `needs-more` and NO request is made to the other origin (assert with a second local server that records requests).
- [x] A start page that redirects to another origin before the form: returns `needs-more` and the password is never typed (assert the second server saw no POST).
- [x] Role `../x`: state file is written inside `authDir` (slug) and never outside.
- [x] Custom header sent only to the target host during sign-in and reachability (`/lab/headers`).
- [x] Throwing `signIn` does not leave an open context (spy on `context.close`).
- [x] No password, username or page text appears in captured console output (existing `signin-redaction.test.ts` still passes).
- [x] Evidence for G-001/G-002/G-003/G-023 no longer holds: `grep -n "waitForTimeout(400)" packages/core/src/preflight.ts` returns 0; `grep -n "failedStep" packages/core/src/preflight.ts` finds it.
- [x] `grep -n "\.goto(" packages/core/src/preflight.ts` returns 0 (G-030 evidence for preflight is gone).
- [x] `pnpm build` passes.
- [x] Evidence for G-004 no longer holds: `grep -n "customHeaders" packages/core/src/preflight.ts` shows it passed to every `createContext` and to `checkUrlReachable`.
- [x] Evidence for G-022 no longer holds: the state file path uses the slug and an inside-`authDir` assertion (`grep -n "isInside\|slug" packages/core/src/preflight.ts`).
- [x] Evidence for G-037 no longer holds: the reachability timer is cleared in a `finally` and a throwing `signIn` closes its context (tests above).

## Test plan
```
pnpm exec vitest run packages/core/tests/signin.test.ts packages/core/tests/signin-redaction.test.ts packages/core/tests/preflight-session.test.ts packages/core/tests/require-sign-in.test.ts packages/core/tests/signin-determinism.test.ts
pnpm build
```

## Definition of done
Boxes checked; no new log line contains typed text, page text, URLs with query strings, or header values; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-110 in the QA Flow Tester repo. Read docs/plan/tickets/T-110-deterministic-signin.md fully, then packages/core/src/preflight.ts, and implement it. Edit only preflight.ts and the listed tests. Make sign-in deterministic: use navigate() from T-107, wait for the form, retry once on transient failure (never after a visible alert), judge success by origin + not-on-login-path + no password field + non-empty storage state, classify errors without ever returning error text, add failedStep and roleDiagnostics, block cross-origin loginPath before any fill, pass customHeaders/userAgent/headerHosts to every context, slug the role file name inside a 0700 authDir, and fix the cleanup issues. Keep existing reason strings. Use debugLog('auth', ...) from T-105 with step names only. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Never print secrets. Work on a branch, not main. If blocked, stop and report.
```
