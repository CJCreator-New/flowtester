# Tickets

Source: `docs/GAP_ANALYSIS.md`. Status: todo, planned, approved, built, done, blocked. A gap closes only after its wave's /verify-all passes. Human items: [HUMAN_TODO.md](HUMAN_TODO.md). This table is the committed record; `.claude/work/backlog.md` is git-ignored scratch and loses on conflict. New TODOs in code use `TODO(T-nn)` (see CONTRIBUTING.md).

| id | title | gaps | priority | size | wave | status | depends on |
|---|---|---|---|---|---|---|---|
| [T-14](T-14-landing-audit-items.md) | Close remaining landing audit items | G46 | P1 | S-M | 2 | built (sample report regenerated 2026-10-09; owner items remain) | T-13 |
| [T-23](T-23-split-large-files.md) | Split large files by area | G35 | P3 | L | 4 | built (23a only) | T-01 |

Later (no ticket yet): G6, G14, G18-G22, G23-G26, G45, G48.

## Demo readiness (plan: [DEMO-READINESS-PLAN.md](DEMO-READINESS-PLAN.md))

Build only; tests run once, in `/verify-all`, after every row here is `built`.

| id | title | gaps | priority | size | wave | status | depends on |
|---|---|---|---|---|---|---|---|
| [T-30](T-30-verdict-gate-scoring.md) | One ready-to-release rule, honest grades | review Core 1,2,4,7,8,12; Docs 5 | P0 | L | 1 | built | - |
| [T-31](T-31-wizard-gate-copy.md) | Wizard shows one release rule | review Wizard 9, 16 | P0 | S | 3 | built | T-30 |
| [T-32](T-32-empty-plans-never-run-hidden-tests.md) | A plan runs only what the person saw | review Core 2 | P0 | S | 1 | built | - |
| [T-33](T-33-checker-false-signals.md) | Checkers report only what they verified | review Core 3,5,6,9,13,14; Docs 6 | P0 | M | 1 | built | - |
| [T-34](T-34-runner-access-and-isolation.md) | Runner access, isolation and token gate | review Runner 1,4-9 | P0 | L | 1 | built | - |
| [T-35](T-35-runner-races-approval-stop.md) | Runner start races, approval and stop | review Runner 2,3,10,11,15; Core 10,11 | P0 | M | 2 | built | T-34 |
| [T-36](T-36-wizard-flows-and-recovery.md) | Wizard flows and recovery | review Demo 1,2,8; Wizard 1-3,8-14,17 | P0 | L | 2 | built | T-31 |
| [T-37a](T-37a-wizard-copy-group-a.md) | Wizard copy and glossary, group A | review Wizard 4,5,7,15,19,22,23 | P1 | M | 4 | built | T-36 |
| [T-37b](T-37b-wizard-copy-group-b.md) | Wizard copy and glossary, group B | review Wizard 5-7,16,18-22; Demo 3 | P1 | M | 4 | built | T-36, T-31 |
| [T-38](T-38-docs-env-config-drift.md) | Docs, environment and config drift | review Docs 1,2,3,9,15-19 | P1 | M | 1 | built | T-30 |
| [T-39](T-39-deploy-ref-docker-hygiene.md) | Generated workflow ref, Docker, hygiene | review Docs 1,10,12,13,20 | P1 | S | 1 | built | - |
| [T-40](T-40-presenter-script.md) | Presenter script for the demo | review Docs 14; Demo notes | P2 | S | 5 | built | T-36, T-37a, T-37b |
