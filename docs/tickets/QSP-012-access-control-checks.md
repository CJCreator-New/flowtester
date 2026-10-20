# QSP-012: F4 signed-out access and two-role isolation (passive)

## Goal
Find role-only pages that open without signing in, and a page that shows one role's name to another role. GET only (ADR 0030).

## In scope
- `packages/core/src/access-control.ts` (new): pure `checkSignedOutAccess`, `checkSessionIsolation`; `runAccessChecks` (cap 25 paths, no redirects followed, risky GET paths skipped, host policy `allow`); `contextFetcher`.
- `packages/core/src/orchestrator.ts`: runs after the test points, before the browser closes; uses `siteMap.pages[].reachedBy`; failures never fail the run; notes "Access checks read pages only; no payloads were sent."
- Deviation: the pure checks live in core, not `packages/checkers/src/permission-matrix.ts` (checkers were off limits for this stream).
- Out of scope: any active check; nothing reads `activeChecksConsent`.

## Acceptance criteria
- [x] Only GET/HEAD, no Origin header, no body.
- [x] 200 + content signed out is a Blocker; redirect to sign-in, 401, 403 are no finding.
- [x] Leak variant found with two roles; own-session page not; one role skips with a note.
- [x] Findings name roles and paths, never cookie values or usernames.
- [x] No reader of `activeChecksConsent` in core src; ADR 0030 links 0003, 0014, 0022.

## Tests
packages/core/tests/access-control.test.ts (local http server).

## Dependencies
QSP-001, QSP-006 order on orchestrator.ts. Fixture `/lab/*` routes (QSP-011) not required: tests use a local server.

## Verification commands
`pnpm exec vitest run packages/core/tests/access-control.test.ts`

## Status
built
