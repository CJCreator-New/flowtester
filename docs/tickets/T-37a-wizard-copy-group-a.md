# T-37a: Wizard copy and glossary, group A

## Goal
Visible text in the check-up flow uses CONTEXT.md terms and plain words for a non-developer.

## Gaps covered
Wizard 4 (cost and privacy overclaim), 5 (Spec, Documents, Spec Override, acceptance criteria), 7 (Run, account, scan), 15 (severity words), 19 (jargon), 22 (Markdown copy shows "(must-fix)"), 23 (Failed to, siteType "SaaS").

## In scope (files)
- `screens/NewCheckupScreen.tsx`: "Specs" label and "acceptance criteria" hint (~614-615), "Documents (Sources)" (~937; a Source is per Plan Item), "It costs nothing" (~777-778) rewritten as "Free models: what you send may be kept and used to learn (Settings explains)", "Crawl pace" (~673), "Only look at it instead" relabelled per T-36.
- `screens/PlanReviewScreen.tsx`: "Approve the plan and start testing" and "Approve and test" become one label; raw `siteType` such as "SaaS" shown as a readable name (~338); "Failed to" wording (~165).
- `screens/TestingScreen.tsx`: "HIGH/WARN" labels (~246) use the shared severity words; countdown no longer appends " LEFT" (~101).
- `lib/translate.ts`: "Run was stopped by user." becomes "The check-up was stopped." (~316-317); "a basic check will run" (~217).
- `components/SignInRow.tsx`: selector fields hidden behind an "Advanced" disclosure with plain labels.

## Out of scope
Gate wording (T-31). Screens owned by T-37b.

## Acceptance criteria
- [ ] No visible "Spec", "Documents (Sources)", "costs nothing" or "Run was stopped" in these files.
- [ ] Countdown reads once: "about 4 minutes left".
- [ ] One label for approve-and-test.
- [ ] Severity words match the shared list.

## Tests to update or add (written, not run)
- `packages/wizard/tests/translate.test.ts`: new strings.
- `packages/wizard/tests/workflow.test.ts`, `sources-screens.test.tsx`: label assertions.

## Dependencies
T-36 (same screens). Run after T-36 and T-31.

## Verification commands (deferred)
`pnpm exec vitest run packages/wizard`

## Status
built
