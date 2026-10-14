# Traceability

Generated from `tickets.json` and `GAPS.md`. Gap, ticket(s), wave(s). A gap is closed when every listed ticket is done and its evidence no longer holds (see `HANDOFF.md`).

## Gap to ticket to wave

| Gap | Severity | Title | Tickets | Waves |
|---|---|---|---|---|
| G-001 | high | Login has no readiness wait and no retry | T-107, T-110 | 1, 2 |
| G-002 | high | Login success is judged only by "password field not visible" | T-110 | 2 |
| G-003 | high | Sign-in failures are misclassified and undiagnosable | T-101, T-105, T-110 | 0, 1, 2 |
| G-004 | high | Headers, user-agent and tunnel auth are not propagated to every stage | T-103, T-110, T-113, T-114, T-115 | 0, 2, 3, 4, 5 |
| G-005 | high | Spider reads links before hydration, no zero-link retry | T-107, T-111 | 1, 2 |
| G-006 | high | No per-route crawl telemetry; HTTP status and failure cause discarded | T-101, T-105, T-111, T-113 | 0, 1, 2, 4 |
| G-007 | high | Spider cannot tell a login bounce or lost session reliably | T-107, T-111, T-113 | 1, 2, 4 |
| G-008 | high | The test run never checks for a lost session | T-107, T-114 | 1, 3 |
| G-009 | high | Failed/skipped pages consume the page budget and transient timeouts are never retried | T-107, T-111 | 1, 2 |
| G-010 | high | No wall-clock or depth budget; page cap is per explorer; no trap guard | T-112, T-113 | 3, 4 |
| G-011 | high | Permission Matrix check is fed a hardcoded status 200 | T-114 | 3 |
| G-012 | high | Fixture and tests cannot reproduce the failure modes | T-102, T-117 | 0, 6 |
| G-013 | high | Re-approval after a runner restart restores only a role named `member` and drops loginPath/selectors | T-108, T-116 | 1, 6 |
| G-014 | medium | Sign-in runs twice per check-up | T-113, T-114, T-115 | 3, 4, 5 |
| G-015 | medium | Spider `setExtraHTTPHeaders` duplicates the context option and swallows errors | T-111 | 2 |
| G-016 | medium | Bypass/tunnel headers are sent to every origin | T-103 | 0 |
| G-017 | medium | Wizard cannot send selectors, token or a login URL; remembered sign-ins drop them | T-108, T-116 | 1, 6 |
| G-018 | medium | Header input handling is inconsistent and silent | T-101, T-104, T-105, T-108 | 0, 1 |
| G-019 | medium | The wizard hides crawl coverage and crawl health | T-109 | 2 |
| G-020 | medium | Link discovery is limited to `a[href]` and path keys | T-112 | 3 |
| G-021 | medium | The first landing page rebases the whole crawl, including to another host | T-111 | 2 |
| G-022 | medium | Role names are unvalidated and reused as a file name in a shared, never-cleaned authDir | T-104, T-110, T-115 | 1, 2, 5 |
| G-023 | medium | The sign-in password can be typed into a different origin | T-104, T-110 | 1, 2 |
| G-024 | medium | Persisted plan and site memory have no version and are written non-atomically | T-116 | 6 |
| G-025 | medium | Playwright ranges disagree across packages and the Docker image | T-106, T-118 | 0, 7 |
| G-026 | medium | Tests and scripts are never type-checked; lint lacks promise rules | T-106, T-118 | 0, 7 |
| G-027 | medium | Several test files share fixed ports | T-110, T-111, T-117 | 2, 6 |
| G-028 | medium | No test of header propagation across phases, storageState handoff, or one sign-in per check-up | T-102, T-117 | 0, 6 |
| G-029 | medium | CI never exercises login-then-crawl end to end, and release is weaker than PR CI | T-118 | 7 |
| G-030 | medium | No shared navigation helper; the goto policy is duplicated | T-107 | 1 |
| G-031 | medium | Spider has no canonical route normalization; `crawl()` is one closure | T-112 | 3 |
| G-032 | medium | Docs contradict or omit the code | T-119 | 7 |
| G-033 | medium | Sign-in form UX and keyboard access | T-108 | 1 |
| G-036 | medium | Raw error text is forwarded to clients; header values may persist | T-115 | 5 |
| G-037 | low | Reachability check and pre-flight cleanup | T-110 | 2 |
| G-038 | low | Spider pacing and exploration waits | T-111 | 2 |
| G-039 | low | `openPage` restarts the shared browser for any error | T-103 | 0 |
| G-040 | low | Late errors double-count a page; click/state failures are invisible | T-111 | 2 |
| G-047 | low | Node version not pinned; line endings; dependency hygiene | T-106 | 0 |
| G-048 | low | `ensurePlanLoaded` can revive a stale plan as awaiting review | T-116 | 6 |
| G-049 | low | `pageCoverage` is declared twice and its reasons cannot express traps or login redirects | T-101 | 0 |
| G-053 | low | "Roles not tested" is shown under "Living Spec Conformance" in the report | T-109 | 2 |

## Unmapped gaps and dispositions

| Gap | Severity | Title | Disposition | Reason |
|---|---|---|---|---|
| G-034 | medium | `releaseVerdict` default differs between "no gate" and the Standard/Lenient gates | deferred | outside the auth/crawl goal; needs a product decision on gate semantics |
| G-035 | medium | A fresh context and video per test point, and per retry | deferred | performance, not reliability; separate effort |
| G-041 | low | `AccountPoolManager` is exported but unused | deferred | dead code with no runtime effect; decide wire-or-delete with parallel-run work |
| G-042 | low | Chromium runs with `--no-sandbox` and `ignoreHTTPSErrors: true` always | accepted risk | needed for containers and staging/self-signed sites; revisit with opt-in flags |
| G-043 | low | Target refusal and the request guard exist only in beta | deferred | deliberate under ADR 0014; follow-up hardening (startup warning) |
| G-044 | low | `forgetSecret` writes an empty string instead of deleting | deferred | cosmetic keychain leftover |
| G-045 | low | In-memory inventories are unbounded | deferred | bounded in practice by maxPages; revisit if memory issues appear |
| G-046 | low | `SafePublicCrawler` bypasses `BrowserManager` and has separate normalization | deferred | competitor/safe-scan path, outside the goal; suspected |
| G-050 | low | No rollback path; Render deploys from push regardless of tests; floating action tags | deferred | hosting and release process, outside the goal |
| G-051 | low | A failed `robots.txt` fetch is treated as allow-all; other discovery catches are silent | deferred | low impact; fold into a later discovery hardening pass |
| G-052 | low | The saved session is written once and never refreshed | deferred | needs the session manager; revisit after session-loss handling ships |

## Ticket to gaps

| Ticket | Wave | Gaps |
|---|---|---|
| T-101 | 0 | G-003, G-006, G-018, G-049 |
| T-102 | 0 | G-012, G-028 |
| T-103 | 0 | G-004, G-016, G-039 |
| T-104 | 1 | G-018, G-022, G-023 |
| T-105 | 1 | G-003, G-006, G-018 |
| T-106 | 0 | G-025, G-026, G-047 |
| T-107 | 1 | G-030, G-001, G-005, G-007, G-008, G-009 |
| T-108 | 1 | G-017, G-018, G-033, G-013 |
| T-109 | 2 | G-019, G-053 |
| T-110 | 2 | G-001, G-002, G-003, G-004, G-022, G-023, G-037, G-027 |
| T-111 | 2 | G-005, G-006, G-007, G-009, G-015, G-021, G-038, G-040, G-027 |
| T-112 | 3 | G-010, G-020, G-031 |
| T-113 | 4 | G-004, G-014, G-006, G-007, G-010 |
| T-114 | 3 | G-008, G-011, G-014, G-004 |
| T-115 | 5 | G-004, G-014, G-022, G-036 |
| T-116 | 6 | G-013, G-017, G-024, G-048 |
| T-117 | 6 | G-012, G-028, G-027 |
| T-118 | 7 | G-029, G-025, G-026 |
| T-119 | 7 | G-032 |

## Coverage check

- Gaps in register: 53
- Ticketed: 42
- Not ticketed: 11 (deferred or accepted risk, listed above)
- Critical/high gaps without a ticket: none
