# T-302 — The pre-flight result stops claiming what it did not check

**Type** bug · **Size** M · **Wave** 0 · **Depends on** none · **Gaps** LC-005 (Medium), LC-006 (Low), LC-007 core half (Medium)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

> **Before you start:** another session has uncommitted edits in `packages/core/src/preflight.ts` and
> `packages/types/src/evidence-finding.ts` — the two files you own. Run `git status` and `git diff` on both, start
> from that working tree, and say in the PR if part of this is already fixed.

## Gaps addressed

**LC-005 (Medium).** `packages/core/src/preflight.ts:711-712`, reached whenever `options.browserManager` or
`options.authDir` is absent (`:660`):

```ts
roleResults[role.role] = true;
roleDiagnostics[role.role] = { ok: true, attempts: 0 };
```

No sign-in happened, but the result is the same shape a verified sign-in produces. `orchestrator.ts:466-470` and
the runner routes read `preflight.ok` / `roleAuthResults`; the only guard today is `discovery-agent.ts:357-364`,
which checks `roleStorageStates` (it happens to be empty here) rather than this flag.

**LC-006 (Low).** `preflight.ts:721` sets `loginReachable: true` on every success and `:617` sets `false` only for a
failed reachability check; nothing fetches the sign-in page. The field has no reader anywhere
(`grep -rn loginReachable packages --include=*.ts --include=*.tsx`) beyond `preflight.ts` and
`packages/types/src/evidence-finding.ts:176`.

**LC-007 core half (Medium).** `preflight.ts:176-177`:

```ts
const isOk = res.status < 400 || res.status === 401 || res.status === 403;
const startWarning = res.status >= 400 && res.status < 500 ? 'start-4xx' : undefined;
```

`startWarning` is produced (`:35`, `:127`, `:621`, `:727`) and consumed by nobody — the runner's route
(`packages/runner/src/server.ts:1701-1720`) answers `{ reachable: true, statusCode: 404 }` and drops it (the runner
side is T-306). No test mentions `startWarning` or `start-4xx`.

## Background

A Check-up starts from one JSON result: `PreFlightResult` in `packages/types/src/evidence-finding.ts`. Everything
downstream — the wizard, the Plan, the report — reads “which Roles are signed in” from it, and the wording rules for
a failure come from `signInReasonText` (`packages/types/src/signin.ts`). A field that is true without a check is a
lie the next reader cannot detect.

## Scope

1. An unverified Role is never reported as signed in: with no browser to sign in with, return the fail-closed shape
   (a reason such as `unreachable`, `ok: false`, `attempts: 0`) instead of `ok: true`.
2. `loginReachable` becomes true only when the sign-in page was actually reached. Decide **once, in this ticket**:
   (a) check `new URL(credential.loginPath || '/login', targetUrl)` per Role with the existing reachability helper
   and set the flag from the result, or (b) delete the field from the type. Prefer (a) if `checkUrlReachable` can be
   reused without a second HTTP round trip per Role; otherwise (b) and say why in the PR.
3. `startWarning` reaches every consumer that can act on it: keep it on `PreFlightResult` and on the reachability
   return shape, and make it a documented part of the contract.

**Out of scope:** the runner route and the wizard text (T-306); the `isOk` rule itself (a 401/403 staying
“reachable” is deliberate, `GAPS.md` N-002); the sign-in step order and the field selectors; `signIn`'s own
behaviour beyond what is needed to report honestly.

## Files owned

- `packages/core/src/preflight.ts`
- `packages/types/src/evidence-finding.ts`
- `packages/core/tests/preflight-result-truth.test.ts` (new)

## Files read-only

`packages/types/src/signin.ts`, `packages/core/src/browser.ts`, `packages/core/src/navigate.ts`,
`packages/core/src/orchestrator.ts`, `packages/core/tests/preflight-session.test.ts`,
`packages/core/tests/signin-determinism.test.ts`, `packages/runner/tests/signin-endpoint.test.ts`.

## Interface contract

- `PreFlightResult` (`packages/types/src/evidence-finding.ts`) keeps `roleAuthResults`, `roleFailures`,
  `roleStorageStates`, `roleLandingPaths`, `roleDiagnostics` and `startWarning?: 'start-4xx'`. This ticket may add a
  field but must not rename or remove one that `packages/runner` or `packages/wizard` reads — check both before
  changing the type.
- New invariant, to be stated in the type's doc comment: **a Role is in `roleAuthResults` as `true` only after a
  sign-in that ran and succeeded.**
- `checkUrlReachable`'s return shape keeps `{ ok, status?, error?, testCopyHeader?, startWarning? }`.
- `pnpm build` order matters: types, then checkers/core, then runner — build all three.

## Implementation notes

- `PreFlightResult.startWarning` is already wired from `checkUrlReachable` at `:621` and `:727`; keep both paths.
- The unverified branch is the `else` at `:709-713` (the `if (options?.browserManager && options?.authDir)` at
  `:660` chooses). Keep the branch — a caller without a browser must still be able to run the reachability part —
  but make its result honest, and make sure `runPreFlight`'s `ok` reflects it (`:715-728` returns `ok: true`
  unconditionally today).
- If you choose to check the login page: one request per Role against the login path, using the same
  `checkUrlReachable(url, tunnelAuth, get?, customHeaders?, headerHosts?)` helper so the tunnel and header rules
  stay in one place, and mark an unreachable login page as a `needs-more` / `unreachable` Role failure rather than a
  hard throw.
- Never put a username, password, token or page text into a reason: use `signInReasonText`.

## Acceptance criteria

- [ ] With no `browserManager`/`authDir`, `runPreFlight` no longer reports any Role as signed in; the test asserts
      `roleAuthResults[role] !== true` **and** that `ok` is false for that Role.
- [ ] With a browser and a working fixture sign-in, every existing result field is unchanged (the current tests in
      `preflight-session.test.ts` and `signin-determinism.test.ts` pass untouched).
- [ ] `loginReachable` is either true only when the login path answered, or gone from the type — and the ticket says
      which, with the reason.
- [ ] `startWarning: 'start-4xx'` is present for a 404 start address and absent for 200/401, asserted in the new
      test (no test covers it today).
- [ ] **Evidence for LC-005 no longer holds:** the branch that assigned `roleResults[role.role] = true` with no
      sign-in is gone (show the new lines).
- [ ] **Evidence for LC-006 no longer holds:** no unconditional `loginReachable: true` remains.
- [ ] **Evidence for LC-007 no longer holds:** a test asserts `startWarning` for a 404 start address.

## Test plan

```bash
pnpm exec vitest run packages/core/tests/preflight-result-truth.test.ts
pnpm exec vitest run packages/core/tests/preflight-session.test.ts \
  packages/core/tests/signin-determinism.test.ts packages/core/tests/signin-redaction.test.ts \
  packages/core/tests/require-sign-in.test.ts packages/core/tests/role-failure-run.test.ts
pnpm exec vitest run packages/runner/tests/signin-endpoint.test.ts packages/runner/tests/auth-crawl-run.test.ts
pnpm build
```

Falsification step in the PR: restore the `ok: true` branch and show the new test failing; revert.

## Definition of done

Acceptance boxes checked in the PR with evidence; test plan green; `pnpm build` green across the three packages; a
reviewer (or the `tester` agent, which never edits source) confirms the criteria independently; status set to `done`
in [`../BOARD.md`](../BOARD.md) and `../tickets.json`. Stay inside the files you own; report a blocker instead of
editing elsewhere.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-302-preflight-truth.md and do it. You own only
packages/core/src/preflight.ts, packages/types/src/evidence-finding.ts and the new test
packages/core/tests/preflight-result-truth.test.ts. Start from the current working tree (another session has
uncommitted edits in the first two — check git diff first). Make the pre-flight result honest: no Role reported as
signed in unless a sign-in ran and succeeded (LC-005), loginReachable only true when the sign-in page was actually
reached or removed from the type with a reason (LC-006), and startWarning kept as part of the contract with a test
that a 404 start address produces it (LC-007). Failure reasons come from signInReasonText; never log or return
passwords, tokens, cookies or page text. Do not touch the runner route or the wizard (T-306 owns those). Run
pnpm build across types, core and runner. Report what passed, what failed, and any needed change outside your files
as a blocker.
```
