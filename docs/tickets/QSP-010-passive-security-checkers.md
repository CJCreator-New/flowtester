# QSP-010: F4 passive CORS, cookie and CSRF checks

## Goal
Read-only security observations: CORS from normal responses, cookie flags, and a missing CSRF token on state-changing forms.

## In scope
- `packages/checkers/src/security.ts`: `checkCors` adds `*` without credentials (Minor); new `checkCsrf`, wired into `checkPage`. Cookie flag logic unchanged (Secure only on https), tests added.
- Passive only (ADR 0030): no foreign Origin header, no request of its own, no payloads. Findings name fields and cookies, never values. Wording "not found", not "vulnerable".

## Acceptance criteria
- [x] CORS: `*` -> Minor; `*` with credentials and `null` stay Major; exact origin or no header -> none.
- [x] CSRF: POST/PUT/DELETE form with no hidden token and no csrf meta -> Minor "No CSRF token found on this form"; SameSite Lax/Strict cookie suppresses; sign-in forms skipped (deviation: plan listed password forms; skipped to keep the existing sign-in form tests and avoid login-form noise).
- [x] Cookie flags: no Secure finding on `http://localhost`; cookie value never in findings.

## Tests
`packages/checkers/tests/security.test.ts` (new describe "passive CORS and CSRF checks (QSP-010)").

## Dependencies
QSP-001.

## Verification commands
`pnpm exec vitest run packages/checkers/tests/security.test.ts`

## Status
built
