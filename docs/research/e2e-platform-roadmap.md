# Roadmap: from website check-up to end-to-end testing platform

Written 2026-10-05 from the seven research files in [e2e-platform/](e2e-platform/00-brief.md). Facts are checked as of that date. Every claim below traces to a cluster file, which holds the links and the *(vendor claim)* and *(unverified)* labels. Where this page says "unverified", the cluster file explains why.

Clusters: [01 web e2e and AI](e2e-platform/01-web-e2e-ai-testing.md) · [02 visual, browsers, reporting](e2e-platform/02-visual-crossbrowser-reporting.md) · [03 accessibility](e2e-platform/03-accessibility-compliance.md) · [04 performance](e2e-platform/04-performance-cwv.md) · [05 security](e2e-platform/05-security.md) · [06 API](e2e-platform/06-api-testing.md) · [07 mobile, desktop, costs](e2e-platform/07-mobile-desktop-costs.md)

## The short version

- **The direction holds up.** Nobody free and maintained does "crawl a site, plan the tests, run them deterministically, give a plain verdict, hand back code you own" for a team with no QA staff. The market is moving the other way: agent-first tools that assume a developer at a terminal with an AI coding tool.
- **Several current checks are wrong or unfinished, and fixing them comes before adding anything.** INP is never measured, the LCP check can report a different number under the LCP name, a failed axe scan looks like a pass, and three features the glossary describes exist only as unused library code (section 1).
- **The cheapest, highest-value additions are small.** A Playwright export of the approved Plan, API checks from the traffic the browser already records, an approve button for visual baselines, a findings file built to be pasted into AI coding tools, and a CI exit code.
- **Real devices cannot sit in a $0 free tier.** Firebase Test Lab's free quota ends when it shuts down on 30 Sep 2027, and no farm replaces it. Phone-app runs belong on the user's own accounts and CI. Mobile web on real WebKit is the cheap second engine.
- **Free hosting is less safe than it looked.** Oracle halved its Always Free Arm allowance on 15 Jun 2026 without an announcement. Plan for two hosting locations and a daily limit per user.
- **Security Probes and Verified Domains need work and legal review before they ship**, and the current `isTestHost` check is not safe on shared machines.

## 1. Current state

Described from the code, not from `docs/PRODUCT_GUIDE.md`. The cluster agents checked each point; I re-checked the ones marked ✓.

**What works today**

- Websites only, Chromium only ([browser.ts](../../packages/core/src/browser.ts)).
- The Deterministic Spider crawls up to 200 pages per role, groups pages into Layout Groups and picks Sample Pages. The AI Planner writes every Plan Item, and a person approves the Plan before anything runs.
- Checkers: bug detection, spec conformance, `ux-quality` (axe plus tap targets and overflow), `performance`, `seo`, `aeo`, `geo`, `security`, `permission-matrix`, `design-standards` (design tokens, pixelmatch diff, AI visual review).
- Six area scores, a "Ready to release" or "Not ready yet" verdict, and reports as HTML, Markdown and JSON. Findings carry expected and actual, steps, a Playwright repro, a fix suggestion and a `verifyCommand`.
- Email and password sign-in per role, with sessions reused through Playwright storage state.
- Live sites are only looked at: POST, PUT, PATCH and DELETE are aborted ([live-site.ts](../../packages/core/src/live-site.ts)). Forms are sent only on a Test Copy.

**What the research found is wrong or unfinished**

| Finding | Where | Cluster |
|---|---|---|
| INP is never measured. The `inpMs` field exists and nothing fills it, so no INP finding can appear. ✓ | `performance.ts` | 04 |
| With no LCP entry, the check falls back to `domContentLoadedEventEnd` and still titles the finding "Largest Contentful Paint". | `performance.ts` | 04 |
| CLS is summed over the page's whole life. web.dev defines it as the largest burst of shifts (under 1 s apart, within a 5 s window). | `performance.ts` | 04 |
| One load per page, no throttling, no repeat runs. The page-weight limit is defined but never used. | `performance.ts` | 04 |
| A failed axe scan is swallowed in an empty `catch` and looks like a pass. Only the first failing element per rule is reported. axe's "needs a person" results are ignored. Findings name the axe rule, not the WCAG criterion. | `ux-quality.ts` | 03 |
| The tap-target rule tests 44 px. The WCAG 2.2 AA minimum is 24 px, so it is stricter than the standard and should be labelled that way. | `ux-quality.ts` | 03 |
| The brief and glossary say WCAG 2.1 AA, but the code already passes `wcag22aa` to axe. The docs are out of date. | `ux-quality.ts`, CONTEXT.md | 03 |
| `RetryRunner` (the source of "flaky passed"), the Account Pool and Entity Namespacing have no callers in `packages/*/src`. The Hub's `flakyFlowsCount` is a hard-coded `0`. ✓ | `core`, `hub` | 01 |
| The CLI prints "BLOCKERS FOUND" but exits with an error code only for run failures, not for a Blocker verdict. There is no GitHub Actions workflow in the repo, though the brief mentions one. ✓ | `cli/src/index.ts` | 02 |
| The `SameSite` cookie finding fires only when `Secure` is also missing, so it misses `SameSite=None` on a Secure cookie. | `security.ts` | 05 |
| `isTestHost` judges the hostname text only. A hostname that resolves to a private address, or any typed "staging" host, is accepted. Fine on the user's own computer, not on shared machines. | `live-site.ts` | 05 |
| Network capture keeps URL, method, status and time only. Nothing is kept between check-ups to compare against. | `evidence.ts` | 06 |
| Live-site POST blocking also blocks GraphQL queries and search APIs that use POST. The pages break, and the failures are kept out of findings. | `live-site.ts` | 06 |
| The only code export is a one-off `repro-<finding>.ts`. | `repro-generator.ts` | 01 |

**Not found in code:** self-healing, an AI explorer, test-inbox support, CAPTCHA, one-time-code or magic-link handling, a link from a Requirement to a Plan Item, any consent or cookie check, and a baseline approval step in the browser.

## 2. Who it's for and the limits

These were decided on 3 and 5 October and are not reopened here.

- **Users:** founders and developers at small firms with no QA staff. QA testers are second. The plain-language verdict stays on top and developer detail goes underneath.
- **Alternatives:** their own Playwright or Cypress scripts, and free point tools (Lighthouse, PageSpeed Insights, the axe extension). AI testing services come second.
- **Delivery:** in the browser with nothing to install, $0 hosting until revenue. Website check-ups run on always-free cloud machines with a daily limit per user. Mobile and heavy use run on the user's own accounts and CI.
- **Money and licence:** a free tier plus monthly USD plans. The first check-up runs on our AI key, then users bring their own. Source-available (FSL), sold self-serve worldwide.
- **Order of work:** web depth (with API checks from recorded traffic), then mobile web on real WebKit and Android Chrome, then store apps through one driver, then desktop.
- **Safety:** read-only checks on any site. Security Probes only on Test Copies. On shared machines a Test Copy must sit under a Verified Domain.
- **Playwright:** export approved Plans first, import users' suites later.
- **Findings** go out as Markdown and JSON, with no tracker integrations. Hand-testing workflows wait. Only the opt-in AI explorer for now.

One builder, a few people trying it, nobody paying yet. That is why every row below is judged on effort as well as value.

## 3. Capability gap table

**Verdicts:** **Now** = build next, within web depth. **Later** = worth doing, after current priorities. **Connect** = use another tool. **Skip** = not for these users. Cells for each App say what applies: ✔ yes, a short note, or – not applicable.

### Fix what misleads first

| # | Capability | Verdict | Website | Phone app | Desktop app | API | Why | Cluster |
|---|---|---|---|---|---|---|---|---|
| 1 | Correct the performance check: real lab INP, no fake LCP fallback, burst-based CLS, throttling, median of repeat runs | **Now** | ✔ | – (device farm, later) | Electron later | latency is in row 9 | Users who trust it get false findings | 04 |
| 2 | Correct the axe check: show scan failures, all elements, "needs a person" list, WCAG criterion numbers, 2.2 wording | **Now** | ✔ | other engines | other engines | – | A failed scan reads as a pass | 03 |
| 3 | Wire in Clean Flow Retry and "flaky passed"; fix `flakyFlowsCount` | **Now** | ✔ | ✔ matters more (flakier) | ✔ | ✔ | The model is ahead of the product | 01 |
| 4 | Fix the `SameSite` gap and widen mixed-content checks (CSS, script-made fetches) | **Now** | ✔ | – | renderer page | headers | Small and certain | 05 |

### Web depth

| # | Capability | Verdict | Website | Phone app | Desktop app | API | Why | Cluster |
|---|---|---|---|---|---|---|---|---|
| 5 | Export the approved Plan as Playwright tests (per role, env-var credentials, storage state) | **Now** | ✔ | own driver format later | – | API checks as Playwright `request` tests | The exit door that makes a source-available tool safe to adopt; cheapest feature here | 01, 06 |
| 6 | Discovery crawl and Layout Groups | **Now** (finish, don't rebuild) | ✔ | app version later (row 33) | – | – | The strongest asset; works with no AI key | 01 |
| 7 | Capture API calls during the crawl (timing, content type, fetch/XHR, JSON shape), redacted before disk | **Now** | ✔ | farm HAR later | Electron later | ✔ | Cheap, already wired; redaction is not optional (Okta HAR precedent) | 06 |
| 8 | Group endpoints, infer shapes and auth, per role | **Now** | ✔ | later | later | ✔ | In-process TypeScript, no extra service | 06 |
| 9 | API checks: hidden errors (200 with GraphQL `errors`), slow endpoints, shape drift, error-body leaks, no-session replay, other-role replay (GET and HEAD only) | **Now** | ✔ | later | later | ✔ | No extra requests for the first four; replay limited to the user's own roles | 06 |
| 10 | Shape and latency diffs between check-ups | **Now** | ✔ | later | – | ✔ | Small, no AI; removals must repeat in two check-ups to count | 06 |
| 11 | Decide whether a POST that parses as a GraphQL `query` may pass on live sites | **Now** (a decision) | ✔ | – | – | ✔ | Otherwise GraphQL sites silently fail | 06 |
| 12 | Keyboard traversal with focus-obscured and trap checks; 320 px reflow | **Now** | ✔ (Tab and focus only on live sites) | platform tools | platform tools | – | Deterministic; covers criteria axe can't | 03 |
| 13 | CrUX real-visitor panel with a "not enough visitor data" state; stored medians and "slower than last check-up" | **Now** | ✔ | Play and Apple data, connect | – | median latency (row 10) | Free API, no hosting cost; lab number must stand alone for small sites | 04 |
| 14 | Page weight against the 4 MB limit; first-party and third-party requests separated | **Now** | ✔ | – | – | – | Already collected | 04 |
| 15 | Visual baselines: old, new and diff in the report with an "Approve as new baseline" button; page stabilising and masking | **Now** | ✔ | per-device baselines later | Electron later | – | Approval is a CLI flag today; ads and dates will cause false alarms | 02 |
| 16 | WebKit and Firefox pass over Sample Pages, labelled "WebKit (Playwright build)", never "Safari" | **Now** (step 2 of the order) | ✔ | mobile web | – | – | Cheapest real second engine; runs on Linux | 02, 07 |
| 17 | Read-only security: CSP quality, CORS (passive), Subresource Integrity, source maps, `security.txt`, API error bodies | **Now** | ✔ | web backend | renderer page | ✔ | Adds no requests beyond what a visit sends | 05 |
| 18 | Findings contract: `schemaVersion` and published JSON Schema, fingerprint in `findings.json`, one Markdown brief per finding, `fix-these.md`, AGENTS.md snippet, committed `known-findings.json` | **Now** | ✔ | ✔ | ✔ | ✔ | This is the "no tracker" answer; most of the data already exists | 02 |
| 19 | Report extras: trend strip from site history, single-file share export, release record (Release Target, who approved, date, verdict, known findings) | **Now** | ✔ | ✔ | ✔ | ✔ | Hosting-free and covers the audit trail small teams need | 02 |
| 20 | CI: `--fail-on blocker\|major` exit code, job summary, annotations, preview-URL workflow template | **Now** | ✔ | once the driver runs in CI | – | ✔ | A few lines each; today there is no workflow and no verdict exit code | 02 |
| 21 | Hosted Linux runner with a daily limit per user, plus a second hosting location | **Now** (delivery) | ✔ | – | – | – | Oracle's cut shows one host is not enough | 07 |
| 22 | Free-key warnings (Gemini free tier trains on content) and a clearer AI Request Budget | **Now** | ✔ | ✔ | ✔ | ✔ | Privacy surprise; OpenRouter free is 50 a day under 10 credits | 07 |
| 23 | Verified Domain (file, meta tag, DNS) with re-verification, public-suffix handling and resolved-IP checks; fix `isTestHost` for shared machines | **Now** (with hosting, before any Probe) | ✔ | – | – | ✔ | Prerequisite for hosted Test Copies | 05 |

### Web depth, second wave

| # | Capability | Verdict | Website | Phone app | Desktop app | API | Why | Cluster |
|---|---|---|---|---|---|---|---|---|
| 24 | Signed-in work: better sign-in detection and "why it failed" wording (meaning A); journeys plus namespaced test data on Test Copies (meaning C) | **Now** once users confirm which they mean | ✔ | sign-in is a screen | – | – | See section 7 | 01 |
| 25 | Blocked sign-in (CAPTCHA, 2FA, magic link): say what blocked us; vendor test keys on Test Copies; TOTP | **Later** | ✔ | – | – | – | Only if users say they are blocked | 01 |
| 26 | Solve CAPTCHAs | **Skip** | – | – | – | – | Conflicts with deterministic tests and bot-protection terms *(terms unverified)* | 01 |
| 27 | Self-healing selectors: AI proposes a fix, a person approves, the test stays deterministic | **Later** | ✔ | accessibility ids help | – | – | Matters only once Plans are saved and re-run, which waits on row 5 | 01 |
| 28 | Opt-in AI explorer, Test Copies only, everything it does saved as a Plan | **Later** | ✔ | app version later | – | – | Existing Safety Filter and Test Copy rules are a better safety story than competitors publish | 01 |
| 29 | Plain-language test authoring | **Later** | ✔ | shared layer | – | – | Competitors need the user's AI tool or a cloud account | 01 |
| 30 | Re-run only what failed or changed (Site Memory content hashes) | **Later** | ✔ | – | – | ✔ | A small site's whole Plan runs in minutes | 01 |
| 31 | AI-assisted test prioritisation, a quarantine service, a Pact-style contract broker | **Skip** | – | – | – | – | Built for large suites or two cooperating teams | 01, 06 |
| 32 | Requirement tags in the export, covered and uncovered list in the report | **Later** | ✔ | ✔ | ✔ | ✔ | Cheap once the export exists; no test-management product | 01 |
| 33 | Test data: create and clean up with a namespaced prefix on Test Copies | **Later** | ✔ | ✔ | ✔ | ✔ | Needs Test Copy; live sites get no data written | 01, 06 |
| 34 | Test email and SMS inboxes | **Connect** (MailSlurp free plan first) | ✔ | ✔ | – | – | Not worth building | 01 |
| 35 | Accessibility: guided manual checklist; draft accessibility statement as Markdown; reduced-motion check | **Later** | ✔ | per platform | per platform | – | The honest bridge to ADA and EAA; never "compliant" | 03 |
| 36 | Overlays; an automatic VPAT or ACR | **Skip** | – | – | – | – | FTC order against accessiBe, April 2025; a VPAT needs a person's judgement | 03 |
| 37 | Consent, tracker-before-consent and Global Privacy Control check | **Later** | ✔ | SDK flows out of scope | – | – | Read-only; keep it out of the accessibility score | 03 |
| 38 | TLS and redirect checks (read the certificate in-process), SPF and DMARC | **Later** | ✔ | – | – | ✔ | SSL Labs bars commercial use | 05 |
| 39 | Known-CVE libraries, secrets in bundles | **Connect** (Retire.js, Gitleaks data) | ✔ | – | – | – | Don't keep our own vulnerability list | 05 |
| 40 | Security Probes: write-method access control, sign-in rate limits, sessions and CSRF, open redirects, exposed files, a small capped injection set | **Later**, Test Copies only | ✔ | backend only | – | ✔ | Needs row 23 and counsel's review first | 05 |
| 41 | ZAP active scan, Nuclei DAST, Schemathesis fuzzing | **Connect** (user's CI or machine) | ✔ | – | – | ✔ | Heavy, and exactly what owners' alarms are built to catch | 05, 06 |
| 42 | OpenAPI check of recorded traffic if a spec is found; OpenAPI draft export | **Later** | ✔ | – | – | ✔ | Ask whether users publish a spec | 06 |
| 43 | SARIF export for GitHub's Security tab | **Later** | ✔ | ✔ | ✔ | ✔ | Private-repo terms unchecked | 02 |
| 44 | PR comments from the user's own `GITHUB_TOKEN`; a GitHub App for check runs | **Connect**; **Skip** the App | ✔ | ✔ | – | ✔ | A GitHub App is a heavy connection | 02 |
| 45 | Real Safari and real devices | **Connect** (TestMu AI, BrowserStack, Sauce Labs on the user's account) | ✔ | ✔ | – | – | Don't resell a grid | 02, 07 |
| 46 | Test management, roles, SSO, audit logs, ReportPortal | **Skip**; JUnit and JSON export so QA testers can use Qase | ✔ | ✔ | ✔ | ✔ | Cheapest credible version is row 19 | 02 |
| 47 | Visual AI engine | **Skip** | ✔ | – | – | – | The existing AI review plus a person approving is enough | 02 |
| 48 | Real-user monitoring; always-on monitoring | **Connect** (web-vitals, Vercel Speed Insights, Checkly free plan) | ✔ | Android vitals, MetricKit | – | ✔ | Needs hosting and user data | 04, 06 |
| 49 | Soft-navigation timing for single-page apps | **Later** | ✔ | – | – | – | Not shipped in stable Chrome; use hard loads per route now | 04 |
| 50 | Load testing | **Skip** built in; **Connect** k6 or Artillery; script generator **Later** | ✔ | – | – | ✔ | Unreliable on shared machines, counts as a Probe, k6 is AGPL | 04 |
| 51 | gRPC | **Skip** | – | – | – | rare | Not in target users' web apps | 06 |

### Beyond the website

| # | Capability | Verdict | Website | Phone app | Desktop app | API | Why | Cluster |
|---|---|---|---|---|---|---|---|---|
| 52 | Android Chrome mobile web | **Later**, in the user's CI or farm | ✔ | mobile web | – | – | Android emulators cannot run inside a VM, so not on free cloud VMs | 07 |
| 53 | Store apps through Maestro: Plan to YAML flow, APK upload or CI upload, run on emulators in the user's CI | **Later** (step 3) | – | ✔ | – | – | One black-box driver for React Native, Expo, Flutter and native | 07 |
| 54 | Real iPhone runs | **Connect** (farm drivers, Appium fallback) | – | ✔ | – | – | Maestro supports iOS simulators only | 07 |
| 55 | App Spider and Layout Groups (screen fingerprint from the view tree) | **Later**, start with fixed taps from the Plan | – | ✔ | – | – | Firebase Robo is the precedent | 07 |
| 56 | App accessibility audits (Android ATF, iOS `performAccessibilityAudit`); app startup and frames from the farm run | **Later** | – | ✔ | – | – | Run inside the user's UI-test build or farm | 03, 04 |
| 57 | MobSF static analysis of the build | **Connect** (separate process, GPL-3.0) | – | ✔ | – | – | Keep out of the FSL product | 05 |
| 58 | Public API as its own App (spec or sample calls, one token per role) | **Later**, after phone apps | – | – | – | ✔ | Most pieces come from rows 7 to 10 | 06 |
| 59 | Phone-app backend traffic | **Later**: read the farm's HAR, never run our own proxy | – | ✔ | – | ✔ | Pinning, user CA distrust, Android 17 certificate transparency | 06 |
| 60 | Desktop apps | **Skip for now**; Electron first when asked | – | – | ✔ | – | No user has asked; Electron reuses the Playwright path | 07 |

## 4. One section for each kind of App

### Website (now)

Everything marked **Now** above. The plain verdict talks about the site ("your order page's data call got slower", "a signed-out visitor can read `/api/me`"), and endpoint tables, criterion numbers and Playwright code go in the developer detail. Three rules protect trust: lab speed numbers come from medians and say the run count, the report says "WebKit (Playwright build)" and never "Safari", and no screen ever says "compliant" or "secure". Say what was checked and what was not.

### Phone app

- **Mobile web first.** WebKit and Firefox on Sample Pages, then Android Chrome in the user's CI. A Playwright WebKit build is real WebKit but runs ahead of Safari releases and has no Safari interface. It finds layout and JavaScript problems Safari would also show. It does not prove "works on an iPhone".
- **Store apps through Maestro.** It is Apache-2.0, free locally, works at the UI layer across React Native, Expo, Flutter and native, and farms accept it. A Plan becomes a YAML flow the user can keep, as with the Playwright export. Costs: iOS runs on simulators only, which need macOS, and Maestro's own AI commands route through Maestro Cloud, so we use only its deterministic commands and keep AI in our own provider layer.
- **Builds.** Android is easy: an APK, or an AAB converted with bundletool. iOS is the constraint. A simulator build needs macOS to make and to run, and a real-device IPA needs the user's signing setup. Start with "the user's CI uploads the build" plus an APK upload.
- **Money.** Real-device farms start at $175 to $250 a month, or $0.17 a minute on AWS Device Farm after 1,000 free minutes once. Firebase Test Lab's free daily quota goes when it shuts down on 30 Sep 2027, and its replacement needs billing. Our free tier cannot include real devices. Emulators in the user's own CI are the free path.
- **Backend traffic** comes from the farm's HAR file, fed to the same analyser as websites. Ask users whether their plan includes network logs, since BrowserStack trials do not.

### Desktop app (last)

Skip until a user asks. When one does, start with Electron: Playwright can launch it (still labelled experimental), the window is a Chromium page, and the axe, header and screenshot checks mostly carry over. Tauri's driver covers Windows and Linux only. Native Windows and macOS apps need Appium and a Windows or macOS machine, which no free Linux host provides.

### API (as its own App)

Checks from recorded traffic come first, inside website check-ups. A public API as an App follows phone apps. Inputs: a base URL, an optional spec, one token per role (two is enough to test object-level access), and a Test Copy flag. On live APIs, only GET and HEAD from the spec's examples. On Test Copies, connect Schemathesis for fuzzing. The verdict reads like: "Not ready yet. 2 of 41 endpoints crash on unusual input. `GET /v1/invoices/{id}` answers without a token."

## 5. Trends and openings

1. **Playwright is the shared base.** It ships its own planner, generator and healer agents (v1.56), and QA Wolf, Checkly, Autify Nexus and Currents build on it. Playwright output is now what the market expects, not a bonus.
2. **Agent-first onboarding assumes a terminal.** Playwright's agents need VS Code, Claude Code, Codex or OpenCode. QA Wolf asks users to connect their coding agent. Postman's Agent Mode needs its desktop app and Application Inventory needs a paid plan. A browser-only tool with a plain verdict reaches founders who have none of that.
3. **Vendor risk is real.** Octomind kept tests in its own format and shut down in 2026 *(shutdown date from secondary sources)*. Testim and Reflect were absorbed. Lost Pixel was archived in April 2026 when its team joined Figma. Optic and Dredd are archived. A source-available tool with a Playwright export has a story none of these can tell.
4. **Free AI testing is credit-metered.** Momentic gives 2,000 credits a month (about 200 runs), Functionize 800,000, Autify 2,000 once. A free tier counted in check-ups per day is easier to predict.
5. **Postman's free plan became single-player in March 2026**, and teams are drifting to Bruno and Hoppscotch. Nothing free and maintained does "traffic to checks to diff over time" for a small team.
6. **No tool ships per-finding briefs for AI coding tools** *(from the docs read, not a full survey)*. AGENTS.md is the shared convention, now under the Linux Foundation's Agentic AI Foundation. Percy and Argos are adding AI-assistant access to visual review.
7. **Accessibility law is live.** The EU Accessibility Act has applied since 28 June 2025, with a microenterprise exemption for services (fewer than 10 staff, up to EUR 2 million). The US ADA Title II web deadlines moved to 26 Apr 2027 and 2028, but those cover governments. Private firms face Title III lawsuits with no web rule. EN 301 549 v4.1.1 (September 2026) aligns with WCAG 2.2 but v3.2.1 stays the legal reference until the Official Journal cites the new one. WCAG 3.0 is still a draft. The FTC's April 2025 order bars accessiBe from claiming automated WCAG compliance without evidence. Test against WCAG 2.2 AA, which also meets 2.1 AA, and be honest about what automation can't judge. Deque's 57% figure counts issues by volume *(vendor claim)*; the UK government's 2017 test found 40% at best of planted barriers. Neither is "compliance".
8. **Enterprise accessibility and DAST tools are out of reach.** Siteimprove, Level Access and Evinced publish no prices (third-party estimates run $15,000 to $30,000 or more a year *(unverified)*). DAST tools want ownership proof and a security-minded user. Our read-only layer needs neither.
9. **Free infrastructure is shrinking.** Oracle halved its Always Free Arm allowance to 2 OCPUs and 12 GB on 15 Jun 2026 without an announcement (support answers conflict on whether paid accounts are affected). AWS free accounts now close after 6 months. Firebase Test Lab shuts down 30 Sep 2027.
10. **Performance metrics are stable.** LCP 2.5 s, INP 200 ms, CLS 0.1 are unchanged; SEO blog claims of a 2.0 s limit have no source on web.dev. Soft navigations are in a final origin trial and not yet in stable Chrome or CrUX.
11. **AI-built apps may create QA demand, but I found no primary source.** Claims about Lovable-built apps are unverified. Ask users whether they build with Lovable, Bolt, Replit, v0 or Cursor.

## 6. Ordered backlog

Effort is a rough guess for one builder using AI tools: **S** a day or two, **M** a week, **L** several weeks. Row numbers refer to the gap table.

### Step 0: stop misleading people (rows 1 to 4)

| Item | Effort | Depends on |
|---|---|---|
| 1. Fix INP, LCP fallback, CLS windows, throttling and repeat-run median | M | A decision on how many runs fit the free machine (measure first) |
| 2. Fix axe error handling, `incomplete`, criterion numbers; update docs to 2.2 | S | – |
| 3. Wire retry and flaky-passed into the run and report | S to M | – |
| 4. `SameSite` and mixed-content fixes | S | – |

### Step 1: web depth

| Order | Items | Effort | Notes |
|---|---|---|---|
| 1.1 | Findings contract and CI (rows 18, 20), release record and trend strip (19) | M | Makes every later feature reportable; no hosting needed |
| 1.2 | Playwright export of the approved Plan (5) | M | The big adoption lever; also needed by rows 27, 32 |
| 1.3 | API capture, shapes, checks, redaction, diffs, replay (7 to 11) | L | Redaction ships with capture. Decide row 11 first |
| 1.4 | Visual approve button, stabilising, masking (15) | M | Baselines remember which machine type made them |
| 1.5 | Keyboard, focus, 320 px reflow (12); CrUX panel, stored medians, page weight (13, 14); read-only security (17) | M | Small checks, each independent |
| 1.6 | Signed-in work (24) | M | Wait for user answers (section 7) |
| 1.7 | Hosting track (21 to 23): hosted runner, daily limits, two locations, Verified Domain, `isTestHost` fix, free-key warnings | L | Runs in parallel with 1.1 to 1.5. Needs the three ADRs below |

### Step 2: mobile web (rows 16, 52)

WebKit and Firefox on Sample Pages (M). Android Chrome through the user's CI later (M).

### Step 3: web second wave, any time after the export

Self-healing (27), Plan re-run selection (30), test data and requirement tags (32, 33), accessibility checklist and statement (35), consent check (37), TLS and DNS checks (38), OpenAPI check (42), SARIF (43). Security Probes (40) come last in this group, and only after the Verified Domain work and legal review.

### Step 4: store apps (rows 53 to 59)

A Maestro flow exporter and APK or CI-upload path first (L), then app accessibility and performance from farm runs, then an App Spider only if users ask. Real iPhones go through a farm.

### Step 5: public API as an App, then desktop (rows 58, 60)

Public API after phone apps. Desktop only when a user asks, Electron first.

## 7. Open questions

### Signed-in flows: three hypotheses

Early users ask for "signed-in flows", but their apps use email and password, which already works. The request could mean one of three things. Until two or more users give the same real example, don't build beyond row 24's detection and wording work.

| | What would be happening | What it would need | Verdict |
|---|---|---|---|
| **A. Hard to find or set up** | Users don't realise roles exist, or the sign-in form isn't recognised (custom page, username on a first step, a modal, a single-page app that never navigates). The check-up quietly reports "not reached". | Better wizard prompts, a "test this sign-in" button, two-step and modal handling, clear "sign-in failed because…" messages. Mostly interface and detection work. | **Now** |
| **B. Sign-in gets blocked** | Bot protection, a CAPTCHA or a rate limit rejects the test browser. Two-factor codes, magic links and email codes also block it. | In order: say what blocked us; vendor test keys on Test Copies (Cloudflare Turnstile and reCAPTCHA publish them); TOTP from a stored secret; an inbox for email links. Never solve CAPTCHAs. | **Later** |
| **C. Signed-in tests are too shallow** | Sign-in works and the crawl reaches pages, but tests only look at pages. They never create an order, change a setting or finish a flow, because forms are sent only on Test Copies. | Test Copy marking, test data with namespaced cleanup, more journeys per role, role-aware checks. This is the same work as the export and test data. | **Now** for journeys and data |

**Questions to ask early users.** Ask for a real example of each, not an opinion.

1. Show me the last time you wanted to test a signed-in page. What did you try, and what happened? (separates A, B and C)
2. How do your users sign in: email and password only, or also Google, a magic link, a code or an authenticator app?
3. Does the QA Tool say "not reached" for your signed-in pages, or does it get in and miss things? Does the text tell you which?
4. Is there a CAPTCHA, a Cloudflare challenge or a rate limit on your sign-in form? On staging as well as production?
5. Do you have a staging copy where you can add a test account, a test key or an off switch?
6. Name the three things a signed-in user does that you most fear breaking.
7. Do you have more than one role, and would you create a test account for each?
8. Would you accept a test account whose email is a shared inbox the tool can read?

### For the builder and the early users

1. **Safety model.** May a POST that parses as a GraphQL `query` pass on live sites, or only on Test Copies? May GET replay with no session, or with another role's session, run on any site, or only on Verified Domains when hosted? May keyboard traversal run on live sites?
2. **Users' Apps.** Staging copies or only production? Which hosts (Vercel, Netlify, GitHub Pages, Cloudflare Pages)? Do any run GraphQL, publish an OpenAPI file, or build with AI app builders? EU, US or both, and are they under the EAA microenterprise limit?
3. **Mobile.** Which App types do they have (Expo, bare React Native, Flutter, native), which have only Android, who owns a Mac or uses EAS, would they hand over an APK, and is $175 to $250 a month for real devices out of range?
4. **Playwright.** Do they already have suites? Do they want files, a pull request or a CI snippet? Does a selector fix apply to the saved Plan, or only to the exported code?
5. **Reports.** Would they paste a per-finding brief into an AI tool or want one file? Should the exit code fail on Major findings or only Blockers? Do QA testers already hold a Qase or TestRail account?
6. **Speed.** How noisy is lab LCP on the actual free machine? Run one page 30 times before choosing "5 runs" or a "slower by X%" rule. Should a poor lab result block "Ready to release"?
7. **Money.** How many AI calls is the first free check-up worth? May the free tier run any Security Probes, or only read-only checks?
8. **Verify before relying on it** (each came from secondary sources): where `RetryRunner`, the Account Pool and Entity Namespacing were meant to run; Octomind's exact shutdown date; GitHub's macOS minute multiplier; Gemini free-tier limits; whether Apple simulator builds need signing; that Playwright's bundled Chromium reaches version 151 for soft-navigation timing.

## 8. ADRs the build will need

Not written here. The first three are required by the decided direction. The rest are my suggestions from the research.

1. **Replace [ADR 0008](../adr/0008-single-local-server.md) (one local server).** Move to a hosted, multi-user runner. 0008 rejected a shared server because it needs sign-in, a run queue, per-user AI keys and a way to reach each person's localhost targets. The new ADR must answer each, plus: which free hosts and the second-location rule, daily limits per user, whether a local mode stays, and what `pnpm tunnel` becomes. (0010 already retired Studio from 0008; the single-server and loopback rules are the part being replaced.)
2. **Replace or amend [ADR 0009](../adr/0009-ai-plans-every-plan-item.md) (AI plans every Plan Item).** 0009 rejected "the AI driving the browser". The new ADR adds the opt-in AI explorer on Test Copies and AI-proposed selector fixes that a person approves, and keeps tests deterministic by saving everything the AI does as a Plan.
3. **New: Verified Domains.** The three methods, verifying the registered domain, public-suffix hosts proved per exact origin, re-verification before every Probe run, resolved-IP checks and redirect handling, who sees results, and the rule that a typed hostname no longer makes a Test Copy on shared machines.
4. **Suggested: live-site request rules.** The GET and HEAD replay rule, the GraphQL `query` decision, pacing and an off switch. This amends [ADR 0003](../adr/0003-deterministic-safety-filters-for-ai-discovery.md).
5. **Suggested: evidence and redaction.** Store shapes, not bodies. Strip cookies, authorisation headers and token-like values. Never keep raw HAR or storage-state files on hosted machines.
6. **Suggested: the findings and Playwright export contracts.** Versioned JSON Schema, stable finding fingerprints, and "generated code must run as is".
7. **Suggested: claim wording.** The tool never says "compliant" or "secure". Reports list what was not checked.
8. **Suggested, later: the app driver** (Maestro, with Appium as fallback) and the Security Probe terms once counsel has reviewed them.

## 9. What this research could not confirm

The cluster files label each item. The ones that could change a decision:

- **Law:** primary texts for the DOJ's 2022 CFAA policy, the UK Computer Misuse Act and Directive 2013/40/EU could not be loaded, so the legal summary rests on law-firm and press accounts. Counsel should review the product's terms before Probes ship. EAA fine amounts and Title III lawsuit counts come from vendors.
- **Prices:** testRigor, Meticulous, Rainforest QA, mabl, Probely, Burp DAST, Invicti, DebugBear, Xray, Zephyr and the enterprise accessibility suites have no confirmed public price.
- **Capacity estimates:** "50 to 100 check-ups a day" on Oracle's free Arm machine is an estimate from stated assumptions, not a measurement. Measure a real check-up's CPU and memory first.
- **Licences:** how MPL-2.0 (axe-core), LGPL-3.0 (Pa11y), GPL-3.0 (MobSF) and AGPL-3.0 (k6) fit with FSL needs legal review.
- **Spot checks of the finished API file:** I re-checked Optic's archive date, PactFlow, Checkly and Postman prices, and Android 17's certificate transparency default against their sources. They hold. The claim that Postman's Free plan became one-user "from 1 March 2026", and that free teams could previously have three users, was not on the pages cited, so I reworded it in cluster 06 to what the sources say.
