# T-37b: Wizard copy and glossary, group B

## Goal
Visible text on the report, history, benchmark, visibility, baselines, landing and chrome uses CONTEXT.md terms and plain words.

## Gaps covered
Wizard 5 (Jump to Specs; Spec Drift Override), 6 ("Test again" misuses Test), 7 ("run #id", "account", "Quick smoke scan"), 16 (release gate names beyond T-31), 18 (accessibility labels), 19 (jargon: Schema.org JSON-LD, "Blocked by robots.txt", "Crawl coverage"), 20 (label drift: Baselines, Compare sites, competitor, Product footer, Target Website URL, Run / Skip item), 21 (Visibility breadcrumb "Page"), 22 (silent copy failures), and the "spec://sample-report" text on the landing hero.

## In scope (files)
- `screens/ReportScreen.tsx`: "Test again" → "New check-up of this site" (~586); "Spec Override", "Spec Drift Override" and "Specs" (~1277, ~1325, ~1332) → "Requirements"; "run #id" and "Run" label (~229, ~414) → "Check-up #id"; "account" → "sign-in" for a Role (~605-606); "Crawl coverage" (~1170) → "Pages checked"; "must fix" and "Blocks release" words (~266, ~806) aligned; spec-override inputs linked to their labels (~1335-1377); SEO/AEO/GEO explanations as visible text, not tooltips only (~755); Light/Dark and Show/Hide buttons use a stable label (~549-551; `components/KeyField.tsx:116`); silent copy failure shows a Notice (~1456-1462); Markdown copy drops the raw "(must-fix)" (~1447).
- `screens/PastCheckupsScreen.tsx`: "Test again" (~143) → same label; "serious problems" word (~11-12).
- `screens/VisibilityScreen.tsx`: "Schema.org JSON-LD" (~23) → "structured data".
- `screens/LandingScreen.tsx`: the hero bar's raw "spec://sample-report" (~109) → "Sample report"; "Product" footer heading (~519-520).
- `screens/BenchmarkScreen.tsx`: "competitor" (~150) → "other site".
- `screens/SettingsScreen.tsx`: "account" (~944, ~1003) → "sign-in"; "Quick smoke scan" (~867) → plain preset description; "Target Website URL" (~785) → "Site address"; "Failed to" (~725, ~737, ~746).
- `screens/ConnectionScreen.tsx`: "pnpm start" (~134) → "Start the QA Tool (see the README)"; silent copy failure (~28-29).
- `components/CommandPalette.tsx`: "Jump to Specs" (~191) → "Jump to Requirements"; "Run / Skip item" (~458) → "Leave out" (matches `components/plan/parts.tsx:80`).
- `components/SiteMap.tsx` (~240-246) and `TopBar.tsx` (~38, ~275): "Baselines" vs "Visual Baselines" one name; "Page" breadcrumb → "Visibility".
- `components/SignInRow.tsx` is owned by T-37a; do not edit it here.

## Out of scope
Gate wording (T-31). The check-up flow screens (T-37a).

## Acceptance criteria
- [x] No "Spec", "Test again" for a whole check-up, "run #", "account" for a Role, or "competitor" in visible text.
- [x] The landing hero has no raw URI.
- [x] Copy actions announce failure.
- [x] Each label in ticket T-37b is one of the agreed names.

## Tests to update or add (written, not run)
- `packages/wizard/tests/` label and text assertions for the changed screens.
- Accessibility test: the new label associations (`sources-screens.test.tsx`, `contrast.test.ts` unchanged).

## Dependencies
T-36 and T-31 (same screens). Run after them, in parallel with T-37a.

## Verification commands (deferred)
`pnpm exec vitest run packages/wizard`

## Status
built

## Carried over from T-31
- Settings, Standard preset: the "Max Major Defects" input still shows 0, but Standard sets no major limit. Hide that input under Standard, or show "No limit (Standard)". Also say on the settings screen that the stamp always uses Standard.

## Carried over from T-37a
- `components/plan/PlanDocument.tsx` still shows "Specs and design notes". Change it to "Product context and design notes" (CONTEXT.md term).
