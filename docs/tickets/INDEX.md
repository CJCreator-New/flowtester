# Tickets

Statuses: todo, planned, approved, built, done, blocked.

| id | title | gaps | priority | size | wave | status | depends on |
|---|---|---|---|---|---|---|---|
| [T-23](T-23-split-large-files.md) | Split large files by area | G35 | P3 | L | 4 | built (23a only) | T-01 |

Later (no ticket yet): G6, G14, G18-G22, G23-G26, G45, G48.

## Demo readiness (plan: [DEMO-READINESS-PLAN.md](DEMO-READINESS-PLAN.md))

Build only; tests run once, in `/verify-all`, after every row here is `built`.

| id | title | gaps | priority | size | wave | status | depends on |
|---|---|---|---|---|---|---|---|
| [T-35](T-35-runner-races-approval-stop.md) | Runner start races, approval and stop | review Runner 2,3,10,11,15; Core 10,11 | P0 | M | 2 | built | T-34 |
| [T-36](T-36-wizard-flows-and-recovery.md) | Wizard flows and recovery | review Demo 1,2,8; Wizard 1-3,8-14,17 | P0 | L | 2 | built | T-31 |
| [T-37b](T-37b-wizard-copy-group-b.md) | Wizard copy and glossary, group B | review Wizard 5-7,16,18-22; Demo 3 | P1 | M | 4 | built | T-36, T-31 |
| [T-38](T-38-docs-env-config-drift.md) | Docs, environment and config drift | review Docs 1,2,3,9,15-19 | P1 | M | 1 | built | T-30 |
| [T-40](T-40-presenter-script.md) | Presenter script for the demo | review Docs 14; Demo notes | P2 | S | 5 | built | T-36, T-37a, T-37b |

## Review remediation (plan: [REVIEW-REMEDIATION-PLAN.md](REVIEW-REMEDIATION-PLAN.md))

Build batches 1–19, in the order the plan sets (see *Build order and file ownership* in the plan). The `wave` column is the batch. Tickets in one batch edit disjoint files; a batch starts only when the earlier ones are built. The plan's mapping table names the built ticket (T-30 to T-40) that each follow-up refines. Build only; tests run once, in `/verify-all`, after every row here is `built`. Batches 1 and 1b (T-41, T-64) come first: they record the baseline and clear its failures.

| id | title | gaps | priority | size | wave | status | depends on |
|---|---|---|---|---|---|---|---|
| [T-41](REVIEW-REMEDIATION-PLAN.md#t-41-test-baseline-that-runs) | Test baseline that runs | test env | P0 | S | 1 | todo | - |
| [T-64](REVIEW-REMEDIATION-PLAN.md#t-64-clear-the-baseline-failures) | Clear the baseline failures | 20 tests, 9 files | P0 | M | 1b | todo | T-41 |
| [T-42](REVIEW-REMEDIATION-PLAN.md#t-42-beta-comparison-delete-and-closed-routes) | Beta: comparison delete and closed routes | SEC, DOC | P0 | S | 2 | todo | T-34, T-41 |
| [T-43](REVIEW-REMEDIATION-PLAN.md#t-43-address-guard-for-every-outbound-request) | Address guard for every outbound request | SEC-1, SEC-2 | P0 | M | 2 | todo | T-41 |
| [T-44](REVIEW-REMEDIATION-PLAN.md#t-44-redaction-matching) | Redaction matching | SEC-3..6 | P1 | M | 2 | todo | - |
| [T-45](REVIEW-REMEDIATION-PLAN.md#t-45-redact-on-write-one-secret-list-screenshots-and-get) | Redact on write, one secret list, GET | SEC-7..9, 11, 12 | P1 | M | 3 | todo | T-42, T-43, T-44, T-46 |
| [T-46](REVIEW-REMEDIATION-PLAN.md#t-46-sign-in-sessions-off-disk) | Sign-in sessions off disk | SEC-10 | P1 | S | 2 | todo | - |
| [T-47](REVIEW-REMEDIATION-PLAN.md#t-47-verdict-correctness) | Verdict correctness | COR-1, 4, 5, 7, 8, 9 | P0 | M | 4 | todo | T-30 |
| [T-48](REVIEW-REMEDIATION-PLAN.md#t-48-rejects-and-refusal-rule) | Rejects and refusal rule | COR-2, 3, 6 | P0 | M | 4 | todo | T-33, T-45 |
| [T-49](REVIEW-REMEDIATION-PLAN.md#t-49-run-lifecycle-browsers-stop-shutdown) | Run lifecycle: browsers, stop, shutdown | REL-1..3, 8..10, GROW-2 | P0 | M | 5 | todo | T-35, T-48 |
| [T-50](REVIEW-REMEDIATION-PLAN.md#t-50-durable-state-scheduler-writes-waiting-plans) | Durable state: scheduler, writes, waiting plans | REL-4..7, GROW-3, 4 | P1 | M | 6 | todo | T-46, T-49 |
| [T-51](REVIEW-REMEDIATION-PLAN.md#t-51-deploy-gate-and-publishing) | Deploy gate and publishing | DEP-1, 2, 4, 5 | P0 | M | 7 | todo | T-41 |
| [T-52](REVIEW-REMEDIATION-PLAN.md#t-52-container-hardening-and-health) | Container hardening and health | DEP-3, 6, 7, 8, 9 | P1 | M | 8 | todo | T-49, T-51 |
| [T-53](REVIEW-REMEDIATION-PLAN.md#t-53-performance-timing-telemetry) | Performance: timing telemetry | PERF phase 0 | P1 | S | 9 | todo | T-52 |
| [T-54](REVIEW-REMEDIATION-PLAN.md#t-54-performance-fixed-waits-and-failure-only-evidence) | Performance: fixed waits, failure-only evidence | PERF phases 1, 3; GROW-1 | P1 | M | 10 | todo | T-53, T-52 |
| [T-55](REVIEW-REMEDIATION-PLAN.md#t-55-performance-once-per-page-cached-link-checks) | Performance: once per page, cached links | PERF phase 2 | P1 | M | 11 | todo | T-54, T-43 |
| [T-56](REVIEW-REMEDIATION-PLAN.md#t-56-performance-parallel-test-points) | Performance: parallel test points | PERF phase 4 | P2 | L | 12 | todo | T-55, T-49 |
| [T-57](REVIEW-REMEDIATION-PLAN.md#t-57-performance-retry-policy) | Performance: retry policy | PERF phase 5a | P2 | S | 13 | todo | T-56; decision 4 |
| [T-58](REVIEW-REMEDIATION-PLAN.md#t-58-response-latency-runner-endpoints) | Response latency: runner endpoints | LAT-1..8, 14 | P2 | M | 13 | todo | T-49, T-50 |
| [T-59](REVIEW-REMEDIATION-PLAN.md#t-59-response-latency-wizard-polling-and-bundle) | Response latency: wizard polling and bundle | LAT-9..13 | P2 | M | 14 | todo | T-58 |
| [T-60](REVIEW-REMEDIATION-PLAN.md#t-60-resource-growth-retention-and-bounds) | Resource growth: retention and bounds | GROW-3 (cap), 5..9 | P2 | M | 15 | todo | T-54, T-57, T-58, T-50 |
| [T-61](REVIEW-REMEDIATION-PLAN.md#t-61-wizard-errors-focus-and-accessibility) | Wizard: errors, focus and accessibility | UX-1, 2, 3, 10, 11, 12 | P1 | M | 16 | todo | T-59, T-36 |
| [T-62](REVIEW-REMEDIATION-PLAN.md#t-62-wizard-copy-and-small-ux) | Wizard: copy and small UX | UX-4..9, 13, 15..20 | P2 | M | 17 | todo | T-61, T-37b |
| [T-63](REVIEW-REMEDIATION-PLAN.md#t-63-docs-and-contracts-residual) | Docs and contracts residual | DOC | P2 | M | 18 | todo | T-60, T-62, T-38 |

## qaskills-patterns (plan: `.claude/work/qaskills-patterns/02-plan.md`)

| id | title | status |
|---|---|---|
| [QSP-001](QSP-001-adr-0030-passive-vs-active.md) | ADR 0030 passive vs active security boundary | built |
| [QSP-002](QSP-002-flaky-retry-types.md) | F1 retry telemetry fields | built |
| [QSP-004](QSP-004-wcag-coverage-types.md) | F2 wcagCoverage types | built |
| [QSP-007](QSP-007-smoke-preset-types.md) | F3 smoke preset types | built |
| [QSP-013](QSP-013-selector-reason-type.md) | F5 selectorReason type | built |
| QSP-003 | F1 rerun, pass rate, likely cause | built |
| QSP-005 | F2 WCAG coverage checkers | built |
| QSP-006 | F2 WCAG coverage in orchestrator and report | built |
| QSP-008 | F3 smoke preset core and CLI (HTTP route wired in 03f) | built |
| QSP-009 | F3 wizard smoke option | deferred |
| QSP-010 | F4 passive security checkers (CORS, CSRF) | built |
| QSP-011 | F4 fixture lab routes | built |
| QSP-012 | F4 signed-out access and two-role isolation | built |
| QSP-014 | F5 selector order | built |
| QSP-015 | F5 web-first Playwright export | built |
| QSP-016 | F6 API spec checks | built |
