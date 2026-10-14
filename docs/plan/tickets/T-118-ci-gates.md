# T-118 CI gates: login+crawl on PRs, nightly wizard-e2e, release and deploy parity

- **Type:** infra · **Size:** S · **Wave:** 7 · **Depends on:** T-106, T-117
- **Gaps addressed:** G-029, and the CI half of G-025 and G-026

## Gaps addressed (evidence copied in)

- G-029: `.github/workflows/ci.yml:51` and `deploy.yml:63` run `vitest run --exclude "**/wizard-e2e.test.ts"`; `grep wizard-e2e .github/` matches only those two files; `release.yml:27-36` has a version check and `pnpm build` only (header: "it only proves the tag builds"); `deploy.yml:46-63` has no lint / format / audit / Playwright guard (those exist only in `ci.yml:30-37,71-103`, which triggers on `pull_request` only, `ci.yml:4-6`); `benchmark.yml:39` runs `pnpm benchmark --sites fixture --no-ai` weekly or manually and `scripts/benchmark.ts` has no login terms.
- G-025 (CI half): `scripts/check-playwright-version.mjs` is called only at `ci.yml:31`.
- G-026 (CI half): `pnpm typecheck` (added by T-106) is not run anywhere.

## Background

The login-then-crawl path is the most fragile part and has no end-to-end gate. PR CI already runs unit and integration tests (including the new T-117 files) but `wizard-e2e` only runs by hand before a release. Release and deploy are weaker than PR CI. Project conventions (copied): pushing to `main` runs `deploy.yml` (tests, then Vercel and Render); work on a branch and open a PR; deploy is gated to the source repo (`if: github.repository == ...`); `pnpm/action-setup` is SHA-pinned; keep timeouts and concurrency groups. Never print secrets. If `.claude/work/DEFER_TESTS` exists, do not run tests.

## Scope

1. `ci.yml`: add a job `auth-crawl` (runs on PRs touching `packages/core/**`, `packages/runner/**`, `fixtures/**`, `packages/types/**`) that installs Chromium and runs `pnpm exec vitest run packages/core/tests/auth-crawl-e2e.test.ts packages/runner/tests/auth-crawl-run.test.ts`; add a non-blocking `pnpm typecheck` step (`continue-on-error: true`) that posts the error count to the job summary.
2. New `.github/workflows/e2e-nightly.yml`: `schedule` (daily) + `workflow_dispatch`, runs `wizard-e2e.test.ts` with Chromium; uploads traces on failure.
3. `release.yml`: add the same test, lint, format, audit and Playwright-guard steps as `ci.yml` before the build (reuse by copying steps; do not change the no-publish rule).
4. `deploy.yml`: add the Playwright guard and lint to the `test` job (same steps as `ci.yml`).
5. `benchmark.yml`: no change.

## Out of scope

`render.yaml` autoDeploy and rollback (deferred G-050); branch protection (not visible in the repo); the benchmark scripts.

## Files owned

`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/release.yml`, `.github/workflows/e2e-nightly.yml` (new)

## Files read-only

`scripts/*`, `package.json`, all `packages/**` (including `packages/runner/tests/release-workflow.test.ts`, which must keep passing).

## Interface contract

Depends on scripts and files: `scripts/check-playwright-version.mjs` (T-106), `pnpm typecheck` (T-106), the two test files from T-117.

## Implementation notes

- Match the existing step style in `ci.yml` (frozen lockfile, Node 22, timeouts, concurrency group).
- Keep `release.yml` publishing nothing (a test asserts "builds and does not publish": `release-workflow.test.ts`).
- Do not add secrets to workflows.

## Acceptance criteria

- [ ] `grep -n "auth-crawl" .github/workflows/ci.yml` finds the job; `grep -rn "wizard-e2e" .github/workflows` finds `e2e-nightly.yml`.
- [ ] `release.yml` contains test, lint and audit steps before `pnpm build` (G-029 evidence gone) and `release-workflow.test.ts` still passes.
- [ ] `deploy.yml` test job runs the Playwright guard.
- [ ] YAML is valid (`node -e "require('yaml')"`-free check: `pnpm exec prettier --check .github/workflows/*.yml`).
- [ ] `pnpm exec vitest run packages/runner/tests/release-workflow.test.ts` passes.
- [ ] Evidence for G-025 and G-026 no longer holds: `grep -n "check-playwright-version" .github/workflows/*.yml` finds ci, deploy and release; `grep -n "typecheck" .github/workflows/ci.yml` finds the step.

## Test plan

```
pnpm exec prettier --check .github/workflows/*.yml
git ls-files | grep release-workflow
pnpm exec vitest run $(git ls-files | grep release-workflow.test)
```

## Definition of done

Boxes checked; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-118 in the QA Flow Tester repo. Read docs/plan/tickets/T-118-ci-gates.md and the workflows under .github/workflows. Edit only ci.yml, deploy.yml, release.yml and the new e2e-nightly.yml. Add an auth-crawl job and a non-blocking typecheck step to ci.yml, a nightly/dispatch wizard-e2e workflow, test/lint/audit/Playwright-guard steps to release.yml (it must still not publish) and the guard + lint to deploy.yml's test job. Match existing step style; add no secrets. Run the commands in "Test plan". Work on a branch, not main. If blocked, stop and report.
```
