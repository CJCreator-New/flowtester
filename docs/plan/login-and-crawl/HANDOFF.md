# Handoff: sign-in and crawling

Planning is finished; **no source file has been changed**. This file tells whoever executes the tickets how to work.

## Reading order

1. [`CONTEXT.md`](CONTEXT.md) — where sign-in and crawling live, what each piece is for, how to run things.
2. [`GAPS.md`](GAPS.md) — what is wrong, with evidence. Skim the top five and the two High rows.
3. [`PLAN.md`](PLAN.md) — decisions, risks, what is deferred, open questions.
4. [`BOARD.md`](BOARD.md) and [`tickets.json`](tickets.json) — waves and dependencies.
5. Your own ticket in [`tickets/`](tickets/). It is self-contained.

## Before your first commit

**Another session has uncommitted work in five of the files these tickets own** — `deterministic-spider.ts`,
`discovery-agent.ts`, `preflight.ts`, `packages/types/src/evidence-finding.ts` and
`packages/wizard/src/screens/NewCheckupScreen.tsx` (plus `api.ts`). Run `git status` and `git diff` on the files
your ticket owns **before** writing anything:

- If your finding is already fixed there, do not touch it: say so in the PR, mark the finding closed in
  [`TRACEABILITY.md`](TRACEABILITY.md), and close the ticket.
- If it is not, start from that working tree — do not stash, revert or "clean up" someone else's in-progress code.
- The audit read the code on the working tree on 2026-10-15; a line number that has moved a few lines is normal.
  Re-locate by function name. If a function is gone or its behaviour differs from this plan's description, the code
  wins: adapt your usage and note the difference in the PR.

## Choosing a wave

- Run waves in order: 0, 1, 2, 3, 4, 5. A ticket starts only when every ticket in its `dependsOn` is `done` (merged
  and verified).
- Wave 0 has three independent starting points: T-301, T-302, T-303. Wave 1 has two: T-304 (after T-301) and T-306
  (after T-302).
- **One owner per wave for `deterministic-spider.ts`**: T-301 → T-304 → T-305 → T-307, in that order and never in
  the same wave. Do not start the next one before the previous has merged; the merge order is the plan.
- T-308 (docs) waits for all five behaviour tickets; T-309 (end to end) is last.

## Assigning work

- One ticket per agent or person. Give them the **Agent prompt** block from the ticket verbatim, plus access to the
  ticket file.
- Use a branch per ticket (`ticket/T-3xx-slug`) or a git worktree under `.claude/worktrees/`. Open a PR; never push
  to `main`.
- Do not merge two tickets into one PR.

## Shared rules (every ticket)

- Edit only the files under **Files owned**. If you need a change elsewhere, stop and report a blocker; do not edit
  around it.
- Follow the interface contract in your ticket exactly. If merged code differs, the code wins: adapt and note it.
- Never read, print or commit `.env`, `.qa-keys.json`, `.qa-ai-models.json` or secrets. Passwords, tokens, cookie
  values and header values never go into logs, plan files, reports or a test's expected output. Failure wording
  comes from `signInReasonText`; never build a message from page text.
- Use the terms from the root `CONTEXT.md` (Deterministic Spider, Role, Test Copy, Allowed Hosts, Check-up, Plan
  Item) and respect the `_Avoid_` lists in UI text.
- Run the commands in your ticket's **Test plan**. Run `pnpm build` after touching `packages/types` or an exported
  API (build order: types, then checkers/core, then runner).
- `.claude/work/DEFER_TESTS` does not exist today. If it appears, write tests but do not run them (a hook blocks
  it) — and say so in the PR instead of claiming a green run.
- `.qa-*`, `.tmp-*`, `.benchmark/`, `/public` are generated: do not edit.
- **Falsification is part of the work**: each fixing ticket says which revert must make its new test fail. A test
  that passes with the fix reverted is not evidence.

## Marking a ticket done

1. All acceptance boxes checked in the PR description with the evidence (command output or file:line).
2. The **Test plan** commands pass, and `pnpm build` passes.
3. The falsification step is in the PR (revert, fail, revert the revert).
4. A reviewer — or the `tester` agent, which never edits source — confirms the acceptance criteria independently.
5. Merge, then set the ticket's status in [`BOARD.md`](BOARD.md) and `tickets.json` to `done`.
6. Tell the owners of the tickets that depend on it (`BOARD.md`: who `dependsOn` you).

## Verifying a finding is closed

Each finding in `GAPS.md` carries the evidence that must stop holding. After wave 5, run the ten checks in
[`TRACEABILITY.md`](TRACEABILITY.md) §Closure checklist, tick the rows, and report anything that still holds — a
finding that survives comes back to [`BOARD.md`](BOARD.md) as a new ticket rather than being closed by hand.

## Not done on purpose

- **`docs/README.md` is not indexed with this plan.** It is one of the files the other session has uncommitted edits
  in, and nothing here depends on it. The plan owner adds the entry once that work has landed.
- **No ADR.** Every decision in [`PLAN.md`](PLAN.md) follows `docs/adr/0026-deterministic-sign-in-and-session-handling.md`
  (deterministic, no AI). If a fix turns out to need a new record (T-302's `loginReachable` choice is the only
  candidate), write one there rather than in this folder.
- **No source file was changed by this plan.** `git status` should show only this folder, plus whatever the other
  session already had in flight.

## If something is wrong with the plan

Report it instead of working around it. An inaccurate line number is normal (re-locate by function name). A
contradicting contract, two tickets claiming one file in a wave, or a missing dependency is a plan defect: stop and
tell the plan owner.
