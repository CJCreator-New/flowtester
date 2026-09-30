# Implementation Plan: Single server and complete AI plan

Agreed in a grilling session on 2026-09-29. It covers two pieces of work:

1. **Single server.** The runner, the Wizard and QA Flow Studio run as one local process on one port.
2. **Complete AI plan.** The AI writes the whole plan: every page, navigation, journey and check. The plan
   review shows all of it, and the plan is exactly what runs.

The decisions are recorded in [ADR 0008](docs/adr/0008-single-local-server.md) and
[ADR 0009](docs/adr/0009-ai-plans-every-plan-item.md), which supersedes
[ADR 0001](docs/adr/0001-hybrid-ai-discovery.md). The terms used here (Plan, Plan Item, Navigation Check,
Layout Group, Sample Page, Fixed-Rule Fallback, AI Request Budget) are defined in [CONTEXT.md](CONTEXT.md).

## Status (as of 2026-09-30)

| Phase | What it delivers | Status |
|---|---|---|
| A. Crawler fixes | Real sites plan more than one page | Done (2026-09-30) |
| B. Single server | One command, one port, one URL | Done (2026-09-30) |
| C. Complete AI plan | A complete plan written by the AI, shown in full, exactly what runs | Done (2026-09-30) |

Build order is A, then B, then C. Phase B's migrated wizard e2e test becomes the harness that Phase C extends.

**Verified 2026-09-30.** Every file this plan names exists, `pnpm -r run build` succeeds, and a serial run of
the whole suite (`vitest run --no-file-parallelism`) passed all 58 files and 335 tests. Docs are in place:
ADR 0008 and 0009, ADR 0001 marked superseded, the CONTEXT.md terms, and the README quick start. No stale
references to ports 3000, 3002 or 5173 remain outside old worktrees. Not re-run in this check: the Docker
image build (recorded as checked on 2026-09-30) and the real-site acceptance runs, which need the user's
OpenRouter key.

**Resolved: the two failing fixture tests.** `core/tests/e2e-orchestrator.test.ts` and
`core/tests/e2e-discovery.test.ts` failed because the fixture's invoice page (`/invoices/INV-101`) wasn't a
clean page. It had no meta description, no `<h1>` (its heading was an `<h2>`) and no OpenGraph tags. The
orchestrator fails a test point on any real finding, whatever its severity, so even the Suggestion-level
OpenGraph finding was enough. The fix was in the fixture, in `fixtures/test-app/server.js`: a meta
description, an `<h1>` and the three OpenGraph tags. No test expectation changed. Nothing else depended on the
old heading or on that page's findings.

**Quality note from the acceptance runs.** The plans are complete and the fallbacks are labeled, but on the
free model much of the planning fell back to fixed rules: all journeys on all three sites, and 45 of 49
Navigation Checks on mghealthtech.com. This meets "anything left to fixed rules clearly labeled", but a
stronger model or a key with credits would show how good the AI-written plan really is.

## Why

This is what the tool did before this plan, as found on 2026-09-29:

- **Every real site tested so far planned a single page.**
  - mghealthtech.com redirects to `www.mghealthtech.com`, and the crawler kept only links whose host
    exactly matched the typed address, so it dropped every link.
  - dev.mysleepreport.com's five one-page runs couldn't be reproduced. Replaying the runner's discovery
    against it on 2026-09-30 found its pages both before and after the Phase A fix. The React app draws all
    its links before the HTML finishes loading. Those runs probably used an older build, since the runner
    keeps old code until restarted, or an earlier version of the site. The Phase C acceptance run checks it
    again.
  - arocord.com really is one page: its menu links all go to www.mghealthtech.com.
- **The crawler stopped at 25 pages and recorded no links between pages.** Navigation didn't exist in the
  plan data.
- **The AI was asked for 3 to 5 journeys in one prompt.** On dev.mysleepreport.com it produced three
  identical "open `/` and wait" journeys.
- **The review showed only part of what ran.**
  - The page sweep (a visit to every page that tries its safe buttons), the six graded checks and the
    three screen sizes all ran, but none of them were shown.
  - "Apply & Update Plan with Docs" only saved the text.
  - Approval quietly applied safe answers and skipped journeys that needed help.
- **Running the tool took three processes on three ports:** the runner (3001), the Wizard (3002) and
  Studio (3000 or 5173). The runner's address was baked into the Wizard at build time.

## Decisions: single server

Decided with the user:

- **Scope:** one process runs the runner API, the Wizard and Studio. The Hub (Postgres and MinIO) stays a
  separate optional service. The CLI Dashboard stays CLI-only.
- **Deployment:** each person runs it on their own machine. The single run slot, the server-side AI key
  and loopback-only CORS stay as they are.
- **Launch:** `pnpm start` builds anything that's missing and checks for Playwright's browser, with a
  clear message if it's absent. It then starts the server and opens the browser. A separate
  `pnpm bootstrap` does the full first-time install and rebuild, and you run it again after a `git pull`.
  This was agreed as `pnpm setup`, but `pnpm setup` is a built-in pnpm command that edits your shell
  profile, so a project script can't use that name.
- **Layout:** the Wizard is at `/` and Studio is at `/studio`, with a link each way. They stay two apps.
- **Code home:** a small static-serving module inside `@qa/runner`. It handles the SPA fallback and guards
  against path traversal.
- **Hub link:** when `HUB_API_URL` is set, the runner forwards `/api/v1/*` to it. When it isn't set, the
  runner returns a clean "Hub not connected" answer and Studio shows an empty state.
- **Verification:**
  - vitest tests for the serving and the proxy.
  - A scripted smoke run.
  - The existing `wizard-e2e.test.ts`, migrated to the single server, with a short Studio check added.

Defaults (accepted):

- **Port:** 3001, the runner's current port, so the CLI, Docker and docs change least. Ports 3000, 3002
  and 5173 go away for users.
- **Wizard API base:** changes from a baked-in `VITE_RUNNER_URL=http://localhost:3001` to same-origin.
  That removes the Docker build-arg problem and the cross-origin dependency.
- **Docker:** the runner and wizard services merge into one service and one image. The wizard's nginx
  container, `nginx.conf` and Dockerfile are deleted.
- **Contributor mode:** `dev:wizard` and `dev:web` (Vite with hot reload) stay for people editing the UIs.
  They're no longer needed to run the app.
- **Hardening:** the server binds to localhost by default and rejects requests whose Host header isn't a
  loopback name. This blocks DNS-rebinding reads of reports and evidence. Docker binds `0.0.0.0` as it
  does today.
- **Docs:** the README and its architecture diagram are updated, and ADR 0008 records the decision.

## Decisions: complete AI plan

Decided with the user:

1. **The plan is exactly what runs.** Every page visit, Navigation Check, journey, check, screen size and
   role is in the plan. The runner runs the approved plan and nothing else. Anything that won't run is
   listed with its reason.
2. **Pages.**
   - The crawler keeps going until nothing new turns up, with a cap of 200 addresses that can be changed.
   - Every page is listed.
   - Pages built from the same layout form a Layout Group. Three Sample Pages from each group are planned
     and tested, and the rest show as covered by the sample. Any page can be promoted to be tested on
     its own.
   - Unique pages are always tested.
3. **Where the site ends.** The site is the host the start address lands on after redirects, plus its
   `www` twin. Links to other hosts are listed as leaving the site and only checked for being broken,
   with one request each. The person can tick a listed host to crawl it too.
4. **Navigation.**
   - The crawler records which page links to which, including script-driven buttons.
   - Each unique link is planned once: shared header and footer menus once for the whole site, and
     in-page links on their own page.
   - A Navigation Check clicks the link as a person would. It passes when the right page opens and works,
     meaning no error page, 404 or blank screen.
   - Every page shows its click path from home, and pages that no link reaches are flagged.
5. **Who does what.** The crawler gathers the facts and the AI writes every Plan Item from them. Code
   checks the AI's work: every page and link must have an item, every selector must be real, and
   sensitive actions stay blocked. Gaps go back to the AI to fix.
6. **Without AI.** A working AI key is required to start a wizard scan. Items the AI still can't plan (it
   hit a rate limit, or its output was unusable even after repair) use the Fixed-Rule Fallback. These
   items are labeled in the plan and can be re-planned with one click.
7. **AI Request Budget.**
   - Requests are batched by Layout Group, plus one for the shared menus and one for journeys. That's
     about 8 to 12 requests for a 30-page site.
   - Before planning, the runner reads how many free requests the key has left today and shows "needs
     about N, you have M left today".
   - It paces requests under 20 a minute and retries when rate-limited.
   - Items past the budget use the Fixed-Rule Fallback.
8. **Waiting.** The scanning screen shows live progress with numbers, a time estimate and a Cancel
   button. The review opens once the plan is complete.
9. **Review screen.**
   - A "Full plan" document tab comes first. In order, it shows:
     - a summary
     - pages by Layout Group, with each page's click path and what's checked there
     - navigation
     - journeys
     - checks, with their screen sizes and roles
     - what won't run, and why
   - The map is the second tab and draws the real links between pages.
   - The plan can be downloaded as Markdown.
10. **Editing.**
    - Every Plan Item can be toggled on or off.
    - Pages can be added by address.
    - A test can be added by describing it.
    - The AI can re-plan one item, or the whole plan, from instructions or new specs. "Apply & update plan
      with docs" really re-plans.
    - There is no raw step editor.
11. **Approval.** Approval is never blocked. A summary next to the button spells out what will run and
    every default applied, each linked to its items. Defaults include safe answers, fallback items, and
    journeys that need a test copy.
12. **Re-runs.** The site is crawled again and compared with the last approved plan. Approved items, edits
    and answers carry over, and the AI plans only new or changed pages and links, which are marked new.
    "Re-plan everything" starts fresh.
13. **Done means** three things:
    - Unit tests pass.
    - The migrated wizard e2e test reviews the fixture app's full plan with a scripted fake AI, and the
      plan must equal what ran.
    - Read-only acceptance runs with the user's OpenRouter key produce proper plans on mghealthtech.com,
      dev.mysleepreport.com and arocord.com.

Defaults (accepted):

- The crawler also looks at each Layout Group once at phone width. That way the plan knows which links
  hide behind a menu button, and the AI plans the tap that opens the menu at 375px.
- Navigation Checks are planned per role, because signed-in menus differ.
- The AI's per-page items replace the fixed page sweep. The sweep becomes the Fixed-Rule Fallback for
  pages.
- Visual-review requests come out of the same daily budget and are included in the estimate.
- The key requirement applies to the wizard. Command-line runs keep their current options. Studio doesn't
  get the new plan view in this work.

The budget rests on these facts from OpenRouter's docs, checked 2026-09-29:
- Free models (IDs ending in `:free`) allow 20 requests a minute.
- They allow 50 requests a day until the account has bought 10 credits, and 1,000 a day after that.
- `GET /api/v1/key` reports the daily counter and ceiling in `free_model_daily_requests`.

## Phase A: Crawler fixes

| Task | What it does | Where | Status |
|---|---|---|---|
| A.1 Landing host and `www` twin | The crawl uses the host the start address lands on and treats `www.` twins as one site, for links, click exploration and sign-in walls. Pages are loaded from the landing origin. A page redirected within the site is recorded once, under its real address, and its relative links resolve from there. A start address that lands on another host's sign-in form doesn't move the site, so a company sign-in service is never crawled. The read-only safe crawler gets the twin rule too. | `core/src/same-site.ts` (`isSameSite`); `core/src/discovery/deterministic-spider.ts`; `core/src/competitive/safe-crawler.ts` | Done |
| A.2 Wait for single-page apps | Dropped. The render-timing explanation was disproved (see Why), and a wait would slow every page for nothing. | — | Dropped |
| A.3 Tests | `same-site.test.ts` covers the twin rule. `spider-site-edge.test.ts` checks the landing-host crawl, redirects within the site and a sign-in service on another host. The landing-host test fails against the old crawler. | `core/tests/` | Done |
| A.4 Real-site check | Crawl-only replays with no AI and the cap set to 4: mghealthtech.com found 4 pages (1 before), arocord.com found 1, and dev.mysleepreport.com found 4. | Manual | Done |

## Phase B: Single server

| Task | What it does | Where | Status |
|---|---|---|---|
| B.1 Static UI serving | Serves a built UI folder with an SPA fallback to `index.html` and a path-traversal guard. A missing file with an extension is a 404, and a missing build answers with a 503 page that says to run `pnpm start`. Hashed assets are cached for good, and everything else is revalidated. The Wizard is at `/` and Studio at `/studio/` (`/studio` redirects there). API routes take priority. | `runner/src/ui-static.ts` (`serveUi`, `defaultUiApps`); `runner/src/server.ts` | Done |
| B.2 Same-origin Wizard | The Wizard calls the API on its own address. In dev mode, Vite passes `/api` on to `VITE_RUNNER_URL` (default 3001). The connection screen now says `pnpm start`, and only appears after a check has failed, so it doesn't flash on every load. | `wizard/src/api.ts`; `wizard/vite.config.ts`; `wizard/src/App.tsx`; `ConnectionScreen.tsx` | Done |
| B.3 Studio at `/studio/` | Vite's `base` is `/studio/` for builds only, so the dev server stays at `/`. The Wizard's header has an "Engineer view" link, and Studio's brand line links back to the Wizard. | `web/vite.config.ts`; both `App.tsx` | Done |
| B.4 Hub proxy | Forwards `/api/v1/*` to `HUB_API_URL`, streaming bodies both ways and dropping hop-by-hop headers. Without a Hub it returns 503 `{ error: 'Hub not connected', hubConnected: false }`, and with an unreachable Hub a 502. Studio's existing fallback shows its own run. A run whose `hubUrl` is the server itself (as Studio sends) goes to the real Hub directly, or isn't pushed when there's no Hub. | `runner/src/server.ts` | Done |
| B.5 Local-only | Binds to `localhost` by default and answers 403 to any Host header that isn't `localhost`, `127.0.0.1` or `[::1]`. | `runner/src/server.ts` | Done |
| B.6 `pnpm start` and `pnpm bootstrap` | `start` builds what's missing, checks Playwright's Chromium, starts the server in-process and opens the browser (`--no-open` skips that). It says so when the tool is already running, and when another program holds the port. `bootstrap` runs install, the Chromium install and `pnpm -r run build`. | Root `package.json`; `scripts/start.mjs` | Done |
| B.7 CLI | `qa-test runner` serves the UIs too, and takes `--hub`. | `cli/src/index.ts` | Done |
| B.8 Docker | The runner image also builds the Wizard and Studio. `docker-compose.yml` has one `runner` service on 3001 with `HUB_API_URL=http://hub-api:4000`. The wizard's Dockerfile and `nginx.conf` are deleted. The image was built and checked on 2026-09-30. | `docker-compose.yml`; `runner/Dockerfile` | Done |
| B.9 Tests | `runner/tests/single-server.test.ts` has 9 tests covering serving, the fallback, traversal, API priority, the Host check, the proxy with and without a Hub, a missing build, and no push to itself (this one fails without the fix). `pnpm smoke` (`scripts/smoke.mjs`) runs `pnpm start` on port 3591. `wizard/tests/wizard-e2e.test.ts` was rewritten, because it had been stale since the URL-first redesign: it still drove the old screens. It now builds both UIs and has the runner serve them, then covers connection, the key setup, the full product path (address, scan, plan review, approval, live run, report and downloads), Studio at `/studio/` with the links each way, a read-only plan, and phone width. | `runner/tests/`; `wizard/tests/`; `scripts/` | Done |
| B.10 Docs | The README quick start, running options, diagram, Wizard walkthrough, `qa-test runner` docs and troubleshooting; `.env.example`; ADR 0008. | | Done |

Found while rewriting the e2e test, and carried into C.5: the Wizard doesn't show a failed scan or a busy runner. If a scan fails, or another check is already running, the scanning screen keeps spinning.

## Phase C: Complete AI plan

Progress (2026-09-30):

- **Delivered:** C.1 through C.12 are fully implemented and verified:
  - Code lives in `core/src/plan/`: `site-graph`, `sampling`, `narrow-look`, `ai-budget`, `ai-planner`, `journeys`, `expand`, `markdown` and `replan`.
  - The runner builds the complete `ReviewPlan`. It reads the key's free requests left (`OpenRouterClient.freeRequestsToday`) and sends `DISCOVERY_PROGRESS` events.
  - It serves `GET /api/runner/plan/markdown`. It runs `/replan`, `/add-page` and `/include-host` in the background, sending `PLAN_UPDATE_*` events, and `PATCH /plan` takes `items` (on/off) and `screenSizes`.
  - A wizard scan without an AI key answers 400 `ERR_NO_AI_KEY`.
  - Wizard UI: `ScanningScreen` shows live progress, layouts, request count, estimate, and stop/cancel controls; `PlanReviewScreen` and `PlanDocument` display the complete plan, summary, editing controls, approval summary, and docs re-planning.
  - Automated tests: `complete-plan.test.ts`, `plan-reuse.test.ts`, `narrow-look.test.ts`, `spider-site-edge.test.ts`, `wizard-e2e.test.ts`.
  - Real-site acceptance run on 2026-09-30 against 3 real sites completed with exit 0 (details below).
- **Changes from the original specification, found while building:**
  - The narrow look covers 768 px too, because many sites fold their menu below about 1,000 px.
  - Only pages whose address names an item (a digit, a long part, or a slug of three or more words) are sampled. Fixed addresses like /about are always tested, even when they share a layout.
  - Menu links to the current page are kept, so the menu is the same on every page.

| Task | What it does | Where | Status |
|---|---|---|---|
| C.1 Plan model | Defines Plan Items (page, Layout Group sample, Navigation Check, journey, check), plus screen sizes, roles, what won't run and why, and where each item came from (the AI, the Fixed-Rule Fallback or the person). One expansion turns the Plan into the tests the runner executes, and it's used for both the approval summary and the run. | `types/src/plan.ts`; `core/src/plan/expand.ts` (`expandPlan`, `GRADED_CHECKS`) | Done |
| C.2 Crawl everything | Crawls until nothing new turns up (cap 200, adjustable in the Wizard: "Explore up to N pages"). Records the page graph per role, including script-driven navigation and where each role lands (`landsOnBy`). Detects shared menus and lists links that leave the site. Looks at each shared menu at 375 px and 768 px. Hosts the person ticks join the crawl. | `deterministic-spider.ts`; `plan/site-graph.ts`; `plan/sampling.ts`; `plan/narrow-look.ts` | Done |
| C.3 AI Planner | Sends one prompt per batch of about three pages, one for shared menus and one for journeys. Runs the coverage check and repair loop, and falls back to fixed rules per item. Controls that delete, pay or sign out are never offered to the AI. | `core/src/plan/ai-planner.ts`; `plan/journeys.ts` | Done |
| C.4 AI Request Budget | Estimates requests, reads the free requests left from OpenRouter, paces at 20 a minute or fewer, retries per-minute 429s, and stops on the daily one. Counts the visual review (up to 20). | `plan/ai-budget.ts` (`PacedAI`); `OpenRouterClient.freeRequestsToday` | Done |
| C.5 Progress | Sends planning progress events. The scanning screen shows numbers, an estimate and a Cancel button ("Stop Scan & Return to Setup"). It also shows a failed scan and a busy runner, which used to leave it spinning. | `DISCOVERY_PROGRESS` events; `ScanningScreen.tsx` | Done |
| C.6 Full plan view | Adds the "Full plan" document tab first and the map tab second with real links, plus a Markdown download. | `components/plan/PlanDocument.tsx`; `PlanReviewScreen.tsx`; `SiteMap.tsx` (`links`); `GET /api/runner/plan/markdown` | Done |
| C.7 Editing | Lets the person toggle any item (shown at once), add a page by address, describe a test, and re-plan one item or everything. The docs button ("Save and re-plan everything with the AI") re-plans with specs and design notes. | `PATCH /plan` (`items`, `screenSizes`); `/replan`, `/add-page`, `/include-host` in the background (`PLAN_UPDATE_*` events); `plan/replan.ts` | Done |
| C.8 Approval summary | Shows what runs and every default applied, linked to their items. Nothing is applied silently. | `PlanSummary` from `expandPlan`; the review's approve bar | Done |
| C.9 Execution | The runner runs only the approved plan's expansion: page items, Navigation Checks (click and land), one-request checks on links that leave the site, and journeys. Validation tests are expanded once, in the plan. | `orchestrator.ts` (`kind`, `breakpoints`, `onlyAt`, `check-link`); `spec-conformance.ts` (`pageWorks`); `validator-expander.ts` | Done |
| C.10 Re-runs | Site memory keeps the approved plan. The runner re-crawls, compares, and has the AI plan only what changed. What fixed rules planned gets another go with the AI. "Re-plan everything" is in the review; `replanAll` starts a run afresh. | `site-memory.ts` (`RememberedPlan`, `siteContentKey`); `DiscoveryOptions.remembered` | Done |
| C.11 Tests and acceptance | Unit tests for the page graph, sampling, the coverage check, batching and budget, the fallback and plan reuse. The wizard e2e test reviews the full fixture plan and checks that the plan equals what ran. Read-only runs on the three real sites. | `complete-plan`, `plan-reuse`, `narrow-look`, `spider-site-edge`; `wizard-e2e.test.ts` | Done (see Real-site acceptance below) |
| C.12 Docs | The README, CONTEXT.md and ADR 0009. | README "The plan review" | Done |

## Real-site acceptance

The complete AI planner and single server were run read-only against three real target sites using a real OpenRouter free-tier key via `acceptance.mjs` on 2026-09-30. All three sites reached `awaiting-review` with valid complete plans saved:

### 1. https://arocord.com/
- **Time**: 2.2 minutes
- **Pages**: 1 page found (`/`), 0 forms, 0 sensitive actions. 100% tested (1 page, 0 sample, 0 covered).
- **Navigation**: 6 navigation checks planned by AI. All 6 leave the site to `www.mghealthtech.com` (About, Products, Insights, Contact us, Terms and Conditions, Privacy Policy).
- **Page tests**: 5 interactive tests on `/` planned by AI (Features button, Support button, FAQ accordion panels 1–3).
- **Journeys**: 1 journey ("Visit the main pages", 1 step) planned via Fixed-Rule Fallback. The free model produced malformed JSON property names twice; the fallback engaged cleanly without blocking.
- **Budget**: 2 requests estimated/needed, 3 requests used, 50 daily limit, 20 visual review.
- **Summary**: 27 tests planned on 1 page at 3 screen sizes (375px, 768px, 1440px). 1 item (the journey) planned by fallback.

### 2. https://mghealthtech.com/
- **Time**: 11.9 minutes
- **Pages**: 35 pages found, confirming the Phase A landing-host redirect + `www` twin fix (previously stuck on 1 page). 1 interactive form (`/contactus`), 0 sensitive actions. 8 external hosts detected.
- **Coverage**: 15 pages tested individually, 3 Sample Pages tested, 17 pages covered by the sample (Layout Group: "Pages like /… (20)").
- **Navigation**: 49 navigation checks (17 shared, 30 in-page, 2 leaving). 4 AI-planned, 45 fallback.
- **Page tests**: 36 interactive tests planned across pages (14 pages AI-planned, 4 fallback).
- **Journeys**: 3 journeys planned via Fixed-Rule Fallback ("Browse and view product", "Send the form on /contactus" with `needsTestCopy: true`, "Visit the main pages"). Free model output was truncated on the journey prompt.
- **Budget**: 11 requests estimated/needed, 16 used, 50 daily limit, 20 visual review.
- **Summary**: 311 tests on 18 pages at 3 screen sizes (375px, 768px, 1440px). 17 pages covered by layout group sampling; 52 items planned by fallback, 1 question using safe answer, 1 item won't run.

### 3. https://dev.mysleepreport.com/
- **Time**: 7.5 minutes
- **Pages**: 10 pages found, 2 interactive forms (`/contact`, `/physicians/onboarding`), 2 sensitive actions.
- **Coverage**: 10 tested, 0 sample, 0 covered (all unique paths).
- **Navigation**: 17 navigation checks (9 shared, 8 in-page, 0 leaving). 11 AI-planned, 6 fallback. 2 checks include menu steps for narrow screens (375px).
- **Page tests**: 19 tests planned across pages (4 pages AI-planned, 6 fallback).
- **Journeys**: 4 journeys planned via Fixed-Rule Fallback ("Browse and view product", "Send the form on /contact" with `needsTestCopy: true`, "Send the form on /physicians/onboarding" with `needsTestCopy: true`, "Visit the main pages").
- **Budget**: 6 requests estimated/needed, 10 used, 50 daily limit, 20 visual review.
- **Summary**: 138 tests on 10 pages at 3 screen sizes (375px, 768px, 1440px). 16 items planned by fallback, 4 questions using safe answer, 4 items won't run (sensitive actions).

### Deviations from original plan
1. **A.2 dropped**: The single-page app wait hypothesis was disproved. The React app drew all links before HTML load finished; an artificial wait would have slowed crawl for no gain.
2. **768 px narrow look added**: Menus frequently fold into hamburger/drawer buttons on tablet widths (<1000px), not just 375px phones. Narrow look covers both 375px and 768px.
3. **Item-shape sampling**: Only routes whose path matches item patterns (digits, long segments, or 3+ word slugs) are grouped into Layout Group samples. Fixed pages like `/about` or `/insurance` are always tested individually.
4. **`pnpm bootstrap` instead of `pnpm setup`**: `pnpm setup` is a reserved built-in pnpm CLI command modifying shell profiles, so project scripts cannot use that name.
5. **Wizard e2e rewrite**: Replaced the stale multi-screen test suite with a single-server end-to-end suite driving the URL-first flow, plan review, Studio link, read-only mode, and mobile viewport.

### Known issues and notes
1. **Pre-existing e2e test failures (resolved 2026-09-30)**: `core/tests/e2e-orchestrator.test.ts` and `core/tests/e2e-discovery.test.ts` failed because the fixture's invoice page had no meta description, no `<h1>` and no OpenGraph tags. Fixed in the fixture (see Status).
2. **Parallel test runner flakiness**: Running all vitest suites simultaneously across packages can flake due to concurrent Playwright browser port/lock contention. Running suites individually passes reliably.
3. **Staged git deletions**: `packages/wizard/Dockerfile` and `packages/wizard/nginx.conf` are staged for deletion, superseded by the unified single Docker image in `packages/runner`.
4. **Free model JSON resilience**: Free OpenRouter models occasionally emit malformed JSON or token-truncated responses on large multi-step journey prompts. Fixed-rule fallback safely catches these without stopping the run, and the UI's "Re-plan" button allows targeted re-generation. Trailing commas are tolerated; comments, single quotes, and unquoted keys are not (by design, avoiding risky parser heuristics).
5. **Budget post-planning calculation**: Fixed `DiscoveryAgent.discover` to set `budget.left` to the requests remaining after planning (`paced.left`) rather than the pre-planning snapshot.

## Done means

- **Phase A:** a crawl-only run finds more than `/` on mghealthtech.com and dev.mysleepreport.com, arocord.com
  stays one page, and the new crawler tests pass.
- **Phase B:** `pnpm start` on a fresh clone (after `pnpm bootstrap`) opens the Wizard at
  `http://localhost:3001/`, and Studio works at `/studio`. `docker compose up` does the same from one
  service. The serving tests, the smoke script and the migrated wizard e2e test pass.
- **Phase C:**
  - The plan for the fixture app lists all its pages and links, and the wizard e2e test shows the plan
    equals what ran.
  - The read-only runs on mghealthtech.com, dev.mysleepreport.com and arocord.com produce complete,
    AI-written plans, with anything left to fixed rules clearly labeled.
  - All tests pass (58 files, 335 tests, checked 2026-09-30).
