# QSP-001: ADR 0030 passive vs active security boundary

## Goal
One written line between passive and active security checks, and the consent contract for active ones.

## In scope
- `docs/adr/0030-passive-vs-active-security-boundary.md`
- `CONTEXT.md`: Smoke Check-up, Active check consent, WCAG criterion status
- `SECURITY.md`: passive/active note

## Acceptance criteria
- [x] ADR exists, links 0003, 0014, 0022.
- [x] Three terms in CONTEXT.md with _Avoid_ lists.
- [x] No code; no active check built.

## Tests
Reviewed by reading (docs only). Link check in packages/core/tests/adr-0030.test.ts (QSP-012).

## Dependencies
None.

## Verification commands
None (docs).

## Status
built
