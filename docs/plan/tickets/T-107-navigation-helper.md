# T-107 Shared navigation helper: settle, status, redirects, retry

- **Type:** feature (foundation) · **Size:** M · **Wave:** 1 · **Depends on:** T-101
- **Gaps addressed:** G-030, and the helper half of G-001, G-005, G-007, G-008, G-009

## Gaps addressed (evidence copied in)

- G-030: raw `goto` calls with different policies: `packages/core/src/preflight.ts:175` (12 s) and `:383` (12 s), `deterministic-spider.ts:331,461,494` (10 s), `orchestrator.ts:570` (15 s) and `:663`. All use `domcontentloaded`; none has retry, hydration wait, status capture or a login-bounce check.
- G-005: `deterministic-spider.ts:331` goto then immediate `a[href]` read at `:368`; `grep -n "networkidle\|hydrat\|waitForSelector" packages/core/src/discovery/deterministic-spider.ts` returns 0.
- G-001: `preflight.ts:186-187` one-shot field probe right after `domcontentloaded`.
- G-009/G-007/G-008: failed loads are never retried (`:529`), the goto Response is discarded (`:331`), and the login bounce check needs a password field present immediately (`:333`).

## Background

Every call site needs the same things after navigating: wait until the page is usable, know the HTTP status and where it ended up, retry once on a transient failure, and report a telemetry record. Put them in one module so each caller changes by a few lines. Project conventions (copied): pnpm monorepo, TypeScript, Node 22, vitest with real Chromium against local `http.createServer`; never log secrets; use `redactUrl` for URLs. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope

New module with `navigate`, `settlePage`, `looksLikeLogin`; unit tests with local servers.

## Out of scope

Migrating call sites (T-110, T-111, T-114); exporting from the package barrel.

## Files owned

- `packages/core/src/navigate.ts` (new)
- `packages/core/tests/navigate.test.ts` (new)

## Files read-only

`packages/core/src/redact.ts`, `packages/types/src/route-telemetry.ts`, `packages/core/src/debug-log.ts` (T-105; do not import it, callers log).

## Interface contract

```ts
// packages/core/src/navigate.ts
import type { Page } from 'playwright';
import type { RouteTelemetry } from '@qa/types';

export interface NavigateOptions {
  timeoutMs?: number; // default 15000 for the first attempt
  retries?: number; // default 1; the retry uses timeoutMs * 1.5
  settleMs?: number; // cap for the idle wait after DOMContentLoaded, default 3000
  needLinks?: boolean; // wait for at least one a[href] or interactive element (spider), default false
  who?: string; // 'visitor' or a role name (copied into telemetry)
}
export interface NavigateResult {
  ok: boolean; // a page loaded (any HTTP status) within the retries
  status?: number; // main-frame status of the last attempt
  finalUrl: string; // page.url() after redirects (not redacted; callers redact)
  redirectChain: string[]; // URLs from request.redirectedFrom() chain, oldest first (not redacted)
  attempts: number;
  durationMs: number;
  settled: boolean; // idle/links condition met before the cap
  linkCount?: number; // when needLinks
  error?: { kind: 'timeout' | 'net' | 'aborted' | 'other' }; // kind only, never message text
}
export function navigate(page: Page, url: string, options?: NavigateOptions): Promise<NavigateResult>;
export function settlePage(
  page: Page,
  options?: { settleMs?: number; needLinks?: boolean }
): Promise<{ settled: boolean; linkCount: number }>;
export function looksLikeLogin(page: Page, loginPaths?: string[]): Promise<boolean>;
//   true when, after a short settle, a visible input[type=password] exists OR the path equals one of loginPaths
export function toTelemetry(r: NavigateResult, requestedPath: string, extra?: Partial<RouteTelemetry>): RouteTelemetry; // redacts paths with redactUrl
```

## Implementation notes

- `navigate`: `const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout })`; then `settlePage`. On `TimeoutError`/`net::ERR_` and attempts left, retry with the longer timeout. Classify errors by `err.name` / `err.message` regex only; never return message text.
- `settlePage`: `await Promise.race([page.waitForLoadState('networkidle'), page.waitForTimeout(settleMs)])` then, if `needLinks`, `await page.locator('a[href], button, [role=link], [role=button]').first().waitFor({ state:'visible', timeout: remaining })` and count `a[href]`. If `needLinks` and zero links after the first wait, wait once more up to `settleMs` (this is the "zero-link retry" for SPAs).
- Redirect chain: walk `resp.request().redirectedFrom()` until null, `unshift` each URL.
- Never throw for HTTP status; the caller decides. Throw only for abort (`page` closed) by returning `error.kind = 'aborted'`.

## Acceptance criteria

- [x] Against a local server: a 404 page returns `ok: true, status: 404`; a 500 returns `status: 500`; a 302 chain returns `redirectChain` of length 2 and `finalUrl` at the last hop.
- [x] A page whose links render after 1500 ms (`setTimeout` in inline script) returns `linkCount >= 1` and `settled: true` with `needLinks: true`; with `needLinks: false` it may return immediately.
- [x] A server that hangs the first request and answers the second: `attempts: 2, ok: true`.
- [x] A server that never answers: `ok: false, error.kind: 'timeout'`, `attempts: 2`.
- [x] `looksLikeLogin` is true for a page with a password input and false for a normal page.
- [x] The returned `error` object contains no message text (assert `Object.keys(error)` is `['kind']`).
- [x] `navigate.ts` exports `navigate`, `settlePage`, `looksLikeLogin` and `toTelemetry`. The evidence for G-030 (five raw `goto` call sites) closes only when T-110, T-111 and T-114 migrate them; their tickets carry that check.
- [x] `pnpm build` passes.

## Test plan

```
pnpm exec vitest run packages/core/tests/navigate.test.ts
pnpm build
```

## Definition of done

Boxes checked; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-107 in the QA Flow Tester repo. Read docs/plan/tickets/T-107-navigation-helper.md and implement it exactly. Create packages/core/src/navigate.ts with navigate/settlePage/looksLikeLogin/toTelemetry as specified (domcontentloaded first, bounded networkidle, optional wait for links, one retry with a longer timeout, status/finalUrl/redirectChain captured, error kind only) and packages/core/tests/navigate.test.ts using real Chromium against local http servers. Do not touch any other file; do not migrate call sites. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main.
```
