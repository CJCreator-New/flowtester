# T-203 Route inventory test: pin every documented route before the rewrite

- **Type:** test · **Size:** M · **Wave:** 0 · **Depends on:** none

## Evidence (architecture audit, 2026-10-15)

- `packages/runner/src/server.ts:973-1330` the dispatch chain inside `start()`: 47 `if (pathname …) { … return; }`
  conditionals, the plan branches at `1123-1185`.
- `packages/runner/src/server.ts:1327-1330` what an unmatched path answers:
  `res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' }));`
- `docs/API.md` documents the routes area by area (Check-up lifecycle, Plan Review, Reports and history, Visual
  baselines, Benchmarks and schedules, AI settings) and ends with "Adding or changing a route".

## Background

T-206 replaces that chain with a route table. The one thing a table rewrite breaks silently is reachability: a
route that stops being matched, or a method that stops being matched, starts answering the generic 404 and no
existing test notices unless it happens to call that exact route with the right state. This ticket writes that
net **before** the rewrite, against the server as it is today, so T-206 can prove it changed nothing.

Conventions (copied): tests live in `packages/runner/tests/`, vitest, `describe`/`it`, a real `RunnerServer` is
booted in `beforeAll` and stopped in `afterAll` (`packages/runner/tests/runner-server.test.ts:18-36` is the
pattern), output goes to a `.tmp-*` folder under `process.cwd()` and is removed afterwards. Hard-coded ports have
already caused one flaky test (commit `c10f5e8`), so take a free port by binding a throwaway server on port 0 and
reading `address().port` (`packages/core/tests/browser-context.test.ts:39-40` does this), and pick the port inside
the test rather than at module load.

## Scope

One new test file: boot one `RunnerServer` (temp data dir, temp output dir, no AI key, no fixture site needed) and
assert **every** (method, path) pair below is matched — that is, the answer is not the generic
`{"error":"Not found"}` from `server.ts:1330`.

Curate the list from the chain and cross-check it against `docs/API.md`. It must cover **all 47 conditionals** at
`server.ts:973-1330`; the pair count comes out slightly higher because some conditionals serve aliases
(`abort`/`stop`, `GET`/`DELETE /api/runs/<id>`). Record the real number of pairs in a comment beside the list, and
map each conditional to its pair(s) there so a reader can see nothing was dropped:

- `GET /healthz`
- `GET /api/runner/stream` (only assert the status line: 200 and `text/event-stream`; do not consume the stream —
  cancel the body)
- `GET /api/runner/status`, `POST /api/runner/run`, `POST /api/runner/abort`, `POST /api/runner/stop`
- `GET /api/report`, `GET /api/report/download/<file>`, `GET /api/runs`, `GET /api/runs/<id>`,
  `DELETE /api/runs/<id>`, `GET /api/runs/<id>/download/<file>`, `POST /api/runs/<id>/triage`,
  `POST /api/runs/<id>/accept-judgement`
- `GET /api/runner/plan`, `PATCH /api/runner/plan`, `POST /api/runner/plan/approve`,
  `POST /api/runner/plan/interpret`, `GET /api/runner/plan/markdown`, `GET /api/runner/plan/export`,
  `POST /api/runner/plan/replan`, `POST /api/runner/plan/add-page`, `POST /api/runner/plan/include-host`,
  `POST /api/runner/plan/add-sign-in`, `GET /api/runner/waiting-plans`
- `GET /api/sites`, `GET /api/sites/<host>`, `POST /api/sites/<host>`, `PUT /api/sites/<host>`,
  `DELETE /api/sites/<host>`
- `GET /api/settings/defaults`, `POST /api/settings/defaults`
- `POST /api/runner/ai-estimate`, `POST /api/runner/preflight`, `POST /api/runner/context/docx`,
  `POST /api/runner/domain-proof`
- `POST /api/runner/ai/finish`, `GET /api/ai/settings`, `POST /api/ai/settings`, `GET /api/ai/key`,
  `POST /api/ai/key`, `GET /api/ai/usage`, `POST /api/ai/test-model`, `POST /api/ai/validate`,
  `GET /api/ai/openrouter/free-models`
- `GET /api/runner/baselines`, `POST /api/runner/baselines/accept`, `DELETE /api/runner/baselines/<id>`,
  `GET /api/baselines/<path>`
- `POST /api/runner/benchmark`, `GET /api/runner/benchmarks`, `GET /api/runner/benchmark/<id>`,
  `DELETE /api/runner/benchmark/<id>`
- `GET /api/runner/schedules`, `POST /api/runner/schedules`, `POST /api/runner/schedules/<id>/toggle`,
  `DELETE /api/runner/schedules/<id>`
- `POST /api/runner/spec-override`, `GET /api/runner/spec-overrides`
- `GET /api/evidence/<path>`

Also assert the negative control, so the check cannot pass by accident: a path that is not in the table
(`GET /api/does-not-exist`) **does** answer exactly `{"error":"Not found"}` with 404.

## Out of scope

Asserting reply bodies, status codes or behaviour of those routes (their own tests do that), changing
`server.ts`, `docs/API.md`, or any other test file. The list must not be made to pass by adding routes.

## Files owned

- `packages/runner/tests/route-inventory.test.ts` (new)

## Files read-only

`packages/runner/src/**` (read to build the list), `docs/API.md`, `packages/runner/tests/runner-server.test.ts`
(the boot pattern to copy).

## Interface contract

```ts
// packages/runner/tests/route-inventory.test.ts
const ROUTES: Array<{ method: string; path: string }> = [
  /* every pair above, one object each; the comment maps them back to the 47 conditionals */
  { method: 'GET', path: '/api/runner/status' },
  /* … */
];
const FALLBACK = JSON.stringify({ error: 'Not found' }); // server.ts:1330 — an unmatched path
const request = (r: { method: string; path: string }) =>
  fetch(`${base}${r.path}`, {
    method: r.method,
    headers: { 'Content-Type': 'application/json' },
    body: needsBody(r) ? '{}' : undefined,
    signal: AbortSignal.timeout(5000),
  });
```

Per case: `const body = await res.text(); expect(body).not.toBe(FALLBACK);` — a route that is matched answers
something else, whatever its status (`400`, `401`, `403`, `404` with a specific body, `409`, `422`, `429` are all
fine and expected without state).

## Implementation notes

- Paths with `<id>` / `<host>` / `<file>` placeholders use a fixed fake value (`run-does-not-exist`,
  `example.invalid`, `report.md`). The point is that the route is matched, not that the resource exists.
- `POST`/`PATCH`/`PUT` requests send `{}`; the handlers answer 400/404/422, which is what is wanted.
- `GET /api/runner/stream` and `GET /healthz` are the two special cases: stream asserts `200` +
  `content-type: text/event-stream` then `res.body?.cancel()`; `healthz` asserts `200`.
- Do not let one failure hide the rest: use `it.each(ROUTES)` so the report names the pair that failed.
- Cancel every response body (`await res.text()` already does) so the server can close in `afterAll`.
- Keep the file free of assertions about plan state: it must pass with a fresh, empty runner.

## Acceptance criteria

- [ ] The new test file boots one `RunnerServer` on a free port (port 0 technique), temp `.tmp-route-inventory*`
      dirs, and stops it in `afterAll` with both folders removed.
- [ ] Every one of the 47 conditionals at `server.ts:973-1330` is covered by at least one pair in the list, mapped
      in the comment beside it, and the file states how many pairs it has.
- [ ] Every pair passes today: `pnpm exec vitest run packages/runner/tests/route-inventory.test.ts` is green.
- [ ] The negative control fails the right way: replacing one entry with `/api/does-not-exist` makes the test fail
      (state this check in the PR, then revert it).
- [ ] No port number is hard-coded, and no other file changed.

## Test plan

```
pnpm exec vitest run packages/runner/tests/route-inventory.test.ts
pnpm exec vitest run packages/runner
```

## Definition of done

The new file is the only change; the suite passes; the pair count is in the file. Stay within the file owned;
report a blocker instead of editing outside it.

## Agent prompt

```
You are executing ticket T-203 in the QA Flow Tester repo (pnpm monorepo, TypeScript, Node 22, vitest). Read
docs/plan/checkup-session/tickets/T-203-route-inventory-test.md fully and implement exactly it. Create exactly one
file, packages/runner/tests/route-inventory.test.ts, which boots one RunnerServer on a free port obtained by
binding port 0 (the pattern in packages/core/tests/browser-context.test.ts:39-40), uses temp .tmp-route-inventory
and .tmp-route-inventory-data folders, and asserts with it.each that each of the 47 documented (method, path) pairs
is matched — i.e. its body is not exactly the generic 404 fallback {"error":"Not found"} from
packages/runner/src/server.ts:1330 — plus the negative control that /api/does-not-exist IS the fallback. Do not
edit any other file, do not change the server, and do not assert reply bodies or specific status codes (400, 401,
403, 404-with-another-body, 409, 422 and 429 all count as matched). Cancel response bodies so the server stops
cleanly. Run the commands in "Test plan". If .claude/work/DEFER_TESTS exists, write the test but do not run it.
Work on a branch, not main.
```
