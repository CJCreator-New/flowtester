# T-113 Discovery agent: headers everywhere, one sign-in, session-drop reporting, telemetry

- **Type:** bug / feature · **Size:** M · **Wave:** 4 · **Depends on:** T-102, T-103, T-105, T-110, T-111, T-112
- **Gaps addressed:** G-004 (discovery half), G-014 (discovery half), G-006 (aggregation), G-007 (role-crawl reporting), G-010 (shared budget)

## Gaps addressed (evidence copied in)
- G-004: `packages/core/src/discovery/discovery-agent.ts:263-270` `runPreFlight(options.targetUrl, options.profile, undefined, {...})`: `tunnelAuth` passed undefined, no `customHeaders`/`userAgent`; `:349-353` crawl contexts get `customHeaders` but no `userAgent`; `:432-438` narrow-screens context gets none.
- G-014: the same file signs in at `:263-270`, then `orchestrator.ts:370` signs in again (see T-114); the discovery result does not expose the preflight result for reuse.
- G-006: only totals are logged (`:358,:398,:451`); `pageCoverage` is built at `:215-223` from `SkippedPage` with 4 reasons.
- G-007: `:401-413` never checks whether a role crawl hit walls; an expired or rejected state is reported as an ordinary crawl; `describeExploration` (`:164-226`) words walls generically.
- G-010: `:375-413` one full crawl for the visitor plus one per role, each with its own page cap and no shared time budget.

## Background
`discoverSite` signs in each role (`runPreFlight`), then crawls as the visitor and as each role with the saved state. After T-110 and T-111 the pieces report why things failed; this ticket threads the run context through, returns the preflight result so the test run does not log in again, reports a dropped role session, and shares one time budget. Project conventions (copied): sign-in failure wording is fixed (`describeExploration` uses fixed text); `requireSignIn` fails closed with `SignInFailedError`; no secrets in notes; `redactUrl` for paths. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
1. `DiscoveryOptions` gains `customHeaders`, `userAgent`, `tunnelAuth`, `headerHosts`, `deadlineAt?`; spread `RunContextOptions` (T-103) into every `createContext` and into `runPreFlight` options (T-110).
2. Expose the preflight result out-of-band, never inside the persisted draft (it holds storage-state paths): `discoverSite(options): Promise<DiscoveryOutcome>` where `DiscoveryOutcome = { draft; preflight? }`. `DiscoveryAgent.discover()` keeps returning the draft (so the runner still builds); add `DiscoveryAgent.discoverWithSession()` returning the `DiscoveryOutcome`. T-115 switches the runner to `discoverWithSession` and keeps `preflight` in memory for the run.
3. Pass `deadlineAt = now + discoveryBudgetMs` (default 20 min, env `QA_DISCOVERY_MAX_MINUTES`) and `maxPages` shared: each role crawl gets `min(maxPages, max(20, floor(maxPages/2)))`.
4. After each role crawl: if `spider.sessionLost` or `signInWalls.length >= 3`, add `exploration.signInFailures[role] = 'session-expired'` (fixed reason) and a note "<role>'s sign-in stopped working part-way; pages after that were not explored" (fixed wording; role name only). Under `requireSignIn`, throw `SignInFailedError` with reason `session-expired`.
5. Telemetry: build `pageCoverage` from the spider `skipped` (now `SkippedPageInfo`) and `routes`; keep `found`/`reached`; include at most 500 `routes` (drop `redirectChain` beyond 5 hops). Emit `DISCOVERY_PROGRESS` fields `signedInAs`, `signInFailedFor`, `skipped` (optional, T-109 reads them). Log one `debugLog('auth', ...)` line per role with `roleDiagnostics`.
6. Narrow-screens context (`:432-438`) gets the same `RunContextOptions` + the role's `storageState`.

## Out of scope
Spider internals (T-111, T-112); orchestrator reuse (T-114); server wiring (T-115); `issues-document.ts` wording for new skip reasons (not owned: if it breaks, report).

## Files owned
- `packages/core/src/discovery/discovery-agent.ts`
- `packages/core/tests/signed-in-discovery.test.ts`, `packages/core/tests/pipelined-discovery.test.ts`, `packages/core/tests/discovery-agent-headers.test.ts` (new)

## Files read-only
`preflight.ts` (T-110), `deterministic-spider.ts` (T-111/T-112), `browser.ts` (T-103), `packages/core/src/issues-document.ts`, `fixtures/test-app/server.js`.

## Interface contract
```ts
// discovery-agent.ts
export interface DiscoveryOptions { /* existing */ customHeaders?: Record<string,string>; userAgent?: string; tunnelAuth?: string; headerHosts?: string[]; deadlineAt?: number; }
export interface DiscoveryOutcome { draft: DiscoveryDraft; preflight?: PreFlightResult }
// private discoverSite(options: DiscoveryOptions): Promise<DiscoveryOutcome>  (today a private method, discovery-agent.ts:244)
// public discover(options)            -> Promise<DiscoveryDraft>    (unchanged, returns outcome.draft)
// public discoverWithSession(options) -> Promise<DiscoveryOutcome>  (new)
// DiscoveryAgent.discover(...)            -> Promise<DiscoveryDraft>   (unchanged)
// DiscoveryAgent.discoverWithSession(...) -> Promise<DiscoveryOutcome> (new; T-115 uses it at server.ts:3119)
```
`DISCOVERY_PROGRESS` crawling payload gains optional `signedInAs?: string`, `signInFailedFor?: string[]`, `skipped?: number`.

## Implementation notes
- `server.ts:3119` is the only runner caller of `DiscoveryAgent.discover`; do not touch it. T-115 switches it to `discoverWithSession`.
- Keep `requireSignIn` ordering from `:272-281`.
- Do not copy `roleStorageStates` into the draft.

## Acceptance criteria
- [ ] Test (header echo, T-102 `/lab/headers`): during discovery the bypass header reaches the sign-in request, the visitor crawl, the role crawl and the narrow-screens pass (counted via `/lab/stats.headerHits`).
- [ ] `discoverSite` returns `preflight.roleStorageStates` with the signed-in role; the draft JSON contains no storage-state path or cookie (assert by serializing the draft).
- [ ] `/lab/expiring` as a signed-in role: `exploration.signInFailures[role] === 'session-expired'` and the note text is the fixed wording; with `requireSignIn` the call throws `SignInFailedError`.
- [ ] With `deadlineAt` already in the past the crawls end immediately with `time-limit` entries and the call still resolves.
- [ ] `pageCoverage.skipped` contains `http-error` with a status for `/lab/always-500` (fixture).
- [ ] Evidence for G-004 (discovery half) no longer holds: `grep -n "runPreFlight" packages/core/src/discovery/discovery-agent.ts` shows the call passing `customHeaders` and `userAgent`.
- [ ] Existing discovery tests pass.
- [ ] `pnpm build` passes without any change to `packages/runner` (`discover()` still returns the draft; `discoverWithSession()` is additive).
- [ ] Evidence for G-014, G-006, G-007, G-010 no longer holds: `discoverWithSession` exists and returns the preflight; `pageCoverage` carries `routes`; a dropped role session is reported as `session-expired`; `deadlineAt` is passed to every crawl (`grep -n "deadlineAt" packages/core/src/discovery/discovery-agent.ts`).

## Test plan
```
pnpm exec vitest run packages/core/tests/signed-in-discovery.test.ts packages/core/tests/pipelined-discovery.test.ts packages/core/tests/discovery-agent-headers.test.ts packages/core/tests/e2e-discovery.test.ts packages/core/tests/page-coverage.test.ts
pnpm build
```

## Definition of done
Boxes checked; `pnpm build` green without touching the runner; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-113 in the QA Flow Tester repo. Read docs/plan/tickets/T-113-discovery-agent-handoff.md and packages/core/src/discovery/discovery-agent.ts, then implement it. Edit only discovery-agent.ts and the listed tests. Thread customHeaders/userAgent/tunnelAuth/headerHosts into runPreFlight and every createContext (including narrow screens), keep DiscoveryAgent.discover returning the draft but add discoverWithSession() returning { draft, preflight }, share a discovery time budget, report a role session that dropped (fixed wording, 'session-expired' reason, fail closed under requireSignIn), build pageCoverage with routes from the spider, add optional progress fields, and log via debugLog. Never put cookies/storage paths in the draft. Use the /lab/* fixture routes (T-102). Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main. If blocked, stop and report.
```
