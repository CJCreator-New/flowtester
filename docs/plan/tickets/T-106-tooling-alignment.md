# T-106 Tooling alignment: one Playwright version, typecheck tests, Node pin

- **Type:** infra · **Size:** M · **Wave:** 0 · **Depends on:** none
- **Gaps addressed:** G-025, G-026, G-047

## Gaps addressed (evidence copied in)

- G-025: `packages/core/package.json:17` and `packages/checkers/package.json:16` declare `"playwright": "^1.49.1"`; `packages/wizard/package.json:27` declares `^1.63.0`; `packages/runner/Dockerfile:3` is `mcr.microsoft.com/playwright:v1.63.0-noble`. `scripts/check-playwright-version.mjs` compares only the lockfile and the Dockerfile and runs only at `.github/workflows/ci.yml:31`.
- G-026: `packages/core/tsconfig.json` has `include: ["src/**/*"]` and the wizard's `include: ["src"]`; vitest does not type-check; `eslint.config.mjs` uses `tseslint.configs.recommended`, with `no-explicit-any` off for tests (`:77`); no pre-commit hook.
- G-047: no `engines` field in any `package.json`; no `.nvmrc`/`.node-version`/`.npmrc`; `.prettierrc` has `"endOfLine": "auto"`; `.github/dependabot.yml` has no Docker entry; `mammoth` is exact-pinned among carets (`packages/core/package.json`, by name).

## Background

Playwright drives login and crawling; a lockfile regeneration should not change its version. Tests and scripts are never type-checked, and lint cannot see a missing `await` on a Playwright call. This ticket aligns versions and adds the checks without changing runtime code. Project conventions (copied): pnpm monorepo (pnpm 11), TypeScript, Node 22, vitest; `.qa-*` and `.tmp-*` are generated output: do not edit. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, do not run tests (builds are fine).

## Scope

1. Pin Playwright to one exact version everywhere (the version in the Dockerfile tag, `1.63.0`, unless the lockfile already resolves higher and the Docker tag matches it; if they differ, report the conflict and stop). Use a root `pnpm.overrides` (or a pnpm catalog) and exact versions in all four manifests; bump `@axe-core/playwright` only if the version check requires it.
2. Add `tsconfig.test.json` (extends base; includes `packages/*/tests/**/*` and `scripts/**/*`) and a root script `typecheck`. Do not fix every pre-existing type error: record the count in the PR and make `typecheck` non-blocking (script exists, CI step in T-118) unless there are 0 errors.
3. ESLint: enable `@typescript-eslint/no-floating-promises` and `no-misused-promises` as **warn** for `packages/*/src/**` (type-aware config for those globs only). Report the warning count; do not edit source files to fix them.
4. Add `engines: { "node": ">=22" }` to the root `package.json`, `.nvmrc` (`22`), `.gitattributes` (`* text=auto eol=lf`), set `.prettierrc` `endOfLine` to `lf`.
5. Dependabot: add a `docker` ecosystem entry for `/packages/runner`; group Playwright updates.
6. `scripts/check-playwright-version.mjs`: also compare every `package.json` Playwright range/override to the Docker tag.

## Out of scope

Upgrading Playwright beyond the Docker version; fixing lint warnings or type errors in source; CI workflow edits (T-118 wires the new script and guard into deploy/release).

## Files owned

`package.json` (root), `packages/*/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `eslint.config.mjs`, `tsconfig.base.json`, `tsconfig.test.json` (new), `.nvmrc` (new), `.gitattributes` (new), `.prettierrc`, `.github/dependabot.yml`, `packages/runner/Dockerfile`, `scripts/check-playwright-version.mjs`.

## Files read-only

`.github/workflows/*` (T-118), all `src/` and `tests/`.

## Interface contract

- Root script `typecheck`: `tsc -p tsconfig.test.json --noEmit`.
- `scripts/check-playwright-version.mjs` exits non-zero on any mismatch (CI and deploy call it; T-118 adds the deploy call).

## Implementation notes

- `pnpm-lock.yaml` may be large; regenerate with `pnpm install --lockfile-only` after editing manifests. Do not hand-edit it.
- Check `pnpm-workspace.yaml` `allowBuilds` stays as is.
- `.gitattributes` with `eol=lf` may change line endings of tracked files on Windows checkouts: run `git add --renormalize .` only if `git status` shows a clean diff limited to line endings, otherwise leave and note it.

## Acceptance criteria

- [x] `grep -n '"playwright"' packages/*/package.json` shows one identical exact version in core, checkers, wizard (evidence for G-025 no longer holds).
- [x] `node scripts/check-playwright-version.mjs` exits 0, and exits non-zero when a manifest is edited to a different version (verify by temporary edit, then revert).
- [x] `pnpm typecheck` runs; the error count is reported in the PR description.
- [x] `pnpm lint` still passes (new rules are warnings).
- [x] `grep -n engines package.json` and `.nvmrc` exist; `.gitattributes` exists.
- [x] `pnpm build` and `pnpm exec vitest run --exclude "**/wizard-e2e.test.ts"` pass.

## Test plan

```
pnpm install --frozen-lockfile=false
node scripts/check-playwright-version.mjs
pnpm lint
pnpm typecheck
pnpm build
pnpm exec vitest run --exclude "**/wizard-e2e.test.ts"
```

## Definition of done

Boxes checked; no source or test file changed; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-106 in the QA Flow Tester repo (pnpm 11 monorepo). Read docs/plan/tickets/T-106-tooling-alignment.md and implement it. Pin Playwright to one exact version across core/checkers/wizard (match packages/runner/Dockerfile; if the lockfile and Dockerfile disagree, stop and report), add tsconfig.test.json and a typecheck script, enable no-floating-promises/no-misused-promises as warnings for packages/*/src, add engines/.nvmrc/.gitattributes, set prettier endOfLine lf, add a docker entry to dependabot, and extend scripts/check-playwright-version.mjs. Edit only the files under "Files owned"; do not edit src/ or tests/ or workflows. Regenerate the lockfile with pnpm, never by hand. Run the "Test plan" commands (skip tests if .claude/work/DEFER_TESTS exists). Work on a branch, not main.
```
