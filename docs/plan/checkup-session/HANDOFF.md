# Handoff: finishing the check-up session plan

Written 2026-10-15 at the end of a session that landed waves 0-1. Read this, then
[`BOARD.md`](BOARD.md) (statuses and the "Work in flight" section), then the ticket you are picking up. The plan's
own documents are the source of truth for *what* to do; this file is about *where the tree is* and *what bit us*.

## Where the tree is

- `main`, **everything uncommitted**, on top of the previous session's sign-in/crawl work (55 changed/new paths).
  The owner asked for it to stay uncommitted: do not commit or push unless they ask again.
- `pnpm build` is **green** (types → wizard → checkers → core → runner).
- **No test has been run.** Every test file below is written and type-checked, nothing more.

Built, uncommitted:

| Ticket | Files |
| --- | --- |
| T-201 contracts | `packages/types/src/checkup-api.ts`, `packages/types/tests/checkup-api.test.ts`, `packages/types/src/index.ts`, `packages/wizard/src/api.ts` |
| T-202 (earlier session) | `packages/wizard/src/lib/scan-progress.ts`, `screens/ScanningScreen.tsx`, `lib/coverage-text.ts` |
| T-203 route net | `packages/runner/tests/route-inventory.test.ts` |
| T-211 browser entry | `packages/types/src/browser.ts`, `packages/types/tests/browser-entry.test.ts`, 15 wizard import paths (10 src + 3 test files) |
| login-and-crawl T-302/T-309 follow-ups | `packages/core/src/preflight.ts`, `packages/core/tests/preflight-result-truth.test.ts`, `packages/core/tests/auth-crawl-e2e.test.ts` |

Not started: **T-204 → T-206 → T-207 → T-208 → T-209 → T-210**, the critical path. Start at T-204
(`tickets/T-204-checkup-session.md`); it has a ready-made agent prompt at the bottom and is the only ticket of the
six with its own dependency free. It suggests landing as two commits — state first, operations second — and stopping
between them if the diff grows too big to hold. Take that offer.

## Next session, in order

1. **Run what was written** (this is the biggest gap). `/verify-all`'s job, but it is cheap to do first:
   `pnpm exec vitest run packages/types/tests packages/runner/tests/route-inventory.test.ts`, then the T-203/T-211/T-201
   test plans, then `packages/core/tests/preflight-result-truth.test.ts packages/core/tests/auth-crawl-e2e.test.ts`
   (needs Chromium; it is installed). Report failures honestly and fix the cause — do not weaken a test to pass.
   Falsification steps the tickets ask for and that nobody has done yet: T-203's negative control (swap one entry
   for `/api/does-not-exist`, see it fail), T-211's two non-vacuity proofs, T-309's revert-one-fix run.
2. **T-204.** Then T-206, T-207, T-208, T-209, T-210 in order — they serialise on `packages/runner/src/server.ts`
   (5595 lines, ~230 `this.<field>` references to the state T-204 moves). One ticket per agent run
   (`/ship <ticket>` or a fresh session each); do not batch them in one pass, and keep `pnpm build` green between
   waves. T-203's file is the proof that T-206 changed no route: it must stay untouched and green.

## Things that will cost you time if you don't know them

- **`pnpm typecheck` is not a gate.** It fails repo-wide with 176 pre-existing errors (wizard tests importing
  without extensions, `@qa/runner` dist missing, `fixtures/test-app/server.js` untyped). `pnpm build` type-checks
  `src` only, which is why the test files above were checked by running `pnpm typecheck` and reading only the lines
  for the touched files (they are clean). Don't "fix" the repo-wide ones in a ticket that does not own them.
- **`packages/wizard/src/App.tsx:393`** builds a partial status object, which is why the wizard's `RunnerStatus`
  (in `api.ts`) makes `lastErrorCode`, `reportRunId` and `beta` optional on top of the shared `RunnerStatusReply`.
  T-201 forbids editing `App.tsx`; the deviation is deliberate and recorded there and in this handoff.
- **`useAI` is not a `DiscoveryOptions` field** — it is silently ignored. It appears in the older tests in
  `auth-crawl-e2e.test.ts`; the new scenarios do not add it. Don't copy it into new code.
- **`RunStartBody.customHeaders`** is `Record<string, string> | string` because the runner's handler accepts both;
  the wizard's old copy said `Record<string, string>`. The shared type keeps the union (the wizard narrows nothing).
- The fixture's **`/lab/expire-session` invalidates every session for good** (`sessionsInvalidated` is global until
  `/lab/reset`), so it can never show a *restored* session. T-309's recovery scenario therefore starts a small
  `node:http` server of its own with a per-token session and an `/invalidate` lever.
- The **politeness note** is written only by the Discovery Agent, which passes a robots policy only on a host that is
  not private (`discovery-agent.ts`). The fixture is localhost, so the new test stubs `isPrivateHost` with
  `vi.doMock` + `resetModules` and cranks `crawlDelayMs: 0` (otherwise a "public" host gets 2 s per page); the
  allow-all contrast spies on `RobotsPolicy.fetch`. Say in the PR that the host check is the only stubbed thing.
- **T-203's list is 61 pairs against 42 in-chain conditionals** (47 by `grep -c "if (pathname"`; the other five are
  beta-scope helpers). The mapping table is in the test file's header. `it.each` names the failing pair; the port
  comes from a throwaway `listen(0)` probe; `/studio` needs `redirect: 'manual'` or the 308 is followed into the
  wizard UI and the fallback 404 looks like a lost route.
- T-203's pairs assume a **handler's own 404 is not byte-identical to the chain fallback**. The ones at risk are
  `GET /api/runs/<id>`, the `/api/sites/<host>` group and `/api/ai/openrouter/free-models`; the chosen values
  (`run-does-not-exist`, `example.invalid`) make them answer their specific messages ("No such check-up", "That site
  isn't remembered."). If one of them fails with the fallback body, that pair needs a different value — not a
  weakened assertion.
- Secrets (`savedSessions`, custom headers, tunnel auth, cookies) live in memory only and are never written, logged
  or returned (ADRs 0016, 0021). Never read or print `.env`, `.qa-keys.json`, `.qa-ai-models.json`.

## Owner decisions carried into the next session

Asked and answered at the start of this session: work **all of T-201…T-210 in order**; verify with **`pnpm build`
only** for that pass (tests written, not run — the owner accepted the risk); T-302 **should** mark a Role whose login
page does not answer as `unreachable`; T-309's two missing scenarios **should** be written; leave **everything
uncommitted**. The build-only choice was about that session; running the suites is the first item above.

## Suggested skills

- `tdd` — if you pick up T-204's `session-state.test.ts`, write it against `createCheckupSession()` before moving
  the server's bodies, so the move is proved rather than hoped.
- `codebase-design` — T-204/T-207 are deep-module moves; the vocabulary (seam, depth, the interface the callers
  see) is what keeps the six new modules from becoming a second server.
- `diagnosing-bugs` — for the first failing test run of the files listed above; several of them are end-to-end and
  will need the loop rather than a guess.
- `/ship resume <slug>` or `/ship <ticket>` — the repo's own planner → developer → tester hand-off, one ticket at a
  time, with the plan approved before code is written. T-204…T-210 each carry an agent prompt for exactly this.
