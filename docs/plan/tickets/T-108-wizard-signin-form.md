# T-108 Wizard sign-in form: selectors, login URL, header validation, re-approval roles, a11y

- **Type:** feature / bug · **Size:** M · **Wave:** 1 · **Depends on:** T-101
- **Gaps addressed:** G-017 (UI half), G-018 (wizard half), G-033, G-013 (wizard half)

## Gaps addressed (evidence copied in)

- G-017: `packages/wizard/src/lib/form.ts:182-193` `rolesOf` returns only `{role, username, password, loginPath}`; `grep -rn "usernameSelector\|submitSelector" packages/wizard/src` returns 0; `api.ts:737-740` `addSiteSignIn` accepts only role/username/password/loginPath; the login path field lives only in a collapsed `<details>` (`NewCheckupScreen.tsx:1112,1149-1155`).
- G-018: `form.ts:136-143`skips any line without `:` silently, so the runner's `ERR_INVALID_HEADERS` never fires.
- G-033: `NewCheckupScreen.tsx:219-226` `start()` returns silently when consent is unticked (`consentMissing`); file inputs are `className="hidden"` at `:1264-1274` and `:1432-1440` (unreachable by keyboard) and `file.text()` has no try/catch (`:1432-1437`); "Sign-in page" is labelled differently in `NewCheckupScreen.tsx:1149`, `PlanDocument.tsx:540-546`, `SettingsScreen.tsx:1005`; `api.ts:769` `testSiteSignIn` throws `body.error` on `!res.ok` without `isSignInFailureReason`.
- G-013 (wizard half): `form.ts:238-240` `approveRolesOf` returns one hardcoded `{role:'member', username, password}`; `PlanReviewScreen.tsx:494-497` shows one "SignInAgain" form.

## Background

The "no sign-in form" failure tells the person to fix the sign-in page, but the UI only offers a same-origin path and no selector fallback. Header lines typed wrongly are dropped silently. This ticket exposes the existing `RoleCredential` fields, validates header text with the shared rules, and fixes the dead-button and keyboard problems. Project conventions (copied): use CONTEXT.md terms in UI text (Check-up, Plan, Plan Review, Sign-in); the wizard imports single modules from `@qa/types/src/...` (no Node-only code in the bundle); failure wording for sign-ins is fixed text from `packages/types/src/signin.ts` (never page or typed text); passwords use `type="password"` and `autoComplete="off"`. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope

1. Per sign-in "Advanced" disclosure: login URL or path, username / password / submit selectors (optional). Send them in `roles` of `StartRunRequest` and in `addSiteSignIn` / `testSiteSignIn` bodies. One shared `SignInRow` component for the three duplicated forms (`NewCheckupScreen`, `PlanDocument` AddSignIn, `SettingsScreen` AddSignIn) if it fits; otherwise a shared hook of fields.
2. Header text box: validate with `parseHeaderText` from `@qa/types/src/input-rules`; show errors inline (line numbers, never the value); block start while invalid.
3. Consent unticked while sign-in details are typed: disable "Scan the site" and show the hint "Tick 'I accept this' to scan with sign-in" (exposed by a pure helper `scanBlockedHint(form): string | undefined` in `form.ts`, referenced by `aria-describedby`).
4. File inputs: visually hidden but focusable (`sr-only`) or a real button calling `input.click()`; wrap `file.text()` in try/catch and render the error with `role="alert"`.
5. One label "Sign-in page" with hint "Where the sign-in form is, for example /login"; the `no-form` reason text points to that field by name (do not edit `packages/types/src/signin.ts` or `lib/translate.ts`; if the wording must change, report it as a blocker).
6. `testSiteSignIn`: apply `isSignInFailureReason` on the error path like `addSiteSignIn` does.
7. `approveRolesOf`: return every pending role (name, username, password, plus saved loginPath and selectors when known) instead of one hardcoded `member`; the "SignInAgain" form renders one block per pending role (names come from the existing `needsSignIn: string[]` in the 409 response).

## Out of scope

`App.tsx`, `ReportScreen.tsx`, `ScanningScreen.tsx` (T-109); server changes (T-115, T-116); changing sign-in reason wording in `packages/types`.

## Files owned

`packages/wizard/src/lib/form.ts`, `packages/wizard/src/api.ts`, `packages/wizard/src/screens/NewCheckupScreen.tsx`, `packages/wizard/src/screens/SettingsScreen.tsx`, `packages/wizard/src/screens/PlanReviewScreen.tsx`, `packages/wizard/src/components/plan/PlanDocument.tsx`, `packages/wizard/src/components/SignInRow.tsx` (new), `packages/wizard/tests/start-run.test.ts`, `packages/wizard/tests/signin-consent.test.ts`, `packages/wizard/tests/signin-reason.test.ts`, `packages/wizard/tests/signin-form.test.ts` (new).

## Files read-only

`packages/types/src/*`, `packages/wizard/src/App.tsx` (T-109 wires the roles), `packages/wizard/src/lib/translate.ts`, `packages/runner/src/server.ts`.

## Interface contract

- `StartRunRequest.roles` items: `RoleCredential` (already has `usernameSelector`, `passwordSelector`, `submitSelector`, `loginPath`, `token`); wizard sends only the ones filled in.
- `approveRolesOf(username, password, pending?: string[])` (today `approveRolesOf(username, password)`, `form.ts:238`) returns `RoleCredential[]`: one entry per name in `pending`; with no `pending` it behaves exactly as today (single `member`) so `signin-consent.test.ts:120-124` still passes. `pending` comes from the existing 409 body field `needsSignIn: string[]` (`api.ts:617`).
- `RunnerError` in `api.ts` gains `needsSignIn?: string[]` and `needsHeaders?: string[]` (from the runner's 409 `ERR_HEADERS_NOT_SAVED`, T-115); the approve / resume / test-again calls in `api.ts` accept and send the header text as `customHeaders`; `PlanReviewScreen` prop `needsSignIn` accepts `boolean | string[]`. The wiring in `App.tsx` (store the roles, pass them down) is done by T-109, which depends on this ticket.
- `addSiteSignIn(host, { role, username, password, loginPath?, usernameSelector?, passwordSelector?, submitSelector? })`.

## Implementation notes

- Header validation: `const { headers, errors } = parseHeaderText(form.customHeaders)`; keep `parseCustomHeaders` as a thin wrapper.
- Existing tests assert `skipReview` only with consent (`start-run.test.ts:34-50`): keep that behaviour.
- Do not render any password or header value in error text.

## Acceptance criteria

- [x] Typing `X-Token abc` in the header box shows an error naming the line and "Scan the site" is disabled; `X-Token: abc` is accepted.
- [x] `scanBlockedHint` returns the hint text when sign-in details are typed and consent is unticked, and `undefined` otherwise; the button markup is `disabled` with `aria-describedby` pointing at the hint (`renderToStaticMarkup` test).
- [x] `rolesOf` includes `usernameSelector` when set and omits it when empty (unit test).
- [x] `grep -rn "usernameSelector" packages/wizard/src` finds the new fields (evidence for G-017 no longer holds).
- [x] The two file inputs are reachable by keyboard (no `display:none` class on them; test the rendered markup).
- [x] `testSiteSignIn` on a 422 with a known reason returns that reason, not a thrown generic error (unit test with a mocked fetch).
- [x] `approveRolesOf('u','p',['admin','editor'])` returns two roles named accordingly; `approveRolesOf('u','p')` returns the single `member` exactly as before.
- [x] The approve call in `api.ts` sends `customHeaders` when header text is given and omits it otherwise (unit test with a mocked fetch); `RunnerError` exposes `needsHeaders` from a 409 body.
- [x] `pnpm build` and wizard tests pass.

## Test plan

```
pnpm exec vitest run packages/wizard/tests/start-run.test.ts packages/wizard/tests/signin-consent.test.ts packages/wizard/tests/signin-reason.test.ts packages/wizard/tests/signin-form.test.ts
pnpm build
```

## Definition of done

Boxes checked; no Node-only import in the wizard; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-108 in the QA Flow Tester repo. Read docs/plan/tickets/T-108-wizard-signin-form.md and implement it. Edit only the files under "Files owned" (not App.tsx, ReportScreen, ScanningScreen). Add Advanced sign-in fields (login URL/path, username/password/submit selectors) and send them through StartRunRequest.roles and addSiteSignIn/testSiteSignIn; validate header text with parseHeaderText from @qa/types/src/input-rules; fix the silent consent no-op, keyboard-unreachable file inputs and the inconsistent "Sign-in page" label; make approveRolesOf return every pending role. Use CONTEXT.md terms; never render passwords or header values. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main. If blocked, stop and report.
```
