# Implementation Plan: Non-Technical Wizard (`packages/wizard`)

Companion to [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md). That plan covers the CLI/dashboard for
developers and QA (`packages/web`, `packages/dashboard`, `packages/hub`). This plan covers a second,
separate frontend aimed at non-technical users, built on top of the same runner/core backend.

## Completion Status (as of 2026-09-28)

**21 of 21 tasks complete.** Each task below says what was built, where, and how its acceptance
criteria were checked. The full test suite (31 files, 162 tests) passes, twice in a row.

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| Phase 0: Backend enablement | 4 | 4 | Complete |
| Phase 1: Scaffold + connection/AI setup | 5 | 5 | Complete |
| Phase 2: Target fork + product inputs | 4 | 4 | Complete |
| Phase 3: Run + live progress | 3 | 3 | Complete |
| Phase 4: Report screen | 2 | 2 | Complete |
| Phase 5: Website path | 3 | 3 | Complete |

**Where the evidence is**
- Runner endpoints: `packages/runner/tests/wizard-endpoints.test.ts`
- OpenRouter logic and safe scan: `packages/core/tests/openrouter.test.ts`, `packages/core/tests/safe-scan.test.ts`
- Wizard logic and palette: `packages/wizard/tests/translate.test.ts`, `context-url-summary.test.ts`, `contrast.test.ts`
- Whole wizard in a real browser, against a real runner and the fixture app, with only OpenRouter and
  the AI model faked: `packages/wizard/tests/wizard-e2e.test.ts`. Set `WIZARD_SCREENSHOTS=<dir>` to
  save a screenshot of every screen.

**Not verified yet**
- A real, valid OpenRouter key, and AI discovery with a real free model. Every AI call in the tests
  is faked. The real API was only called with an invalid key, which it correctly rejects.
- The product path inside Docker, which needs a real key. The website path was run end to end
  through the Dockerised wizard and runner.

**Known limitation:** the website path doesn't use AI, but still asks for the OpenRouter key first,
because this plan puts AI setup (Phase 1) before the product/website choice (Phase 2).

**Docker:** `docker compose up` now also starts `runner` (port 3001, built on Playwright's image) and
`wizard` (port 3002). The containerised runner rewrites `localhost` targets to
`host.docker.internal`, so products running on the user's machine can still be reached. With no OS
keychain in the container, the key is saved to the runner's data volume. Both images were built and
run, and a scan of a site on the host completed through the wizard.

**Bugs found and fixed along the way**
- `SafePublicCrawler` failed on every page. It passed Playwright-only syntax (`button:has-text(...)`)
  to `document.querySelector`, which throws. This means `qa-test compare` had never worked either.
- The runner announced `RUN_COMPLETED` before storing the report. A client fetching `/api/report`
  straight away could get the previous run's report.
- `RunnerServer.stop()` never finished while a browser had the event stream open.
- The fixture app crashed on any unknown path, such as `/robots.txt`, by sending headers twice.
- `@qa/checkers` imported `yaml` without declaring it. Local installs hid this; the Docker build failed.

**Changes elsewhere that affect this plan** (from completing IMPLEMENTATION_PLAN.md on 2026-09-27):
- The runner only accepts cross-origin requests from `localhost`, `127.0.0.1` and `[::1]`. The
  wizard on `localhost:3002` is allowed; serving it under another hostname needs that origin added.
- `SafePublicCrawler` obeys `robots.txt` and stops after at most 5 steps. Task 0.4 keeps both.

## Scope Recap

- New package `packages/wizard` — a guided, jargon-free web app. `packages/web` ("QA Flow Studio")
  is untouched and remains the advanced/technical dashboard.
- Runs locally via the existing Docker setup; the wizard talks directly to the runner's HTTP API
  (CORS allows localhost origins, which covers the wizard's dev port) — no new proxy.
- Two target-type paths: **Product** (roles + reference materials, full AI discovery) and
  **Website** (URL only, read-only Safe Interaction Mode).
- AI provider is OpenRouter only, free-tier models auto-selected, key entered once and validated live.
- Report stays in the existing `report.md` + `findings.json` format; no new report schema.
- Out of scope: two-site competitive benchmarking, manual JSON test-case editing, a dedicated
  design-token/visual-diff step, a review/confirm-flows gate, PDF/DOCX parsing.

---

## Phase 0: Backend Enablement (Prerequisite — 3–4 days)

Small gaps in the existing backend that the wizard depends on. None of this is new architecture;
it's exposing/extending capability that already exists in `packages/core`.

### Task 0.1 — Expose `contextFilePath` over `/api/runner/run`
**Status: Complete.** `TriggerRunBody.productContext` is written to `product-context-<runId>.md` in the
run's output folder and passed to `DiscoveryAgent.discover()` as `contextFilePath`. Without it, no file
is written and nothing changes. Tested with and without (`wizard-endpoints.test.ts`).

`DiscoveryAgent.discover()` already accepts `contextFilePath` and parses it via `ContextParser`
(`packages/core/src/discovery/context-parser.ts`), but `RunnerServer.handleTriggerRun` /
`TriggerRunBody` (`packages/runner/src/server.ts`) never receives or forwards it.

- Add `productContext?: string` (raw concatenated text, not a path) to `TriggerRunBody`.
- On the server, write it to a temp file under the run's `outputDir` and pass that path as
  `contextFilePath` to `agent.discover()`.

**Acceptance criteria**
- Posting `{ targetUrl, useAI: true, productContext: "<markdown text>" }` to `/api/runner/run`
  results in `DiscoveryAgent.discover()` being called with a `contextFilePath` pointing at a file
  containing exactly that text.
- Omitting `productContext` behaves identically to today (no context file, discovery proceeds
  without it) — no regression for existing `packages/web` callers.
- Unit test in `packages/runner` covering both cases (with and without `productContext`).

### Task 0.2 — OpenRouter: list free models
**Status: Complete.** `GET /api/ai/openrouter/free-models` takes the key from an
`Authorization: Bearer` header, or else uses the saved key. It keeps models priced at "0" or ending in
`:free` that take and return text, and drops classifier models (content-safety, guard). Best first:
`openrouter/free` when offered, then JSON-mode support, no forced reasoning, largest context.
With none free it returns `{ models: [], recommendedModel: null }`, and a bad or missing key gets a
401. The logic is in `packages/core/src/ai/openrouter.ts`.

New endpoint, e.g. `GET /api/ai/openrouter/free-models`, given an API key (query param or header),
proxies OpenRouter's `/models` endpoint and returns only entries priced at zero
(`pricing.prompt === "0"` and `pricing.completion === "0"`, or id suffix `:free`).

- Runner picks one sensible default from the filtered list (e.g. largest context window, or a
  fixed preference order) and returns it as `recommendedModel` alongside the full filtered list.

**Acceptance criteria**
- With a valid key, the endpoint returns a JSON array of free-tier models only (no paid models
  present) plus a `recommendedModel` field naming one of them.
- With no free models currently available from OpenRouter, returns an empty list without erroring
  (caller/UI must handle this — see Task 3.2).
- With an invalid/missing key, returns 401 with a clear error body, not a 500.

### Task 0.3 — OpenRouter: validate key
**Status: Complete.** `POST /api/ai/openrouter/validate` calls OpenRouter's `GET /api/v1/key`
with an 8 s limit. It rejects malformed keys without a network call and always answers
`{ valid, reason }` in plain words, never a 500. A test checks the key is never logged or stored.
Checked against the real API with an invalid key; not yet with a real valid key (none available).

New endpoint, e.g. `POST /api/ai/openrouter/validate`, body `{ apiKey }`. Makes a minimal
authenticated call to OpenRouter (e.g. `GET /auth/key` or a 1-token completion) and returns
`{ valid: true }` or `{ valid: false, reason }`.

**Acceptance criteria**
- A known-valid key returns `{ valid: true }` within ~2s.
- A malformed or revoked key returns `{ valid: false }` with a human-readable `reason`, not a thrown
  error or 500.
- Endpoint never logs or persists the key server-side beyond the request lifecycle.

### Task 0.4 — Safe-crawl findings: wire checkers into `SafePublicCrawler`
**Status: Complete.** `SafePublicCrawler.scan()` runs `BugDetectionChecker` and `UXQualityChecker`
(axe-core) at every step. `runSafeWebsiteScan()` writes the usual `report.md` / `findings.json`,
marked `scanMode: 'safe-public'`. Requests the crawler itself blocked are not reported as site defects.
A script injected before page load now also blocks every form-submission path. Tested on a local
page built to tempt the crawler: accessibility and console-error findings, the POST blocked, no form sent.
On the real page `httpbin.org/forms/post` it found 3 genuine accessibility issues and submitted nothing.

`SafePublicCrawler.crawl()` (`packages/core/src/competitive/safe-crawler.ts`) currently returns a
`ReferenceFlow` (steps + screenshots) with no findings. Extend it (or add a wrapping function) to
run the existing bug-detection/accessibility checkers at each step it safely reaches, producing
real `Finding`s in the same shape the product-path orchestrator emits.

- Reuse existing checker logic from `packages/core` (bug detection: console errors, HTTP failures;
  accessibility: axe-core at settled states) rather than writing new checkers.
- Findings from this path must carry enough metadata (`route`, `severity`, `checker`,
  `stepsToReproduce`) to render in the same report template as product-path findings.
- Must not violate Safe Interaction Mode's existing constraints (no form submission, no mutating
  HTTP methods, no navigation outside the target host) — checkers only *observe*, never act.

**Acceptance criteria**
- Running the safe crawler against a real public page with at least one known accessibility issue
  (e.g. an unlabeled button) produces a `Finding` for it in the returned report.
- Running it against a page that triggers a console error produces a `bug_detection` `Finding`.
- The crawler's network interceptor still blocks all POST/PUT/PATCH/DELETE requests during the run
  (regression test against the existing behavior in `safe-crawler.ts`).
- Output is consumable by the same `report.md`/`findings.json` writer used by the product path (no
  parallel report format).

---

## Phase 1: Wizard App Scaffold + Connection & AI Setup (1 week)

### Task 1.1 — Scaffold `packages/wizard`
**Status: Complete.** Vite + React + TypeScript + Tailwind, dev server on port 3002
(`pnpm dev:wizard`), built by the root `pnpm build`. It imports types from `@qa/types`, and
`packages/web` is untouched.

Vite + React + TypeScript + Tailwind, matching the monorepo conventions of `packages/web`
(`tsconfig.base.json`, workspace deps on `@qa/types`). New dev port (e.g. 3002). Distinct visual
theme from `packages/web` (design pass to happen in Task 1.5, not hardcoded yet here).

**Acceptance criteria**
- `pnpm --filter @qa/wizard dev` starts a dev server on the new port with a blank routed shell.
- Package builds via the existing root build pipeline (`pnpm build` at repo root includes it)
  without touching `packages/web`'s build.
- `@qa/types` is imported successfully (proves workspace linking works).

### Task 1.2 — Connection check screen
**Status: Complete.** Polls `GET /api/runner/status`. Each check waits for the previous one,
then pauses 3 s. The screen shows the `docker compose up` instruction, plus the non-Docker command.
The E2E test counts 2–4 checks in 7 s, and the screen moves on within one interval of the runner starting.

On load, poll `GET /api/runner/status`. While unreachable, show plain-language instructions
("Start the QA Tool first — run `docker compose up`, then this page will continue automatically")
and keep retrying in the background (e.g. every 3s). Once reachable, proceed to Task 1.3 or 1.4.

**Acceptance criteria**
- With the runner stopped, opening the wizard shows the instructions screen, not a blank page or a
  raw fetch error.
- Starting the runner while the wizard is open on this screen causes it to advance automatically
  within one retry interval, with no manual refresh needed.
- No infinite-retry runaway: retries are visibly throttled (not hammering the endpoint faster than
  the polling interval).

### Task 1.3 — One-time AI key setup
**Status: Complete.** The key is checked 500 ms after typing or pasting stops, with inline
"✓ Key is active" / "✗ Key invalid or out of credit". The runner saves it
(`POST /api/ai/openrouter/key`) to the OS keychain, or to its data volume when there's no keychain
(Docker), and reads it for AI runs. "Change AI key" sits in the header. The E2E test covers invalid,
valid (under 2 s), reloading without being asked again, and changing the key.

Shown only if no valid key is stored locally. Password-style input for the OpenRouter key; calls
Task 0.3's validate endpoint automatically (debounced) as the user types/pastes, showing inline
"✓ Key is active" / "✗ Key invalid or out of credit" status. On success, stores the key locally
(e.g. a local config file the runner reads, or the wizard's own persisted storage) and does not ask
again on subsequent visits.

**Acceptance criteria**
- Pasting a valid key shows a positive status indicator within ~2s without the user clicking
  anything else.
- Pasting an invalid key shows a clear negative status and blocks proceeding to the next step.
- Reloading the wizard after a successful key setup does not show this screen again.
- A "change key" affordance exists (e.g. a small settings control) to re-open this step
  deliberately.

### Task 1.4 — Free-model auto-selection
**Status: Complete.** After the key is saved, the recommended free model is stored and sent as
`aiModel` on every run. An empty list shows "No free AI models are available right now — please try
again later." and doesn't continue. Covered by the E2E test.

On successful key validation, call Task 0.2's free-models endpoint and store the
`recommendedModel` for use in all subsequent runs. No model picker UI.

**Acceptance criteria**
- After key setup, a run triggered from the wizard uses the `recommendedModel` value without any
  additional user input.
- If the free-models list is empty (Task 0.2's empty-list case), the wizard shows a plain-language
  message ("No free AI models are available right now — please try again later") rather than
  silently failing or sending an empty model to the runner.

### Task 1.5 — Visual design pass
**Status: Complete.** Done with the `frontend-design` skill. The rationale is in
`packages/wizard/DESIGN.md`: a check-up slip that fills in, an inspector's stamp on the report, and
Atkinson Hyperlegible type. `contrast.test.ts` fails if any palette pairing drops below WCAG AA.
Screenshots of every screen were reviewed at desktop and 375 px widths.

Establish the wizard's distinct visual language (typography, color palette, spacing rules) — done
deliberately via the `frontend-design` skill, not ad hoc Tailwind defaults. Applies to every screen
built in later phases.

**Acceptance criteria**
- A short design rationale exists (even informally, e.g. in a comment or short note) for the
  palette/type choices made, distinguishing this from `packages/web`'s dark dashboard look.
- Look is consistent across all wizard screens built afterward (no screen visibly reverts to
  unstyled/default Tailwind).
- Passes a basic contrast check (WCAG AA) given this app's own stated goal of accessibility-mindedness.

---

## Phase 2: Target-Type Fork + Product Path Inputs (1–1.5 weeks)

### Task 2.1 — Target-type fork screen
**Status: Complete.** Two large choices. The E2E test goes back and forth without being asked
for the key again.

"Is this a product you have access to, or a public website?" Two large, plain-language choices.
Selection determines which of Tasks 2.2–2.4 (product) or Phase 5 (website) are shown next.

**Acceptance criteria**
- Choosing "product" routes to Task 2.2 next; choosing "website" routes directly to Phase 5's URL
  step, skipping roles and reference materials entirely.
- Choice is changeable (a back button) without losing anything already entered in the AI-setup step.

### Task 2.2 — URL step with pre-flight validation
**Status: Complete.** A new `POST /api/runner/preflight` endpoint uses
`PreFlightChecker.checkUrlReachable` (10 s). One shared URL step: Enter submits, a spinner shows while
checking, and unreachable addresses get "Couldn’t reach that site — check the URL and try again".
Covered by the E2E test.

Single URL field. On submit, calls the existing pre-flight check (`packages/core/src/preflight.ts`)
via the runner. Inline error if unreachable; otherwise advances.

**Acceptance criteria**
- A reachable URL advances to the roles step within a reasonable timeout (e.g. 10s) with a loading
  indicator during the check.
- An unreachable URL (wrong host, connection refused, timeout) shows a plain-language inline error
  ("Couldn't reach that site — check the URL and try again") and does not advance.
- Pressing Enter in the field behaves the same as clicking a "Next" button.

### Task 2.3 — Roles/credentials step (skippable)
**Status: Complete.** "No, skip this step" sends `roles: []`. Each row sends
`{ role, username, password, loginPath }`, and removed rows aren't sent. The E2E product run signs in
to the fixture app with them.

"Do you need to log in to test this?" with a prominent skip option, or an "add a role" flow
collecting role name/username/password/login path per row (mirrors `RoleCredential` shape already
used by `RunConfigModal`).

**Acceptance criteria**
- Skipping proceeds with `roles: []`, matching existing backend behavior for an unauthenticated run.
- Adding one or more roles produces a `roles` array in the same shape `/api/runner/run` already
  accepts (`{ role, username, password, loginPath }`), verified against a real run.
- Removing a role row removes it from the payload sent on run.

### Task 2.4 — Reference materials step (multi-file upload)
**Status: Complete.** Accepts several `.md` / `.markdown` / `.txt` files plus a paste box.
Each source gets its own `# Reference file: <name>` heading. Other file types are refused with a
message saying what to do instead, and with nothing added, `productContext` is left out. A unit test runs
the joined text through the real `ContextParser`; the E2E test checks the request.

Accepts multiple `.md`/`.txt` file uploads (or paste boxes) — PRD, user flows, design docs/links
all together, no separate design-spec step. Concatenates all inputs into one blob before sending.

**Acceptance criteria**
- Uploading 2+ files and submitting results in a single `productContext` string (Task 0.1) that
  contains the content of all uploaded files, each clearly delineated (e.g. a header per file) so
  the existing heading-based `ContextParser` can still extract requirements from each.
- Non-text file types (e.g. `.pdf`, `.docx`) are rejected client-side with a clear message, not
  silently mangled.
- The step is optional — proceeding with zero files results in `productContext` being omitted
  entirely (matches Task 0.1's "no regression" case).

---

## Phase 3: Run Execution + Live Progress (1 week)

### Task 3.1 — Trigger run (product path)
**Status: Complete.** Exactly one `POST /api/runner/run` with `useAI`, `aiProvider: 'openrouter'`,
`aiModel`, `roles` and `productContext`. The key stays on the runner and isn't sent. A 409 shows
"Another check is already running…", and success moves straight to the progress screen. Covered by the E2E test.

Wires URL, roles, and productContext into a single `POST /api/runner/run` call with `useAI: true`,
the stored OpenRouter key/model from Phase 1, and the Safety Filter always implicitly on (no UI
control — matches existing backend default behavior for destructive-action handling).

**Acceptance criteria**
- Submitting the product-path wizard triggers exactly one `/api/runner/run` call with all collected
  fields present and correctly shaped.
- A 409 (run already in progress) is surfaced as a plain-language message, not a raw error.
- Successful trigger immediately transitions the UI to the live-progress screen (Task 3.3) using the
  returned `runId`.

### Task 3.2 — Plain-language event translation
**Status: Complete.** `src/lib/translate.ts` gives every runner event a plain sentence. To have something
to report, the orchestrator now also emits `PREFLIGHT_STARTED`, `TEST_POINT_STARTED` and
`FINDINGS_UPDATED`, and the runner emits `DISCOVERY_STARTED/COMPLETED`. Names that look technical are
replaced by the action ("Clicking a button…"), unknown events show "Working on it…", and a finding
counter updates live. Unit tests cover this, and the E2E test checks no jargon ever appears on screen.

A translation layer over the existing `useRunnerStream` SSE hook that maps raw orchestrator events
(step names, actions, selectors) to short human sentences: "Exploring your site...", "Signing in as
admin...", "Testing the checkout flow...", "Found 2 issues so far."

**Acceptance criteria**
- For each real orchestrator event type currently emitted (`RUN_STARTED`, `STEP_COMPLETED`,
  `RUN_COMPLETED`, `RUN_FAILED`, etc.), there is a defined plain-language template — no raw selector
  strings, CSS paths, or internal event-type names ever rendered to the user.
- An event type with no explicit mapping falls back to a generic "Working on it..." message rather
  than rendering nothing or crashing.
- A running finding counter updates live as findings arrive, without requiring a page refresh.

### Task 3.3 — Live progress screen
**Status: Complete.** A progress bar (with real progress once the tests are known), elapsed time, and
a history of milestones. Losing the connection shows a reconnecting notice; on reconnect, and every
10 s during a run, it checks the runner's status to catch anything missed. A failed run shows a plain
explanation and "Go back and try again", which keeps every answer. Covered by the E2E test.

Renders Task 3.2's feed plus a non-technical progress indicator (spinner/progress bar, elapsed
time). No step list with selectors, no technical stepper reused from `packages/web`.

**Acceptance criteria**
- Screen updates in real time as SSE events arrive (verified against a real local run).
- If the connection to the SSE stream drops, the screen shows a reconnecting state rather than
  freezing silently.
- If the run fails before completion (`RUN_FAILED` / pre-flight rejection), the screen shows a clear
  plain-language failure message and a way to go back and retry, not a stuck spinner.

---

## Phase 4: Report Screen (3–4 days)

### Task 4.1 — Plain-language summary card
**Status: Complete.** The verdict uses the same rule as `report.md` (no blocking or serious
issues), counts use plain words ("1 blocks release"), and the top 3 issues get plain titles. The E2E test
compares the screen with `/api/report`.

On `RUN_COMPLETED`, fetch `/api/report` and render: overall verdict ("Ready to release" / "X issues
found"), counts by severity in plain words, and up to 3 top finding titles.

**Acceptance criteria**
- Verdict text and severity counts are derived directly from the real `ReleaseReport` response, not
  hardcoded or mocked.
- Zero findings renders a clearly positive state ("No issues found — looks ready!"), not an empty
  list with no framing.
- Severity labels use plain words (e.g. "blocks release" instead of raw `Blocker` enum text) per the
  no-jargon goal.

### Task 4.2 — Download report action
**Status: Complete.** A new `GET /api/report/download/report.md|findings.json` endpoint serves the
files; the button saves both. The runner test and the E2E test compare bytes with the files on disk,
including for a run with zero findings.

A single "Download full report" action that retrieves both `report.md` and `findings.json` (e.g.
zipped, or as two sequential downloads) for the completed run.

**Acceptance criteria**
- Clicking it results in the user having both files locally, matching byte-for-byte what the
  backend already produces at `.qa-report/report.md` / `.qa-report/findings.json` (or the run's
  equivalent output dir) — no reformatting introduced by the wizard.
- Works for a run with zero findings (still produces a valid, downloadable report, not an error).

---

## Phase 5: Website Path (Safe Interaction Mode) (1–1.5 weeks)

Depends on Task 0.4.

### Task 5.1 — Website URL step
**Status: Complete.** Uses the same URL step component as Task 2.2. Submitting goes straight to the
run, with no screens in between (E2E).

Same pre-flight-validated URL field as Task 2.2, but routed from the "website" branch of Task 2.1 —
no roles or reference-materials steps shown at all.

**Acceptance criteria**
- Choosing "website" in Task 2.1 and submitting a URL here goes straight to run-triggering with no
  intervening screens.
- Same inline pre-flight validation behavior as Task 2.2 (shared component, not reimplemented).

### Task 5.2 — Trigger safe-crawl run
**Status: Complete.** `mode: 'safe-public'` runs `runSafeWebsiteScan()`. The runner test confirms
`DiscoveryAgent` and `FlowTestOrchestrator` are never called, and the test site's request log shows no
POST/PUT/PATCH/DELETE. The progress screen uses website wording ("Looking around the site safely…").

New runner endpoint or a `mode: 'safe-public'` flag on the existing `/api/runner/run`, routing to
`SafePublicCrawler` + Task 0.4's checker wiring instead of `FlowTestOrchestrator`.

**Acceptance criteria**
- A website-path run never calls `DiscoveryAgent`/`FlowTestOrchestrator` with write-capable
  Playwright actions — verified by confirming no POST/PUT/PATCH/DELETE requests occur during a real
  run against a form-having public site.
- Findings from this path appear in the same `/api/report` shape consumed by Task 4.1, so the report
  screen requires no branching logic to display them.
- Live progress (Task 3.2/3.3) renders sensible plain-language messages for this path too (e.g.
  "Looking around the site safely..." instead of "Signing in as admin...", which won't apply here).

### Task 5.3 — Safety messaging
**Status: Complete.** The read-only notice is on the address screen, before anything runs. The
report shows "This was a read-only scan…", and `report.md` carries the same note. Covered by the E2E test.

Since this path never logs in or submits anything, the wizard should set expectations up front
("I'll only look around — I won't submit forms, log in, or change anything on the site.").

**Acceptance criteria**
- This message is shown before the run starts on the website path, not buried in results afterward.
- Report screen for a website-path run visibly indicates it was a read-only scan, so results aren't
  mistaken for full product-path coverage.

---

## Timeline Summary

| Phase | Duration | Depends on |
|-------|----------|------------|
| Phase 0: Backend enablement | 3–4 days | — |
| Phase 1: Scaffold + connection/AI setup | 1 week | Phase 0 (0.2, 0.3) |
| Phase 2: Target fork + product inputs | 1–1.5 weeks | Phase 1, Phase 0 (0.1) |
| Phase 3: Run + live progress | 1 week | Phase 2 |
| Phase 4: Report screen | 3–4 days | Phase 3 |
| Phase 5: Website path | 1–1.5 weeks | Phase 0 (0.4), Phase 3/4 components |

**Total: ~5–6 weeks for one engineer**, phases 1–4 (product path end-to-end) deliverable
independently of Phase 5 if the website path needs to slip.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| OpenRouter's free-model list is empty/volatile | AI setup blocks entirely | Task 1.4 handles the empty-list case explicitly; consider a small hardcoded fallback model as last resort |
| `SafePublicCrawler` + checkers (Task 0.4) is the least-proven piece | Website path ships late or thin | Scope Phase 5 as separable/optional; ship Phases 1–4 (product path) first as a complete, usable increment |
| Non-technical users still hit real error states (network errors, AI timeouts, malformed sites) | Confusing raw errors leak through despite the "no jargon" goal | Every fetch call in Phases 1–4 must have an explicit plain-language error mapping — track this as a checklist item during review, not just per-task acceptance criteria |
| Concatenating multiple uploaded files (Task 2.4) confuses the heading-based `ContextParser` | AI misses requirements from later files | Require a clear delimiter/header per file when concatenating; verify with a real multi-file test case |
