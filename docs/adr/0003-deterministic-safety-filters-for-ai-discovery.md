# 0003: Deterministic Safety Filters for AI Discovery

## Context and Decision
When the Discovery Agent navigates local or staging applications, relying purely on LLM prompt compliance to avoid destructive actions (deletions, payments, external notifications) risks accidental data loss or side effects. We decided that safety enforcement must be deterministic: a keyword and regex barrier intercepts and skips sensitive actions automatically during passive exploration, queuing them as Ambiguity Questions for explicit human review in the Confirmation Phase.

## Consequences
- Zero probability of the AI triggering destructive actions or real payment endpoints without human confirmation.
- Destructive workflows are not ignored—they are cataloged and surfaced for QA approval.
- Staging and tunnel runs remain strictly confined to the allowlisted target host.
