# T-303 — Fixture App: the pages the login-and-crawl tests need

**Type** test · **Size** S · **Wave** 0 · **Depends on** none · **Gaps** LC-010 (Medium)

Part of: [`../GAPS.md`](../GAPS.md) · board: [`../BOARD.md`](../BOARD.md) · plan: [`../PLAN.md`](../PLAN.md)

## Gaps addressed

**LC-010 (Medium).** Two findings cannot be tested against the built-in App as it stands: its `robots.txt` is
`User-agent: * / Allow: /` (`fixtures/test-app/server.js:46-51`), so nothing is ever “disallowed”; and no page has a
password field outside a sign-in page, so “a password field must not mean a sign-in page” (LC-002) has no page to
prove itself on. The crawler tests are also all against throwaway in-test servers, so nothing exercises the crawler
against the App the product ships to test against.

## Background

`fixtures/test-app` is the built-in App the Check-up is run against during development and in the smoke run
(`pnpm fixture`, `fixtures/test-app/server.js`, 1048 lines, plain `node:http`, no dependencies). It already has a
real signed-in area (`/account*`, session cookie), planted failure modes and a `robots.txt`. Pages added here are
used by T-304, T-301's e2e sibling and T-309; keep them small, deterministic and obvious in intent.

## Scope

1. `robots.txt` gains a disallowed area: `Disallow: /private/` (keep the existing `Allow: /`, the `GPTBot` group and
   the `Sitemap:` line).
2. Two pages under `/private/` (a normal page and one more so a crawl of the disallowed area would be visible), linked
   from the home page so a crawl that ignores `robots.txt` reaches them.
3. A page that is **not** a sign-in page but shows a visible password field, inside the signed-in area:
   `/account/security`, with a “change password” form (current password, new password, save button) and a normal nav
   — the page a wall classifier must keep.
4. A redirect that makes its path differ only by case and by trailing slash: `/Settings` → `302` to `/settings/`,
   where `/settings/` serves an ordinary page (no password field).
5. Both new areas linked from the home page nav and from `/account`, so the crawl finds them by following links.

**Out of scope:** the crawler, the sign-in code and every test file (T-301, T-304, T-309 own those); new
dependencies; a build step for the fixture (it stays a plain `node` server); the fixture's existing planted failure
modes; anything under `/api/`.

## Files owned

- `fixtures/test-app/server.js`

## Files read-only

`fixtures/test-app/docs/**`, `package.json` scripts (`pnpm fixture`), `packages/core/tests/fixture-*.test.ts`,
`packages/runner/tests/fixture-app.test.ts`, `packages/runner/tests/smoke*`.

## Interface contract

- Existing routes, status codes and bodies are unchanged — `fixture-app.test.ts` and the smoke run must pass as they
  are.
- New routes: `GET /private/` (200), `GET /private/reports` (200), `GET /account/security` (200, session required as
  for the other `/account` pages), `GET /Settings` (302 → `/settings/`), `GET /settings/` (200).
- `GET /robots.txt` keeps its content type and gains exactly one `Disallow: /private/` line.
- `/account/security` contains one visible `input[type="password"]` and at least one other form field, so a test can
  tell “a page with a password field” from “the sign-in page” without page text.

## Implementation notes

- Follow the file's own helpers: `html(title, body)` and the `SIGN_IN_FORM` const, and its existing `origin` variable
  for absolute links; there is no router — routes are `if (url.pathname === …)` blocks.
- `/account` pages already redirect to `/signin` when there is no session (`server.js:540-547`); do the same for
  `/account/security` so the signed-in requirement stays honest.
- Put the case/slash redirect next to the other redirects (see `/signout`, `server.js:534-539`) and keep the `302`
  shape and the `Location` header style.
- Do not add a password field to any page a visitor reaches: LC-002 is about pages in the signed-in area, and a
  visitor-facing password field would change the crawl's wall count on every existing test.

## Acceptance criteria

- [ ] `GET /robots.txt` contains `Disallow: /private/` and still contains the `Sitemap:` line.
- [ ] `GET /private/` and `GET /private/reports` answer 200 and are linked from the home page.
- [ ] `GET /Settings` answers `302` with `Location: /settings/`; `GET /settings/` answers 200 with no password field.
- [ ] `GET /account/security` answers 200 with a session and redirects to `/signin` without one, and its markup holds
      exactly one visible `input[type="password"]` plus other fields.
- [ ] The existing fixture tests pass unchanged: `pnpm exec vitest run packages/runner/tests/fixture-app.test.ts`
      and `packages/core/tests/fixture-failure-modes.test.ts`.
- [ ] A short note in the PR lists each new route with its status, so T-301/T-304/T-309 can cite it.

## Test plan

```bash
node fixtures/test-app/server.js &     # or: pnpm fixture
curl -s -o /dev/null -w '%{http_code} ' localhost:3002/robots.txt localhost:3002/private/ localhost:3002/private/reports localhost:3002/settings/ localhost:3002/Settings
pnpm exec vitest run packages/runner/tests/fixture-app.test.ts packages/core/tests/fixture-failure-modes.test.ts
pnpm exec vitest run packages/core/tests/e2e-discovery.test.ts   # the fixture as the crawl target
```

## Definition of done

Acceptance boxes checked in the PR with the `curl` output; the fixture tests green; a reviewer (or the `tester`
agent, which never edits source) confirms the markup claims by fetching the pages. Status set to `done` in
[`../BOARD.md`](../BOARD.md) and `../tickets.json`; then tell the owners of T-304 and T-309 that the routes exist.

## Agent prompt

```
Read docs/plan/login-and-crawl/tickets/T-303-fixture-pages.md and do it. You own only fixtures/test-app/server.js.
Add, in the file's existing style (plain node:http, if (url.pathname === …) blocks, the html() helper): Disallow:
/private/ in robots.txt; /private/ and /private/reports linked from the home page; /account/security inside the
signed-in area with a change-password form (one visible password field plus other fields) and the same no-session
redirect as the other /account pages; /Settings redirecting 302 to /settings/, which serves an ordinary page. Do not
change any existing route or add dependencies, and do not add a password field to a page a visitor reaches. Verify
with the curl commands in the test plan and run the existing fixture tests. Report the new routes and their statuses
in the PR.
```
