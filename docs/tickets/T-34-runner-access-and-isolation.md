# T-34: Runner access, isolation and token gate

## Goal
Testers on a shared runner cannot read or change each other's data, and the public copy cannot run without a token.

## Gaps covered
Runner 1 (evidence path check runs before decoding, `server.ts:1250-1258` and `:1128-1131`), Runner 4 (public Render has no token, `render.yaml:9-19`), Runner 5 (beta limits bypassed by cookie-less sessions; eviction drops other testers' sessions, `beta.ts:40-61`), Runner 6 (writes not closed in beta: spec overrides `:3356`, settings and defaults `:1864`, AI settings `:2403`, triage and accept-judgement `:2100`), Runner 7 (baseline accept: unchecked `body.id`, `:3145`, copies saved sessions, `:3148`), Runner 8 (CORS reflects any localhost origin with credentials, `server.ts:868`), Runner 9 (run without a token on a non-loopback host, `cli.ts:30-39`).

## In scope
- `server.ts`: check run ownership on the resolved `runs/<id>` segment after decoding; reject `..` after decoding; `closedInBeta` covers the listed writes.
- `server.ts` baselines: `id` must match `^[\w-]+$`; apply `isInside` and `isSavedSession` to source and destination.
- `server.ts` CORS: allow exact origins from `RUNNER_ALLOWED_ORIGINS` (plus the server's own origin), never any localhost port.
- `beta.ts`: rate-limit session creation per client address; never evict a session that owns a run, a plan or a sign-in.
- `cli.ts`: refuse to start on a non-loopback host without `RUNNER_ACCESS_TOKEN` (exit with a message).
- `render.yaml`: `RUNNER_ACCESS_TOKEN` with `sync: false`.
- `docs/DEPLOYMENT.md`, `docs/CONFIGURATION.md`, `SECURITY.md`, ADR 0012: state the token requirement and the `?access=` link.

## Acceptance criteria
- [ ] A request for `/api/evidence/runs/<mine>/..%2F<theirs>/x.png` is refused.
- [ ] Baseline accept with `id` containing `/` or `..` is refused; saved sessions are never copied.
- [ ] A request with `Origin: http://localhost:9999` on a server allowing only `:3001` gets no credentialed CORS header.
- [ ] Starting on `0.0.0.0` without a token exits with a clear message.
- [ ] Cookie-less requests cannot exhaust the daily cap by creating sessions faster than the limit.

## Tests to update or add (written, not run)
- `packages/runner/tests/beta-privacy.test.ts`, `host-policy.test.ts`: cross-tester evidence and session eviction.
- `packages/runner/tests/` baselines test: traversal refused, saved session never copied.
- `packages/runner/tests/route-inventory.test.ts`: CORS origin cases.
- New `cli` test: non-loopback without token refuses to start.

## Dependencies
None. Must finish before T-35 (both edit `server.ts`).

## Verification commands (deferred)
`pnpm exec vitest run packages/runner/tests/beta-privacy.test.ts packages/runner/tests/host-policy.test.ts packages/runner/tests/route-inventory.test.ts`

## Status
todo
