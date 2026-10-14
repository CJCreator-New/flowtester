# T-116 Persistence integrity and re-approval: roles, remembered sign-ins, atomic writes

- **Type:** bug · **Size:** M · **Wave:** 6 · **Depends on:** T-108, T-115
- **Gaps addressed:** G-013 (server half), G-017 (server half), G-024, G-048

## Gaps addressed (evidence copied in)
- G-013: `packages/runner/src/server.ts:3822` `planForDisk` keeps only `role` and `loginPath` and blanks the username; `:3804` adds every role to `signInNotSaved`; `:4632-4644` approve replaces by `sent.get(r.role) ?? r` and answers 409 while `signInNotSaved` is non-empty; wizard `form.ts:238-240` (`approveRolesOf`, T-108) sent one hardcoded `member`. If `record.context.profile` is undefined, sent roles are ignored and `stillMissing` stays non-empty.
- G-017: `:1812-1819` `rememberSignIns` builds `saved` from this request only and `signIns: saved` replaces the whole array; `:1816` a role whose keychain save fails is skipped silently; `:1817` keeps only `role`, `username`, `loginPath` (selectors lost); `:1832-1833` a role with no keychain password is dropped on load.
- G-024: `server.ts:3671-3689` `catch {}` returns null for a missing or invalid plan file; `:3791-3795` plain `writeFile`; `packages/core/src/site-memory.ts:129-138` read error returns null, `:156-160` non-atomic write, `:133` shallow spread over `emptySiteMemory` with no version; `grep schemaVersion` in both files returns 0.
- G-048 (suspected): `server.ts:3676-3682` a loaded plan sets `phase='awaiting-review'`, `isRunning=true`, `currentRunId` while `phase==='idle'`.

## Background
After a runner restart the pending Plan is read from disk. Passwords are deliberately not on disk, so approval re-asks for them. Today that works only for one role named `member` and drops each role's login path and selectors. Remembered sign-ins overwrite each other. Plan and site-memory files can be truncated by a crash and then read as "nothing there". Project conventions (copied): passwords never in plan files or memory (keychain only); fixed sign-in wording; `{error, code}` errors; plan file readable by older code (additive fields only). Work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
1. 409 `ERR_SIGN_IN_REQUIRED` keeps `needsSignIn: string[]` (role names; already returned at `server.ts:4641`, typed `string[]` in `packages/wizard/src/api.ts:617` and asserted in `packages/runner/tests/runner-server.test.ts:336`) and gains `needsSignInDetails: Array<{ role: string; loginPath?: string }>`. Approve merges each sent credential over the saved role: `{ ...saved, username, password }` so `loginPath` and selectors persist; unknown role names in the request are ignored; if `profile` is missing, rebuild it from the plan file's roles (names + loginPath + selectors).
2. `planForDisk` also keeps the selector fields (`usernameSelector`, `passwordSelector`, `submitSelector`, `postLoginSelector`, `postLoginUrl`) — they are not secrets — and still blanks username/password/token.
3. `rememberSignIns`: merge by role into `memory.signIns` (keep other roles), keep `loginPath` and selectors; report roles whose keychain save failed in the response (`notSaved: string[]`) instead of skipping silently; on load, return roles without a keychain password as "needs password" rather than dropping them (`needsPassword: string[]`).
4. New `packages/core/src/atomic-write.ts`: `writeJsonAtomic(path, value)` writes `path.tmp-<pid>` then `rename`. Use it for the plan file, parked plans (`:3706`) and site memory. Add `schemaVersion: 1` to both documents; the reader accepts missing version (treated as 0) and unknown newer versions (read-only warning, do not overwrite). A parse failure copies the bad file to `<name>.corrupt-<timestamp>` and returns null (so the next save does not destroy evidence).
5. `ensurePlanLoaded`: store `status: 'awaiting-review' | 'approved' | 'done'` in the plan file; only revive `awaiting-review`; clear/mark on approve and completion.

## Out of scope
Header handling (T-115); wizard UI (T-108 already sends per-role credentials); keychain deletion (G-044 deferred).

## Files owned
- `packages/runner/src/server.ts`
- `packages/core/src/site-memory.ts`, `packages/core/src/atomic-write.ts` (new)
- `packages/core/src/index.ts` (add `export * from './atomic-write.js'` only)
- `packages/runner/tests/runner-server.test.ts` (existing `needsSignIn` assertion stays valid; update only if needed)
- `packages/runner/tests/reapproval-roles.test.ts` (new), `packages/runner/tests/remembered-signins.test.ts` (new), `packages/core/tests/atomic-write.test.ts` (new), `packages/core/tests/site-memory-versioning.test.ts` (new)
- existing `packages/core/tests/*site-memory*.test.ts` (update only if behaviour requires). `packages/runner/tests/wizard-endpoints.test.ts` is owned by T-115: run it and report a blocker if it fails

## Files read-only
`packages/wizard/src/lib/form.ts` (T-108), `packages/runner/src/run-inputs.ts`.

## Interface contract
```ts
// 409 from POST /api/runner/plan/approve: { error, code:'ERR_SIGN_IN_REQUIRED', needsSignIn: string[], needsSignInDetails: Array<{ role: string; loginPath?: string }> }
// POST /api/sites/<host> rememberSignIns response adds: notSaved?: string[]; needsPassword?: string[]
// plan file / site memory: schemaVersion: 1; plan file status field
export async function writeJsonAtomic(path: string, value: unknown): Promise<void>;
```
T-108's wizard reads the existing `needsSignIn: string[]` (its `approveRolesOf(username, password, pending?: string[])`); `needsSignInDetails` is additive.

## Implementation notes
- `writeJsonAtomic`: write `path + '.tmp-' + process.pid`, `fsync` if cheap, `rename` over the target; on rename failure remove the temp file and rethrow.
- Reader: `JSON.parse`; if it throws, `copyFile(path, path + '.corrupt-' + Date.now())`, log a redacted warning (file name only) and return null. Never overwrite the corrupt copy.
- `schemaVersion`: missing = 0 (read normally, written back as 1); greater than 1 = read-only (log once, do not save).
- Plan file `status` is set to `approved` when the run starts and `done` when it finishes; `ensurePlanLoaded` revives only `awaiting-review`.
- Merge order for credentials on approve: `{ ...savedRole, username: sent.username, password: sent.password }`; ignore sent roles that are not in `needsSignIn`.
- Re-locate lines by function name (`planForDisk`, `ensurePlanLoaded`, the approve handler, `signInsFor`).

## Acceptance criteria
- [ ] Plan with roles `admin` (loginPath `/a/login`) and `editor`: after a simulated restart approve with `[{role:'admin',...},{role:'editor',...}]` succeeds and the run signs in at `/a/login` (assert via fixture request log); approve with only `admin` returns 409 with `needsSignIn` equal to `['editor']` and `needsSignInDetails` carrying editor's loginPath.
- [ ] Sending a role named `member` that the plan does not have is ignored (no new role appears).
- [ ] `rememberSignIns` for role A then role B leaves both in `memory.signIns` with selectors preserved.
- [ ] A keychain failure for one role returns it under `notSaved` and still saves the others.
- [ ] Truncating the plan file to half its bytes: the next read returns null, writes `.corrupt-*`, and a later save does not overwrite the corrupt copy.
- [ ] Kill-simulated write (throw between tmp write and rename): original file intact.
- [ ] Site memory without `schemaVersion` loads; one with `schemaVersion: 99` loads read-only and is not overwritten.
- [ ] A `done` plan is not revived by `ensurePlanLoaded`.
- [ ] Evidence for G-024 no longer holds: `grep -n "writeFile" packages/runner/src/server.ts packages/core/src/site-memory.ts` shows no direct writes of plan/memory JSON.
- [ ] Evidence for G-013, G-017 and G-048 no longer holds: the re-approval, remembered-sign-ins and stale-plan tests above exist and pass; `grep -n "member" packages/wizard/src/lib/form.ts` shows the hardcoded role only as the no-`pending` fallback.
- [ ] `pnpm build` passes.

## Test plan
```
pnpm exec vitest run packages/runner/tests/reapproval-roles.test.ts packages/runner/tests/remembered-signins.test.ts packages/core/tests/atomic-write.test.ts packages/core/tests/site-memory-versioning.test.ts packages/runner/tests/wizard-endpoints.test.ts packages/runner/tests/url-first.test.ts packages/runner/tests/runner-server.test.ts
pnpm build
```

## Definition of done
Boxes checked; no password/token in any persisted file; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-116 in the QA Flow Tester repo. Read docs/plan/tickets/T-116-server-persistence-and-reapproval.md and the plan/approve/rememberSignIns code in packages/runner/src/server.ts and packages/core/src/site-memory.ts. Edit only the files under "Files owned". Make re-approval after a restart work for any roles (merge sent credentials over the saved loginPath/selectors; 409 lists needsSignIn with role and loginPath), merge remembered sign-ins by role and keep selectors, add writeJsonAtomic and schemaVersion for the plan file, parked plans and site memory (corrupt files are copied aside, never overwritten), and only revive pending plans. Never write passwords or tokens to disk. Run the "Test plan" (skip running if .claude/work/DEFER_TESTS exists). Work on a branch, not main. If blocked, stop and report.
```
