# T-119 Docs and ADR: auth and crawl behaviour, env vars, headers, limits, broken references

- **Type:** docs · **Size:** M · **Wave:** 7 · **Depends on:** T-104, T-105, T-107, T-110, T-112, T-113, T-114, T-115, T-116
- **Gaps addressed:** G-032

## Gaps addressed (evidence copied in)
- G-032: `CLAUDE.md:12-13`, `docs/README.md:29`, `docs/adr/0010-one-app-with-details-on-demand.md:31`, `packages/wizard/DESIGN.md:7,132`, `docs/GAP_ANALYSIS.md:4`, `docs/tickets/T-05-docs-and-dead-code-cleanup.md:17` cite `URL_FIRST_IMPLEMENTATION_PLAN.md` and `UX_IMPLEMENTATION_PLAN.md`, which are not in `git ls-files`; `docs/CONFIGURATION.md:60` says `QA_FAIL_ON` defaults to `blocker` while `packages/runner/src/checkup.ts:141-143` defaults to `standard`; `QA_CONCURRENCY`, `QA_DELAY_MS`, `QA_CUSTOM_HEADERS`, `--header`, per-role `usernameSelector/passwordSelector/submitSelector`, `customHeaders`, `crawlConcurrency`, `crawlDelayMs` appear in no doc (grep of `docs/API.md`, `CONFIGURATION.md`, `ARCHITECTURE.md`, `TESTING.md`, `README.md`, `SECURITY.md`, `.env.example`); `docs/API.md:78` omits `session-expired` which `:39` lists; ADR 0022/0024/0025 link `0003-deterministic-safety-filters.md` (actual file `0003-deterministic-safety-filters-for-ai-discovery.md`), ADR 0017 and `docs/API.md:89` link `0004-structural-fingerprint-dedup.md` (actual `0004-structural-fingerprint-deduplication.md`); `docs/PRD.md` has 5 absolute `C:/Users/HP/OneDrive/...` links; `docs/README.md:11` calls ADR 0023 the latest although 0024 and 0025 exist; ADR numbers 0013 and 0015 are missing.

## Background
It also documents the outcomes of G-004, G-016, G-018, G-022 and G-023 (closed by other tickets).

Users and agents read these docs first. They name files that do not exist, give a wrong CI default, and hide the bypass-header and selector options. After T-104..T-116 the behaviour also changed (readiness waits, `session-expired`, header scoping, telemetry, per-run auth dir). Project conventions (copied): `CONTEXT.md` is the glossary — use its terms exactly (Check-up, Plan, Plan Item, Plan Review, Navigation Check, Layout Group...) and respect each term's "_Avoid_" list; `docs/adr/` holds decisions, add a new ADR for a significant decision; terse style, exact commands. Do not edit generated output (`.qa-*`, `.tmp-*`, `/public`). Never include secret values.

## Scope
1. Remove or replace every reference to the two missing plan files (list above) with the ADRs and `docs/E2E_PLATFORM_IMPLEMENTATION_PLAN.md`; fix the `CLAUDE.md` "Active plans" line accordingly (this is a docs-only edit to the project instructions: keep all other lines identical).
2. `docs/CONFIGURATION.md`: add `QA_CONCURRENCY` (1-5), `QA_DELAY_MS` (0-2000), `QA_CUSTOM_HEADERS` (JSON, or repeat `--header "Name: value"`), `QA_DEBUG`, `QA_RELOGIN`, `QA_CRAWL_MAX_MINUTES`, `QA_DISCOVERY_MAX_MINUTES`; correct `QA_FAIL_ON` (`standard` default; state what it gates on by reading `checkup.ts`); per-role selectors in `QA_ROLES`; clamp ranges and what happens on invalid input.
3. `docs/API.md`: `customHeaders` (record or string), `crawlConcurrency`, `crawlDelayMs`, `maxPages`, `skipReview` default per caller, `roles[].{usernameSelector,passwordSelector,submitSelector,postLoginSelector,postLoginUrl}`, the 400 codes `ERR_INVALID_ROLES`, `ERR_INVALID_LOGIN_PATH`, `ERR_INVALID_HEADERS`, the 409 `ERR_SIGN_IN_REQUIRED` with `needsSignIn` and `ERR_HEADERS_NOT_SAVED`, `session-expired` in both lists, `pageCoverage.skipped[].why` values and `routes`.
4. New ADR `docs/adr/0026-deterministic-sign-in-and-session-handling.md`: the decisions in `docs/plan/PLAN.md` (readiness waits and retry, success signals, one sign-in per check-up with re-login once, header scoping to the target origin, telemetry, fixed failure wording kept). Link real ADR files only.
5. `SECURITY.md`: header values are secrets (never stored in plans/reports; sent only to the target origin and allowlisted hosts), per-run auth dir deleted at run end, `loginPath` must stay on the target origin.
6. New short section "Sign-in and crawl limits" in `docs/CONFIGURATION.md`: supported login shapes (form, two-step, modal opener), not supported (CAPTCHA, OTP, SSO/OAuth) and the saved-session workaround (ADR 0021), page / click / depth / time caps and defaults, skip reasons and what each means, robots behaviour.
7. Fix the broken ADR links, make the `docs/PRD.md` links relative, update `docs/README.md` "Latest ADR", add a one-line note on the 0013/0015 numbering gap. `.env.example`: add the new variable names (no values).

## Out of scope
Code changes; the wizard UI text.

## Files owned
`CLAUDE.md`, `README.md`, `SECURITY.md`, `.env.example`, `docs/README.md`, `docs/CONFIGURATION.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/PRD.md`, `docs/GAP_ANALYSIS.md`, `docs/adr/*.md` (existing link fixes and the new 0026), `packages/wizard/DESIGN.md`, `docs/tickets/T-05-docs-and-dead-code-cleanup.md`.

## Files read-only
All `packages/**/src`, `docs/plan/**`.

## Interface contract
Documents the contracts in T-101, T-104, T-105, T-107, T-110, T-112, T-114, T-115, T-116. If a name differs in the merged code, the code wins: re-read the code before writing.

## Implementation notes
- Re-read the merged code before writing: `checkup.ts` (env vars, `QA_FAIL_ON`), `run-inputs.ts` (error codes), `preflight.ts` (reasons, `failedStep`), `deterministic-spider.ts` and `frontier.ts` (budgets, skip reasons), `server.ts` (409 bodies). The code wins over this ticket's wording.
- Link check: a throwaway `node -e` that walks `*.md`, extracts `](relative/path)` targets, strips `#anchors`, and `fs.existsSync`es them against the file's directory; run it before and after and paste both counts in the PR.
- ADR format: copy the section headings of `docs/adr/0025-spider-guarded-delete-probe.md`.

## Acceptance criteria
- [ ] `git ls-files | grep -E "URL_FIRST|UX_IMPL"` returns 0 and `grep -rn "URL_FIRST_IMPLEMENTATION_PLAN\|UX_IMPLEMENTATION_PLAN" . --include=*.md` returns 0 (excluding `docs/plan/`).
- [ ] `grep -n "QA_CONCURRENCY\|QA_DELAY_MS\|QA_CUSTOM_HEADERS\|QA_DEBUG" docs/CONFIGURATION.md` finds each; `QA_FAIL_ON` row says `standard`.
- [ ] A markdown link check (every relative link in `docs/**/*.md`, `README.md`, `CONTEXT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CLAUDE.md` resolves to a file) reports 0 broken links; include the script in the PR description (a throwaway `node -e` is fine; do not add it to the repo).
- [ ] `docs/adr/0026-*.md` exists and states Status, Context, Decision, Consequences like the other ADRs.
- [ ] `docs/API.md` lists `session-expired` in both places and the new error codes.
- [ ] Terms follow `CONTEXT.md` (no "_Avoid_" words in new text).
- [ ] `pnpm exec prettier --check docs README.md SECURITY.md CLAUDE.md` passes (or the repo's format check for markdown).
- [ ] Evidence for G-032 no longer holds: the three greps in "Test plan" return the expected results.

## Test plan
```
pnpm exec prettier --check docs README.md SECURITY.md CLAUDE.md
git ls-files | grep -E "URL_FIRST|UX_IMPL"
grep -rn "URL_FIRST_IMPLEMENTATION_PLAN\|UX_IMPLEMENTATION_PLAN" --include=*.md . | grep -v "^./docs/plan/"
```

## Definition of done
Boxes checked; only owned files edited; no secret values in any doc. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-119 in the QA Flow Tester repo. Read docs/plan/tickets/T-119-docs-and-adr.md, CONTEXT.md (use its terms, respect "_Avoid_"), and the merged code for the behaviours you document (re-read checkup.ts, run-inputs.ts, preflight.ts, deterministic-spider.ts). Edit only the files under "Files owned". Remove references to the two missing plan files, fix QA_FAIL_ON and add the missing env vars / API fields / error codes / limits, write ADR 0026, fix broken ADR and PRD links, and update the docs index. Never include secret values. Keep all other CLAUDE.md lines unchanged. Run the commands in "Test plan". Work on a branch, not main. If blocked, stop and report.
```
