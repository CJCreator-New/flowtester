# Handoff

Planning is finished; nothing in the codebase has been changed. This file tells whoever executes the tickets how to work.

## Reading order

1. `CONTEXT.md` (what the system is, where login and crawl live).
2. `GAPS.md` (what is wrong, with evidence). Skim the top 5 and the High section.
3. `PLAN.md` (decisions, risks, open questions, what is deferred).
4. `BOARD.md` (waves and dependencies) and `tickets.json` (machine-readable).
5. Your own ticket in `tickets/`. It is self-contained.

## Choosing a wave

- Run waves in order: 0, then 1, and so on. A ticket may start only when every ticket in its `dependsOn` is `done` (merged and verified).
- Everything inside one wave can run in parallel: same-wave tickets own disjoint files.
- Two files have sequential owners (`deterministic-spider.ts`: T-111 then T-112; `server.ts`: T-115 then T-116). Do not start the later ticket before the earlier one has merged. T-113 waits for T-112 (it passes the budgets T-112 adds); T-109 waits for T-108 (the `needsSignIn` roles).
- Wave 0 has four independent starting points: T-101, T-102, T-103, T-106. Open question 1 in `PLAN.md` (Playwright version) must be answered before T-106 merges.

## Assigning work

- One ticket per agent or person. Give them the "Agent prompt" block from the ticket verbatim, plus access to the ticket file.
- Use a branch per ticket (`ticket/T-1xx-slug`) or a git worktree under `.claude/worktrees/`. Open a PR; never push to `main`.
- Do not merge two tickets into one PR.

## Shared rules (every ticket)

- Edit only the files under "Files owned". If you need a change elsewhere, stop and report a blocker; do not edit around it.
- Follow the interface contract in your ticket exactly. If the merged code of an earlier ticket differs from its contract, the code wins: update your usage and note the difference in your PR.
- Never read, print or commit `.env`, `.qa-keys.json`, `.qa-ai-models.json` or secrets. Header values, passwords and cookies never go into logs, plan files, reports or tests' expected output.
- Use the glossary terms from the root `CONTEXT.md`; respect the "_Avoid_" lists in UI text.
- Run the commands in your ticket's "Test plan". Run `pnpm build` after touching `packages/types` or exported APIs (build order: types, then checkers/core, then runner).
- If `.claude/work/DEFER_TESTS` exists, write tests but do not run them (a hook blocks it).
- `.qa-*`, `.tmp-*`, `.benchmark/`, `/public` are generated: do not edit.

## Marking a ticket done

1. All acceptance boxes in the ticket are checked in the PR description with the evidence (command output or file:line).
2. The "Test plan" commands pass; `pnpm build` passes.
3. A reviewer (or the `tester` agent, which never edits source) confirms the acceptance criteria independently.
4. Merge, then change the ticket's Status in `BOARD.md` (and `tickets.json` `status`) to `done`.
5. Tell the owners of tickets that depend on it.

## Verifying a gap is closed

Each gap in `GAPS.md` has a "Evidence" line (a file:line, or a search that proved absence). A gap is closed when the evidence no longer holds: re-run that search or open that line. Each ticket's acceptance criteria include this check ("the evidence for G-### no longer holds"). After Wave 6, re-run the verification list in `TRACEABILITY.md` (Gap to Ticket) and mark the gap closed there.

## If something is wrong with the plan

Report it instead of working around it: an inaccurate line number is normal (the audit read code at commit `bc14ab3`), so re-locate by function name. A contradicting contract, an overlapping file, or a missing dependency is a plan defect: stop and tell the plan owner.
