# T-36: Wizard flows and recovery

## Goal
Every screen recovers or explains itself: the landing handoff keeps the address, the plan can be retried, a lost runner is shown, and errors sit next to the thing that failed.

## Gaps covered
Demo 1 (landing "Start a free check-up" loses the address; `router.ts:79-81`), Demo 2 (default address choice; labels and a clear choice), Demo 3 (counts; see T-37), Demo 8 (plan screen spins; runner stop silent). Wizard 1 (plan load failure, `App.tsx:204-206`, `:266-268`, `:279-281`, `:748-749`), 2 (runner lost mid-check, `useRunnerConnection.ts:204`, `App.tsx:347`, `:158`), 3 (stop buttons silent, `api.ts:430-441`), 6 (flow), 8 (approve stuck, `PlanReviewScreen.tsx:131-134`), 9 (start disabled silently, `App.tsx:169`, `NewCheckupScreen.tsx:234-236`), 10 (`/check?url=` ignored, `App.tsx:121-124`), 11 (Back snaps forward, `phase-address.ts`, `App.tsx:155-161`), 12 (no retry in Past check-ups and Benchmark), 13 (misleading "access refused" messages, `api.ts:343-355`), 14 (Visual Baselines empty state; raw IDs), 17 (no built-in demo target).

## In scope
- `lib/router.ts`: `isCheckRoute` includes the new check-up route, so `/check?url=` prefills.
- `App.tsx`: plan load failure shows "The plan couldn't be opened" with Retry; keep polling the runner, and show "Lost contact with Release check-up. Retrying…" after a missed poll.
- Stop: a Notice when `aborted` is false.
- Approve: pending clears on any `PLAN_UPDATE_*` event and after a timeout.
- Start: the AI setup error shows beside the Start button with Retry.
- Errors: `api.ts` only says "access refused" on 401 or 403; other errors say what failed.
- Past check-ups and Benchmark: Retry on failed poll.
- Visual Baselines: empty state gives a next step; show names, not IDs.
- "Only look at it" is relabelled to say nothing is sent or changed, and the server records ownership only for "It's my live site" (`NewCheckupScreen.tsx:420`, `:1059`).
- "Try the built-in test app" option that fills `http://localhost:3050` with a one-line hint to run `pnpm fixture`.
- Back on check-up addresses: no snap-forward; the URL keeps the step the user came from.

## Acceptance criteria
- [ ] Landing "Start a free check-up" with an address lands with the address filled.
- [ ] A failed plan load shows Retry, and Retry works.
- [ ] Stopping the runner mid-check shows the lost-contact message.
- [ ] A failed stop shows a Notice.
- [ ] Approve is never stuck disabled.
- [ ] A 500 is never reported as "access refused".

## Tests to update or add (written, not run)
- `packages/wizard/tests/workflow.test.ts`, `sources-screens.test.tsx`, router tests: prefill, Retry, lost-contact, stop Notice, approve timeout.
- `packages/wizard/tests/online.test.ts`: error class mapping.
- Tests that expected "Only look at it" or the old check route.

## Dependencies
T-31 (gate copy in the same screens); coordinates with T-37 on labels.

## Verification commands (deferred)
`pnpm exec vitest run packages/wizard`

## Status
todo

## Carried over from T-35
- The wizard does not show `ERR_NO_TESTS` yet. Show the refusal on the plan review screen with the reason.
- A repeat approve with the same key now returns 200 with the first result, not 409. The wizard must treat 200 as success and not show an error.
