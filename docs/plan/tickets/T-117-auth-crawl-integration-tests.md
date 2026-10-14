# T-117 End-to-end proof on the fixture: login, handoff, expiry, traps, headers, ports

- **Type:** test · **Size:** M · **Wave:** 6 · **Depends on:** T-102, T-112, T-113, T-114, T-115
- **Gaps addressed:** G-012 (tests half), G-028, G-027

## Gaps addressed (evidence copied in)

- G-012/G-028: `grep customHeaders|extraHTTPHeaders packages/*/tests` matched only `spider-concurrency.test.ts:60` (a `some` request has the header); no test counts sign-ins per check-up or asserts the storageState handoff (`preflight-session.test.ts:85-113` asserts the result only; `credentials-crawl.test.ts` has 5 tests: consent, wrong password, no secret in output, beta). No test covers redirect-to-login mid-run, hydration, traps, 401/403.
- G-027: duplicate fixed ports: `missing-element.test.ts:9` and `page-coverage.test.ts:10` (3541); `narrow-look.test.ts:12` and `spider-form-facts.test.ts:7` (3532, fixed in T-111); `opening-missing.test.ts:9` and `require-sign-in.test.ts:17` (3547, fixed in T-110); `vitest.config.ts` sets no `fileParallelism`.

## Background

Each earlier ticket tests its own unit. This ticket adds the end-to-end checks that prove the pieces work together, using the `/lab/*` routes from T-102, and removes the remaining port collisions. Project conventions (copied): tests live in `packages/*/tests`, real Chromium against the fixture or an in-test `http.createServer`, `beforeAll` listen / `afterAll` close; secrets-absence assertions are explicit; fixed ports are avoided (`listen(0)`). Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope

1. `packages/core/tests/auth-crawl-e2e.test.ts` (new): drives `DiscoveryAgent.discoverWithSession` then `FlowTestOrchestrator.run` against the fixture on `listen(0)`; asserts one sign-in per role total, the same session used by crawl and run, bypass header on every phase (`/lab/stats`), SPA late links found, 500/403 recorded with status, trap bounded, expiry reported (`session-expired` note, run points Skipped with the exact text), and that no password / header value / cookie appears in the draft, report JSON or console.
2. `packages/runner/tests/auth-crawl-run.test.ts` (new): the same through `POST /api/runner/run` and the SSE stream; asserts `RUN_FAILED` carries `signInReason`, per-route `pageCoverage` is in `/api/report`, `DISCOVERY_PROGRESS` carries the optional fields.
3. Replace fixed ports with `listen(0)` in: `missing-element.test.ts`, `opening-missing.test.ts`? (that file's pair is `require-sign-in.test.ts`, owned by T-110: only change `opening-missing.test.ts`), `page-coverage.test.ts`, `narrow-look.test.ts`.
4. A regression test per old failure (each fails on the pre-plan code): login against `/lab/spa-login`; zero-link SPA; dead-link budget; session expiry mid-crawl; headers on test run.

## Out of scope

Changing source code; CI wiring (T-118).

## Files owned

- `packages/core/tests/auth-crawl-e2e.test.ts` (new), `packages/runner/tests/auth-crawl-run.test.ts` (new)
- `packages/core/tests/missing-element.test.ts`, `opening-missing.test.ts`, `page-coverage.test.ts`, `narrow-look.test.ts`

## Files read-only

All `src/`; `fixtures/test-app/server.js`; other tests.

## Interface contract

Uses only the contracts in T-102 (routes), T-113 (`discoverWithSession`, `DiscoveryOutcome`), T-114 (`RunOptions.preflight`, skip text `Signed out part-way: the session stopped working`), T-115 (run API, 409 codes).

## Implementation notes

- Use `server.listen(0)` and read `server.address().port`; pass the URL into the code under test; never hard-code a port.
- Reset the fixture with `POST /lab/reset` in `beforeEach`.
- Set `QA_DEBUG` unset in these tests; capture `console` to assert the absence of secrets.
- Keep the whole file group under ~90 s on a laptop (use small `maxPages` and `maxDurationMs`).

## Acceptance criteria

- [ ] Each of the five regression tests fails when run against the pre-plan commit (verify with `git stash`-free method: check out the base commit into a temp worktree path, or reason by assertion on a feature that did not exist; report which you verified).
- [ ] `grep -n "listen(35" packages/core/tests/missing-element.test.ts packages/core/tests/opening-missing.test.ts packages/core/tests/page-coverage.test.ts packages/core/tests/narrow-look.test.ts` returns 0 (G-027 evidence gone).
- [ ] The e2e test asserts `signIns` equals the number of roles and that the bypass header was seen in sign-in, discovery and test phases.
- [ ] No secret (fixture password, sentinel header value, cookie value) appears in console output, draft JSON, report JSON or run folder (recursive grep in test).
- [ ] `pnpm exec vitest run --exclude "**/wizard-e2e.test.ts"` passes.
- [ ] Evidence for G-012 and G-028 no longer holds: the five regression tests and the header / sign-in-count assertions exist in the two new files (`grep -c "it(" packages/core/tests/auth-crawl-e2e.test.ts packages/runner/tests/auth-crawl-run.test.ts`).

## Test plan

```
pnpm exec vitest run packages/core/tests/auth-crawl-e2e.test.ts packages/runner/tests/auth-crawl-run.test.ts
pnpm exec vitest run packages/core/tests/missing-element.test.ts packages/core/tests/opening-missing.test.ts packages/core/tests/page-coverage.test.ts packages/core/tests/narrow-look.test.ts
pnpm exec vitest run --exclude "**/wizard-e2e.test.ts"
```

## Definition of done

Boxes checked; no source file edited; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-117 in the QA Flow Tester repo. Read docs/plan/tickets/T-117-auth-crawl-integration-tests.md. Write the two end-to-end test files against the fixture (/lab/* routes from T-102) and replace the fixed ports in the four listed test files with listen(0). Do not edit any non-test file. Assert one sign-in per role, header propagation across phases, session-expiry reporting, SPA/trap/status behaviour, and total absence of secrets in outputs. Run the commands in "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main. If a test cannot pass because a source behaviour is missing or wrong, stop and report the exact failure instead of editing source.
```
