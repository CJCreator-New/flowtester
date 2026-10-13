# T-102 Fixture routes that reproduce the auth and crawl failure modes

- **Type:** test (fixture) · **Size:** M · **Wave:** 0 · **Depends on:** none
- **Gaps addressed:** G-012 (and the fixture half of G-028)

## Gaps addressed (evidence copied in)
- G-012: `fixtures/test-app/server.js:209-214` redirects only an anonymous visitor on `/account*`; the session cookie is a static role name with no expiry or invalidation (`:59,:84`). The only slow routes are `/reports` (2 s server delay, `:479-480`) and `/slow/N` (`:413-417`). There is no client-rendered shell, hash route, onClick-only target, overlay, query/path trap, redirect chain, 5xx link, slow login form, or sign-in counter (`POST /signin` at `:84-91` has no counter, unlike `/lab/stats`).
- G-028 (fixture half): there is no way to assert how many sign-ins happened or which headers a request carried.

## Background
Every reliability fix in this plan needs a deterministic page that fails the old way. The built-in fixture app (`pnpm fixture`, default port 3050) is what tests run against. This ticket adds `/lab/*` routes only; existing routes and their output must not change (an existing test checks that robots/sitemap/llms.txt do not mention port 3050). Project conventions (copied): pnpm monorepo, TypeScript/JS, Node 22, vitest; Chromium needed for browser tests. Never print secrets; work on a branch; never push to `main`. If `.claude/work/DEFER_TESTS` exists, write tests but do not run them.

## Scope
Add the routes in the contract to `fixtures/test-app/server.js`, keep the file's current style (one request handler, plain HTML strings), and add a no-browser HTTP test.

## Out of scope
Changing existing routes; adding a framework; testing the crawler itself (other tickets).

## Files owned
- `fixtures/test-app/server.js`
- `packages/core/tests/fixture-failure-modes.test.ts` (new)

## Files read-only
`packages/core/src/**`, existing `packages/*/tests/**`, the file that tests robots/sitemap on the fixture (`git ls-files | grep fixture-app`).

## Interface contract (route names are relied on by T-111, T-112, T-114, T-117)
| Route | Behaviour |
|---|---|
| `GET /lab/spa-late` | HTML shell `<div id="root"></div>`; after ~1500 ms client JS inserts `<a href="/lab/spa-late/a">` and `/lab/spa-late/b`. Without JS: no links. `/lab/spa-late/a` and `/b` are plain pages. |
| `GET /lab/spa-login` | Login form appears ~1200 ms after load (client-rendered). `POST /lab/spa-login` with correct fixture credentials sets `fixture_session`; same credentials as `/signin`. |
| `GET /lab/expiring` and `/lab/expiring/*` | Needs a valid `fixture_session`. After the session has made N protected requests (default 3, `?n=` on `POST /lab/expiring/start`) it is invalidated: pages answer **302 to `/signin`**. |
| `GET /lab/expiring-spa` | Always 200; ~300 ms after load client JS runs `location.replace('/signin')` when the session is invalid. |
| `POST /lab/expire-session` | Invalidates all sessions immediately. |
| `GET /lab/trap/<n>` | Page `n` links to `/lab/trap/<n+1>` forever. `GET /lab/calendar?month=YYYY-MM` links to previous and next month forever. |
| `GET /lab/hash` | Links `#/one`, `#/two`; client router swaps the heading. |
| `GET /lab/onclick` | `<div role="link" data-href="/lab/onclick/target" onclick="location.href=...">` and `<button onclick="location.href='/lab/onclick/target2'">`; no `<a href>` to those targets. |
| `GET /lab/overlay` | Fixed full-page cookie banner over the content with an "Accept" button (`id="accept"`); links underneath. Accepting removes it. |
| `GET /lab/redirect-chain` | 302 to `/lab/redirect-chain/2`, 302 to `/lab/redirect-chain/final` (200). |
| `GET /lab/always-500`, `GET /lab/forbidden` | 500 and 403 with an HTML body and a title. Linked from `/lab/index` so a crawl meets them. |
| `GET /lab/index` | Links to every route above (the crawl entry point for tests). |
| `GET /lab/headers` | JSON `{ "x-qa-bypass-token": "<present|absent>", "user-agent": "<value>" , "cookie": "<present|absent>" }` (never echoes the token value). Records seen-header counts per path into `/lab/stats`. |
| `GET /lab/stats` (extend) | Add `signIns` (count of successful `POST /signin`) and `headerHits` (count of requests carrying `X-QA-Bypass-Token`, by path). |
| `POST /lab/reset` | Resets counters and sessions. |

## Implementation notes
- Follow the existing dispatch pattern in `server.js` (see `/slow/N` at `:413-425` and `/lab/stats`). Keep the `server` export untouched.
- The client JS for the SPA routes must be inline `<script>`; no external files.
- Do not add any of these routes to the existing sitemap or `llms.txt`.
- Use fixed fixture credentials that already exist in `server.js`; do not invent new secrets.

## Acceptance criteria
- [x] `curl`-level test (in `fixture-failure-modes.test.ts`, plain `http`, no browser): `/lab/redirect-chain` follows 302 twice to a 200; `/lab/always-500` is 500; `/lab/forbidden` is 403; `/lab/trap/5` links to `/lab/trap/6`; `/lab/spa-late` has no `<a href` in the raw HTML; `/lab/headers` never contains the token value.
- [x] After `POST /lab/expiring/start?n=2` and a sign-in, the third request to `/lab/expiring` returns 302 with `Location` containing `/signin`.
- [x] `signIns` in `/lab/stats` increments once per successful `POST /signin`, resets on `POST /lab/reset`.
- [x] The evidence for G-012 no longer holds: each failure mode in the list has a route (grep `'/lab/spa-late'`, `'/lab/trap/'`, `'/lab/overlay'`, `'/lab/redirect-chain'`, `'/lab/expiring'` in `server.js` all match).
- [x] The existing fixture tests still pass (`pnpm exec vitest run -t fixture`).

## Test plan
```
pnpm exec vitest run packages/core/tests/fixture-failure-modes.test.ts
pnpm exec vitest run packages/core/tests/e2e-discovery.test.ts packages/core/tests/signin.test.ts
node -e "import('./fixtures/test-app/server.js').then(m=>{m.server.listen(3099,()=>{console.log('ok');m.server.close()})})"
```

## Definition of done
Boxes checked; no existing route output changed; only owned files edited. Stay within files owned; report a blocker instead of editing outside them.

## Agent prompt
```
You are executing ticket T-102 in the QA Flow Tester repo. Read docs/plan/tickets/T-102-fixture-failure-modes.md and implement it. Edit only fixtures/test-app/server.js and the new packages/core/tests/fixture-failure-modes.test.ts. Add the /lab/* routes exactly as in the contract table (names matter: other tickets depend on them). Do not change existing routes, the sitemap, robots or llms.txt output. Use plain inline HTML/JS, no new dependencies, no new secrets. Run the commands in "Test plan"; if .claude/work/DEFER_TESTS exists, write the test but do not run it. Work on a branch, not main. If blocked, stop and report.
```
