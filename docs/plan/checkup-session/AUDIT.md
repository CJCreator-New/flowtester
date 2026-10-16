# Audit register

Every finding of the architecture review of 2026-10-15, with the evidence it rests on and its disposition. This is
the register the ticket set is measured against; the mapping is in [`TRACEABILITY.md`](TRACEABILITY.md).

Read-only review: no measurement of runtime performance, memory or build time was taken, and no behavioural
experiment was run. Every finding is a static observation with a `path:line` or a counted search behind it. Line
numbers are as of commit `8d41601` plus the working-tree edits of that day.

**Dispositions:** `ticketed` (a ticket in this plan), `deferred` (a named successor plan, with the reason), or
`accepted risk` (deliberately not done, with the reason — recorded so a later review does not re-suggest it).

## Findings

| ID    | Dimension      | Finding                                                                                                                                                                                                                                   | Severity                                                                                          | Evidence                                                                                                  | Disposition                                                                                                          |
| ----- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A-001 | Modularization | `RunnerServer` is one class doing transport and state at once: 5587 lines, 51 fields, 107 methods, a 425-line `start()` holding 47 `if (pathname …)` conditionals.                                                                        | High — every runner change pays it and no seam exists to test through                             | `packages/runner/src/server.ts` (whole file), `:960-1385`, `:715-790`                                     | Ticketed: T-204, T-206; the other 36 branches deferred (see D-001)                                                   |
| A-002 | Layering       | The Plan's operations (read, edit, validate, park, re-plan, approve) are private methods on the HTTP server, so a Plan edit is only reachable through HTTP.                                                                               | High — the product's core artefact is untestable below the transport                              | `server.ts:4077, 4208, 4218, 4442, 4461, 4489, 4512, 4581, 4621, 4670, 4719, 4911, 4949`                  | Ticketed: T-207                                                                                                      |
| A-003 | Layering       | Plan building (`buildPlan`, `testsFor`, `screenSizesOf`, `gradedChecksFor`, `prepareAI`, `aiBudgetFor`) lives in the server, not with the planner in `@qa/core`.                                                                          | Medium — the runner knows how a Plan is built, so plan-shape changes touch the server file        | `server.ts:3652, 3720, 3748, 3757, 3789, 3813, 3647, 3539, 3600`                                          | Ticketed: T-208; `prepareAI`/`aiFor`/`aiSetup` stay on purpose (keys and provider policy, not plan building)         |
| A-004 | Testability    | The transport is the test surface: 28 of 41 runner test files boot a real `RunnerServer` (data dir, output dir, fake OpenRouter) to assert one behaviour.                                                                                 | High — slow, stateful tests; the seam has no direct test surface                                  | `packages/runner/tests/*` (`grep -l "new RunnerServer"` → 28 of 41)                                       | Ticketed: T-203, T-206, T-207; the remaining areas deferred (D-001)                                                  |
| A-005 | Layering       | `checkup.ts`, the CI route, boots the same HTTP server on `QA_CHECKUP_PORT` and calls it over `fetch`, so CI binds a port and maps errors across JSON for a zero-distance call. A flaky bind has already come from it.                    | Medium — extra failure mode in CI, already observed                                               | `packages/runner/src/checkup.ts:426, 433, 458`; commit `c10f5e8`                                          | Ticketed: T-209                                                                                                      |
| A-006 | Contracts      | The check-up API is declared twice, by hand: `TriggerRunBody`/`StartRunRequest`, `PatchPlanBody` (server.ts:4225 inline, wizard api.ts:490 exported, comments copied), and the status reply vs the wizard's `RunnerStatus`.               | High — silent drift between the two ends of the product's main contract                           | `server.ts:422, 4225, 1099`; `packages/wizard/src/api.ts:70, 359, 490`                                    | Ticketed: T-201 (defines + switches the wizard), T-207 (server's `PatchPlanBody`), T-209 (server's `TriggerRunBody`) |
| A-007 | Coupling       | No Role Session module: a role's identity (password, custom headers, token, `localStorage`, storage state) is spread over `RoleCredential`, `CrawlOptions`, `RunOptions` and `BrowserContextOptions` and merged ad hoc at each call site. | High — sign-in bugs hide in call sites; the in-flight work adds merge sites 3 and 4               | `customHeaders` in 5 core files, 24 references; `preflight.ts:243-295, 676`, `discovery-agent.ts:516-540` | Deferred: D-002 (its own plan)                                                                                       |
| A-008 | Duplication    | `PASSWORD_SELECTOR` is declared twice with different values, in two modules that both look for a sign-in form.                                                                                                                            | Low — same reason as A-007, small and concrete                                                    | `packages/core/src/preflight.ts:40`; `packages/core/src/visual-capture.ts:48`                             | Deferred: D-002 (with A-007)                                                                                         |
| A-009 | Coupling / UI  | The wizard's Plan Review surface is one 2071-line module (27 components, 7 helpers), a 24-method `PlanActions` interface threaded through ~20 of them, and a 1051-line `api.ts` with 50 exported calls; `App.tsx` holds 20+ `useState`.   | Medium — the product's central artefact is one file, and plan state lives in the top-level screen | `wizard/src/components/plan/PlanDocument.tsx`; `wizard/src/api.ts`; `wizard/src/App.tsx`                  | Deferred: D-003 (Phase 3)                                                                                            |
| A-010 | Layering       | One circular import in the repo: a `lib/` module importing a type from `screens/`, and back.                                                                                                                                              | Medium — layer inversion, undefined-at-load-order risk, blocks testing the helper alone           | `wizard/src/lib/coverage-text.ts:2` ⇄ `wizard/src/screens/ScanningScreen.tsx:5`                           | Ticketed: T-202                                                                                                      |
| A-011 | Modularization | `@qa/core` has no declared surface: a 69-line `export *` barrel, with `server.ts` importing 95 named symbols through it, and `runner/src/index.ts` re-exporting whole modules.                                                            | Medium — no seam between engine and transport, which is _why_ A-002/A-003 happened                | `core/src/index.ts`; `grep` count of names in the `@qa/core` import of `server.ts` → 95                   | Deferred: D-001 (same file as A-001)                                                                                 |
| A-012 | Boundaries     | The wizard reaches into `@qa/types/src/<area>.js` at 14 call sites in 10 source files (17 with tests), so "browser-safe" is a convention in comments, not a boundary anything enforces.                                                   | Medium — a Node-only import would break the wizard build, not a test                              | `grep -rn "@qa/types/src" packages/wizard` → 14 in `src`, 3 in `tests`; `types/src/index.ts`              | Ticketed: T-211                                                                                                      |
| A-013 | Duplication    | Two neighbouring modules both translate plan/AI wording: `translate.ts` (336 lines) and `plan-translate.ts` (348 lines).                                                                                                                  | Low — likely one absorbable into the other, needs a careful diff                                  | `packages/wizard/src/lib/translate.ts`; `packages/wizard/src/lib/plan-translate.ts`                       | Deferred: D-003 (Phase 3)                                                                                            |
| A-014 | Modularization | `core/src` holds 40 `.ts` files flat at its root beside four feature directories (`discovery/`, `plan/`, `ai/`, `competitive/`).                                                                                                          | Low — a drawer, not a tangle: the feature directories do the real grouping                        | `ls packages/core/src/*.ts` → 40                                                                          | Accepted risk (see N-001)                                                                                            |

## Deferred, with the reason

- **D-001 — the rest of the route table and the engine's surface (A-001, A-004, A-011).** Only the plan routes move
  to the table in this plan. The remaining 36 conditionals (runs and reports, sites, evidence, AI settings,
  OpenRouter, baselines, benchmarks, schedules, spec overrides, `/healthz`) keep their branches, and naming
  `@qa/core`'s entries is not attempted. Reason: `server.ts` takes one owner per wave, so every one of those is a
  follow-up on the _same_ file this plan's six runner tickets serialize on. Doing them first would collide with
  T-204/T-206/T-207/T-208/T-209; doing them all here would make one unreviewable change. Successor: a second plan
  using this one's pattern (one area per wave, one inventory test, one handler module).
- **D-002 — the Role Session module (A-007, A-008).** One module that acquires a role's identity (password flow,
  token, headers, `localStorage`, storage state) and applies it to any browser context, replacing hand-merges in
  `preflight.ts`, `deterministic-spider.ts`, `discovery-agent.ts`, `browser.ts` and `orchestrator.ts`. Reason: it is
  the highest-value candidate after A-001, but it is a behaviour-bearing change across five `@qa/core` files with
  ADR 0026 in scope (it may amend it), and it needs its own design step (what the interface is, where the session
  is acquired, how `reloginHandler` collapses into it). Doing it inside a structure-only plan would mix two kinds of
  risk in one review. Successor: Phase 2 plan, with A-008 folded in.
- **D-003 — the wizard's Plan Review surface (A-009, A-013).** Split `PlanDocument.tsx` into section modules behind
  one plan-session hook that owns plan state and mutations (moving the 20+ `useState` out of `App.tsx`), split
  `api.ts` by feature, and fold `translate.ts` into `plan-translate.ts` (or the reverse). Reason: UI-only, no
  dependency on the runner's seam, and it would collide with this plan's wizard files (T-202, T-211). Successor:
  Phase 3 plan.

## Not a gap

- **N-001 — `core/src`'s flat root (A-014).** The four feature directories carry the meaning; the root files are
  leaf utilities and top-level engine pieces (`scoring.ts`, `reporter.ts`, `evidence.ts`, …) that are already
  coherent. Re-organizing 40 files has no test or seam payoff, and the last attempt at this kind of churn would
  touch most imported paths in the repo for no behaviour change. Left as it is, deliberately.
- **A-006 is not "the wizard is wrong to have its own client"**: `api.ts` as a client is right; duplicating the
  _shape_ is what T-201 fixes.
- **The `@qa/core` barrel is not a mistake in itself**: ARCHITECTURE.md documents it as the package's style (A-011 is
  about the _runner_ reaching through it for everything, not about `export *` existing).

## Coverage statement

- **Scanned:** all 192 non-test source files across `types`, `checkers`, `core`, `runner`, `wizard` (imports parsed,
  Tarjan for cycles, fan-in/fan-out per file, file sizes); `CONTEXT.md`; all 26 ADRs; `docs/ARCHITECTURE.md`,
  `docs/API.md`, `docs/README.md`; `git log` (115 commits) for hot spots; the working-tree diff of that day.
- **Counted searches** (not read in full): the test-file census (207 files), the `new RunnerServer` census (28 of
  41), the `customHeaders` census (5 files, 24 references), the deep-import census (14 in `wizard/src`).
- **Not covered:** runtime behaviour, performance, memory, bundle size, build time — no measurement was taken, so
  nothing here claims a speedup or a cost. `checkers/` was read only for its file-level shape (one file per audit);
  its rules were out of scope. Deploy and CI topology was out of scope beyond the runner's port.
- **Confidence:** every finding is `verified` (path/line or counted search). Two figures in the first draft of the
  review were loose and are corrected here: the wizard's deep type imports are 14 in `wizard/src` (17 with tests),
  and `core/src`'s flat root holds 40 files.
