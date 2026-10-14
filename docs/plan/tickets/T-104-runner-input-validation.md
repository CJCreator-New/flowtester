# T-104 Runner input validation: roles, login path, header rules

- **Type:** security / bug · **Size:** S · **Wave:** 1 · **Depends on:** T-101
- **Gaps addressed:** G-018 (server side), G-022 (roles half), G-023 (loginPath half)

## Gaps addressed (evidence copied in)

- G-022: `packages/runner/src/server.ts:1808-1817,2981-2983` use `body.roles` / `role.role` as sent; `handleAddSignIn` sanitizes at `:4356-4361` but `handleRun` does not; `grep -n "roles" packages/runner/src/run-inputs.ts` returns 0 results. `preflight.ts:319` later uses the role as a file name.
- G-023: `loginPath` is never validated (`grep loginPath packages/runner/src/run-inputs.ts`: 0). `preflight.ts:162` `new URL(loginPath || '/login', baseUrl)` lets an absolute value replace the base.
- G-018: `run-inputs.ts:202-225` does not check that header names are legal tokens or that values are free of CR/LF/NUL; `server.ts:3140-3143` drops a rejected header set with `ch.ok ? ch.value : undefined` (no error).

## Background

`POST /api/runner/run` validates context documents, saved sessions, AI cap and custom headers (`server.ts:2738-2744`) but not `roles`. A malformed or hostile role name or login path can reach the filesystem and the sign-in step. This ticket adds validators in `run-inputs.ts`; T-115 calls them from `handleRun`. Project conventions (copied): validators return `Checked<T>` `{ok, value | problem}`; errors use `{error, code}` with `ERR_*` codes; never echo secrets or header values in errors. Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope

Add `checkRoles`, `checkLoginPath`, tighten `checkCustomHeaders`; reuse `ROLE_NAME_PATTERN`, `HEADER_NAME_PATTERN`, `isSafeHeaderValue`, `parseHeaderText` from `@qa/types` (T-101).

## Out of scope

Calling the validators from `server.ts` (T-115); wizard validation (T-108).

## Files owned

- `packages/runner/src/run-inputs.ts`
- `packages/runner/tests/run-inputs-roles.test.ts` (new)

## Files read-only

`packages/runner/src/server.ts`, `packages/runner/tests/run-inputs-docx.test.ts`, `packages/types/src/input-rules.ts`.

## Interface contract

```ts
// packages/runner/src/run-inputs.ts
export function checkRoles(value: unknown): Checked<RoleCredential[] | undefined>;
//  undefined/absent -> ok undefined. Not an array, > 10 roles, role not matching ROLE_NAME_PATTERN,
//  duplicate role names, non-string username/password/loginPath/selectors, or any string > 500 chars
//  -> { ok:false, problem:{ error:'The sign-in details are not valid.', code:'ERR_INVALID_ROLES' } } (never echoes values)
export function checkLoginPath(value: unknown, targetUrl: string): Checked<string | undefined>;
//  accepts a path starting with a single '/', or an absolute http(s) URL whose host equals targetUrl's host
//  (www/apex counted equal); returns a normalised path+search. Anything else -> code 'ERR_INVALID_LOGIN_PATH'.
export function checkCustomHeaders(value: unknown): Checked<Record<string, string> | undefined>; // existing, now enforces HEADER_NAME_PATTERN, isSafeHeaderValue, MAX_CUSTOM_HEADERS; error code stays 'ERR_INVALID_HEADERS'
```

## Implementation notes

- Follow the `Checked<T>` helpers already in the file (see `checkSavedSessions` `:117-174`, `checkAiCap`).
- `checkCustomHeaders` already accepts a record or a "Header: Value" string (`:190-225`): switch the string branch to `parseHeaderText`; if `errors.length`, return `ERR_INVALID_HEADERS` with a message naming line numbers only.
- `checkRoles` must not log or return password text. Selectors are CSS strings; cap length, no other validation.

## Acceptance criteria

- [x] `checkRoles([{role:'../x',username:'a',password:'b'}])` returns `ERR_INVALID_ROLES`; `checkRoles([{role:'member',username:'a',password:'b'}])` is ok.
- [x] `checkLoginPath('https://evil.example/login','https://app.test')` is `ERR_INVALID_LOGIN_PATH`; `'/login'` and `'https://app.test/login'` are ok; `'//evil.example/x'` is rejected.
- [x] `checkCustomHeaders({'X Bad':'1'})` and `{'X-A':'a\r\nb'}` are `ERR_INVALID_HEADERS`; the error message does not contain `a` or `b` values.
- [x] Evidence for G-022 (roles half) no longer holds: `grep -n "checkRoles" packages/runner/src/run-inputs.ts` finds it.
- [x] `pnpm build` passes.

## Test plan

```
pnpm exec vitest run packages/runner/tests/run-inputs-roles.test.ts packages/runner/tests/run-inputs-docx.test.ts
pnpm build
```

## Definition of done

Boxes checked; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-104 in the QA Flow Tester repo. Read docs/plan/tickets/T-104-runner-input-validation.md and implement it. Edit only packages/runner/src/run-inputs.ts and the new packages/runner/tests/run-inputs-roles.test.ts. Add checkRoles and checkLoginPath, tighten checkCustomHeaders using the shared rules from @qa/types (added in T-101). Return Checked<T> results with ERR_* codes that never echo secret values. Do not edit server.ts (T-115 wires these in). Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main.
```
