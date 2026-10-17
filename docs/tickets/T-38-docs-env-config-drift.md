# T-38: Docs, environment and config agree with the code

## Goal
A new user can follow the README and product guide, and every documented variable is read, documented and defaulted the same way.

## Gaps covered
Docs 1 (setup commands and paths), 2 (walkthrough labels), 3 (`.env` never loaded), 9 (Node and pnpm versions), 15 (env drift: `QA_CHECKUP_PORT`, missing variables, `HUB_API_URL`), 16 (broken links in `E2E_PLATFORM_IMPLEMENTATION_PLAN.md`), 17 (ADR count), 18 (Firefox and WebKit listed as targets), 19 (`PRIVACY.md` link), and the product-guide numbers (-30/-15, cap 65, "zero unmitigated majors") against PRD FR-8.1 and FR-8.2, and the wizard labels in T-37.

## In scope
- `package.json`: `start` runs with `node --env-file-if-exists=.env scripts/start.mjs` (Node 22.9+; the engines field requires Node 22, so state 22.9+ in the README). The child process inherits the environment.
- `README.md`, `docs/PRODUCT_GUIDE.md`: walkthrough uses the wizard's real labels ("Start the check-up", "Approve and test", "It's my live site" or "Only look at it"); Node 22 and pnpm 11; the -30/-15 and majors numbers match the PRD and T-30.
- `.env.example`: lists every variable read in code (grep `process.env.`), defaults match `docs/CONFIGURATION.md`. Remove `QA_CHECKUP_PORT`; remove `HUB_API_URL` references in `scripts/start.mjs` and `scripts/smoke.mjs`.
- `packages/runner/src/checkup.ts` (~424): stop reading `QA_CHECKUP_PORT`.
- `docs/CONFIGURATION.md`: matches `.env.example`.
- `CONTRIBUTING.md`: ADR count is 0028.
- `docs/E2E_PLATFORM_IMPLEMENTATION_PLAN.md`: fix links to `packages/cli`, `dashboard`, `hub`, `.github/workflows/qa-preview.yml`, and `../findings.schema.json` → `docs/findings.schema.json`.
- `docs/PRD.md` and the guide: Firefox and WebKit are "planned", not listed as supported.
- `docs/tickets/HUMAN_TODO.md` T-13: confirm the `PRIVACY.md` link; if the link is absent, record "no link" and remove the item.

## Acceptance criteria
- [ ] Every `process.env.*` read in code appears in `.env.example` exactly once, with a default that matches `CONFIGURATION.md`.
- [ ] A value placed only in `.env` is read after `pnpm start`.
- [ ] No documented command or path is missing (run the existence check).
- [ ] Walkthrough labels match the wizard's text.

## Tests to update or add (written, not run)
- A test that every `process.env` read in `packages/*/src` is listed in `.env.example` (add `packages/runner/tests/config-docs.test.ts` or extend `checkup-docs.test.ts`).
- `scripts/` smoke expectations if `HUB_API_URL` was referenced.

## Carried over from T-39
- `docs/DEPLOYMENT.md` (~53): says to bump `TOOL_REF` with the version. Update it: the generated workflow runs `main` until tag `v0.1.0` exists, then `TOOL_REF` moves to the tag.

## Dependencies
T-30 (ratio and rule numbers), T-37 (labels). Doc edits can start now; re-check labels after T-37.

## Verification commands (deferred)
`pnpm exec vitest run packages/runner/tests/checkup-docs.test.ts` and the new config-docs test.

## Status
todo
