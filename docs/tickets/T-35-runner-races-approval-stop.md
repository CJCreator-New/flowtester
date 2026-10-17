# T-35: Runner start races, plan approval and stop

## Goal
Two Starts or two Approves run once. The plan that was reviewed is the plan that runs. Stop tells the truth. Schedules fire.

## Gaps covered
Runner 2 (double start, double approve: `server.ts:2703`, `checkup-run.ts:912`, `:948-949`, `routes/plan.ts:903`, `:1116`), Runner 3 (schedules never fire, `scheduler.ts:110`), Runner 10 (beta decisions change what runs after review, `routes/plan.ts:1071-1098`), Runner 11 (beta: one tester parks another's plan, `server.ts:2716-2721`, `checkup-run.ts:919-922`, `routes/plan.ts:1172-1175`), Runner 15 (run start has no scheme check outside beta, `server.ts:2743`), Core 10 (approval regenerates tests), Core 11 (invalid AI key swallowed, `server.ts:2931`, `ai-planner.ts:959-966`).

## In scope
- `server.ts` `handleTriggerRun` and `checkup-run.ts`: a synchronous `starting` flag set before any await; honour `begin()`'s return value; a second start while starting returns 409.
- `routes/plan.ts` approve: record the approval key before any await; a repeat approve with the same key returns the first result.
- `routes/plan.ts` approve: beta decisions (read-only flip) happen before review; approval returns the reviewed list and does not regenerate tests.
- `checkup-run.ts` stop: stop during start returns `aborted: true` after the abort is honoured. Stop during plan review keeps the plan (no `plan.clear` without an explicit discard).
- Beta: starting or unparking a run never parks another tester's awaiting-review plan. Owner check on `current`.
- `scheduler.ts`: `start()` is called when the server starts. A test covers a due schedule firing once.
- `server.ts` scheme check: `refuseTarget` (or the `^https?:` check) also runs outside beta.
- Invalid OpenRouter key: `OpenRouterAuthError` surfaces as `ERR_NO_AI_KEY` with "The key was not recognised".

## Acceptance criteria
- [ ] Two concurrent POST `/api/runner/run` produce one run and a 409 for the second.
- [ ] Two approves with the same key run once.
- [ ] Approval result lists the same tests the review showed.
- [ ] A due schedule runs once.
- [ ] Stop during start reports `aborted: true`.

## Carried over from T-32
- `packages/runner/src/routes/plan.ts` (~1098): approval with no draft still calls `defaultTestCase`. Remove that fallback: an approval with no reviewed tests is refused with `noTests`.
- `packages/runner/src/session/checkup-run.ts` (~706): the direct no-AI run still uses a sanity test. Decide: keep it only if the run report says "Nothing to test" rather than passing it as a check. Record the decision in the ticket.
- Wizard does not show `noTests` yet. T-36 owns that: show it on the plan review screen.

## Tests to update or add (written, not run)
- `packages/runner/tests/runner-server.test.ts`, `checkups.test.ts`: concurrent start and approve.
- `packages/runner/tests/` scheduler test: start wiring and firing.
- `packages/runner/tests/beta-privacy.test.ts`: unparking another tester's plan refused.
- `packages/runner/tests/wizard-endpoints.test.ts`: invalid key message.

## Dependencies
T-34 (both edit `server.ts`).

## Verification commands (deferred)
`pnpm exec vitest run packages/runner/tests/runner-server.test.ts packages/runner/tests/checkups.test.ts packages/runner/tests/beta-privacy.test.ts`

## Status
built

## Carried over from T-34 (decision needed)
- Beta AI settings POST still saves the tester's own key but skips the shared model-choice file. Keep as is, unless the owner decides testers must not enter keys at all. Record the decision here.

## Decisions recorded at build
- Beta AI settings: kept as is (a tester saves their own key; the shared model-choice file is not written). The owner can still decide that testers may not enter keys at all; no code changed for it.
- Direct no-AI run (`checkup-run.ts`): the sanity test is kept, and the report now carries the note "Nothing to test: ... This is not a checked journey." instead of passing it as a check.
- Approval with nothing to run is refused with 409 `ERR_NO_TESTS` and a `noTests` reason. The wizard does not show it yet (T-36).
- A repeat approve with the same Idempotency-Key now answers 200 `{ status: 'approved', runId, repeated: true }` (was 409 `ERR_DUPLICATE_APPROVAL`; the wizard treated both as success). A second keyless approve while one runs gets 409 `ERR_DUPLICATE_APPROVAL`.
- Approve answers with `tests: [{ id, name }]`, the list that runs. The reviewed list (`plan.testCases`) is used as is; tests are derived again only when none was reviewed or the beta read-only flip changed what may run.
- Stop during plan review keeps the plan and answers `aborted: false, planKept: true`. `POST /api/runner/abort` with `{ discard: true }` throws it away.
- Beta: a start or an unpark that would move another tester's waiting plan is refused with 409 `ERR_RUN_IN_PROGRESS`.
- Scheduled runs start read-only, without AI, quick preset capped at 20 pages. Not started in beta (schedules are closed there).
- Not done: `ai-planner.ts` still turns an AI failure into the fixed-rules fallback; the invalid key is caught earlier, in `prepareAI`.
