# Demo readiness plan

Source: the demo-readiness review (core engine, runner API and security, wizard UI, docs and deploy, live demo walkthrough). Tickets T-30 to T-40 close every finding in that review.

## Rules for this plan

- Build only. Tickets end `built`, not `done`. No test run happens until every ticket here is `built`. Then one `/verify-all` pass runs the build and the full suite once and fixes failures against the tickets.
- Each ticket updates the tests its change affects, and adds tests for new behaviour. Tests are written, not run, during build.
- Allowed during build: reading, editing, `pnpm lint`, `pnpm format:check`. Not allowed: `vitest`, `pnpm test`, `pnpm build`, the smoke check, or any browser run. Builds run once, in verification.
- Edits use the Edit tool on unique strings. Nothing rewrites a shared file with Write.
- Deferred verification (`DEFER_TESTS`) is the repo's process. The hook that enforces it lives in `.claude/`, which this clone does not have, so the rule is kept by discipline.

## Decisions taken in this plan (review before merge)

1. **Ready-to-release rule.** The PRD (FR-8.2) is the source of truth: Standard means 0 Blockers and every area at C or better. Majors do not block a release on their own, but they lower the area grade. The wizard default, the CLI exit code, the stamp, the settings text and the product guide all follow this one definition. Lenient and Strict keep their existing shape, adjusted to match.
2. **Generated workflow ref.** Until a tag exists, the generated "In your GitHub repo" workflow uses `main`. Tag `v0.1.0` at release.
3. **Scheduler.** It is started with the server, so a schedule does what its screen says. The schedule UI stays.
4. **AI findings.** AI-written findings are advisory. They never change the verdict or the grade caps (ADR 0009).

## Waves

Build order. Tickets in the same wave touch disjoint behaviour and can run in parallel.

| Wave | Tickets | Notes |
|---|---|---|
| 1 | T-30, T-32, T-33, T-34, T-38, T-39 | Core verdict and checkers, runner security, docs and config, hygiene. |
| 2 | T-35, T-36 | Runner start and approval races (after T-34 frees `server.ts`), wizard flows. |
| 3 | T-31 | Wizard gate copy (after T-30 fixes the constants). |
| 4 | T-37a, T-37b | Wizard copy and glossary, two haiku agents, one per file group. |
| 5 | T-40 | Presenter script (after the labels in T-36 and T-37 settle). |

## Ticket summary

| Ticket | Area | Closes review items | Model |
|---|---|---|---|
| T-30 | Verdict, gate and scoring | Core 1, 2 (coverage), 4, 7, 8, 12; CLI exit code | sonnet |
| T-31 | Wizard gate copy and defaults | Docs 5, Wizard 9, Settings presets, gate names | haiku |
| T-32 | Empty plans never run a hidden test | Core 2 (empty plan) | sonnet |
| T-33 | Checker false signals | Core 3, 5, 6, 9, 13, 14; security headers (Docs 6) | sonnet |
| T-34 | Runner access, isolation and token gate | Runner 1, 4, 5, 6, 7, 8, 9 | sonnet |
| T-35 | Runner start races, approval and stop | Runner 2, 3, 10, 11, 15; Core 10; AI key (Core 11) | sonnet |
| T-36 | Wizard flows and recovery | Demo 1, 2, 3, 8; Wizard 3, 6 (flow), 10, 11, 12, 13, 14, 17 | sonnet |
| T-37a | Wizard copy, group A | Wizard 4, 5, 7, 15, 16 (part), 19-23 (part) | haiku |
| T-37b | Wizard copy, group B | Wizard 5, 7, 16, 19-23 (rest), 18 | haiku |
| T-38 | Docs, env and config drift | Docs 1, 2, 3, 9, 15, 16-19; Core 'docs drift' | haiku |
| T-39 | Deploy ref, Docker, hygiene | Docs 1 (ref), 10, 12, 13, 20 | haiku |
| T-40 | Presenter script | Docs 14; Demo walkthrough notes | haiku |

Human items, not ticket work: merge the branch to `main` so the deploy gate runs (Docs 7); confirm the old key revocation (Docs 8); confirm the default AI model names (Docs 11); run `docker build` (Docs 10); decide whether `.pipeline/`, `dev-pipeline/`, `agent-dashboard/` and `PRODUCT_REVIEW.md` stay tracked (Docs 20); confirm the count and scores items in the walkthrough (Demo 6).
