# Gap register (fresh audit, 2026-10-13)

Goal: make the authentication flow and the crawler/spider reliable. Method: 5 code explorers, then 15 read-only dimension analyzers; findings merged by root cause. I re-read the key code myself (see "Verified by orchestrator"). Docs were treated as claims, not evidence. Paths are relative to the repo root. No secret values were read or printed.

## Executive summary

53 gaps: **13 high, 23 medium, 17 low, 0 critical.** Counts by dimension in the heatmap below.

Top 5 in plain language:

1. **Login is a snapshot, not a wait (G-001, G-002, G-003).** `preflight.ts` reads the form right after `domcontentloaded`, submits, waits at most 8 s plus a fixed 400 ms, and calls it success if no password field is visible. Slow or client-rendered logins give false `no-form` / `wrong-details`; a failed login can be saved as a session; every other error is reported as `no-form` or `unreachable`.
2. **Bypass headers, user-agent and tunnel auth reach only part of the flow (G-004).** Discovery gets `customHeaders`; sign-in, the Plan Review "crawl more", the sign-in test endpoint, the narrow-screen pass and the whole test run do not (`server.ts:3548-3582` never passes them).
3. **The spider reads links before the page has hydrated and never records why a route failed (G-005, G-006, G-009).** One `domcontentloaded` + immediate `a[href]` read, HTTP status discarded, every failure is `did-not-load`, and failed paths still use the page budget.
4. **Nothing notices a lost session (G-007, G-008).** Login-bounce detection needs a password field present at that instant; the test run has no check at all after `goto(startPage)`, so an expired session produces results against the login page. Sign-in also runs twice per check-up (G-014).
5. **None of the failure modes can be reproduced in tests (G-012).** The fixture has no late-hydrating SPA, session expiry, query/path trap, hash route, onClick-only navigation, overlay or redirect chain, so none of the fixes above has regression protection.

## Heatmap (dimension x severity)

| Dimension                 | Critical | High | Medium | Low | Total                  |
| ------------------------- | -------- | ---- | ------ | --- | ---------------------- |
| 1 Intent vs reality       | 0        | 0    | 0      | 0   | 0 (merged into others) |
| 2 Unfinished work         | 0        | 1    | 0      | 2   | 3                      |
| 3 Test gaps               | 0        | 1    | 2      | 0   | 3                      |
| 4 Error handling          | 0        | 6    | 1      | 3   | 10                     |
| 5 Security                | 0        | 0    | 3      | 3   | 6                      |
| 6 Data and schema         | 0        | 1    | 1      | 2   | 4                      |
| 7 API / contracts         | 0        | 1    | 3      | 0   | 4                      |
| 8 Observability           | 0        | 1    | 1      | 0   | 2                      |
| 9 Performance             | 0        | 1    | 1      | 2   | 4                      |
| 10 Dependencies / tooling | 0        | 0    | 2      | 1   | 3                      |
| 11 CI/CD                  | 0        | 0    | 1      | 1   | 2                      |
| 12 Code health            | 0        | 0    | 3      | 1   | 4                      |
| 13 Docs                   | 0        | 0    | 1      | 0   | 1                      |
| 14 UX / a11y              | 0        | 0    | 2      | 1   | 3                      |
| 15 Goal gap               | 0        | 1    | 2      | 1   | 4                      |
| **Total**                 | 0        | 13   | 23     | 17  | 53                     |

Each gap is counted once under its primary dimension (the first listed in its entry). Dimension 1 findings were all duplicates of findings owned by other dimensions (PRD login promise, headers, coverage display, status 200, missing plan files), so they are merged and credited in the entries. Totals: 13 + 23 + 17 = 53.

## Verified by orchestrator (read directly)

- `server.ts` references `customHeaders` only at 439, 2743, 3140-3141 (grep); `orchestrator.run({...})` at 3548-3582 has none. G-004 confirmed.
- `preflight.ts` 175-178 (single `domcontentloaded` goto, 12 s), 186-187 (one-shot field probe), 251-258 (8 s race + `waitForTimeout(400)`), 260-273 (success = no visible password field, then saves state), 275-278 (error mapping). G-001/002/003 confirmed.
- `deterministic-spider.ts` 331-346 (goto result discarded, bounce needs a password field and a path change), 347-355 (first landing rebases `site`, off-site becomes `did-not-load`), 529-532 (bare catch), 542/562 (`lastLoadAt` is a per-worker local, so the polite delay is per worker), 544/550-553 (`visited.add` before load). G-005/006/007/009/021/038 confirmed.
- `orchestrator.ts` 570 (`goto(startUrl)` with no status/URL/password check), 908 (`statusCode: 200`). G-008, G-011 confirmed.
- `preflight.ts` 162-180 and 217/244: the login origin is whatever the page lands on; no same-origin check before `fill`. G-023 confirmed.

## Register (ordered by severity)

### High

**G-001** · Dim 4 (also 15, 1) · Login has no readiness wait and no retry

- Evidence: `packages/core/src/preflight.ts:175-178` single `domcontentloaded` goto (12 s); `:186-187` one-shot `findField`; `:251-258` 8 s race then fixed `waitForTimeout(400)`; no `networkidle`/hydration/retry anywhere in the file (grep).
- Confidence: verified · Severity: high - a late-hydrating or slow login gives false `no-form` / `wrong-details`, and the role is dropped.
- Impact: login is not deterministic; the same site passes or fails by timing. · Remedy: wait for a visible field with a cap, retry once on timeout/navigation failure (never after a visible alert), wait for a post-submit signal. · Effort: M

**G-002** · Dim 4 (also 15, 1) · Login success is judged only by "password field not visible"

- Evidence: `preflight.ts:260-273` (origin unchanged + no visible password input, then `storageState` saved); no check of cookies, landing URL or a post-login selector. `docs/PRD.md:226` promises "validates successful redirect" (claim).
- Confidence: verified · Severity: high - a failed login that re-renders without a password input, or an MFA step, is saved as a session.
- Impact: silently signed-out crawl and test run. · Remedy: require the landing page is not the login path and the storage state has cookies/localStorage; support optional `postLoginSelector`/`postLoginUrl`. · Effort: M

**G-003** · Dim 4 (also 8, 15) · Sign-in failures are misclassified and undiagnosable

- Evidence: `preflight.ts:275-278` (timeout/`net::ERR_` -> `unreachable`, everything else -> `no-form`); `:346-349` outer catch -> `unreachable`, nothing logged; `:195,:228,:255` `.click().catch(() => {})`; no `console` call in the file.
- Confidence: verified · Severity: high - a closed page or detached element shows as "no sign-in form"; no step name anywhere.
- Impact: wrong guidance in wizard and report; `requireSignIn` aborts a run with a misleading reason. · Remedy: classify by error kind; add a non-secret `failedStep` and a redacted debug line (keep the "never return page or typed text" rule at `:143-150`). · Effort: M

**G-004** · Dim 7 (also 12, 4, 8, 15, 1, 5) · Headers, user-agent and tunnel auth are not propagated to every stage

- Evidence: `preflight.ts:333-336,381` `createContext({baseUrl, tunnelAuth})` only; `discovery-agent.ts:265` passes `tunnelAuth` undefined; `:432` narrow-screens context has no headers; `server.ts:1721` and `:4463` (`crawlMore`) none; `server.ts:3548-3582` `orchestrator.run` gets no `customHeaders`/`userAgent`/`tunnelAuth` (grep: `customHeaders` only at 439, 2743, 3140); `preflight.ts:93-99` reachability fetch has none. Headers are also not stored in the plan context, so approve/resume/Test again lose them.
- Confidence: verified · Severity: high - a bypass-token (WAF/staging) site is crawlable but sign-in and every test fail.
- Impact: sign-in and test run see a different site than the crawl. · Remedy: one context-options object (`baseUrl, tunnelAuth, customHeaders, userAgent, storageState`) used everywhere; store validated headers in the run context. · Effort: M

**G-005** · Dim 15 (also 4) · Spider reads links before hydration, no zero-link retry

- Evidence: `deterministic-spider.ts:331` `goto(domcontentloaded, 10000)`, `:368` immediate `$$eval('a[href]')`, `:386` inventory, `:401` forms; no `networkidle`/`waitForSelector`/hydration wait (grep).
- Confidence: verified · Severity: high - client-rendered apps record zero links and never expand.
- Impact: a fraction of the site is crawled; the page is still counted as visited. · Remedy: `settle(page)` (load + bounded idle + at least one link or interactive element), retry once when a page has zero links. · Effort: M

**G-006** · Dim 8 (also 4, 15, 1, 6) · No per-route crawl telemetry; HTTP status and failure cause discarded

- Evidence: `deterministic-spider.ts:331` Response dropped; `:529-532` bare catch -> `did-not-load`; `:54-57` `SkippedPage` is `{urlPath, why}` with 4 reasons; 0 `console.` calls in the file; redirects kept in a local Map (`:342,:358`); no `DEBUG`/`QA_DEBUG`/`VERBOSE` anywhere (grep over `packages/*/src`, `docs/CONFIGURATION.md`, `.env.example`).
- Confidence: verified · Severity: high - a 404, 500, timeout, off-site redirect and DNS error look identical.
- Impact: short crawls cannot be diagnosed without editing code. · Remedy: `RouteTelemetry {requestedPath, status, finalPath, redirectChain, skipReason, detail, attempts, durationMs}` per route, a `QA_DEBUG=crawl,auth` switch, one redacted log line per route. · Effort: M

**G-007** · Dim 4 (also 15, 8, 1) · Spider cannot tell a login bounce or lost session reliably

- Evidence: `deterministic-spider.ts:333-337` bounce = path changed AND a password input exists immediately after `domcontentloaded`; misses SSO / username-first / late-rendered / same-path login and 401/403; `discovery-agent.ts:401-413` no check that a role crawl hit walls; no re-login (grep `re-?login|reauth` in `packages/*/src`: none).
- Confidence: verified · Severity: high - a session lost mid-crawl turns later pages into recorded login pages or silent skips.
- Impact: signed-in coverage degrades to a signed-out crawl with no signal. · Remedy: decide after settle, also on landing on a known login path or the role's login page; count consecutive bounces and stop with `session-lost`; report it per role. · Effort: M

**G-008** · Dim 4 (also 15, 1) · The test run never checks for a lost session

- Evidence: `orchestrator.ts:546-556` context per test point from the saved state; `:570` `goto(startUrl)` with no status, final-URL or password-field check; retry reuses the same dead state (`:531-556`); `session-expired` exists only in `preflight.ts:386-392` for supplied sessions.
- Confidence: verified · Severity: high - an expired session yields findings/passes against the login page.
- Impact: auth failures reported as product bugs. · Remedy: after `goto(startUrl)` for a signed-in role, detect a login redirect; fail the point with an explicit `session-lost` reason, re-auth once. · Effort: M

**G-009** · Dim 4 (also 9, 15) · Failed/skipped pages consume the page budget and transient timeouts are never retried

- Evidence: `deterministic-spider.ts:544` loop bound `visited.size < maxPages`; `:550-553` `visited.add` at dequeue before load; robots (`:318-322`), wall (`:337`), off-site (`:352`) and failure (`:529`) all return after the add; no retry in `evaluatePage`.
- Confidence: verified · Severity: high - 200 broken links can exhaust the crawl with zero pages recorded.
- Impact: thin inventory and Plan; a cold-start host (Render free tier) loses pages for good. · Remedy: count recorded pages against `maxPages`, cap attempts separately, retry a failed load once with a longer timeout. · Effort: M

**G-010** · Dim 9 (also 15, 4) · No wall-clock or depth budget; page cap is per explorer; no trap guard

- Evidence: `deterministic-spider.ts:544,93` (cap 200, loop ends only on abort/cap); grep `deadline|maxDepth|maxDuration|depth` in the file: none; `discovery-agent.ts:375-413` one crawl for the visitor plus one per role, each with its own cap; path-only key (`:267`) so `/a/1../a/N`, `/cal/2031/05` are unbounded until 200.
- Confidence: verified · Severity: high - discovery time is unbounded and multiplied by roles; hosts with request timeouts kill the job.
- Impact: very long crawls, near-identical routes fill the budget. · Remedy: wall-clock budget + depth limit + per-route-shape cap, shared budget across explorers, `skipped.why = 'time-limit' | 'trap-limit'`. · Effort: M

**G-011** · Dim 2 (also 1) · Permission Matrix check is fed a hardcoded status 200

- Evidence: `orchestrator.ts:904-910` `statusCode: 200`, no `redirectedToLogin`; `packages/checkers/src/permission-matrix.ts:67-124` uses both.
- Confidence: verified · Severity: high - a 401/403/login redirect is read as "granted", so denial expectations cannot be judged.
- Impact: broken access control and expired sessions go unreported; false findings possible. · Remedy: pass the main-frame response status and the bounce signal from the navigation. · Effort: S

**G-012** · Dim 3 (also 15, 11) · Fixture and tests cannot reproduce the failure modes

- Evidence: `fixtures/test-app/server.js` has only a static-role cookie with no expiry (`:209-214`), server-side delays (`/reports`, `/slow/N`), no SPA shell, hash route, onClick-only target, overlay, query trap, redirect chain, 5xx link, slow login or unlinked sitemap entry; grep `hash|trap|page=|calendar|overlay` in `spider-*.test.ts` and `pipelined-discovery.test.ts`: none; no 401/403 assertion in spider/discovery tests.
- Confidence: verified (fixture), suspected for tests not opened in full · Severity: high - every fix in this plan lacks regression protection.
- Impact: hydration waits, trap limits, expiry detection can regress unnoticed. · Remedy: add `/lab/*` routes per failure mode and tests per mode. · Effort: M

**G-013** · Dim 6 · Re-approval after a runner restart restores only a role named `member` and drops loginPath/selectors

- Evidence: `packages/wizard/src/lib/form.ts:238-240` `approveRolesOf` returns one hardcoded `{role:'member', ...}`; `server.ts:3822` `planForDisk` keeps `role` and `loginPath` only; `server.ts:4632-4644` replaces by `sent.get(r.role) ?? r` and 409s while `signInNotSaved` is non-empty; `PlanReviewScreen.tsx:494-497` one "SignInAgain" form.
- Confidence: verified (analyzer read) · Severity: high - approval can dead-end or silently lose login config.
- Impact: plans with roles other than `member`, or several roles, cannot be approved after a restart. · Remedy: return pending roles in the 409, prompt per role, merge sent credentials over saved loginPath/selectors. · Effort: M

### Medium

**G-014** · Dim 12 (also 9, 15, 3) · Sign-in runs twice per check-up

- Evidence: `discovery-agent.ts:263-270` and `orchestrator.ts:370-374` each call `runPreFlight` with separate state; failure semantics differ (`discovery-agent.ts:272-281` vs `orchestrator.ts:376-405`).
- Confidence: verified · Severity: medium - lockout/rate-limit/OTP risk; crawl and run can hold different sessions.
- Impact: second login can fail and drop a role. · Remedy: produce the preflight result once, hand it to the run, re-validate instead of re-login. · Effort: M

**G-015** · Dim 12 (also 5, 2) · Spider `setExtraHTTPHeaders` duplicates the context option and swallows errors

- Evidence: `deterministic-spider.ts:238-240` `.catch(() => {})`; `browser.ts:127-134` already merges tunnel + custom headers into the context.
- Confidence: verified (code); suspected (the call replaces the tunnel headers - Playwright semantics, not run) · Severity: medium.
- Impact: tunnel auth possibly lost mid-crawl; a failure to apply headers is invisible. · Remedy: delete the call, rely on the context option. · Effort: S

**G-016** · Dim 5 · Bypass/tunnel headers are sent to every origin

- Evidence: `browser.ts:127-144` `extraHTTPHeaders` on the context; no origin filter.
- Confidence: verified (code); semantics inferred from Playwright · Severity: medium - secrets reach analytics/CDN/third parties and off-site links.
- Impact: token disclosure; CORS preflights distort checks. · Remedy: add the headers in a `context.route` only for the target origin (and allowlisted hosts). · Effort: M

**G-017** · Dim 7 (also 14, 1, 6, 13) · Wizard cannot send selectors, token or a login URL; remembered sign-ins drop them

- Evidence: `RoleCredential` fields `evidence-finding.ts:120-129`; `form.ts:182-193` `rolesOf` sends role/username/password/loginPath only; grep `usernameSelector|submitSelector` in `packages/wizard/src`: 0; `server.ts:1812-1819` rememberSignIns replaces the whole array and keeps only role/username/loginPath; only `checkup.ts:122-124,243-251` can send selectors.
- Confidence: verified · Severity: medium - the `no-form` failure has no remedy in the UI.
- Impact: custom/multi-origin logins cannot be configured. · Remedy: "Advanced" fields per sign-in; persist selectors (not secrets); merge by role. · Effort: M

**G-018** · Dim 7 (also 13) · Header input handling is inconsistent and silent

- Evidence: `form.ts:136-143` drops lines without `:`; `run-inputs.ts:202-225` no header-name token or CR/LF check; `checkup.ts:172-174` ignores invalid `QA_CUSTOM_HEADERS`; three parsers (wizard, runner, CLI).
- Confidence: verified · Severity: medium - the user believes a bypass token is set when it is not.
- Impact: blocked crawl with no explanation. · Remedy: one shared parser/validator, errors surfaced. · Effort: S

**G-019** · Dim 14 (also 7, 1) · The wizard hides crawl coverage and crawl health

- Evidence: grep `pageCoverage` in `packages/wizard/src`: 0; `ReportScreen.tsx:1074-1128` shows only rolesNotTested/documentedItems; `App.tsx:235` casts `DISCOVERY_PROGRESS` with `as unknown as ScanProgress`; `ScanningScreen.tsx:7-29,127-141` no sign-in/skipped/stall info.
- Confidence: verified · Severity: medium - the wizard and the HTML export tell different stories.
- Impact: a crawl stopped at the login wall looks healthy. · Remedy: coverage block + skipped list in the report; shared progress type; sign-in/skip/stall info on the scanning screen. · Effort: M

**G-020** · Dim 15 · Link discovery is limited to `a[href]` and path keys

- Evidence: `deterministic-spider.ts:368` `a[href]` only; `:376` skips `#` links; `:267,:550` path-only key (query and hash routes collapse); grep `sitemap` in `packages/core/src/discovery/`: 0; `[role=link]` collected but never enqueued; form `action` never enqueued; no overlay/consent dismissal in the main crawl.
- Confidence: verified · Severity: medium (click exploration partly covers SPAs, 8/page and 100/crawl).
- Impact: sitemap-only, hash-routed and query-routed pages are never crawled; overlays hide targets. · Remedy: sitemap seeding, route key with selected query/hash, `[role=link]`/`data-href`, overlay dismisser. · Effort: M

**G-021** · Dim 4 · The first landing page rebases the whole crawl, including to another host

- Evidence: `deterministic-spider.ts:347-350` sets `site` from the first landing before the off-site test at `:352`; `landedOnce` is set even for an error page.
- Confidence: verified · Severity: medium. Impact: SSO/marketing redirect moves the scope; empty crawl. · Remedy: rebase only for www/apex or http/https changes. · Effort: S

**G-022** · Dim 5 (also 6, 7) · Role names are unvalidated and reused as a file name in a shared, never-cleaned authDir

- Evidence: `preflight.ts:319` `path.join(authDir, `${role.role}.json`)`; `server.ts:1808-1817,2981-2983` roles from the body unchecked (`handleAddSignIn` sanitizes at `:4356-4361`); `server.ts:703` one `<outputDir>/auth` for all sites/runs; grep for removal of authDir: none; `fs.mkdir` with no mode (`preflight.ts:313`).
- Confidence: verified (path use, no cleanup); suspected (traversal reachable over HTTP) · Severity: medium.
- Impact: `../x` can write a `.json` outside authDir; two sites/runs overwrite each other's session; cookie files persist on a possibly synced folder. · Remedy: validate role names at the API, slugify in the path, per-run auth dir with 0o700, delete on run end. · Effort: S

**G-023** · Dim 5 · The sign-in password can be typed into a different origin

- Evidence: `preflight.ts:162` `new URL(loginPath || '/login', baseUrl)` (absolute `loginPath` replaces the base); `:180` origin taken from where the page landed; `:217,:244` `fill` before any same-origin check (the check is at `:262`, after submit); `loginPath` unchecked in `run-inputs.ts` (grep).
- Confidence: verified · Severity: medium - needs a hostile input or a redirect, but exposes the test password to a third party.
- Impact: credential disclosure. · Remedy: require `loginPath` on the target origin and abort (`needs-more`) before filling if the page is on another origin. · Effort: S

**G-024** · Dim 6 · Persisted plan and site memory have no version and are written non-atomically

- Evidence: `server.ts:3671-3689` catch returns null; `:3791-3795` plain `writeFile`; `site-memory.ts:129-138,156-160` same; grep `schemaVersion` in `server.ts`, `site-memory.ts`: 0.
- Confidence: verified · Severity: medium. Impact: a truncated plan reads as "no plan"; a truncated memory is overwritten with an empty one. · Remedy: temp-file + rename, `schemaVersion`, back up on parse failure. · Effort: M

**G-025** · Dim 10 · Playwright ranges disagree across packages and the Docker image

- Evidence: `packages/core/package.json:17`, `packages/checkers/package.json:16` `^1.49.1`; `packages/wizard/package.json:27` `^1.63.0`; `packages/runner/Dockerfile:3` `v1.63.0-noble`; `scripts/check-playwright-version.mjs` compares lockfile and Dockerfile only and runs only in `ci.yml:31`.
- Confidence: verified (manifests; lockfile unreadable to the analyzer) · Severity: medium. Impact: a lockfile regeneration can change the Playwright that drives login/crawl. · Remedy: one pinned version via overrides/catalog; run the guard in deploy. · Effort: S

**G-026** · Dim 10 · Tests and scripts are never type-checked; lint lacks promise rules

- Evidence: `packages/core/tsconfig.json` `include: ["src/**/*"]`; `eslint.config.mjs` uses `tseslint.configs.recommended`, `no-explicit-any` off in tests (`:77`); no pre-commit hook.
- Confidence: verified · Severity: medium. Impact: a missing `await` on a Playwright call (flaky crawl) is not flagged. · Remedy: `tsconfig.test.json` + `typecheck` script; `no-floating-promises` at warn for `src`. · Effort: M

**G-027** · Dim 3 · Several test files share fixed ports

- Evidence: `missing-element.test.ts:9` and `page-coverage.test.ts:10` (3541); `narrow-look.test.ts:12` and `spider-form-facts.test.ts:7` (3532); `opening-missing.test.ts:9` and `require-sign-in.test.ts:17` (3547); no `fileParallelism` in `vitest.config.ts`.
- Confidence: verified (duplicates); suspected (live collisions) · Severity: medium. Impact: intermittent EADDRINUSE in the sign-in gate test. · Remedy: `listen(0)`. · Effort: S

**G-028** · Dim 3 · No test of header propagation across phases, storageState handoff, or one sign-in per check-up

- Evidence: grep `customHeaders|extraHTTPHeaders` in `packages/*/tests`: only `spider-concurrency.test.ts:60` (`some` request); fixture `/signin` has no counter (`server.js:84-91`).
- Confidence: verified · Severity: medium. Impact: dropped headers or repeated logins pass the suite. · Remedy: fixture counters/echo, end-to-end assertions. · Effort: M

**G-029** · Dim 11 (also 3) · CI never exercises login-then-crawl end to end, and release is weaker than PR CI

- Evidence: `ci.yml:51`, `deploy.yml:63` exclude `wizard-e2e.test.ts`; `release.yml:27-36` build only; `deploy.yml:46-63` no lint/format/audit/Playwright guard; `benchmark.yml:39` `--sites fixture --no-ai` and no login terms in `scripts/benchmark.ts` (grep).
- Confidence: verified (workflows); suspected (benchmark detail) · Severity: medium. Impact: auth/crawl regressions ship. · Remedy: nightly/dispatch e2e, a PR job for login+crawl on the fixture, test gate in release. · Effort: M

**G-030** · Dim 15 (also 12) · No shared navigation helper; the goto policy is duplicated

- Evidence: raw `goto` at `preflight.ts:175,383`, `deterministic-spider.ts:331,461,494`, `orchestrator.ts:570,663`, each `domcontentloaded` with its own timeout (10/12/15 s), none with retry, status capture, hydration wait or bounce check.
- Confidence: verified · Severity: medium. Impact: every fix must be repeated in each place. · Remedy: `navigate(page, url, opts)` in `packages/core/src/navigate.ts`. · Effort: M

**G-031** · Dim 12 · Spider has no canonical route normalization; `crawl()` is one closure

- Evidence: `deterministic-spider.ts:267,273,342-343,359-360,379,467,550` each re-derive pathname/search; `evaluatePage` ~300 lines with shared mutable state.
- Confidence: verified · Severity: medium. Impact: trap/dedupe/bounce fixes need edits in ~7 places. · Remedy: `normalizeRoute()` + `CrawlFrontier`. · Effort: M

**G-032** · Dim 13 (also 1, 8) · Docs contradict or omit the code

- Evidence: `CLAUDE.md:12-13`, `docs/README.md:29`, `docs/adr/0010-...md:31`, `packages/wizard/DESIGN.md:7,132`, `docs/GAP_ANALYSIS.md:4` cite `URL_FIRST_IMPLEMENTATION_PLAN.md`/`UX_IMPLEMENTATION_PLAN.md` (absent in `git ls-files`); `docs/CONFIGURATION.md:60` says `QA_FAIL_ON` defaults to `blocker`, `checkup.ts:141-143` defaults `standard`; `QA_CONCURRENCY`, `QA_DELAY_MS`, `QA_CUSTOM_HEADERS`, `--header`, per-role selectors, `customHeaders`/`crawlConcurrency` appear in no doc; `docs/API.md:78` omits `session-expired` (listed at `:39`); broken ADR links.
- Confidence: verified · Severity: medium. Impact: users and agents chase missing files and cannot discover the bypass-header option. · Remedy: fix and document. · Effort: S

**G-033** · Dim 14 · Sign-in form UX and keyboard access

- Evidence: `NewCheckupScreen.tsx:219-226` `start()` returns silently when consent is unticked; `:1264-1274,:1432-1440` file inputs are `className="hidden"` and have no try/catch around `file.text()`; "Sign-in page" labelled differently in three forms; `api.ts:769` `testSiteSignIn` drops the named reason on HTTP errors.
- Confidence: verified · Severity: medium. Impact: dead-looking button; keyboard users cannot import roles/sessions. · Remedy: hint/focus on missing consent, `sr-only` inputs, one shared label. · Effort: S

**G-034** · Dim 7 · `releaseVerdict` default differs between "no gate" and the Standard/Lenient gates

- Evidence: `packages/types/src/verdict.ts:85` `gate ? gate.maxMajors : 0`; callers `checkup.ts:339,448`, `html-report.ts:40`, `reporter.ts:100`, wizard `summary.ts:91` pass no gate.
- Confidence: verified · Severity: medium. Impact: wizard says Ready while report/CI say Not ready. · Remedy: one rule for omitted `maxMajors`. · Effort: M

**G-035** · Dim 9 · A fresh context and video per test point, and per retry

- Evidence: `orchestrator.ts:431` `recordVideo` default true; `:463-556` `openPage` per case x breakpoint, again on attempt 2.
- Confidence: verified · Severity: medium. Impact: slow, large evidence folders. · Remedy: record only on retry/failure. · Effort: M

**G-036** · Dim 8 (also 5) · Raw error text is forwarded to clients; header values may persist

- Evidence: `server.ts:4199,2583,2840,3592,4720,4805,4826,4946,5024,5086,5101` broadcast/return `err.message`; only `:4125-4132` builds a `Redactor`; no strip of `customHeaders` in `planForDisk` confirmed (grep `customHeaders` in `packages/core/src/plan`: 0).
- Confidence: suspected · Severity: medium. Impact: a token inside a URL in a Playwright error could reach SSE; bypass tokens could be saved in plan JSON. · Remedy: one redacting error helper; sentinel-value test. · Effort: M

### Low

**G-037** · Dim 4 (also 9) · Reachability check and pre-flight cleanup

- Evidence: `preflight.ts:106-113` `clearTimeout` not in `finally`; `:122` `ok: res.status < 500` (401/403/404 pass); `:295` plain fetch (10 s) fails on cold-start hosts; `:333-349` `context.close()` inside `try`, not closed when `signIn` throws.
- Confidence: verified · Severity: low. Impact: leaked contexts; cold hosts reported unreachable; wrong address blamed on sign-in. · Remedy: `finally`, warm-up with retries, warn on 4xx. · Effort: S

**G-038** · Dim 9 · Spider pacing and exploration waits

- Evidence: `deterministic-spider.ts:542` `let lastLoadAt` per worker; fixed `waitForTimeout(600)` after clicks (`:464`); `clickBudget` first-come across workers (`:285,:453`).
- Confidence: verified · Severity: low. Impact: concurrency 5 at a 2 s delay hits a public site ~2.5 req/s; fixed sleeps miss slow SPAs. · Remedy: one shared limiter; wait for URL change or idle. · Effort: S

**G-039** · Dim 4 · `openPage` restarts the shared browser for any error

- Evidence: `browser.ts:173-189`. Confidence: verified · Severity: low. Impact: a bad `storageState` file kills other concurrent contexts. · Remedy: restart only for closed/crashed browser errors. · Effort: S

**G-040** · Dim 4 (also 2) · Late errors double-count a page; click/state failures are invisible

- Evidence: `deterministic-spider.ts:440` `pages.push` then `:529-531` pushes `did-not-load` for the same path; empty catches `:380-382,:479-481,:525-527`. Confidence: verified · Severity: low. Impact: contradictory coverage. · Remedy: guard with a recorded flag, count swallowed errors. · Effort: S

**G-041** · Dim 2 · `AccountPoolManager` is exported but unused

- Evidence: `packages/core/src/account-pool.ts:9-61`; grep `AccountPool` in `packages/{core,runner,types}/src`: definition, `index.ts:22`, `hub.ts:25` only. Confidence: verified · Severity: low. Impact: implies per-worker credential leasing that does not exist. · Remedy: wire or delete. · Effort: S

**G-042** · Dim 5 · Chromium runs with `--no-sandbox` and `ignoreHTTPSErrors: true` always

- Evidence: `browser.ts:103-104,142`. Confidence: verified · Severity: low. Impact: weaker isolation; TLS errors accepted silently. · Remedy: opt-in flags. · Effort: S

**G-043** · Dim 5 · Target refusal and the request guard exist only in beta

- Evidence: `server.ts:1354,838`; `grantAccess` returns true without a token (`:799-801`); localhost bind and Host/Origin checks (`:693,855-891`). Confidence: verified · Severity: low (ADR 0014 deliberate). Impact: a tunnelled runner without `RUNNER_ACCESS_TOKEN` is an open scanner. · Remedy: refuse/warn at startup. · Effort: S

**G-044** · Dim 5 · `forgetSecret` writes an empty string instead of deleting

- Evidence: `packages/core/src/ai/key-resolver.ts:96-98`, `SecretStore` has no delete. Confidence: verified · Severity: low. Impact: empty keychain entries accumulate. · Remedy: add `delete`. · Effort: S

**G-045** · Dim 9 · In-memory inventories are unbounded

- Evidence: `deterministic-spider.ts:275-283,386,428-439`; `discovery-agent.ts:298`. Confidence: verified · Severity: low. Impact: heap growth on large dashboards. · Remedy: cap elements per page. · Effort: M

**G-046** · Dim 12 · `SafePublicCrawler` bypasses `BrowserManager` and has separate normalization

- Evidence: `competitive/safe-crawler.ts:172-186,297`. Confidence: suspected · Severity: low (competitor/safe-scan path only). Impact: request guard and host pinning may differ. · Remedy: route through `BrowserManager`. · Effort: M

**G-047** · Dim 10 · Node version not pinned; line endings; dependency hygiene

- Evidence: no `engines` in any `package.json`; no `.nvmrc`/`.npmrc`; `.prettierrc` `endOfLine: "auto"`; `mammoth` exact-pinned among carets (`packages/core/package.json:15`); Dependabot has no Docker entry. Confidence: verified (one item suspected: no `.gitattributes` was not searched explicitly) · Severity: low. Impact: contributor drift. · Remedy: engines, `.nvmrc`, `.gitattributes`. · Effort: S

**G-048** · Dim 6 · `ensurePlanLoaded` can revive a stale plan as awaiting review

- Evidence: `server.ts:3676-3682`. Confidence: suspected · Severity: low. Impact: an old plan reappears after a crash. · Remedy: store plan status in the file. · Effort: S

**G-049** · Dim 6 · `pageCoverage` is declared twice and its reasons cannot express traps or login redirects

- Evidence: `packages/types/src/discovery.ts:157-161`, `run-report.ts:86-90`. Confidence: verified · Severity: low. Impact: drift; no place for new reasons. · Remedy: one shared type. · Effort: S

**G-050** · Dim 11 · No rollback path; Render deploys from push regardless of tests; floating action tags

- Evidence: `render.yaml:15` `autoDeploy: true`; `deploy.yml:87-110` checks only `/` and `/healthz`; `qa-check.yml:48-49` `ref: main`. Confidence: verified · Severity: low (hobby-scale hosting). Impact: bad deploy stays live. · Remedy: deploy hook after tests; document rollback. · Effort: S

**G-051** · Dim 2 · A failed `robots.txt` fetch is treated as allow-all; other discovery catches are silent

- Evidence: `discovery/docs-fetch.ts:186`; `crud-facts.ts:83,100`; `guard.ts:19,25,28,37`. Confidence: verified · Severity: low. Impact: lost diagnostics; polite-crawl rule weakened on error. · Remedy: distinguish fetch error from missing file. · Effort: S

**G-052** · Dim 15 · The saved session is written once and never refreshed

- Evidence: `preflight.ts:273` single write; crawl and run each re-hydrate from it. Confidence: verified · Severity: low. Impact: short-lived tokens may expire before the run. · Remedy: session manager with refresh. · Effort: M

**G-053** · Dim 14 · "Roles not tested" is shown under "Living Spec Conformance" in the report

- Evidence: `ReportScreen.tsx:1073-1086,1115`. Confidence: suspected · Severity: low. Impact: misleading heading. · Remedy: own section. · Effort: S

## Dependencies between gaps

- G-030 (navigation helper) should land before G-001, G-005, G-007, G-008 so fixes are made once.
- G-004 needs the context-options factory (G-016) before call sites change; G-014 (single sign-in) needs G-004's contract.
- G-006 telemetry fields (and G-049) must exist before G-005/G-007/G-009/G-019 record or show them.
- G-031 (frontier) before G-010/G-020.
- G-012 (fixture routes) before G-028 and the G-005/G-007/G-008/G-010 acceptance tests.
- G-022 role validation before G-013/G-017 (roles persist with selectors).

## Quick wins (low effort, high impact)

G-011 (pass real status), G-021 (rebase rule), G-023 (origin guard), G-015 (drop `setExtraHTTPHeaders`), G-018 (shared header validation), G-027 (`listen(0)`), G-025 (pin Playwright), G-032 (docs), G-033 (consent hint).

## Not a gap (checked, intentional)

- Sign-in failure text is fixed and never built from page content or typed details (`preflight.ts:14-24,143-150,276`; `packages/types/src/signin.ts`). Only the classification is a gap.
- Passwords stay in memory or the OS keychain; `planForDisk` omits them; `savedSessions` are memory-only and host-validated (`server.ts:2819-2822,3797-3829`, `run-inputs.ts:117-174`).
- Local runner access control (localhost bind, Host/Origin checks, constant-time access token) is by design for a single-owner tool.
- `wizard-e2e` excluded from PR CI is documented (`docs/TESTING.md`, `docs/DEPLOYMENT.md`); only the missing automation is reported (G-029).
- Path-only page identity is documented as deliberate (`deterministic-spider.ts:250-251`); only its consequences are reported (G-020, G-031).
- Click budgets (8/page, 100/crawl) and concurrency clamp 1-5 are explicit guards (ADR 0025).
- Fresh context per test point is deliberate isolation (`orchestrator.ts:529-531`); only the cost is reported (G-035).
- No TODO/FIXME/HACK/XXX markers in `packages/**` (grep). Redactor hiding only `@` usernames is a documented trade-off (`redact.ts:19-21`).
- `release.yml` not publishing is deliberate (header comment, `release-workflow.test.ts`).

## Coverage statement

Analyzed: all 15 dimensions, scoped to the auth/crawl code paths (`packages/core/src/{preflight,browser,orchestrator}.ts`, `discovery/*`, `competitive/safe-crawler.ts` partly, `plan/*` partly), `packages/runner/src/{server,checkup,run-inputs}.ts`, wizard sign-in/credentials/scanning/report screens, `packages/types/src`, `fixtures/test-app/server.js`, `packages/*/tests` (named files), `.github/workflows/*`, root and package manifests, `docs/` (compared to code).

Not analyzed or limited:

- `pnpm-lock.yaml` could not be read (permission denied), so locked Playwright versions and dependency vulnerabilities are unverified.
- No test, build, audit or coverage run (read-only audit). Playwright behaviours (`setExtraHTTPHeaders` replacing context headers, headers on cross-origin requests) are from the documented API, not executed.
- GitHub branch protection and hosting (Render/Vercel) settings are not visible from the repo.
- `server.ts` (5116 lines) was read at the cited sites only, not end to end; `planForDisk` internals and the request-guard implementation were not fully traced.
- Test files not opened in full: `live-site`, `safe-crawl-links`, `signin`, `signin-endpoint`, `e2e-orchestrator`, `role-failure-run`, `wizard-e2e`; assertion depth was not measured.
- Production configuration, real target sites and the keychain contents.
