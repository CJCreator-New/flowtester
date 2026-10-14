# Plan: reliable authentication and crawler

## Open questions (answer before or during Wave 0; plan proceeds on the stated assumptions)

1. **Playwright target version.** G-025 says align everything on one version. Assumption: pin to the Docker image version (1.63.x). Needs the owner to confirm, and `pnpm-lock.yaml` could not be read in the audit.
2. **Should a lost session re-login once, or only report?** Assumption: re-login once per role per run, then report `session-lost`. Risk: accounts with lockout or one-time tokens (set `QA_RELOGIN=0` to disable).
3. **Header scoping.** Assumption: bypass/tunnel headers go only to the target origin and the Domain Allowlist hosts. Some sites may need them on an API subdomain; the allowlist covers that.
4. **Ticket ids.** The repo already has `docs/tickets/T-01..T-24`. These tickets use `T-101..T-119` so ids never collide.
5. **Out-of-goal items** (G-034, G-035, etc.) are deferred, not forgotten (see dispositions).

## Goal

Make automated login and crawling deterministic and diagnosable: the login waits for real signals, the same authenticated context (session, headers, user-agent) is used by sign-in, the crawl, Plan Review "crawl more" and the test run, the spider survives SPAs, traps and expiring sessions, and every route leaves a telemetry record (URL, HTTP status, final URL / redirect destination, skip reason).

## Scope

In: `preflight.ts`, `deterministic-spider.ts`, `discovery-agent.ts`, `orchestrator.ts`, `browser.ts`, runner `server.ts` / `run-inputs.ts` / `checkup.ts`, shared types, wizard sign-in/coverage UI, fixture app, tests, CI gating, docs for these.

## Non-goals

SSO / OAuth / CAPTCHA / OTP automation (stays `needs-more`; saved sessions remain the workaround); changing checker logic beyond the Permission Matrix input; AI planning; hosting/deploy redesign; hub / multi-tenant work; the verdict gate rule (G-034) and per-test-point video cost (G-035).

## Approach

1. **Contracts first (Wave 0).** Shared types (`RouteTelemetry`, `failedStep`, shared `PageCoverage`), the context factory in `browser.ts`, validation in `run-inputs.ts`, a redacting debug logger, fixture routes that reproduce each failure mode, and tooling alignment. All new files or single-owner files, so they run in parallel.
2. **One navigation helper (Wave 1).** `navigate()` / `settlePage()` encode: `domcontentloaded` then bounded idle, wait for a link or interactive element, capture status / final URL / redirect chain, retry once, report telemetry. Preflight, spider and orchestrator then use it, so each fix lands once.
3. **Core fixes by file owner (Waves 2-4).** `preflight.ts` (T-110) and `deterministic-spider.ts` (T-111) in Wave 2; the spider's link discovery and traps (T-112) and `orchestrator.ts` (T-114) in Wave 3; `discovery-agent.ts` (T-113) in Wave 4 because it passes the budgets T-112 adds. One ticket per file per wave.
4. **Server integration (Waves 5-6).** `server.ts` is owned by one ticket per wave: T-115 (propagation, preflight reuse, per-run auth dir, error redaction), T-116 (re-approval, remembered sign-ins, atomic persistence).
5. **Proof and gates (Waves 6-7).** End-to-end tests on the fixture, CI jobs, docs.

## How gaps are prioritized

Critical/high first (all 13 are ticketed; their fixes land by Wave 6 - G-012 and G-013 complete in T-117 and T-116 - with regression tests in T-102 and T-117). Within a severity: gaps that block other fixes (G-030, G-016, G-012, G-006) go earliest. Medium gaps that touch the same file as a high gap ride along in that ticket. Low gaps are bundled only when they touch a file already owned, otherwise deferred.

## Key design decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| `navigate()` helper in core, used by all three call sites | Fixes are made once; telemetry is uniform | One more module; small behaviour changes in every goto (timeouts, one retry) |
| Headers added with a target-origin `context.route`, not `extraHTTPHeaders` | Stops token leakage to third parties (G-016) | Slightly more overhead per request; needs allowlist hosts for API subdomains |
| Run preflight once, hand `roleStorageStates` to the run | Avoids double login and mismatched sessions (G-014) | The saved state can be old by the time the run starts, so the run revalidates on first navigation (G-008) |
| `failedStep` is a non-secret enum, never page or typed text | Keeps the existing redaction guarantee | Less detail than raw error text |
| Count recorded pages against `maxPages`, cap attempts separately | Dead links no longer exhaust the crawl (G-009) | A crawl of a very broken site can make more requests; bounded by the attempt cap and wall-clock budget |
| Hash and query routes opt in via a route-key option | Avoids exploding the page count on filter/sort links | Default behaviour for query routes changes only for listed parameters |
| Session loss re-logins once, then reports | Prevents silent signed-out runs | One extra login per role on expiry |
| Server work split into two tickets across waves | `server.ts` is 5116 lines and shared | Longer critical path |

## Milestones

- **M0 (Wave 0):** contracts, fixture failure modes, context factory, validation, debug logger, tooling aligned.
- **M1 (Waves 1-2):** navigation helper and debug logger; deterministic login and a reliable spider core; wizard sign-in form and coverage display.
- **M2 (Waves 3-5):** trap/link discovery, single sign-in, session-loss handling, headers reach every stage (runner integration in Wave 5).
- **M3 (Waves 6-7):** persistence and re-approval, end-to-end proof on the fixture, CI gates, docs.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Playwright version change (T-106) breaks tests | Land first; run the full suite; only pin, no upgrade past the Docker image version |
| Existing tests assert old reasons / behaviours | Each core ticket owns the tests for its file and updates them |
| Header scoping breaks sites that need headers on subdomains | Allowlist hosts; documented in T-119; covered by T-103 tests |
| More waiting slows crawls | Bounded caps; telemetry shows time per route; `QA_DEBUG=crawl` |
| Re-login locks an account | Opt-out env var; re-login at most once per role per run |
| `server.ts` merge conflicts | One owner per wave (T-115 then T-116, dependent) |
| T-110, T-111 and T-115 are large (L) | If a session cannot finish one, split along its numbered scope items; the interface contracts stay the same |
| Hidden dependence on `domcontentloaded` timing in existing flows | `navigate()` keeps `domcontentloaded` as the first signal; extra waits are bounded |

## Dispositions (every gap)

**Ticketed:** G-001 T-107/T-110 · G-002 T-110 · G-003 T-101/T-105/T-110 · G-004 T-103/T-110/T-113/T-114/T-115 · G-005 T-107/T-111 · G-006 T-101/T-105/T-111/T-113 · G-007 T-107/T-111/T-113 · G-008 T-107/T-114 · G-009 T-107/T-111 · G-010 T-112/T-113 · G-011 T-114 · G-012 T-102/T-117 · G-013 T-108/T-116 · G-014 T-113/T-114/T-115 · G-015 T-111 · G-016 T-103 · G-017 T-108/T-116 · G-018 T-101/T-104/T-105/T-108 · G-019 T-109 · G-020 T-112 · G-021 T-111 · G-022 T-104/T-110/T-115 · G-023 T-104/T-110 · G-024 T-116 · G-025 T-106/T-118 · G-026 T-106/T-118 · G-027 T-110/T-111/T-117 · G-028 T-102/T-117 · G-029 T-118 · G-030 T-107 · G-031 T-112 · G-032 T-119 · G-033 T-108 · G-036 T-115 · G-037 T-110 · G-038 T-111 · G-039 T-103 · G-040 T-111 · G-047 T-106 · G-048 T-116 · G-049 T-101 · G-053 T-109.

**Deferred (with reason):**
- G-034 releaseVerdict default: outside the auth/crawl goal; needs a product decision on gate semantics.
- G-035 per-test-point context and video cost: performance, not reliability; separate effort.
- G-041 AccountPoolManager dead code: no runtime effect; decide wire-or-delete with parallel-run work.
- G-043 beta-only target guard / exposed runner warning: deliberate under ADR 0014; follow-up hardening.
- G-044 forgetSecret empty write: cosmetic keychain leftover.
- G-045 unbounded inventories: bounded in practice by `maxPages`; revisit if memory issues are observed.
- G-046 SafePublicCrawler divergence: competitor/safe-scan path, outside the goal.
- G-050 rollback / Render autoDeploy / floating actions: hosting and release process, outside the goal.
- G-051 robots fetch-error handling: low impact; fold into a later discovery hardening pass.
- G-052 storageState refresh during a run: needs the session manager; revisit after session-loss handling ships.

**Accepted risk:**
- G-042 `--no-sandbox` and `ignoreHTTPSErrors: true`: needed for container use and staging/self-signed sites; revisit with opt-in flags.
