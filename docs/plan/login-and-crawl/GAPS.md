# Gaps: sign-in and crawling

The register for the login-and-crawl audit of 2026-10-15 (`8d41601`, working tree). Ten findings, each with one
disposition: **ticketed** (id in the last column) or **not a gap** (§below). Ids are `LC-###` — not `G-###` —
because `docs/plan/GAPS.md` (the completed T-101..T-119 plan) already owns that namespace, and this plan sits
beside it. Ticket → finding mapping both ways: [`TRACEABILITY.md`](TRACEABILITY.md).

`Confidence` is **verified** (read the code and, where possible, ran it) or **suspected** (unfalsified, with the
check to run named). Every finding names the evidence that must stop holding for it to count as closed.

## Executive summary

Ten findings, none of which is a crash: two are **high** — the crawler does not honour `robots.txt` at all
(LC-001), and ordinary pages are misread as sign-in walls and can abort a Role's crawl (LC-002). Four are
**medium**, four **low**. Everything sits in the sign-in and crawling path; nothing here touches checkers, scoring,
reports or the Plan Review UI.

In plain language, the five that matter most:

1. **We ignore `robots.txt`.** The policy is fetched and passed in, then asked about a full URL instead of a path,
   so no `Disallow` rule ever matches. This only happens on a site we do not own — exactly where it is meant to
   apply.
2. **Pages with a password field are treated as sign-in pages.** A `/settings` page with a “change password” form, or
   any page reached through a redirect, is dropped from the crawl, listed to the person as “asks for a sign-in”,
   and three in a row abort the rest of that Role's crawl.
3. **A session that is recovered mid-crawl leaves a hole.** The recovered route is never retried and never reaches
   the route table, so the coverage numbers and the Plan quietly disagree.
4. **Recovery restores cookies only.** A Role whose site keeps its token in `localStorage` — supported at sign-in —
   can never recover, and is reported as signed out.
5. **The pre-flight result says things it has not checked.** With no browser to sign in with, every Role is reported
   as signed in; `loginReachable` is hard-coded `true`; and a start address that answers 404 is reported
   `reachable: true` with the warning thrown away.

## Heatmap

| Dimension                       | high   | medium | low    |
| ------------------------------- | ------ | ------ | ------ |
| 1 Intent vs reality             | LC-002 | —      | LC-006 |
| 3 Test gaps                     | —      | LC-010 | —      |
| 4 Error handling and resilience | —      | LC-004 | —      |
| 5 Security                      | LC-001 | —      | —      |
| 6 Data and schema               | —      | LC-009 | —      |
| 7 API and contract consistency  | —      | LC-005 | —      |
| 8 Observability                 | —      | LC-003 | —      |
| 9 Performance                   | —      | —      | LC-008 |
| 14 UX                           | —      | LC-007 | —      |

Dimension 2 (unfinished work), 10-13 and 15 are clean for this path: no TODO/FIXME/HACK marker exists anywhere in
`preflight.ts`, `discovery/`, `orchestrator.ts`, `same-site.ts`, `navigate.ts` or `credentials.ts`; dependencies are
the pinned workspace ones; CI runs the suites this plan touches.

## Register

### LC-001 — the crawler never honours `robots.txt`

- **Dimension** 5 Security / compliance · **Severity** high — we fetch and crawl paths a site asked crawlers to leave
  alone, on a site we do not own.
- **Evidence** `packages/core/src/discovery/deterministic-spider.ts:494` calls
  `options.robots.isAllowed(requested)` — `requested` is the queued **absolute URL**. Every other caller passes a
  path: `packages/core/src/competitive/safe-crawler.ts:168`, `:213`, `:302`,
  `packages/core/src/discovery/docs-fetch.ts:213`. `RobotsPolicy.isAllowed` (`competitive/robots.ts:60`) anchors the
  pattern at `^`, so a `/`-rooted rule cannot match an `https://…` string.
- **Verified** ran the built policy: with `User-agent: * / Disallow: /admin / Disallow: /*? / Allow: /admin/public`,
  `isAllowed('/admin')` → `false` but `isAllowed('https://example.com/admin')` → `true`; the same for `/admin?x=1`
  and `/admin/public`. So the policy as used by the spider is a no-op.
- **Why it bites** the policy is only passed when the host is **not** private
  (`packages/core/src/discovery/discovery-agent.ts:435`), i.e. exactly when `robots.txt` is the thing that matters.
  The `skippedByRobots` note (`discovery-agent.ts:235-240`) is therefore never produced in practice, and
  `deterministic-spider.ts:496` is answered by an empty policy.
- **Impact** a Check-up of a live site fetches disallowed paths; the person is never told. The route table can list
  pages the site owner excluded.
- **Remedy** pass `pathname + search` of the requested route (the value the other three call sites use), and add the
  end-to-end test the path lacks.
- **Effort** S · **Ticket** T-304 (fixture route: T-303)

### LC-002 — a page with a password field is treated as a sign-in wall, and three in a row abort the Role's crawl

- **Dimension** 1 Intent vs reality · **Severity** high — the crawler is defined as finding every reachable page
  (`CONTEXT.md` “Deterministic Spider”); this makes pages vanish and can end a Role's crawl early.
- **Evidence** `deterministic-spider.ts:583`
  `const isWall = (hasSignInForm && (landed.pathname !== requestedPath || isLoginPath)) || navRes.status === 401;`
  - `hasSignInForm` is `looksLikeLogin(page, knownLoginPaths)` (`navigate.ts:96-126`): true when **any visible
    password input** is on the page, or the path is a known login path.
  - `requestedPath` is not a path: it is the frontier's route key, assigned in the worker at
    `deterministic-spider.ts:1009` (`requestedPath = norm.key`). `normalizeRoute` (`frontier.ts:44-58`)
    **lower-cases** it, **strips a trailing slash**, and keeps only `routeQueryParams`.
  - `landed.pathname` is the raw pathname after redirects (`deterministic-spider.ts:559`).
  - **Verified** (built `frontier.js`): `normalizeRoute('/settings/')` → `"/settings"` vs pathname `"/settings/"`
    (mismatch); `normalizeRoute('/Settings')` → `"/settings"` vs `"/Settings"` (mismatch); `'/pricing'` matches.
- **Impact** a page that shows a password field for a legitimate reason — `/account/security`, `/settings`, a
  two-factor enrolment page — and is reached through any redirect, a trailing slash or different casing, is
  classified as a wall: it is **not recorded at all** (no page, no forms, no links, no telemetry row as `recorded`),
  it is pushed to `signInWalls` (:586), and the person is told “these pages ask for a sign-in that no role could get
  past” (`discovery-agent.ts:224-226`). For a signed-in Role, three in a row set `sessionLost = true` (:589-605),
  which stops every worker and marks the rest of the queue `session-lost` (:1063-1072).
- **Remedy** compare like with like (normalize both sides, or keep the requested path alongside the key) and make
  “a password field” a wall only when the page really is the sign-in page: the URL is the login path or its
  redirect target, the form has no other fields, or the page holds nothing else the crawl has recorded. Keep the
  reason it was decided (`hasSignInForm` is stored on the page item, `:847`).
- **Effort** M · **Ticket** T-301 (fixture route: T-303)

### LC-003 — a route recovered mid-crawl is dropped without a trace

- **Dimension** 8 Observability · **Severity** medium — the route table and the coverage numbers stop matching what
  was crawled.
- **Evidence** `deterministic-spider.ts:589-605`: when `consecutiveWalls >= stopAfterWalls` and the re-login
  succeeds, the handler `return`s (`:596`) before the telemetry row for this route is built (`:606-625`) and without
  re-enqueuing the requested page. `signInWalls.push(requestedPath)` (`:586`) has already happened.
- **Impact** the page that triggered recovery appears in the “not reached” note but has **no** `RouteTelemetry` row
  and is never retried, so `routes.length` is less than the number of attempts and the Plan's map has a silent hole.
- **Remedy** after a successful recovery, record the route and put it back at the front of the queue once, so the
  recovery is visible and the page is still crawled.
- **Effort** S · **Ticket** T-305

### LC-004 — mid-crawl recovery restores cookies only, and leaves the old ones in place

- **Dimension** 4 Error handling and resilience · **Severity** medium — recovery cannot work for a class of sign-ins
  the product otherwise supports.
- **Evidence** `discovery-agent.ts:519-536`: `await roleContext.addCookies(newState.cookies)` — only cookies are
  copied from the fresh session. `signIn` itself supports `localStorageEntries` (`preflight.ts:264-278`) and the
  session it saves holds `origins[].localStorage`, so a site that keeps its token in `localStorage` is supported at
  sign-in and **cannot** recover mid-crawl; the fresh state can also put cookies of other hosts into the context.
  `orchestrator.ts:737-748` is a second, independent copy of the same idea.
- **Impact** on such a site the crawl declares `sessionLost`, the Role's remaining pages are skipped, and the person
  is told the sign-in stopped working — for a session that could have been restored.
- **Remedy** restore the **whole** saved session (cookies and `localStorage`), on a context that has been cleared
  first; one helper used by both call sites, and the same helper used at sign-in.
- **Effort** M · **Ticket** T-305

### LC-005 — the pre-flight result reports every Role as signed in when no browser was used

- **Dimension** 7 API and contract consistency · **Severity** medium — a success is reported in the same shape a
  verified success has.
- **Evidence** `packages/core/src/preflight.ts:711-712`:
  `roleResults[role.role] = true; roleDiagnostics[role.role] = { ok: true, attempts: 0 };` — reached whenever
  `options.browserManager` or `options.authDir` is absent (`:660`). Nothing was verified; `attempts: 0` is the only
  hint. Consumers: `orchestrator.ts:466-470` (`if (!preflight.ok) throw`) and the runner routes
  (`server.ts:1701`, `:4764`) — the only guard is `discovery-agent.ts:357-364` (`requireSignIn`), which checks
  `roleStorageStates`, not this flag.
- **Impact** `roleAuthResults` and `roleDiagnostics` are the shape the Plan and the report read to say “tested as
  `admin`”; with no browser they say every Role is in. A caller that omits the browser (any future CI path) gets a
  silent false positive.
- **Remedy** fail closed: an unverified Role must not be reported as signed in (`ok: false` with a reason such as
  `unreachable`, or a distinct `verified: false` marker that consumers must handle). Keep `attempts` truthful.
- **Effort** S · **Ticket** T-302

### LC-006 — `loginReachable` is hard-coded `true` and read by nobody

- **Dimension** 1 Intent vs reality · **Severity** low — a dead field that asserts an unchecked fact.
- **Evidence** `preflight.ts:721` sets `loginReachable: true` on every success and `:617` `false` on the
  reachability failure; nothing fetches the sign-in page during pre-flight. The field exists only in
  `packages/types/src/evidence-finding.ts:176`; `grep -rn loginReachable packages --include=*.ts --include=*.tsx`
  finds no reader outside `preflight.ts` and the type.
- **Impact** a future consumer would report “the sign-in page is reachable” for a site whose `/login` 404s.
- **Remedy** either check the login path (with the same reachability helper, `checkUrlReachable` on
  `new URL(loginPath, target)`) and set the flag from that result, or delete the field from the type. Pick one in
  the ticket; do not leave it lying.
- **Effort** S · **Ticket** T-302

### LC-007 — a start address that answers 4xx is reported as reachable, and the warning is thrown away

- **Dimension** 14 UX · **Severity** medium — the person starts a Check-up against an error page believing it works.
- **Evidence** `preflight.ts:176-177`: `isOk = res.status < 400 || res.status === 401 || res.status === 403` and
  `startWarning = res.status >= 400 && res.status < 500 ? 'start-4xx' : undefined` — so a 404 or 410 returns
  `ok: true`. `server.ts:1701-1720` answers `POST /api/runner/preflight` with `{ reachable: true, statusCode: 404 }`
  and does not forward `startWarning`. **No consumer exists**: `grep -rn "startWarning\|start-4xx" packages/*/src`
  finds only the producer (`preflight.ts:35`, `:127`, `:621`, `:727`) and no test mentions either string.
- **Impact** the wizard shows the address as fine, the Check-up is started, and the crawl then records the start
  address as `http-error` (`deterministic-spider.ts:678-690`) — the person pays for a run against a 404.
- **Remedy** carry the warning to the wizard and show it next to the address, in the existing fixed-wording style;
  keep 401/403 as reachable (a site that asks for a sign-in is a real site) but say so.
- **Effort** S · **Ticket** T-302 (core) + T-306 (runner + wizard)

### LC-008 — the page limit is checked after the page's whole inventory has been built and saved

- **Dimension** 9 Performance · **Severity** low — wasted work and a stray file per dropped page.
- **Evidence** `deterministic-spider.ts:862-868` (`if (pages.length >= this.maxPages) … skipReason: 'page-limit'`)
  sits **after** `readPageForms` (:818), `readLayoutFingerprint` (:829) and the JPEG screenshot (:830-843), all of
  which are thrown away; the screenshot file itself stays in `plan-pages/`.
- **Impact** on a large site the last pages over the limit each pay for elements, forms, a layout fingerprint and a
  screenshot — and leave files behind that belong to no recorded page. The same check is already made in the worker
  loop (`:1027`) and the drain (`:1073`), so the late check is a race guard, not the main gate.
- **Remedy** check the limit before the inventory (and before the screenshot) and record the skip immediately;
  keep the late check as the race guard with the same skip wording.
- **Effort** S · **Ticket** T-307

### LC-009 — the paths shown to the person are internal route keys, not the page's path

- **Dimension** 6 Data and schema · **Severity** low — the reported path can name a page that does not exist.
- **Evidence** `deterministic-spider.ts:586` (`signInWalls.push(requestedPath)`), `:496`, `:541`, `:565`, `:610`,
  `:642`, `:684`, `:866`, `:979` (`skipped.push({ urlPath: requestedPath, … })`) all use the **route key**:
  lower-cased, trailing slash removed, query filtered (`frontier.ts:44-58`). The drain paths use
  `redactUrl(norm.path)` (`:1063`, `:1076`) — same lower-casing, so both disagree with the real path. Contrast
  `RouteTelemetry.requestedPath`, which is redacted but not normalized (`navigate.ts:249`).
- **Impact** `signInWalls` and `skipped[]` feed the Plan's notes and the coverage list
  (`discovery-agent.ts:199-240`, `:283`), so a case-sensitive site shows `/settings` for `/Settings`: a path the
  person cannot open. It also makes the two lists hard to join with the route table by path.
- **Remedy** keep the requested path as it was asked for (redacted with `redactUrl`) alongside the route key, and
  push the former into `SkippedPageInfo.urlPath` / `signInWalls`; the key stays what the frontier dedupes on.
- **Effort** S · **Ticket** T-301

### LC-010 — the behaviours behind LC-001…LC-009 have no test, and two have no test at all

- **Dimension** 3 Test gaps · **Severity** medium — this is why the above survived a well-covered area.
- **Evidence** (searches over `packages/core/tests` and `packages/runner/tests`)
  - `isAllowed` appears only in `packages/core/tests/robots.test.ts` — a unit test of the policy with **paths**;
    no test hands a `RobotsPolicy` to `DeterministicSpider` (`grep -rn robots packages/core/tests/*spider*.test.ts
…` → empty). LC-001 is uncovered.
  - `startWarning` and `start-4xx`: **no test file mentions either** (LC-007, LC-006).
  - `localStorage`: no login or crawl test mentions it, although `signIn` supports it and LC-004 turns on it.
  - `sessionLost` appears once (`spider-reliability.test.ts`); nothing covers the recovered-route path (LC-003).
  - No fixture page has a password field outside a sign-in page, and the fixture's `robots.txt` is `Allow: /`
    (`fixtures/test-app/server.js:46-51`), so LC-002 and LC-001 cannot be tested as the code stands.
- **Impact** the four findings above can regress unnoticed, and a fixed line looks like any other line.
- **Remedy** each fixing ticket adds its own regression test, and one end-to-end ticket crawls the fixture App with
  a disallowed path, a password-field page and a session that dies mid-crawl, asserting the Plan's notes, the route
  table and the absence of the wrong wording.
- **Effort** M · **Ticket** T-303 (fixture), T-309 (end to end), plus one test in each fixing ticket

## Not a gap

- **N-001 — the crawl sends no robots policy and adds no delay on a private host.**
  `discovery-agent.ts:430-440` (`isPrivateHost`). Deliberate: the person's own machine is the Test Copy case, and
  pausing would slow every local run for no benefit.
- **N-002 — a 401/403 counts as reachable.** `preflight.ts:176`. Deliberate: a site that asks for a sign-in is a
  real site, and the sign-in step is what follows. Only the _warning_ for 4xx goes unused (LC-007).
- **N-003 — Roles sign in one after another, each in its own context.** `preflight.ts:660-700`. Accepted: two
  attempts per Role with a real browser is seconds, and signing in several Roles at once would multiply memory and
  the chance of tripping a site's own sign-in throttling. Revisit only with a measurement.
- **N-004 — `QA_RELOGIN=0` switches the mid-run re-login off.** `orchestrator.ts:719`. Deliberate escape hatch,
  documented in `docs/CONFIGURATION.md`.
- **N-005 — the fixture App is a Test Copy and is crawled with `exploreClicks` and the CRUD probe.**
  `spider-links-and-traps.test.ts`, `spider-crud.test.ts`. Deliberate and guarded (ADR 0025).

## Deferred

- **D-001 — sitemap seeding may not carry the crawl's HTTP identity.** `deterministic-spider.ts:397`, `:416` use
  `context.request.get(...)` for `/robots.txt` and the sitemap, while page loads go through the context with
  `extraHTTPHeaders` (`customHeaders`, `X-Tunnel-Authorization`). Whether `BrowserContext.request` sends those
  headers is **not established** here (suspected): if it does not, seeding silently fails on a header-protected or
  tunnelled site — the `catch` at `:432` swallows it and the crawl just continues. Impact is small (seeding is an
  optimisation; the crawl then relies on links) and the check is a two-minute experiment: start the fixture behind a
  required header, crawl with `customHeaders`, and see whether the sitemap's extra page is found. Left for the
  follow-up plan rather than guessed at here.
- **D-002 — the second sign-in loop in the orchestrator** (`orchestrator.ts:706-770`) is a third implementation of
  “a session stopped working” (after the spider's recovery and the pre-flight re-check). LC-004 removes the
  duplication in the restore step only; folding the three into one Role Session module is Phase 2 of the
  architecture review, registered as D-002 in `docs/plan/checkup-session/AUDIT.md` and not re-planned here.

## Coverage statement

- **Analysed** the whole sign-in path (`preflight.ts`, `credentials.ts`, `packages/types/src/signin.ts`,
  `evidence-finding.ts`, the runner's pre-flight and sign-in routes and `planForDisk`, the wizard's sign-in UI and
  `import-roles.ts`) and the whole crawling path (`deterministic-spider.ts`, `frontier.ts`, `navigate.ts`,
  `same-site.ts`, `overlay.ts`, `element-inventory.ts`, `interactive-states.ts`, `crud-facts.ts`,
  `discovery-agent.ts`, `competitive/robots.ts`, `orchestrator.ts`'s bounce and re-login branch,
  `packages/types/src/route-telemetry.ts`), plus the 23 `packages/core/tests` and 17 `packages/runner/tests` files
  that touch them.
- **Read at working-tree state**, not only committed: the other session's uncommitted edits to
  `deterministic-spider.ts`, `discovery-agent.ts`, `preflight.ts` and `packages/types/src/evidence-finding.ts` are
  what the findings above are about (they are the files the fixes land in). Findings were confirmed against the
  code as it is on disk now.
- **Not analysed**: `site-type.ts`, `test-planner.ts`, `plan/journeys.ts` and the wizard screens also carry
  uncommitted work — out of this scope (they are plan-building, not login or crawling) and left to their own
  session; `packages/checkers` (no sign-in or crawl code); the AI planner and reports beyond the fields this path
  writes into them; `visual-capture.ts` and the narrow-screen pass (`discovery-agent.ts:577-600`) beyond the
  storage-state choice it makes; anything requiring a live third-party site.
- **Not run**: `pnpm build` and the full suites (planning only). The two verifications above ran the **built**
  `packages/core/dist` output of `frontier.ts` and `robots.ts`, which are unmodified in git, so the compiled code
  and the source agree for both.
