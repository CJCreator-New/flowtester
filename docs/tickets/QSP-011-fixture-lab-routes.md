# QSP-011: F4 fixture lab routes

## Goal
Fixture routes the access-control and passive-security checks can run against.

## In scope
- `fixtures/test-app/server.js`: unlinked GET-only `/lab/open-account`, `/lab/closed-account`, `/lab/401`, `/lab/mirror`, `/lab/mirror-leak`, `/lab/csrf-form`, `/lab/csrf-ok`, `/lab/cookie-good`, `/lab/cookie-bad`. `/lab/reset` clears the leak memory.

## Acceptance criteria
- [x] Routes respond as described (open 200 with content, closed 302 to /signin without cookie, 401, mirror shows own name, mirror-leak shows first user's name to all).
- [x] Linked from nowhere: crawl and benchmark counts unchanged; `/lab/stats` stays 0 POST/DELETE after GET visits.

## Tests
`packages/core/tests/fixture-access-lab.test.ts`; `fixture-failure-modes.test.ts` still green.

## Dependencies
None.

## Verification commands
`pnpm exec vitest run packages/core/tests/fixture-access-lab.test.ts packages/core/tests/fixture-failure-modes.test.ts`

## Status
built
