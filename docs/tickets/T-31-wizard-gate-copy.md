# T-31: Wizard shows one release rule

## Goal
The wizard uses the rule from T-30 everywhere: the default, the report line, the settings presets and their descriptions, and the gate's name.

## Gaps covered
Wizard 9 (second verdict: "Your release rule: not met" beside "Ready to release"; presets shown as "custom" after reload), Docs 5 (settings text), gate naming (Wizard 16).

## In scope
- `packages/wizard/src/api.ts` (~955-960): the default gate sent with a run is `DEFAULT_RELEASE_GATES.standard` imported from `@qa/types/src/verdict`, not a hand-written object.
- `packages/wizard/src/screens/SettingsScreen.tsx` (~521-534, ~542, ~559): preset descriptions match T-30 ("0 Blockers, every area C or better"). Preset detection compares against the same constants.
- `packages/wizard/src/screens/ReportScreen.tsx` (~281-287): the rule line agrees with the stamp. If the stamp and the rule ever disagree, the rule line says so plainly.
- One name for the gate across the UI: "Release rule" (replace "Release Readiness Gates", "Quality gate", "Configure Release Readiness Gates" in CommandPalette ~120).

## Out of scope
Other copy changes (T-37). The constants themselves (T-30).

## Acceptance criteria
- [ ] The default gate equals `DEFAULT_RELEASE_GATES.standard`.
- [ ] Standard shows as Standard after reload.
- [ ] A Major-only report never shows "Ready to release" next to "Must fix before release" without an explanation.
- [ ] One gate name in all visible text.

## Tests to update or add (written, not run)
- `packages/wizard/tests/*` that assert the default gate or the preset labels.
- Add a test: preset detection round-trips the default.

## Dependencies
T-30.

## Verification commands (deferred)
`pnpm exec vitest run packages/wizard`

## Status
built
