# T-206 Route table, and the plan routes as its first rows

- **Type:** refactor · **Size:** M · **Wave:** 2 · **Depends on:** T-204, T-203

## Evidence (architecture audit, 2026-10-15)

- `packages/runner/src/server.ts:960-1385` `start()`: 425 lines of `if (pathname …) { … return; }`, 47
  conditionals, each ending in `return`.
- The plan rows to move: `server.ts:1123-1185` (`GET`/`PATCH /api/runner/plan`, `plan/approve`, `plan/interpret`,
  `plan/markdown`, `plan/export`, `plan/replan`, `plan/add-page`, `waiting-plans`, `plan/add-sign-in`,
  `plan/include-host`).
- The gates before the chain: access token / cookie (`:923`), origin check (`:1011`), beta closed routes (`:1028`),
  beta scoping (`:1035`), `/studio` redirect (`:1039`), then the run routes, then
  `serveUi` and the fallback 404 (`:1327`).
- `packages/runner/src/server.ts` is 5587 lines with 107 methods; adding a route means editing that chain.

## Background

Half of this ticket is mechanical and deliberately so: the routing becomes data (a table of
`{ method, path, handle }`), the chain becomes a loop, and the plan rows are the first real entries — delegating to
the existing methods for exactly one wave, so this diff cannot change behaviour. T-207 then moves the handler
bodies out of the class.

ADR [0027](../../../adr/0027-checkup-session-module-and-route-table.md) fixes two constraints: keep `node:http`
(no framework, no runtime route discovery), and keep the gate order — access, origin, beta, closed routes — before
matching, because those are security behaviour and not routing.

Conventions (copied): `start()` resolves with the URL and rejects on a listen error; `this.sendJson(res, status,
body)` writes JSON with the existing headers; errors are caught once at the end of the request handler and
redacted with `this.redactedMessage(err)` (`:200`, `:804`). Every route today ends with `return`, and the fallback
answers `{"error":"Not found"}` (`:1330`) — T-203's test pins that.

## Scope

- New `packages/runner/src/routes/route.ts`: the `Route` type, the matcher (exact paths and prefixes), and a
  helper that answers the fallback 404 in one place.
- New `packages/runner/src/routes/plan.ts`: the eleven plan rows, each delegating to the existing `RunnerServer`
  method for now (`{ method: 'GET', path: '/api/runner/plan', handle: (c) => c.server.handleGetPlan(c.req, c.res) }`
  shape — adapt to the context type below).
- New `packages/runner/src/routes/index.ts`: `planRoutes` and the table assembly (`allRoutes`), the single place a
  route is registered from now on.
- `server.ts`: the plan branches (`:1123-1185`) are deleted; the chain keeps its other branches; the table is
  matched in their place, in the same position, and `/api/runner/waiting-plans` keeps working for any method
  (it is matched without a method check today).
- New `packages/runner/tests/route-table.test.ts`: unit tests for the matcher, with no server.

## Out of scope

Moving the other 37 branches (runs, sites, AI, OpenRouter, baselines, benchmarks, schedules, spec overrides,
evidence, report, status, run, abort, stream) — a follow-up plan; they stay in the chain. Also out: moving handler
bodies out of the class (T-207); changing any gate, header, status code, body or log line; touching
`serveUi` or the `/studio` redirect.

## Files owned

- `packages/runner/src/routes/route.ts` (new)
- `packages/runner/src/routes/plan.ts` (new)
- `packages/runner/src/routes/index.ts` (new)
- `packages/runner/src/server.ts`
- `packages/runner/tests/route-table.test.ts` (new)

## Files read-only

`packages/runner/tests/route-inventory.test.ts` (T-203's net — it must pass unchanged),
`packages/runner/src/session/checkup-session.ts`, `docs/API.md`,
`packages/runner/tests/wizard-endpoints.test.ts`, `packages/runner/tests/test-cap-endpoints.test.ts`.

## Interface contract

```ts
// packages/runner/src/routes/route.ts
import type http from 'http';

/** What a handler is given. Grows in the follow-up plan; kept minimal on purpose. */
export interface RouteContext {
  readonly server: RunnerServer; // for the plan rows in this wave; T-207 replaces this with the session
  readonly req: http.IncomingMessage;
  readonly res: http.ServerResponse;
  readonly url: URL;
}

export interface Route {
  /** 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS'. */
  method: string;
  /** Exact path, or an array of exact paths (aliases such as abort/stop). */
  path: string | string[];
  /** Prefix rows match `/api/runs/…`-style paths; the handler gets the full URL. */
  prefix?: boolean;
  /** Some rows accept any method (today's `/api/runner/waiting-plans`). */
  anyMethod?: boolean;
  handle: (context: RouteContext) => Promise<void> | void;
}

/** The first row that matches wins. Exact rows beat prefix rows at the same path. */
export function matchRoute(routes: readonly Route[], method: string, pathname: string): Route | undefined;

// packages/runner/src/routes/index.ts
export const allRoutes: readonly Route[];
```

In `server.ts`, the eleven plan branches are replaced by one call at the same point in the chain:

```ts
const route = matchRoute(allRoutes, req.method ?? 'GET', pathname);
if (route) return void (await route.handle({ server: this, req, res, url }));
```

## Implementation notes

- Keep the _order_ of gates: everything before `:1123` stays where it is, including the `/studio` redirect and the
  beta checks. The table is consulted only where the plan branches were; the next ticket widens that.
- The `/api/runner/waiting-plans` branch has no method check today (`:1170`). Model it with `anyMethod: true`
  rather than inventing a method, so T-203's inventory test stays honest.
- Handlers are awaited and their errors flow into the existing catch, so `redactedMessage` still redacts; do not
  add a second error path.
- `handlePlanMarkdown(res)` and `handlePlanExport(res)` take only a response today: keep them as they are and let
  the row pass `{ res }` through the context (do not change their signatures to fit the table — the table fits
  them).
- Do not reorder the rows relative to the chain: `plan/approve` before `plan/interpret`, etc. Two rows can never
  match the same (method, path) pair; `route-table.test.ts` asserts that.
- `matchRoute` must be pure and cheap: no regex construction per request beyond the table's own.
- Keep the plan section's comments with the rows.

## Acceptance criteria

- [ ] `pnpm build` passes.
- [ ] `pnpm exec vitest run packages/runner` is green, including `route-inventory.test.ts` (T-203) **unchanged** and
      the plan-route suites (`wizard-endpoints`, `test-cap-endpoints`, `sources-endpoints`,
      `sources-reload`, `reapproval-roles`, `remembered-signins`, `run-inputs-roles`).
- [ ] `grep -c "if (pathname" packages/runner/src/server.ts` is 36 (down from 47), and the deleted ones are exactly
      the eleven plan branches listed above.
- [ ] `route-table.test.ts` (no server) covers: an exact match, a prefix match, `anyMethod`, that the first match
      wins, that no two rows share a (method, path) pair, and that an unknown path matches nothing (so the chain's
      fallback 404 answers).
- [ ] `pnpm exec vitest run packages/runner/tests/session-state.test.ts` still green.
- [ ] No status code, body, header, log line or gate order changed: the PR shows the diff of `start()` is deletions
      plus the four lines above.

## Test plan

```
pnpm build
pnpm exec vitest run packages/runner/tests/route-table.test.ts packages/runner/tests/route-inventory.test.ts
pnpm exec vitest run packages/runner
pnpm test:url-first
```

## Definition of done

All boxes checked; the five owned files are the only changes; T-203's inventory test is untouched and green. Stay
within the files owned; report a blocker instead of editing outside them.

## Agent prompt

```
You are executing ticket T-206 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Node 22, vitest). Read
docs/plan/checkup-session/tickets/T-206-route-table-and-plan-routes.md and docs/adr/0027-... fully, then implement
exactly the ticket. Create packages/runner/src/routes/route.ts (Route type, matchRoute, one fallback 404 helper),
packages/runner/src/routes/plan.ts (the eleven plan rows from packages/runner/src/server.ts:1123-1185, delegating to
the existing methods), and packages/runner/src/routes/index.ts (the table). In server.ts delete exactly those ten
if (pathname ...) branches and match the table at the same position, after the access/origin/beta/studio gates,
keeping node:http, the gate order and every status code, body and log line unchanged. Add
packages/runner/tests/route-table.test.ts covering the matcher with no server. Do not touch the other 37 branches,
do not edit any existing test (in particular packages/runner/tests/route-inventory.test.ts must pass unchanged),
and do not move handler bodies out of the class. Run the commands in "Test plan". If .claude/work/DEFER_TESTS
exists, write the test but do not run tests. Work on a branch, not main.
```
