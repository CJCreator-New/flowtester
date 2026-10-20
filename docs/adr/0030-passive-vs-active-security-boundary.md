# 0030: Passive vs Active Security Boundary

Status: Accepted, 2026-10-19 (qaskills-patterns, ticket QSP-001). Builds on [0003](0003-deterministic-safety-filters-for-ai-discovery.md), [0014](0014-verified-domains-and-safe-host-classification.md), [0018](0018-claim-wording.md), [0022](0022-test-sign-in-as-consent.md) and [0029](0029-one-ready-to-release-rule.md).

## Context
New security checks are planned (signed-out access, session isolation, CSRF token and CORS reads). Later ideas (forged tokens, injection payloads) look like attacks to a site owner. The tool needs one line between the two, so each new check is placed on a known side.

## Decision
- **Passive**: reads what the App already sends, or makes a normal GET or visit. Allowed on any run the existing safety rules allow. No foreign Origin, no body, no crafted headers.
- **Active** (Security Probe class): JWT forgery, SQL injection payloads, ID enumeration, mass assignment, login floods, foreign Origin, crafted headers. Needs a Test Copy (ADR 0014) AND Active check consent.
- **Active check consent**: `owner: true` and `activeChecksConsent: true` in the request. Local computer and GitHub Actions only. Per run, recorded in the report, ignored on `RUNNER_BETA`, never stored in site memory (same pattern as ADR 0022).
- This ADR builds no active check. Each active check needs its own ticket and tests. No code reads `activeChecksConsent` yet.
- Wording follows ADR 0018: "not found", never "secure" or "vulnerable".

## Consequences
- Passive checks ship now: signed-out access, session isolation (GET only), CSRF token presence, CORS read from existing responses.
- The Verdict gate (ADR 0029) is unchanged.
