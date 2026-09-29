# Pre-Release Readiness Checker — Product Spec

Sep 26, 2026 · @MG Health Tech Design

## Overview

We will build an internal tool that takes a URL (a local build, directly or through a tunnel) and returns a release readiness report before anything ships. The tool provides a URL-first entry point: a user enters a URL to immediately initiate exploration and testing. Running with an AI key is optional: without an AI key, deterministic rules, spidering heuristics, and standard test templates automatically plan journeys and run all checkers; when an AI key is configured (via OpenRouter or standard providers), intelligent flow discovery, ambiguity resolution, and visual/copy reviews are enhanced. One generic engine serves all products in parallel, and QA owns and operates it.

Today, pre-release review depends on manual QA passes and ad-hoc design reviews. That process misses logic bugs in less-travelled flows, lets UI drift from the design system go unnoticed, and rarely checks every requirement in the spec. The tool makes one thorough, repeatable review part of every release.

## Goals and non-goals

The tool succeeds if it catches release-blocking issues that manual review would miss, with few enough false positives that teams trust the report.

**Goals**

- AI discovers and documents every flow: user flow, app flow and business rules.
- AI extracts all requirements from product context and generates test cases and expected outcomes.
- Run deterministic tests against AI-generated requirements: same flow and requirements produce the same test results.
- Test every flow and every interactive element under every user role.
- Catch functional bugs and logic failures before release.
- Check the live UI against design tokens and frames exported from Figma.
- Check UX quality with rule-based checks, including WCAG accessibility.
- Produce a prioritized report with fix-ready findings a developer or coding agent can act on.
- Offer a read-only mode for analysing flows on public websites.

**Non-goals (for now)**

- Inferring intent the product context doesn't state. The agent reads what QA provides; anything else it discovers on the site.
- Replacing the QA team. The tool augments manual QA and is judged against it.
- Load, performance or security testing beyond basic signals like page load time.
- Testing production with real user data.
- Selling or exposing the tool outside the company.

## Users and use cases

QA owns the tool: it sets up product profiles, runs reviews, triages findings and maintains the tool. Other teams read the parts of the report that concern them.

| User | Main use case | Report section they read |
| --- | --- | --- |
| QA engineers | Own the tool: configure products, run reviews before each release, triage findings, maintain flow docs | Bugs, consolidated report |
| Product managers | Confirm the build matches the spec | Spec conformance |
| Designers | Confirm the build matches Figma and design system standards | Design and UI standards, UX quality |
| Engineering leads | Decide go or no-go for a release | Consolidated release report on the hub |

A secondary use case is competitive and reference analysis: running the tool in read-only mode on public websites to compare their flows, such as onboarding or pricing, with ours.

## Inputs and run workflow

The primary entry point is URL-first: entering a URL (and owner confirmation for active mutation) immediately initiates discovery. The tool discovers and documents flows, forms, and pages. QA reviews the architectural site map and plan before testing starts, or clicks "Skip review, just test it" for rapid automated evaluation.

**Inputs per run**

| Input | Required | Purpose |
| --- | --- | --- |
| Target URL | Yes | The URL or local build under test |
| Owner verification | Yes (for active data changes) | Confirms authorization; public/unowned sites run safely in read-only mode |
| Product context (optional) | Optional | PRD, user stories, or business rules to guide discovery |
| Test accounts for roles | Optional | Test flows and permissions behind authentication |
| Figma token export | Optional | Design tokens and reference baselines for design checks |

**Run phases**

1. **URL-First Front Door.** Enter a single URL. Preflight checks ensure the target is reachable.
2. **Discover.** The spider navigates pages, maps layout groups, inspects forms, and synthesizes 3–5 core journeys.
3. **Plan Review.** The interactive Blueprint site map displays journeys, questions, and tests. Users can adjust journeys, answer ambiguity questions, or describe tests in plain English.
4. **Approve & Test.** The runner executes tests across breakpoints (375px, 768px, 1440px), capturing screenshots, DOM, logs, and Web Vitals.
5. **Evaluate.** Checkers evaluate Works, Accessible, Fast and mobile, Findable, Secure, and Looks and reads well.
6. **Report.** A–F aspect grades, ranked improvement recommendations, and a self-contained offline HTML report are published.

## AI discovery and QA confirmation

After signing in as each role and exploring the site, the AI agent generates discovery documents for QA to review and confirm. This step ensures the AI's understanding matches the product before tests run.

**Round 1: when the URL is added**

**What the AI discovers and generates**

- **Flow documentation.** User flow (steps per role), app flow (pages and navigation), and inferred business rules (validation, calculations, state transitions).
- **Test case matrix.** One row per discovered flow or feature; columns for role, start page, steps, expected result, and edge cases (empty input, invalid value, boundary value, back-button behavior).
- **Permission matrix.** Which role can see and do what, inferred from what the AI observed on the site.
- **Page and element inventory.** Every page, form, input, button, modal and other interactive element the AI found.

**QA's review during Confirm**

- Confirm the flows are correct, or edit the AI's descriptions.
- Mark any flows or elements out of scope for this run.
- Flag if the AI missed a flow, and describe it for the AI to add a test case.
- Confirm the role permissions, or correct them.
- Approve the test case matrix, or edit expected results.

Everything QA confirms becomes the spec for testing, and the confirmed flow document becomes the permanent record for that release.

**Round 2: after discovery**

- Found a form with no test case. What should happen after a valid submit?
- Found a page or action missing from the permission matrix. Which roles should have access?
- Found an element that triggers a download, email, payment or delete. Allow, skip or use a safe alternative?
- Found pages not linked from any flow in the spec. Test with generic checks only, or mark out of scope?

Every answer is saved to the product profile, so the next run asks only about what is new or changed. Answers become part of the expected behavior the checkers compare against.

## AI-generated test cases and expected outcomes

After QA confirms the test case matrix, the AI generates executable test cases in a structured JSON format. Each test case includes the steps to take, the expected outcome, and validation rules. The test runner executes these deterministically and compares the actual behavior against the AI-generated expectations.

A spec file defines flows, the steps in each flow, the expected result of each step, business rules and a role permission table:

```json
{
  "testCases": [
    {
      "id": "TC-001",
      "flowId": "create-invoice",
      "role": "manager",
      "startPage": "/invoices",
      "steps": [
        { "action": "click", "selector": "[data-testid=new-invoice-btn]", "name": "New invoice" },
        { "action": "fill", "selector": "[data-testid=customer-field]", "value": "Test Co", "name": "Customer" },
        { "action": "fill", "selector": "[data-testid=amount-field]", "value": "1200", "name": "Amount" },
        { "action": "click", "selector": "[data-testid=save-btn]", "name": "Save" }
      ],
      "expectations": {
        "url": { "pattern": "/invoices/*", "description": "Navigated to invoice detail page" },
        "text": { "contains": "Invoice created", "description": "Confirmation message" },
        "apiCall": { "method": "POST", "path": "/api/invoices", "status": 200 }
      },
      "validationRules": [
        { "field": "amount", "min": 1, "max": 1000000, "expectedError": "Enter an amount between 1 and 1,000,000" }
      ]
    }
  ]
}
```

**How the test runner uses it**

- **Steps** become deterministic actions; the runner clicks, fills and navigates exactly as described.
- **Expectations** are checked exactly: URL matches pattern, text appears, API calls succeed.
- **Validation rules** generate extra test points automatically: boundary values, empty and invalid inputs, and checks that the expected error message appears.
- **Edge cases** (back-button, refresh, invalid session) are added per test case and tested for each role.

* **Steps and expectations** become test cases that pass or fail exactly.
* **Rules** generate extra test points automatically: boundary values (0, 1, max, max + 1), empty and invalid inputs, and checks that the stated error message appears.
* **Permissions** are checked against the observed role matrix.
* **Missing coverage** (flows the crawler found that the spec doesn't mention) feeds the round 2 setup questions.

Elements are located by `data-testid` first, which all three products will add to their interactive elements, then by visible label or accessible name as a fallback. Specs should reference `data-testid` values wherever possible so tests survive changes to layout and wording.

## Local testing through a tunnel

The runner runs on each developer's machine, so it tests that developer's local build directly on `localhost` by default. A free-tier tunnel with GitHub sign-in is used when the build runs somewhere else, or when a teammate needs to open the same build to reproduce a finding. This spec assumes Microsoft dev tunnels, which [let you sign in with a GitHub account](https://learn.microsoft.com/azure/developer/dev-tunnels/security) and keep tunnels private to their creator by default.

**What the tool must handle**

- **Changing URLs.** Tunnel URLs can change between sessions, so the URL is entered per run. Product profiles store paths (`/invoices`), never full hostnames.
- **Pre-flight check.** Before the crawl, the tool confirms the URL responds, the login page loads and each role can sign in. If not, the run stops with a setup error rather than hundreds of false failures.
- **Tunnel authentication.** Dev tunnels are private by default. The runner signs its requests with the tunnel's access token header (`X-Tunnel-Authorization`), so tunnels don't need to be opened to anonymous access.
- **Interstitial page.** Dev tunnels show a one-time anti-phishing page in browsers. The runner sends the `X-Tunnel-Skip-AntiPhishing-Page` header so tests start on the app itself.
- **Slower responses.** Over a tunnel, timeouts are longer and the runner limits parallel browser sessions so the machine and free-tier tunnel aren't overloaded.
- **Mid-run drops.** If the connection drops, the runner pauses, retries, and resumes from the last completed test point. Failures during the outage are marked as environment errors, not product bugs.
- **Host-dependent features.** Login redirects, SSO callbacks, CORS rules and cookie domains may be tied to a fixed host. The build must allow `localhost` or the tunnel host, or those flows will fail for environmental reasons.

**Security.** Keep tunnels private or limited to the company's GitHub organization, never anonymous. Use test data only, and close the tunnel when the run ends. Free-tier usage limits should be checked against the expected run volume across all developers.

## Multi-product setup

The tool is built as one generic engine with no product-specific code, so the same build serves all three products running in parallel. Everything that differs between products lives in a product profile.

| Profile field | Example |
| --- | --- |
| Product name and owner | Product A, QA lead for Product A |
| Staging URLs | One or more environments per product |
| Roles and test accounts | Admin, manager, member, viewer, each with credentials in the secrets manager |
| Spec files | YAML spec files for the current release |
| Figma file and approved frames | File link plus the frames that represent the current release |
| Forbidden actions | Product-specific additions to the defaults |
| House standards | Product-specific UX or design rules, if any |

Runs for different products execute in parallel in separate containers, and each product's reports, suppressions and history stay separate. Adding a fourth product means adding a profile, not writing code.

## Role and permission testing

QA provides one test account per role for each product, and the tool tests every flow and every interactive element under every role.

**Element inventory.** During discovery the tool lists every interactive element on every page it reaches: links, buttons, forms, inputs, dropdowns, toggles, tabs, modals and file uploads. Each element becomes a test point, per role, until it has been exercised or explicitly skipped (for example, a forbidden action).

**Role matrix.** The tool compares what each role can see and do and produces a matrix of page or action × role. It flags:

- **Permission leaks:** a lower role can see or perform something only a higher role should.
- **Over-restriction:** a role is blocked from something the spec says it should do.
- **Direct-URL access:** pages hidden in a role's navigation but still reachable by typing the URL.
- **Inconsistent UI:** a control shown to a role but failing with an error when used.

The observed matrix is checked against the permission matrix uploaded for each product (CSV or YAML: page or action × role, allow or deny). Differences become findings, and pages or actions missing from the uploaded matrix go to the round 2 setup questions.

## Full coverage execution

A run never stops at the first issue: it records each failure and moves on until every planned test point has a final status.

**Test point statuses**

| Status | Meaning |
| --- | --- |
| Passed | Executed and behaved as expected |
| Failed | Executed and produced one or more findings |
| Blocked | Could not be reached because an earlier step failed; linked to the blocking finding |
| Skipped | Deliberately not executed, such as a forbidden action; reason recorded |
| Could not verify | Executed, but the expected result is unclear; needs QA review |

**Continue-on-failure rules**

- On a failure, the runner captures evidence, logs the finding and returns to a known good state (reload, go back, or sign in again).
- If a step fails, the runner tries an alternative route to reach later steps in the same flow, such as direct navigation, so one bug doesn't hide the rest of the flow.
- Flaky steps are retried up to two times before being marked failed, and the retry count is recorded.
- A crashed browser session restarts and resumes from the last completed test point.

**Coverage report.** Every report opens with coverage: test points per status, per role and per flow, plus a list of pages and elements discovered but never reached. A run counts as complete only when no test point is left without a status.

## Flow documentation

Besides findings, every run produces living documentation of each flow it tested, so QA ends up with an up-to-date map of how each product actually behaves.

| Document part | What it captures |
| --- | --- |
| User flow | The steps a user takes, per role, with a screenshot of each screen and the action that leads to the next |
| App flow | Pages, routes, redirects, modals and the system states in between (loading, empty, error, success) |
| Business logic | Rules from the spec and setup answers, plus observed behavior such as validation messages, limits, conditional fields and state transitions |
| Role differences | Where the flow changes by role, taken from the role matrix |
| Data and integrations | Key API calls made during the flow and the data each step creates or changes |
| Edge cases tested | Empty inputs, invalid values, boundary values, back-button and refresh behavior |
| Linked results | Test points, statuses and findings for the flow |

Each flow document includes a diagram of the flow (steps and branches) generated from the recorded run. Documents are versioned per release, and the report highlights where a flow changed since the last release, which helps catch unintended changes even when nothing is technically broken.

## System architecture

The system has seven components: an AI agent for discovery and planning, deterministic checkers, and a hub to consolidate results.

| Component | Where it runs | Responsibility |
| --- | --- | --- |
| Local app | Developer machine | Add URL and context, review/confirm AI discovery and test cases, view the run's report |
| Discovery agent | API | Sign in as each role, explore the site, document flows and infer requirements |
| Test planner | API | Convert confirmed test cases into executable scenarios |
| Orchestrator | Developer machine | Manage all phases; pause, resume and retry |
| Test runner | Developer machine | Execute test scenarios; capture screenshots, DOM, logs and network traffic |
| Checkers | Developer machine | Compare evidence against test expectations, design tokens and UX rules |
| Report hub | Company server | Store product profiles, consolidate runs, serve consolidated reports |

**Integrations**

- **Figma API** to export design tokens, component definitions and reference frames.
- **Spec files** uploaded as YAML with each run and versioned per release.
- **Local repository** searched for `data-testid` values to point each finding to its source file and line.
- **Coding agents** read `.qa-report/findings.json` and `report.md` directly; no plugin needed.

Developers install one package. It contacts a vision-capable LLM API to discover flows and plan tests, runs everything locally on the developer's machine, and uploads findings to the hub. Each run uses a fresh browser profile with no access to production systems. No test case is written manually.

**Built with** Claude. The team builds the tool with Claude Code, which is included with the team's existing Claude Pro plans. The finished tool supports Bring Your Own Key (BYOK) for OpenRouter and AI providers. Running with an AI key is optional: when no key is configured, deterministic spidering, fixed heuristic planning, and rule-based checkers run completely offline.

## Core checkers

Each checker answers one question by comparing the test runner's evidence against test expectations and fixed rules.

| Checker | Question it answers | How it checks | Needs from QA |
| --- | --- | --- | --- |
| Bug detection | Does it work? | Console errors, uncaught exceptions, failed requests (4xx/5xx), broken links, elements that do nothing when clicked, pages that fail to load | Nothing beyond test accounts |
| Spec conformance | Did we build what we said? | Runs each spec test case and compares URL, visible text, element state and API responses with the expected values | The YAML spec and setup answers |
| Design and UI standards | Does it match the design? | Computed styles compared with Figma design tokens; visual diffs against approved baselines | Token export and approved baseline |
| UX quality | Is it accessible and easy to use? | axe-core for WCAG 2.2 AA, tap target size (>= 44px), color contrast, and dead ends | Optional house rules |
| Performance | Is it fast and mobile-ready? | Web Vitals (LCP, CLS, INP) in test browser, mobile horizontal overflow at 375px, overlapping interactive elements | None |
| Security | Are connections and headers secure? | Passive review of HTTPS, security headers (CSP, HSTS, X-Content-Type-Options), cookie flags (Secure, HttpOnly), mixed content, and passwords in URLs | None |
| SEO & link health | Can search engines and users find pages? | Page title, meta description, H1 and heading order, canonical URL, lang attribute, and broken internal links | None |

**Rule-based UX checks**

- Form submitted with invalid input shows no error message, or the error isn't next to the field.
- Action takes over 1 second with no loading indicator.
- Page has no way back or onward (dead end).
- Button or link text is duplicated with different destinations, or the same action uses different labels across pages.
- Tap targets smaller than 44 × 44 px on mobile breakpoints.
- Content overflows or overlaps at a breakpoint.
- Destructive actions (delete, remove, cancel) run without a confirmation step.
- Required fields are not marked, or placeholders are used instead of labels.

**Spec conformance output.** The checker produces a traceability table: one row per requirement, with its status (passed, failed, partial, could not verify) and linked evidence. "Could not verify" is always shown explicitly rather than hidden or counted as a pass.

**Design checks by breakpoint.** Default breakpoints are 375px (mobile), 768px (tablet) and 1440px (desktop), adjustable per project.

**House standards.** Teams can add their own rules as configuration, such as approved button labels, a required confirmation pattern or a maximum form length. Each rule becomes a check applied on every run.

## Public website analysis mode

For sites we don't own, the tool runs a read-only analysis of publicly reachable pages and produces a flow comparison, not a bug report.

**Constraints**

- No account creation, logins, form submissions, purchases or any action with side effects.
- Low request rate (for example, no more than one page load every few seconds) and a cap on pages per run.
- Respect each site's robots.txt and terms of use; skip sites whose terms prohibit automated access.
- Runs require a named internal owner and a stated purpose.

**Output**

A structured walkthrough of the target flow (for example, pricing page to plan selection), with screenshots, step counts, notable patterns, and a side-by-side comparison with our equivalent flow.

## Findings, severity and consolidation

Every finding carries a severity, its source and evidence. The tool never blocks a release and sends no chat notifications: it consolidates results from every developer's runs into one report per product and release.

| Severity | Meaning | Report placement |
| --- | --- | --- |
| Blocker | Breaks a core flow, loses data, or fails a must-have requirement | Top of the report and first in `findings.json` |
| Major | Significant bug, requirement gap or accessibility failure with a workaround | Listed after blockers |
| Minor | Cosmetic issue, small design drift, low-impact UX problem | Grouped section |
| Suggestion | Improvement idea, not a defect | Collapsed section |

**Consolidation.** Each runner uploads its results to the report hub on the company server. The hub merges runs from all developers for the same product and release, removes duplicate findings, keeps the latest status for each test point, and publishes one consolidated release report.

## Report delivery

There are no chat notifications. Every run writes a fix-ready report into the developer's project folder, in a form the developer or a coding agent such as Claude Code can act on directly, and uploads the same report to the hub.

**Output files per run**

- `.qa-report/report.md`: readable summary, coverage, and one section per finding.
- `.qa-report/findings.json`: the same findings in a fixed schema for agents and scripts.
- `.qa-report/evidence/`: screenshots, DOM snapshots, network logs and a Playwright reproduction script per finding.

A developer can then tell a coding agent "fix the blockers in `.qa-report`", and the agent has everything it needs without the developer re-explaining the issue.

**What every finding contains**

| Field | Content |
| --- | --- |
| Where | URL path, role, breakpoint, `data-testid` and CSS selector |
| Source location | File and line found by searching the local repo for the element's `data-testid` |
| Steps to reproduce | Numbered steps plus a runnable Playwright script |
| Expected vs actual | The spec value, rule or token, next to what the build did |
| Resolution | A concrete fix from the rule's resolution template (examples below) |
| Verify | A command that re-runs only this test point, such as `qa-check verify F-012` |

**Resolution templates.** Each rule ships with a fixed, fill-in-the-blanks resolution, so resolutions stay deterministic:

| Finding type | Example resolution |
| --- | --- |
| Design token mismatch | Change `color` from `#1F6FEB` to token `--color-primary` (`#2563EB`) in `Button.tsx:42` |
| Accessibility (axe-core) | The rule's own remediation guidance, such as "Add an accessible name to this button", with the WCAG reference |
| Spec step failed | After clicking `save-invoice`, expected text "Invoice created"; got a 500 from `POST /api/invoices`. Check the handler for this endpoint |
| Missing validation message | Submitting `amount = 0` showed no error. Spec expects "Enter an amount between 1 and 1,000,000" next to the field |
| Permission leak | Role `viewer` can open `/settings/billing`; permission matrix says deny. Add a server-side role check to this route |

For logic failures, the tool can show exactly where and how the build differs from the spec, but not the root cause in the code; the developer or coding agent diagnoses that from the source code the tool identified. After a fix, running `verify` confirms it and updates the finding's status on the hub.

## Tech stack and prerequisites

**Local runner (per developer machine)**

- **Language & CLI**: Node.js with TypeScript. Installed via `npm install -g @qa/flow-tester`.
- **Browser automation**: Playwright (bundled with the CLI).
- **Local storage**: SQLite (runner cache) + filesystem (`.qa-report` output).
- **UI for setup/review**: Web-based dashboard served on `http://localhost:3000` from the runner process. Built with React.

**APIs and services**

- **Claude API key**: For discovery agent and test planner. Stored in OS keychain (via `keytar` npm package). Never in logs or `.qa-report`.
- **Microsoft Dev Tunnels**: Free tier, GitHub sign-in. CLI tool `devtunnel` (Microsoft provides binaries).
- **Figma API** (optional): Token export only. Read-only access.

**Report hub (company server, one instance)**

- **Backend**: Node.js or Python (Flask/FastAPI). Lightweight.
- **Database**: PostgreSQL.
- **Storage**: S3-compatible (MinIO, AWS S3, or similar) for evidence (screenshots, video, network logs).
- **API**: REST endpoints for runners to upload results, and for QA to fetch consolidated reports.

**Prerequisites before Phase 1**

- Claude API account and key (team-wide or per-developer; decide early).
- Node.js v18+ installed on all developer machines.
- One company server with Postgres and object storage ready for the hub (or a light AWS/cloud alternative).
- All three products have `data-testid` attributes added to interactive elements (staggered per product, OK to do this in Phase 1 alongside other work).
- Figma files exported or API tokens ready (optional, needed for design checks in Phase 2).
- Permission matrices for each product drafted (CSV or simple JSON).

## Optional AI mode

The tool works fully without AI, and each user can optionally add their own AI API key in settings to unlock extra features. AI mode is off by default, adds to the deterministic checks rather than replacing them, and every AI output is labeled as AI-generated in the report.

**Features unlocked by an API key**

| Feature | What it adds | Without a key |
| --- | --- | --- |
| Spec drafting | Drafts the YAML spec from a PRD or user story inside the tool, then runs the same validation | Draft specs with an AI assistant outside the tool |
| Guided setup | Suggests answers to round 1 and round 2 questions from the crawl and the PRD, for the user to confirm | User answers every question |
| Root-cause hints | Reads the evidence and the source file found via `data-testid` and suggests a likely cause and code fix | Template resolution only; developer or coding agent diagnoses |
| UX review | Adds a heuristic UX review of screenshots on top of the rule-based UX checks | Rule-based UX checks only |
| Flow summaries | Writes a plain-language summary of each documented flow | Structured flow documentation only |

**Key handling**

- Keys are entered in the local app and stored in the operating system's keychain on the developer's machine. They are never uploaded to the report hub or written to reports, logs or `.qa-report` files.
- Each user uses their own key, so usage and billing stay with that user's API account. Claude Pro plans do not include API access, so a key comes from a separate Claude Console account.
- The provider sits behind a small adapter interface. Claude is the first supported provider; others can be added later.

**Controls**

- Each AI feature can be switched on or off separately, per user and per product.
- The report shows the model used, the number of AI calls and the approximate cost for the run.
- In AI mode, screenshots, page content and relevant source snippets are sent to the provider. The settings screen shows this before the key is saved, and QA can disable AI mode for a product if its data must not leave company systems.
- Deterministic results never depend on AI: removing the key leaves every non-AI check and finding exactly the same.

**Each finding includes:** title, checker, severity, source (spec test case, generated test point or generic rule), affected page and breakpoint, reproduction steps, screenshots or video clip, and the spec requirement or design token it relates to.

**Feedback loop.** Reviewers can mark any finding as confirmed, intended or false positive. Intended and false-positive findings are suppressed in future runs unless the underlying page changes. Each report highlights what is new, what is fixed and what is still open since the last release.

**Noise control.** Similar findings are grouped (for example, one token mismatch across 20 buttons becomes one finding). Findings from steps that passed on retry are marked flaky and collapsed by default.

## Safety and guardrails

The runner clicks and submits automatically, so the system limits where it can go and what it can do by default.

- **Domain allowlist.** The crawler never leaves the host of the URL given for the run. Any other URL runs in public read-only mode.
- **No production.** Production domains are blocked for full testing.
- **Default forbidden actions.** No real payments, no emails or messages to real addresses, no deleting shared data, no changing account-wide settings. Projects can add more.
- **Test data only.** Runs use dedicated test accounts and seeded data, reset between runs where possible.
- **Credential handling.** Test credentials are stored in a secrets manager, injected at run time, and never written to logs or reports.
- **Tunnel protection.** Tunnels are protected with access controls or basic auth and closed after each run.
- **No external data sharing.** With AI mode off, screenshots and page content stay on company infrastructure. AI mode can be disabled per product.
- **Audit log.** Every run records who started it, the target, and every action the runner took.

## Milestones

The rollout has four phases. Each phase must pass its exit criterion before the next begins, and durations are estimates for a team of two to three engineers.

| Phase | Scope | Exit criterion | Estimate |
| --- | --- | --- | --- |
| 1. Pilot | Generic engine, product profiles, spec validation, crawler, full-coverage runner, bug detection and spec conformance; all flows in all three products | Every flow in all three products runs end to end, and the tool finds at least the issues QA found manually on a real release | 6–8 weeks |
| 2. Full checkers | Role matrix against uploaded permission matrices, element inventory, design-token checks, screenshot diffs, rule-based UX checks and accessibility | All roles and elements covered; QA rates most findings as useful | 4–6 weeks |
| 3. Hub and docs | Report hub, consolidation across developers, fix-ready report files with resolutions and verify command, flow documentation, feedback loop and suppressions | QA reviews one consolidated report per product release without manual merging | 4 weeks |
| 4. Scale | House-standard rules, public website analysis mode, quality-of-life improvements | Every release of all three products passes through the tool | Ongoing |

## Success metrics

The tool is working if it finds real issues early, stays low-noise and saves review time. Targets below are starting proposals to be set with the QA team after the pilot.

| Metric | How measured | Proposed target |
| --- | --- | --- |
| Precision | Share of findings reviewers mark as confirmed | 70% or higher |
| Escaped defects | Bugs found after release that the tool should have caught | Down 30% vs the pre-tool baseline |
| Unique catches | Confirmed findings the manual QA pass missed | At least a few per release |
| Spec coverage | Share of requirements marked passed or failed, not "could not verify" | 80% or higher |
| Run time | Staging URL submitted to report ready | Under 3 hours for a full run of one product |
| Review time saved | QA and design review hours per release, before vs after | Down 25% |
| Cost per run | Infrastructure cost (no model costs) | Tracked; budget set after pilot |
| Test point completion | Share of planned test points (all roles, all elements) with a final status | 100% every run |

## Risks and open questions

The biggest risk moves from AI noise to spec upkeep: the tool is only as good as the spec files and setup answers, so writing and maintaining them must be cheap.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AI-drafted specs contain mistakes | False failures or missed checks | Validation on upload, human review before first use, spec templates per product |
| Specs drift from the real build | False failures | Specs versioned per release; round 2 questions flag unmatched pages and elements |
| Pilot scope (all flows, three products) is large | Pilot takes longer than planned | Pilot limited to bug detection and spec conformance; other checkers follow in phase 2 |
| Results differ between developer machines | Inconsistent findings | Pinned browser and tool versions in the package; hub records machine and version per run |
| Free-tier tunnel limits or instability | Failed or slow runs | `localhost` by default; tunnels only when needed; pre-flight check and pause and resume |
| No detection of subtle logic errors | Bugs the spec didn't describe slip through | Encourage rules and expected values in specs; keep manual exploratory QA for new features |
| Figma out of sync with intended build | Spurious design findings | Compare against approved frames only, or against an approved baseline screenshot |

**Open questions**

- [x] Who drafts and reviews each YAML spec? Product owners, QA and developers all draft specs with AI and review them.
- [x] Which tunnel service? Microsoft dev tunnels, free tier, GitHub sign-in.
- [x] Where is the report hub hosted? On the company's own server.
- [x] Where do results go? No chat notifications; each report is delivered in a form a developer or a coding agent can act on directly, with resolutions.
- [x] Which flows should the pilot cover? All flows in all three products.
- [x] Who writes the YAML spec? The product team drafts it using AI, outside the tool.
- [x] Where does the runner run? On each developer's machine.
- [x] Is there a permission matrix per product? Yes; it is uploaded to the tool.
- [x] Can the team add `data-testid` attributes? Yes, in all three products.
- [x] Block releases or notify? Never block; consolidate results.
- [x] Which product should the pilot use? All three, with one generic engine.
- [x] Who owns the tool? QA.
- [x] AI at run time? Optional and off by default; each user can add their own API key.
