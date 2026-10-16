# T-306 — A start address that answers 4xx is shown as a warning, not as fine

**Type** feature · **Size** S · **Wave** 1 · **Depends on** T-302 (the contract it carries) · **Gaps** LC-007 (Medium, runner + wizard half)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

## Gaps addressed

**LC-007 (Medium).** `packages/core/src/preflight.ts:176-183` returns `ok: true` for a 400-499 start address and sets
`startWarning: 'start-4xx'`. `packages/runner/src/server.ts:1701-1720` (`POST /api/runner/preflight`) replies
`{ reachable: true, statusCode: 404, … }` and does not forward the warning; the wizard reads only `reachable` /
`statusCode`. So a person can start a Check-up against a 404 and the crawl then records the start address as
`http-error` (`deterministic-spider.ts:678-690`). T-302 makes the warning a documented part of the core contract;
this ticket is the surface.

## Background

The wizard checks the address before starting a Check-up and shows the result inline (`NewCheckupScreen.tsx`, the
`#url-status` region and the block that reads the response). A 401/403 meaning “reachable” is deliberate (a site
that asks for a sign-in is a real site, `GAPS.md` N-002) — the wording must stay honest about that, and a 4xx that
is not 401/403 must read as “this address answered, but not with a page”.

## Scope

1. `POST /api/runner/preflight` forwards the warning (keep the existing response fields byte-compatible; **add** a
   field rather than changing one).
2. The wizard shows a non-blocking warning next to the address for a 4xx start address, in the existing fixed-wording
   style, and leaves 401/403 reading as reachable-but-sign-in. Starting the Check-up stays possible.
3. A runner test pins the response shape for 200, 404 and 401.

**Out of scope:** the reachability rule itself and `PreFlightResult` (T-302); the crawl's `http-error` row; the
`preflight` handler's position in the route chain (`docs/plan/checkup-session/` is rewriting dispatch — this ticket
only touches the handler body and never the `if (pathname …)` chain); any change to `docs/API.md` (T-308 owns it).

## Files owned

- `packages/runner/src/server.ts` (the `handlePreflight`-equivalent method only — locate by
  `POST /api/runner/preflight`; the method that calls `checkUrlReachable` at `:1701`)
- `packages/wizard/src/screens/NewCheckupScreen.tsx`
- `packages/wizard/src/api.ts`
- `packages/runner/tests/preflight-route.test.ts` (new)

## Files read-only

`packages/core/src/preflight.ts`, `packages/types/src/evidence-finding.ts`, `docs/API.md`,
`packages/runner/tests/wizard-endpoints.test.ts`, `packages/wizard/src/lib/coverage-text.ts`.

> `packages/wizard/src/api.ts` and `NewCheckupScreen.tsx` also carry another session's uncommitted edits, and
> `api.ts` is claimed by T-201 of the checkup-session plan (wizard type aliases). Check `git status` and coordinate
> before you touch either; if the other work is unmerged, still proceed — the changes are additive — but say so in
> the PR.

## Interface contract

- `POST /api/runner/preflight` response keeps `{ reachable, reason?, code?, statusCode?, suggestion?, testCopy?,
owner?, markedTestCopy?, searchChecks?, signIns? }` exactly as today and gains
  `startWarning?: 'start-4xx'` (the same literal the core uses).
- The wizard's check function in `api.ts` keeps its signature and returns the new field as an optional part of its
  result type; the wizard must not treat it as an error.
- `packages/wizard` imports single modules from `@qa/types/src/...` only — no Node-only import.

## Implementation notes

- In the runner, take `check.startWarning` straight from `checkUrlReachable` and pass it through; the two branches
  (`check.ok` / not) must both be able to carry it.
- In the wizard, put the warning in the existing status area next to the address, `role="status"` as the region
  already is, with wording like “This address answered with a 404. Nothing may be there to check.” — no sentence
  built from the response, and the jargon rule of `CONTEXT.md` applies (“App”, “Check-up”, never “crawler”).
- Keep the existing suggestion text for the unreachable vs server-error cases (`server.ts:1716-1722`) unchanged.

## Acceptance criteria

- [ ] A 404 start address answers `reachable: true` **and** `startWarning: 'start-4xx'`; a 200 answers
      `reachable: true` with no `startWarning`; a 401 answers `reachable: true`, no `startWarning` (assert all three
      in the new test).
- [ ] The wizard renders the warning for the 404 case and still allows starting the Check-up; a screenshot or the
      rendered-DOM assertion is in the PR.
- [ ] No existing field of the response changed (the assertions in `wizard-endpoints.test.ts` and
      `checkup-vs-api.test.ts` pass unchanged).
- [ ] **Evidence for LC-007 no longer holds:** `startWarning` has at least one consumer in `packages/runner` **and**
      one in `packages/wizard` (show both lines).

## Test plan

```bash
pnpm exec vitest run packages/runner/tests/preflight-route.test.ts
pnpm exec vitest run packages/runner/tests/wizard-endpoints.test.ts packages/runner/tests/runner-server.test.ts
pnpm --filter @qa/wizard build     # or pnpm build, which builds the wizard too
pnpm exec vitest run packages/wizard
```

## Definition of done

Acceptance boxes checked in the PR with evidence; the test plan green; the wizard builds (no Node-only import
leaked into the bundle — the build fails if one does); a reviewer (or the `tester` agent, which never edits source)
confirms the criteria independently; status set to `done` in [`../BOARD.md`](../BOARD.md) and `../tickets.json`.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-306-start-warning-shown.md and do it. You own the
POST /api/runner/preflight handler body in packages/runner/src/server.ts (locate by the route, do not touch the
if (pathname …) chain), packages/wizard/src/screens/NewCheckupScreen.tsx, packages/wizard/src/api.ts, and the new
test packages/runner/tests/preflight-route.test.ts. Forward the core's startWarning ('start-4xx') through the
preflight response as a new optional field (change no existing field) and show it in the wizard next to the address
as a non-blocking warning, while a 401/403 stays "reachable". Keep the wizard bundle free of Node-only imports and
use the CONTEXT.md terms in the wording. Check git status first: another session has uncommitted edits in the wizard
files. Run the test plan, report what passed and what failed.
```
