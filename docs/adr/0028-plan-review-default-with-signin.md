# 0028: Plan Review Is On by Default When Sign-In Details Are Given

Status: Accepted, 2026-10-16, accepted by the owner (from UX flow review finding F-09).

Amends [0022](0022-test-sign-in-as-consent.md) (test sign-in as consent). Builds on [0016](0016-evidence-redaction.md) and [0021](0021-saved-sessions-memory-only-and-confined-docs-fetch.md) only through 0022; no change to either.

## Context
With sign-in details and consent (ADR 0022), the wizard sends `skipReview: !form.reviewFirst`, and "Show me the plan first" starts unticked. A Check-up started this way goes from the scan straight to testing, so Plan Review is skipped. ADR 0022 does not say this. Three promises are then untrue on that path: the hint "Nothing is tested until you approve the plan.", the landing promise "You approve every test", and the FAQ line that you only review and approve the plan. Forms are filled in and sent on a full-testing run, so the person should see what will be sent first.

## Decision
- When a request carries sign-in details and consent (`signInConsent: true`, as in 0022), Plan Review is on by default: the Check-up stops at the Plan and waits for approval. This is review-first.
- `skipReview` stays opt-in. Only an explicit `skipReview: true` skips Plan Review; an omitted value never does.
- In the wizard the consent notice shows one box, ticked by default, "Let me review the plan before testing starts". Unticking it sends `skipReview: true`. When it is unticked and sign-in details are typed, the hint says: "With these sign-in details, testing starts as soon as the plan is written. You will not review the plan first."
- Everything else in 0022 is unchanged: explicit owner say-so, local or GitHub Actions only, one-run consent, sign-in must succeed first, Safety Filter, Security Probes needing a Test Copy, and nothing written to site memory.
- Plan Review approval stays unblocked, as before, apart from the 0022 rule that approving a saved Plan with consent needs a role with username and password.
- A headless Check-up (CI) has no one to review a Plan, so it keeps sending `skipReview: true` explicitly.
- The landing promise, hint and FAQ stay true as written, so none of them changes.

## Consequences
- The default path with sign-in details takes one more step (approve the Plan). That step is where the person sees the questions and the approval summary before any form is sent.
- A person who unticks the box knowingly gives up the review for that one run. The hint says so in plain words.
- Tests: with sign-in details and consent, no `skipReview` stops at Plan Review; `skipReview: true` goes straight to testing; the wizard box starts ticked and unticking sends `skipReview: true`; the hint changes with the box; CI still sends `skipReview: true`.
- Making review skip by default again needs a new ADR, and the landing promise and FAQ would need an exception.
