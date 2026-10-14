# T-103 One browser-context options object, origin-scoped headers, narrower browser restart

- **Type:** refactor / security · **Size:** M · **Wave:** 0 · **Depends on:** none
- **Gaps addressed:** G-004 (contract half), G-016, G-039

## Gaps addressed (evidence copied in)

- G-016: `packages/core/src/browser.ts:127-144` puts tunnel and custom headers in the context's `extraHTTPHeaders`, so they go to every origin (analytics, CDNs, off-site links).
- G-004: each caller builds context options by hand: `preflight.ts:333-336,381` (tunnel only), `discovery-agent.ts:349-353,432-438` (custom headers only / none), `server.ts:1721,4463` (neither), `orchestrator.ts:546-556` (all). One shared shape is missing.
- G-039: `browser.ts:173-189` `openPage` closes and restarts the shared browser after ANY error, including a bad `storageState` file, which kills other concurrent contexts.

## Background

Headers (bypass tokens, tunnel auth) are secrets and must reach only the target site. Today they are applied context-wide. This ticket makes `createContext` accept `customHeaders`, `userAgent` and `tunnelAuth` as one options object and adds them with a route handler that checks the request host. It adds the exported `RunContextOptions` type that later tickets pass around. Project conventions (copied): pnpm monorepo, TypeScript, Node 22, vitest. Build order types, checkers/core, runner. Never print secrets (header values must not appear in logs or errors). Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope

Edit `browser.ts` only (plus its tests): scoped header injection, exported type, `openPage` restart rule.

## Out of scope

Changing callers (T-110, T-113, T-114, T-115 do that); `--no-sandbox` / `ignoreHTTPSErrors` (accepted risk G-042).

## Files owned

- `packages/core/src/browser.ts`
- `packages/core/tests/browser-context.test.ts` (new)
- `packages/core/tests/browser-restart.test.ts`, `packages/core/tests/browser-guard.test.ts` (update if behaviour change requires)

## Files read-only

`packages/core/src/preflight.ts`, `discovery-agent.ts`, `orchestrator.ts`, `packages/runner/src/server.ts`.

## Interface contract

```ts
// packages/core/src/browser.ts
export interface RunContextOptions {
  baseUrl: string;                          // target origin; headers go only to this host
  tunnelAuth?: string;                      // existing option; a string today (browser.ts)
  customHeaders?: Record<string, string>;
  userAgent?: string;
  headerHosts?: string[];                   // extra hosts that may receive the headers (Domain Allowlist)
}
export interface BrowserOptions extends Partial<RunContextOptions> { /* existing fields unchanged */ storageState?: ...; viewport?: ...; recordVideoDir?: ...; }
// createContext(options: BrowserOptions): Promise<BrowserContext>
//   - headers are NOT put in extraHTTPHeaders; they are added by a context.route('**/*') handler
//     only when new URL(request.url()).host equals baseUrl's host or is in headerHosts.
//   - the handler calls route.fallback({ headers: { ...request.headers(), ...secretHeaders } }) so
//     the beta request guard route (installRequestGuard) and blockChanges still chain.
//   - userAgent keeps using the context option (not secret).
```

Callers spread it: `createContext({ ...runCtx, storageState })`.

## Implementation notes

- Today `:127-134` merges `tunnelAuth` and `customHeaders` into `extraHTTPHeaders`. Replace with `const secret = {...tunnelHeaders(options.tunnelAuth), ...options.customHeaders}` and, if non-empty, `await context.route('**/*', (route) => route.fallback(hostAllowed(route.request().url()) ? { headers: { ...route.request().headers(), ...secret } } : {}))`.
- Register this route BEFORE `installRequestGuard` so that, with Playwright's LIFO route order, the guard runs first and can abort; both use `fallback()`. Add a test for the order.
- `hostAllowed`: compare lowercase `host` (include port); allow `baseUrl` host and each `headerHosts` entry; allow www/apex pair (reuse `isSameSite` from `same-site.ts` if it is already imported, otherwise inline).
- `openPage` (`:173-189`): restart the shared browser only if the error message matches `/Target (page, context or browser )?has been closed|Browser has been closed|browser has disconnected/i` or `!browser.isConnected()`; otherwise rethrow immediately. Keep the one-retry behaviour for those cases.
- Never log header values; if you add a debug line, log header names only.

## Acceptance criteria

- [x] Test: against a local server on host A with `baseUrl` A and a third-party host B (second local server on another port), a page on A that loads a script from B sends `X-QA-Bypass-Token` to A and NOT to B.
- [x] Test: `headerHosts: ['127.0.0.1:PORT_B']` makes B receive it.
- [x] Test: with `guard` set (beta), a request the guard rejects is still aborted (route chain intact).
- [x] Test: `openPage` with a nonexistent `storageState` path throws without closing the shared browser (a second concurrent context stays usable).
- [x] The evidence for G-016 no longer holds: `grep -n "extraHTTPHeaders" packages/core/src/browser.ts` shows no secret header merge.
- [x] `pnpm build` passes.

## Test plan

```
pnpm exec vitest run packages/core/tests/browser-context.test.ts packages/core/tests/browser-restart.test.ts packages/core/tests/browser-guard.test.ts
pnpm build
```

## Definition of done

Boxes checked; no behaviour change for callers that pass no headers; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-103 in the QA Flow Tester repo. Read docs/plan/tickets/T-103-browser-context-factory.md and implement it. Edit only packages/core/src/browser.ts and the listed tests. Add the exported RunContextOptions type; move tunnel/custom headers out of extraHTTPHeaders into a context.route handler that adds them only for the target host and headerHosts (use route.fallback so the request guard chains); make openPage restart the shared browser only for closed/disconnected errors. Never log header values. Do not change callers. Run the "Test plan" commands (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main. If blocked, stop and report.
```
