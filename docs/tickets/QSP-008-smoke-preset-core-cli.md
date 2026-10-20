# QSP-008: F3 Smoke Check-up (core + CLI)

## Goal
Quick post-deploy check: reads a few known paths of a deployed App, health first, GET only.

## In scope
- `packages/core/src/post-deploy-smoke.ts`: `runPostDeploySmoke`, `smokeReport`, `readVersion`.
- `packages/runner/src/checkup.ts`: `--preset smoke`, `--health-path`, `--expected-version`, `--confirm-live`.
- Order: health (/healthz, /health, /api/health, /status) -> /, /pricing, /robots.txt, /sitemap.xml -> version (/version.json, /version, /build.json).
- Health failure (non-2xx other than 404, or no answer) is a Blocker and stops the rest; skipped paths are listed under "What this did not check".
- Host check: a host that is not a Test Copy needs `--confirm-live`; private addresses refused on RUNNER_BETA.
- Budget: 10 s per request, 120 s total. No paging, Slack or canary.

## Acceptance criteria
- [x] GET only (server records methods).
- [x] Health gate failure and timeout stop the run, verdict not ready via `releaseVerdict`.
- [x] /pricing 404 is Minor, no crash.
- [x] Version mismatch finding only when an expected version is given.
- [x] Live address refused without confirmation; nothing sent.
- [ ] Runner HTTP start route for `preset: 'smoke'`: not wired (lead).

## Tests
packages/core/tests/post-deploy-smoke.test.ts; packages/runner/tests/smoke-preset.test.ts.

## Dependencies
QSP-007.

## Verification commands
`pnpm exec vitest run packages/core/tests/post-deploy-smoke.test.ts packages/runner/tests/smoke-preset.test.ts`

## Status
built
