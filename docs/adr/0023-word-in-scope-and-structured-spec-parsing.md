# 0023: Word in Scope and Structured Spec Parsing

Status: Accepted 2026-10-12.

Amends [0020](0020-sources-role-binding-and-pipelined-planning.md) (the line "PDF and Word are out of scope"; PDF stays out) and [0009](0009-ai-plans-every-plan-item.md) (the Fixed-Rule Fallback now reads the documents). Builds on [0003](0003-deterministic-safety-filters-for-ai-discovery.md), [0014](0014-verified-domains-and-safe-host-classification.md), [0016](0016-evidence-redaction.md), [0018](0018-claim-wording.md), [0021](0021-saved-sessions-memory-only-and-confined-docs-fetch.md) and [0022](0022-test-sign-in-as-consent.md), all unchanged.

## Context
Real Product Context is often a Word file with headings, tables, numbered steps and User Flows written as "Steps: a → b → c". The parser read only flat bullets, so most of that structure was lost. Separately, the person running the tool has no AI key and will not get one. Without a key, Plan Items from documents did not exist at all.

## Decision

### Word is in scope, converted on the server
- `.docx` is accepted next to `.md`, `.markdown` and `.txt`. PDF and the old `.doc` stay out ("PDF and old .doc files are not supported. Save as .docx, .md or .txt.").
- Conversion runs in `@qa/core` with `mammoth` (`convertToHtml`) plus a small in-repo HTML-to-Markdown step. The wizard sends the picked file as base64 to `POST /api/runner/context/docx` and gets Markdown back. The CLI calls the same function in-process. Everything downstream stays text: `contextDocuments: [{name, text}]`.
- Not in the browser: the mammoth browser build adds about 0.5 MB to the wizard bundle, and the CLI needs a Node converter anyway, so there would be two converters with different output.
- Caps: raw file 2 MB; must start with the ZIP signature; declared uncompressed total 20 MB and 500 entries (read from the ZIP directory by hand); 10 s timeout; one file per call. Declared sizes can lie. That residual risk is accepted.
- Converter warnings are shown to the person. A line in converted text that starts `# Document:` is escaped, because the stored context format splits on it.
- The route is open in beta: it is stateless, changes nothing shared and logs and stores nothing (like `domain-proof`). The caps and the 5 MB body limit bound it.
- Text files: the wizard cap is aligned with the runner at 500 KB (was 1 MB in the wizard).
- A generic pass hides `password: value` style text on ingest, before storage and prompts. It is not a guarantee for other secret shapes.

### Structured parsing
The pure part of the parser lives in `@qa/types/src/context-parse.ts`, so the wizard can show "3 requirements, 4 User Flows, 2 tables" per file. It reads headings (the heading path is the section), User Flow blocks (title, persona, preconditions, steps, assertions; persona from the nearest heading when the block has none), `Negative specs` lines, tables (routes with a Roles column, a capability matrix, other tables as one rule per row), numbered items and flow diagrams. A document that yields no requirements, User Flows or tables is flagged "Nothing was read" and not counted as read. A description is the first prose line, or empty.

### Plan Items without an AI key
The Fixed-Rule Fallback (0009) now also turns parsed documents into Plan Items. A pure module (`plan/spec-plan.ts`) runs in the Discovery Agent after the crawl. Rules:
- A User Flow becomes a Plan Item for the role named by its persona. A step becomes an action only when it names a `/route` or a control found in that role's crawl. Fill steps are never invented. Steps that match nothing are listed under "Needs your judgement"; when none match, the item is marked needs-help and not run.
- A step on a Sensitive Action is never generated (0003). A step that sends a form sets the test-copy requirement, so on a live App it runs only with 0022 consent. Finalize, publish and delete stay blocked.
- Assertions become checks only in two deterministic forms: `land on /route` (URL check) and a quoted status or label (text check). Free text ("password complexity enforced server-side") is never judged by code. It is listed under "Needs your judgement" for that role, outside the verdict and grades until accepted (0020).
- A Site Map table gives one reach Plan Item per allowed role and one Denial Plan Item per role not allowed. The Denial uses a new optional `negate` on the URL expectation: it passes when the final path is not the route, so a redirect or refusal passes. `Negative specs` routes give the same Denial Plan Items; the Negative spec Source wins when both name a (role, route). Routes starting `/api/` or containing `*` are skipped. A route no crawl reached is "Not found in app", not a failure.
- Capability matrix rows have no route, so fixed rules cannot map them. Restricted cells become "Needs your judgement" entries.
- Role words are matched exactly or by whole-word prefix, never guessed. `all` and `all active` are defined; anything else (`lead+`, free words) goes to notes and a judgement entry. A persona with no configured role makes the Plan Item needs-help.
- Each Plan Item carries a Source through `DiscoveredFlow.docSource` (new, optional). Items are `source: 'fallback'`.
- With an AI, the AI plans first as before and fixed rules fill only the units the AI did not reach, de-duplicated by Requirement id. The AI now also sees User Flow steps and assertions (up to 600 characters per entry, with a higher budget only when such entries exist).
- "N of M documented items reached" now counts only User Flows, routes and negative specs once any exist, not plain headings. The figure changes for existing users.

### Safety
0003, 0014, 0016, 0021 and 0022 are unchanged. Writes on a live App happen only under 0022 consent. Wording follows 0018: a Denial or flow that fails reads "Behaviour differs from <Source>", never "bug" as fact; a stale document can be marked in Plan Review.

## Consequences
- A no-key Check-up gets runnable, Sourced Plan Items. Many steps may stay unmatched on a real App; the wizard says so.
- New dependency `mammoth`, pinned; audit with `pnpm audit --prod --audit-level high`.
- Saved plans lack `docSource` and `negate`; both are optional.
- Rollback: revert the docx route and conversion; the text path is unaffected.
