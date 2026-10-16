# T-210 Docs and glossary: the session, the routes, the new way to add a route

- **Type:** docs · **Size:** S · **Wave:** 6 · **Depends on:** T-209

## Evidence (architecture audit, 2026-10-15)

- `docs/API.md:126-129` "Adding or changing a route" says: "Add it in `server.ts` next to its group … Add a test in
  `packages/runner/tests/` … Add the client call in `packages/wizard/src/api.ts` … Update this page." After T-206/T-207
  a route is a row in `packages/runner/src/routes/`, so this section is wrong.
- `docs/ARCHITECTURE.md` — the package table describes the runner as "the server (`server.ts`) that exposes the
  engine over HTTP + server-side events"; "Life of a check-up" step 6 says `core/orchestrator.ts` executes each
  Test, with no mention of who owns the run state.
- `CONTEXT.md` has no term for the module that owns one Check-up's state and operations (**Check-up Session**).
- `docs/CONFIGURATION.md` may document `QA_CHECKUP_PORT`, which T-209 stops using.

## Background

The repo's rule is that when a doc and the code disagree, the code wins and the doc is fixed in the same pull
request. This plan changed the runner's shape in seven tickets; this ticket makes the docs describe it, and adds the
glossary term so the next person (or agent) uses the same name.

Conventions (copied): `CONTEXT.md` is the domain glossary — terms are followed by a definition and an "_Avoid_:"
line for the words not to use. `docs/README.md` indexes everything and names the latest ADR.
`docs/ARCHITECTURE.md` is a developer's map of the code, with the reasons in `docs/adr/`.

## Scope

- `CONTEXT.md`: add **Check-up Session** after **Check-up**, with a definition that matches ADR 0027 and an
  _Avoid_ line (`Run manager, session object, runner state`).
- `docs/ARCHITECTURE.md`: the `@qa/runner` row of the package table (server, `routes/`, `session/`); step 6 of
  "Life of a check-up" (the session owns the run and the Plan under review; the checkers and the orchestrator are
  unchanged); "Boundaries worth protecting" gets the rule from ADR 0027: the session owns state and operations,
  never policy (access tokens, origins, beta limits and host policy stay in the transport).
- `docs/API.md`: rewrite "Adding or changing a route" as: a row in `packages/runner/src/routes/index.ts` (or the
  area's module), a handler function taking the session, the gate order (access, origin, beta, closed routes) before
  matching, the wizard client call, this page, and the route inventory test. State honestly which areas are tabled
  and which are still in the chain (the plan routes are tabled; the rest is the follow-up plan).
- `docs/CONFIGURATION.md`: `QA_CHECKUP_PORT` is ignored now (T-209); mark it as unused-and-kept, or remove it
  according to the owner's answer to PLAN.md open question 4.
- `CHANGELOG.md`: one entry under the unreleased heading.
- `docs/README.md`: index `docs/plan/checkup-session/` beside the other plan documents.

## Out of scope

`docs/adr/0027-...` (written and approved before this plan starts), `docs/TESTING.md`, `CONTRIBUTING.md`, the
`docs/plan/tickets/` set of the previous plan, and any UI text (the "_Avoid_" lists matter there, and no UI text
changed in this plan).

## Files owned

- `CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/CONFIGURATION.md`
- `docs/README.md`
- `CHANGELOG.md`

## Files read-only

`docs/adr/0027-checkup-session-module-and-route-table.md`, `docs/plan/checkup-session/**`,
`packages/runner/src/session/**`, `packages/runner/src/routes/**`, `packages/runner/src/server.ts`,
`packages/runner/src/checkup.ts`.

## Interface contract

Documentation only; no code interface. The names must match the code exactly: `CheckupSession`,
`createCheckupSession`, `PlanStore`, `ReportStore`, `RunSlot`, `RunSecrets`, `RunEvents`, `CheckupRun`,
`resolveAuthorization`, `routes/route.ts` (`Route`, `matchRoute`), `routes/index.ts` (`allRoutes`), and the
`@qa/types/src/checkup-api.ts` types (`RunStartBody`, `PlanPatchBody`, `RunnerStatusReply`, `ApprovalReply`).

## Implementation notes

- Read the merged code, not this plan: if a ticket landed with a different name, the code wins. Write down the real
  names and say in the PR where they differ from ADR 0027.
- Keep `CONTEXT.md`'s voice: one sentence of definition, then a short paragraph, then `_Avoid_: …`. Use the term
  **Check-up Session** only for the module that owns one Check-up's state and operations; the _Check-up_ is still
  what the person runs.
- `docs/API.md` must not claim a route is tabled when it is not: list the plan routes as the ones in the table and
  say the other areas are still in the `start()` chain until the follow-up plan.
- In `docs/ARCHITECTURE.md`, do not restate ADR 0027 — link it.
- Keep the CHANGELOG entry short and factual (structure only, no behaviour change), and respect the existing
  heading style.

## Acceptance criteria

- [ ] `CONTEXT.md` has a **Check-up Session** entry with an _Avoid_ line, and the term is used the same way in
      `docs/ARCHITECTURE.md`.
- [ ] `docs/API.md` "Adding or changing a route" names `routes/index.ts` and a handler function, mentions the gate
      order and the inventory test, and no longer says "Add it in `server.ts` next to its group".
- [ ] `docs/API.md` correctly separates the tabled plan routes from the areas still in the chain.
- [ ] `docs/ARCHITECTURE.md` describes the runner as the server + `routes/` + `session/`, and links ADR 0027.
- [ ] `QA_CHECKUP_PORT` is documented as unused (or removed), and nothing else in `docs/CONFIGURATION.md` changed.
- [ ] `CHANGELOG.md` and `docs/README.md` updated.
- [ ] Every name written in these docs exists in the code: the PR lists the `grep` or file for each one.
- [ ] `pnpm exec prettier --check .` passes (docs are formatted; this is part of the repo's `format:check`).

## Test plan

```
pnpm exec prettier --check .
pnpm build
```

## Definition of done

All boxes checked; the six owned files are the only changes; every documented name exists in the merged code. Stay
within the files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-210 in the QA Flow Tester repo (pnpm monorepo, TypeScript). Read
docs/plan/checkup-session/tickets/T-210-docs-and-glossary.md, docs/adr/0027-... and the merged code under
packages/runner/src (session/, routes/, server.ts, checkup.ts), then update exactly the six owned docs:
CONTEXT.md (add the term Check-up Session with an _Avoid_ line), docs/ARCHITECTURE.md (runner package row, Life of
a check-up step 6, boundaries, link ADR 0027), docs/API.md (rewrite "Adding or changing a route" for the route
table and gate order, and say which areas are tabled and which are still in the chain), docs/CONFIGURATION.md
(QA_CHECKUP_PORT is unused), docs/README.md (index the new plan) and CHANGELOG.md (one short entry). Documentation
only: do not change code. Use the real merged names, not the plan's, and say so in the PR where they differ. Run
the commands in "Test plan" (prettier --check must pass). Work on a branch, not main.
```
