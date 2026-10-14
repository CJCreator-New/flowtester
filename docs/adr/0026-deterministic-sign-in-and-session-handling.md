# 0026: Deterministic Sign-In, Session Lifecycle and Origin-Scoped Header Propagation

Status: Accepted, 2026-10-14.

Builds on [0003](0003-deterministic-safety-filters-for-ai-discovery.md) (Safety Filter), [0014](0014-verified-domains-and-safe-host-classification.md) (Test Copy), [0016](0016-evidence-redaction.md) (Redaction), [0021](0021-saved-sessions-memory-only-and-confined-docs-fetch.md) (Saved Sessions), [0022](0022-test-sign-in-as-consent.md) (Sign-in Consent), and [0024](0024-intent-and-refusal-rule.md) (Intent).

## Context
Full product exploration and pre-release evaluation require authenticated journeys and bypass headers (e.g. for staging gates, Cloudflare access, or test environments). Previously, sign-in state was re-evaluated repeatedly or lost between crawl and test phases, bypass headers risked leaking across external origins, session expirations lacked structured reporting, and credentials lacked clean re-authentication lifecycles across runner restarts.

## Decision
- **Readiness waits and retry:** Form interactions await element attachment, visibility, and input readiness before filling credentials or clicking submit. Initial sign-in attempts that encounter transient network failures undergo a single clean retry in a fresh browser context.
- **Deterministic success signals:** Sign-in success is verified through concrete indicators: URL path divergence from `loginPath`, matching `postLoginUrl`, presence of `postLoginSelector`, or removal of sign-in forms alongside authenticated UI markers (account menu, logout control).
- **One sign-in per check-up with single re-login:** Each role signs in once during PreFlight. The authenticated context is preserved and shared between the discovery crawl and test point execution. If a session expires mid-run, the runner performs an automatic one-time re-login attempt (configurable via `QA_RELOGIN`). If re-login fails or the session drops again, subsequent role routes are recorded as skipped with the fixed `session-expired` reason; they are not retried in a loop.
- **Header scoping and confidentiality:** Custom headers (`QA_CUSTOM_HEADERS`, `customHeaders`) are injected into both crawler and test point contexts. Headers are dispatched strictly to the target origin and explicitly allowlisted hosts (`headerHosts`); external third-party requests are sanitized. Custom headers and credentials are never stored in serialized plans or report files on disk; restoring plans across runner restarts returns 409 `ERR_HEADERS_NOT_SAVED` or `ERR_SIGN_IN_REQUIRED`.
- **Structured route telemetry:** Crawl progress records per-route telemetry (`requestedPath`, `status`, `finalPath`, `redirectChain`, `attempts`, `durationMs`) and maps skipped pages to standardized reasons (`page-limit`, `did-not-load`, `robots`, `sign-in`, `http-error`, `timeout`, `off-site-redirect`, `time-limit`, `trap-limit`, `session-lost`, `duplicate`).
- **Fixed, non-leaking diagnostic messages:** Authentication outcomes map strictly to canonical error reasons (`wrong-details`, `no-form`, `unreachable`, `needs-more`, `session-expired`). Error messages use fixed diagnostic text; credentials, tokens, and cookie values are never echoed in error strings, logs, SSE streams, or reports.

## Consequences
- Single sign-in reduces load and execution latency on target applications during check-ups.
- Custom headers cannot leak to third-party endpoints, external CDNs, or analytics providers.
- Restarting a runner while a plan awaits review requires callers to re-supply headers and credentials before testing commences.
