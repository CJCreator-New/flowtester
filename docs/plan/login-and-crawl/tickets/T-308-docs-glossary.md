# T-308 — Docs and glossary: sign-in, crawling, and what the reports mean

**Type** docs · **Size** S · **Wave** 4 · **Depends on** T-301, T-304, T-305, T-306, T-307 (they settle the behaviour being described) · **Gaps** LC-005, LC-006, LC-009 (documentation half)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

## Gaps addressed

Nothing here is undocumented _behaviour_; the gap is that the vocabulary and the contracts this plan changes have no
single place to read. Concretely:

- `CONTEXT.md` (282 lines) has no entry for a **sign-in wall**, a **skipped page**, or **route telemetry**, although
  `packages/types/src/route-telemetry.ts` is part of the Plan's vocabulary and its `RouteSkipReason` list
  (`page-limit`, `robots`, `sign-in`, `session-lost`, `off-site-redirect`, …) is what the person reads under a page
  that is missing from the Plan. There is also no entry for what “signed in” means in a result (LC-005).
- `docs/API.md` describes `POST /api/runner/preflight`; T-306 adds a field to the response (LC-007).
- `docs/ARCHITECTURE.md` (49 lines) does not say where sign-in and crawling sit, though this plan moves the boundary
  between them (one session-restore helper, T-305) and the robots gate (T-304).
- `docs/CONFIGURATION.md` documents the crawl switches; `QA_CRAWL_MAX_MINUTES`, `QA_DISCOVERY_MAX_MINUTES`,
  `QA_RELOGIN` and the robots/own-machine rule (`discovery-agent.ts:426-440`) should be findable together.
- The trailing-slash/case rule behind LC-009 (a route key is not a path) is the kind of thing the next reader needs
  written down once.

## Background

`docs/README.md` indexes everything, and `CONTEXT.md` is the domain glossary the code and UI text must follow. This
plan changes several contracts at once (T-301 path fidelity, T-302 “signed in means verified”, T-304 robots, T-306 a
new response field); one docs ticket keeps them consistent rather than five notes spread across PRs, and keeps
`_Avoid_` lists and the UI wording rules in one place.

## Scope

1. `CONTEXT.md`: add **Sign-in Wall**, **Skipped Page**, **Route Telemetry** (with the reason list, in the register's
   own words), and a line under the pre-flight/Role entry: a Role counts as signed in only when the sign-in ran and
   succeeded. Keep the existing style (`_Avoid_:` lines included) and do not renumber other terms.
2. `docs/ARCHITECTURE.md`: a short section with the sign-in → crawl → Plan flow (the diagram in
   [`../CONTEXT.md`](../CONTEXT.md) is a starting point), naming `PreFlightChecker`, the Deterministic Spider, the
   Discovery Agent, the session-restore helper and where robots is enforced.
3. `docs/CONFIGURATION.md`: `QA_CRAWL_MAX_MINUTES`, `QA_DISCOVERY_MAX_MINUTES`, `QA_RELOGIN`, `maxPages`,
   `maxPerShape` (25), `maxDepth` (8), `concurrency`, the robots/own-machine rule, and the fact that a route key is
   not a path.
4. `docs/API.md`: the `startWarning` field on `POST /api/runner/preflight` (T-306), and the note that a 4xx start
   address is reachable-with-a-warning while 401/403 means “asks for a sign-in”.
5. `CHANGELOG.md`: one entry per behaviour change from T-301, T-302, T-304, T-305, T-306 — written for the person
   using the tool (what they will now see), not for a reader of the diff.
6. `docs/TESTING.md`: the two fixture routes T-303 adds and which ticket's test uses each.

**Out of scope:** source code of any kind; `docs/plan/**` (the plan is its own record); regenerating
`docs/README.md`'s index unless a listed file moved; ADRs — the decisions here follow `docs/adr/0026` and need no new
one (say so in the PR if you disagree, rather than adding a record).

## Files owned

- `CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/CONFIGURATION.md`
- `docs/API.md`
- `CHANGELOG.md`
- `docs/TESTING.md`

## Files read-only

Everything in `packages/`, `fixtures/`, `docs/adr/0026-deterministic-sign-in-and-session-handling.md`,
`docs/README.md`, `docs/plan/login-and-crawl/GAPS.md`.

## Interface contract

- Glossary entries follow the existing `CONTEXT.md` shape: a bold term, a one-to-three sentence description, then
  `_Avoid_:` where peers exist.
- The `RouteSkipReason` list written into `CONTEXT.md` must match
  `packages/types/src/route-telemetry.ts` exactly — copy it, do not retype it from memory.
- `docs/API.md` keeps its existing route-table shape; the new field is added to the preflight entry only.
- No text may contain a username, password, token, cookie or a real site's data; examples use `example.com`.

## Implementation notes

- Read the five changed behaviours from the **code** at the committed state of T-301…T-307, not from this plan's
  descriptions — if they differ, the code wins and the PR says so.
- Word the CHANGELOG entries as a person would notice them: “Pages that ask for a sign-in are no longer confused with
  pages that show a password field”, “A start address that answers 404 is now flagged before the Check-up starts”.
- Keep the `_Avoid_` lists intact (`CONTEXT.md:16-17`: _Avoid_ “Discovery agent, AI crawler” for the Deterministic
  Spider; `:21`: _Avoid_ “AI crawler, test generator” for the Test Planner) — the crawl vocabulary is a known trap.

## Acceptance criteria

- [ ] `CONTEXT.md` has entries for Sign-in Wall, Skipped Page and Route Telemetry, and the role-signed-in rule; the
      skip-reason list matches `packages/types/src/route-telemetry.ts` **word for word**.
- [ ] `docs/ARCHITECTURE.md` names all five pieces from Scope 2 with their paths.
- [ ] `docs/CONFIGURATION.md` lists every switch from Scope 3, each with its default and its effect.
- [ ] `docs/API.md` documents `startWarning`; a reader can tell a 404 start address from a 401 one.
- [ ] `CHANGELOG.md` has one entry per change in T-301, T-302, T-304, T-305, T-306.
- [ ] `docs/TESTING.md` names the two new fixture routes and the tests that use them.
- [ ] `pnpm exec prettier --check "CONTEXT.md" "docs/*.md" "CHANGELOG.md"` exits 0.
- [ ] **Evidence for LC-005/LC-006/LC-009 no longer holds:** each is stated in the docs in the terms the code now
      uses (quote the new lines in the PR).

## Test plan

```bash
pnpm exec prettier --check CONTEXT.md docs/ARCHITECTURE.md docs/CONFIGURATION.md docs/API.md docs/TESTING.md CHANGELOG.md
grep -n "RouteSkipReason\|'session-lost'" packages/types/src/route-telemetry.ts   # compare with the glossary list
pnpm build    # proves nothing was broken by a stray edit
```

## Definition of done

Acceptance boxes checked in the PR with the file:line that proves each (a glossary entry quoted, the reason list
diffed against the type); prettier exit 0; no source file touched (`git status` in the PR); a reviewer (or the
`tester` agent, which never edits source) confirms the list matches the type. Status set to `done` in
[`../BOARD.md`](../BOARD.md) and `../tickets.json`. This is the last ticket before the end-to-end one, so say in the
PR what a reader should now find where.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-308-docs-glossary.md and do it. You own CONTEXT.md,
docs/ARCHITECTURE.md, docs/CONFIGURATION.md, docs/API.md, CHANGELOG.md and docs/TESTING.md only — no source file.
Document what T-301, T-302, T-304, T-305 and T-306 actually changed, read from the code, not from the plan: the
glossary terms (Sign-in Wall, Skipped Page, Route Telemetry with the reason list copied from
packages/types/src/route-telemetry.ts, and "a Role counts as signed in only when the sign-in ran and succeeded"),
the sign-in → crawl → Plan flow with paths, the crawl switches and the robots/own-machine rule, the new
startWarning field on POST /api/runner/preflight, one CHANGELOG entry per behaviour change in the user's words, and
the two new fixture routes in docs/TESTING.md. Keep the existing style and the _Avoid_ lists, use example.com in
examples, and put nothing secret in any file. Run prettier --check on the files you touched and report anything you
could not verify.
```
