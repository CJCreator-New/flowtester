# QSP-016: F6 API checks from an OpenAPI file

## Goal
When an OpenAPI file is supplied, generate negative-first API checks and validate responses.

## In scope
- `packages/core/src/api-spec-checks.ts`: `parseOpenApi`, `generateApiChecks`, `runApiChecks`, `apiChecksSection`.
- `packages/core/src/json-schema-lite.ts`: the in-repo subset validator moved from tests (tests helper re-exports it). No new dependency.
- At least 40% error cases (missing required field, wrong type, bad enum, malformed JSON, missing query, unknown id, no sign-in).
- GET only unless `allowWrites` (Test Copy plus owner consent); skipped writes are listed.
- No spec: nothing generated, "No API spec supplied; API checks not generated."
- Sign-in header is sent but never appears in findings (Redactor).
- JSON specs only; YAML gets a plain "convert to JSON" message.

## Acceptance criteria
- [x] No spec -> no checks, note present.
- [x] Error share >= 40%.
- [x] Responses checked with the subset validator.
- [x] Secret sentinel absent from findings.
- [ ] Spec supply point in the start route / report section: lead wires (`apiChecksSection`).

## Tests
packages/core/tests/api-spec-checks.test.ts

## Dependencies
None.

## Verification commands
`pnpm exec vitest run packages/core/tests/api-spec-checks.test.ts`

## Status
built
