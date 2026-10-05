# Research brief: growing the QA Tool into an end-to-end testing platform

Written 2026-10-05, after two grilling sessions (3 Oct and 5 Oct). Each cluster file in this folder follows this brief, and [../e2e-platform-roadmap.md](../e2e-platform-roadmap.md) brings them together.

## The question

What would it take to grow the QA Tool from a website check-up into an end-to-end testing platform for websites, phone apps, desktop apps and APIs? What are other tools doing that this one is missing, does poorly, or does in an outdated way? Where is the market going, and where are the openings?

## What the tool does today (from the code, not docs/PRODUCT_GUIDE.md)

- **Scope:** websites only, tested in Chromium only (`packages/core/src/browser.ts`).
- **Discovery:** the Deterministic Spider crawls up to 200 pages for each role. It groups pages built from the same template into Layout Groups and tests three Sample Pages from each.
- **Planning:**
  - The AI Planner writes the Plan from what the crawl found. It uses OpenRouter, Claude, OpenAI or Gemini, and users bring their own key.
  - A person reviews and approves the Plan before anything runs.
  - Fixed rules take over when there's no AI.
- **Checks** (`packages/checkers/src`):
  - `bug-detection`: console errors, failed requests, broken links and dead ends.
  - `spec-conformance`: expected URLs, text and element states.
  - `ux-quality`: axe-core against WCAG 2.1 AA, plus tap-target size and horizontal overflow.
  - `performance`: lab LCP, CLS and INP read through PerformanceObserver in one test browser, plus transfer size.
  - `seo`, `aeo`, `geo`: titles, meta tags, canonical links, structured data and llms.txt.
  - `security`: security headers, passwords in URLs, forms that submit insecurely.
  - `permission-matrix`: which roles may open which routes.
  - `design-standards`: computed styles against design tokens, pixelmatch screenshot diff, and an AI visual review.
- **Verdict:** each of the six areas starts at 100 points and loses points by severity. The report ends in "Ready to release" or "Not ready yet". Findings can be marked "Not a problem" or "It's intended".
- **Other features:**
  - `qa-test verify <finding>` re-runs one finding.
  - A competitor flow benchmark.
  - A Figma token sync.
  - Playwright repro code for each finding.
  - Reports in HTML, Markdown and JSON.
- **Report Hub** (optional, Postgres and S3): merges duplicate findings into one record each, tracks each finding's status (open, fixed, came back, accepted risk), and marks tests that passed only on a clean retry as "flaky passed".
- **Sign-in:** an email and password for each role. Sessions are reused through Playwright storage state.
- **Integrations:** AI providers, Figma, and an example GitHub Actions workflow. There's no Jira, Linear, Slack or test-management connection.
- **Deployment:** runs on the person's own computer at `localhost:3001`, one check-up at a time. `pnpm tunnel` shares it through a Cloudflare tunnel as a stop-gap.
- **Safety:** live sites are only looked at. Forms are sent only on a Test Copy, meaning localhost, a private network, a tunnel, or a site the person marked as a test copy.

## Who it's for and the limits (decided)

- **Primary users:** teams without QA staff, meaning founders and developers at startups and small firms. QA testers are a second type of user. The plain-language verdict stays on top, with developer detail underneath.
- **The builder's situation:** one person building with AI tools. A few people are trying it and nobody pays yet, and there's no fixed date.
- **What users use today instead:** their own Playwright or Cypress scripts, plus free point tools such as Lighthouse, PageSpeed Insights and the axe extension. These are the main comparison. AI testing services come second, and enterprise suites only show where the market is heading.
- **Delivery:**
  - The tool will run in the browser with nothing to install, and hosting costs $0 until there's revenue.
  - Website check-ups run on always-free cloud machines, with a daily limit per user.
  - Mobile testing and heavy use run on the user's own accounts, such as device farms or CI.
- **Pricing:**
  - A free tier plus monthly plans in USD.
  - The first check-up runs on our AI key, and users bring their own key after that.
- **Order of work:**
  1. Web depth, including API checks built from the traffic the website records.
  2. Mobile web on real WebKit and Android Chrome.
  3. Store apps (React Native, Expo, Flutter and native Swift or Kotlin) through one driver that covers all of them.
  4. Desktop comes last, because no user has asked for it.
- **AI:** tests run deterministically. AI suggests fixes for broken selectors, which a person approves, and an opt-in AI explorer can roam Test Copies.
- **Security:**
  - Read-only checks run on any site.
  - Security Probes, meaning anything the owner could mistake for an attack, run only on Test Copies.
  - On shared hosted machines, a Test Copy must sit under a Verified Domain, proved once with a file, a meta tag or a DNS record.
- **Playwright:** an approved Plan can be exported as Playwright tests the user owns. Importing users' own suites comes later.
- **Tracking:** target teams track work in docs or nowhere, so findings are shared as Markdown and JSON reports, with no tracker connection.
- **Hand testing:** exploratory testing by people waits until QA testers become a focus.
- **Signed-in flows:** early users ask for this, but their apps use email and password, which already works. What's actually missing is unknown.
- **Licence and market:** source-available (FSL), sold self-serve worldwide, covering US (ADA) and EU (EAA) accessibility law.
- **Vocabulary:** an **App** is anything released on its own: a website, a phone app (iOS and Android builds together), a desktop app or a public API. See [CONTEXT.md](../../../CONTEXT.md).

## How each cluster file is written

- **Primary sources only:**
  - official docs, pricing pages, specs, standards, legal texts, GitHub repos and release notes
  - every claim links to its source
  - sources checked on or after 2026-10-05
  - vendor marketing labelled *(vendor claim)*
  - anything that can't be confirmed is labelled *(unverified)*
- Recent information (2025–2026) wins. Check with web search, because tools, prices and laws change.
- Each capability gets a verdict judged against the direction above:
  - **Build now:** next, within web depth.
  - **Build later:** worth doing, after current priorities.
  - **Connect:** use another tool rather than build it.
  - **Skip:** not for these users.
- Each capability also says whether it applies to a **Website**, **Phone app**, **Desktop app** or **API**, and what is different about doing it on each.

### Cluster file outline

1. **Scope:** what this cluster covers.
2. **Market map:** a table of tools with category, what's relevant, free tier and price, and source.
3. **Capabilities:** for each one: what leading tools do, what the QA Tool does today, the gap, which Apps it applies to with platform notes, and a verdict with a one-line reason.
4. **Trends and openings (2025–2026):** with sources.
5. **Fit with the limits:** $0 hosting, browser-only delivery, teams without QA staff. Risks and conflicts.
6. **Open questions:** things only users or the builder can answer.
7. **Sources:** every link cited.

## The clusters

Each cluster is one file in this folder, about 2,000 to 3,500 words, with a table for the market map. The tool lists are starting points: check that each tool still exists, and add others that matter.

### 01-web-e2e-ai-testing.md — AI and scripted web testing

- **Capabilities:**
  - test discovery and crawling
  - test generation from crawls, recordings, plain language or requirements
  - light requirements traceability
  - self-healing selectors, approved by a person or applied automatically
  - regression runs, with change-based or risk-based selection and AI-assisted prioritisation
  - flaky-test detection, quarantine and retries
  - test analytics
  - autonomous AI explorers, and how vendors keep them safe and repeatable
  - export to Playwright code
  - test data: seeding, synthetic data, isolation, cleanup, test email and SMS inboxes
  - signed-in flows: session reuse, CAPTCHA and bot protection, two-factor codes, magic links
- **Signed-in flows:** set out three possible meanings (hard to find or set up, sign-in gets blocked, signed-in tests are too shallow), what each would need, and the questions to ask early users.
- **Tools:**
  - Playwright: codegen, test agents, MCP, trace viewer
  - Cypress and Cypress Cloud
  - Momentic, Octomind, QA Wolf, mabl, testRigor, Checkly, Reflect, Autify, Rainforest QA, Functionize, Testim, Ghost Inspector, Meticulous
  - flaky-test tools: Trunk, Currents, BuildPulse
  - test inboxes: Mailosaur, MailSlurp
- **Trends to cover:** agentic and MCP-based testing, and AI-built apps (Lovable, Bolt, Replit, v0, Cursor) creating QA demand among founders.

### 02-visual-crossbrowser-reporting.md — visual testing, browsers and devices, reporting

- **Visual regression:** baselines, approval, perceptual vs pixel diffing, masking changing content. Tools: Percy, Chromatic, Applitools, Argos, Lost Pixel, BackstopJS, Playwright `toHaveScreenshot`.
- **Browsers and devices:** Playwright's Chromium, Firefox and WebKit builds against real Safari and real devices, and what a WebKit build misses for iPhone users. Grids: BrowserStack, Sauce Labs, LambdaTest (check for a rebrand).
- **Reporting and analytics:** shareable reports, history and trends. Tools: Allure, ReportPortal, Currents.
- **Defect tracking without a tracker:** a good shareable report, a stable JSON schema, and Markdown made for pasting into AI coding tools.
- **Test management and governance:** TestRail, Qase, Xray, Zephyr, audit logs, approvals, roles, SSO. Name the cheapest credible version for small teams.
- **Release gates and CI:** PR comments, status checks, preview-URL triggers.

### 03-accessibility-compliance.md — accessibility and compliance

- **Standards:** WCAG 2.2 against the 2.1 AA used today, WCAG 3 status, EN 301 549.
- **Law:** the EU Accessibility Act (scope, small-firm exemption, enforcement), the US ADA Title II web rule and its deadlines, ADA Title III lawsuits, and what "covering ADA and EAA" can honestly mean.
- **Automation limits:** the share of issues automation finds, and guided manual tests for the rest.
- **Tools:** the axe family, Siteimprove, Level Access, Evinced, WAVE, Pa11y, Lighthouse, IBM Equal Access, Accessibility Insights.
- **Overlays:** the FTC action against accessiBe, and why the product shouldn't ship one.
- **Checks after interaction:** keyboard-only use, focus order, reflow at 320 px, reduced motion.
- **Accessibility statements and VPAT/ACR drafts.**
- **Phone apps:** Android Accessibility Test Framework, iOS `performAccessibilityAudit`, React Native and Flutter.
- **Desktop apps:** Windows UI Automation, macOS AX, Electron.
- **Privacy and consent:** trackers firing before consent, Global Privacy Control, cookie scanners.

### 04-performance-cwv.md — performance and Core Web Vitals

- **Core Web Vitals:** current metrics and thresholds, and any changes. Test-run data against real-visitor data, and why INP from a scripted run differs.
- **Free real-visitor data:** the CrUX API and PageSpeed Insights API, with their quotas and the gap for low-traffic sites.
- **Credible test-run numbers:** throttling, repeat runs, and noise on small shared cloud machines.
- **Budgets and regressions** between check-ups.
- **Real-user monitoring:** the web-vitals library, Vercel Speed Insights, Sentry, DebugBear, SpeedCurve, Calibre, WebPageTest.
- **Single-page apps:** soft navigations.
- **Load testing:** k6, Artillery, Locust, and whether a $0-hosted tool should ever generate load.
- **Phone apps:** startup time, dropped frames, ANRs, Android vitals, MetricKit.
- **Desktop apps:** Electron startup and memory.

### 05-security.md — security testing (defensive: an owner checking their own App)

- **Read-only checks:** CSP quality, cookie flags, TLS, mixed content, CORS, Subresource Integrity, client libraries with known CVEs, exposed source maps, exposed files, secrets in client bundles, `security.txt`, SPF and DMARC.
- **Security Probes on Test Copies:** the ZAP active scan, basic injection, open redirects, sign-in rate limits, broken access control (building on the permission matrix), sessions and CSRF. Say which are safe and quiet enough for a free tier.
- **API security:** the OWASP API Top 10, tested from recorded traffic with several roles.
- **Tools:** ZAP, Burp Suite DAST, StackHawk, Detectify, Probely (check ownership), Invicti, Nuclei, MDN HTTP Observatory, securityheaders.com.
- **Proving ownership:** how scanners and Google Search Console verify a domain, and how hosted scanners prevent abuse.
- **Legal limits:** US CFAA, UK Computer Misuse Act, EU practice, and the terms hosted scanners use.
- **Phone apps:** OWASP MASVS and MASTG, MobSF.
- **Desktop apps:** the Electron security checklist.

### 06-api-testing.md — API testing (written 2026-10-05)

### 07-mobile-desktop-costs.md — phone apps, desktop apps and running costs (2,500 to 4,000 words)

- **Mobile web:** Playwright WebKit against real iOS Safari, Playwright's Android support, and what runs on free Linux machines.
- **Store apps:**
  - Drivers: Maestro, Appium, Detox, Espresso, XCUITest, Flutter `integration_test`, Patrol, Expo EAS Workflows. Recommend one driver for React Native, Expo, Flutter and native.
  - How a browser-only tool takes an app build (APK, AAB, IPA, simulator builds).
  - Exploring an app without scripts (Firebase Robo test, Monkey, AI explorers), and what the app version of the Deterministic Spider and Layout Groups would be.
- **Device farms on the user's own account:** BrowserStack, Sauce Labs, LambdaTest, Firebase Test Lab, AWS Device Farm, Genymotion. For each: price, free quota, and API access with the user's key.
- **Desktop apps:** Electron through Playwright, Tauri through WebDriver, native Windows and macOS drivers, and what a browser-only hosted tool would need to run them.
- **$0 hosting:**
  - always-free cloud machines (Oracle, Google Cloud, AWS, Azure) and how many check-ups they can run
  - hosted browsers (Cloudflare Browser Rendering, Browserless)
  - the user's own GitHub Actions minutes
- **AI costs:** OpenRouter free limits, the Gemini free tier, and how competitors handle bring-your-own-key.

## The roadmap doc

[../e2e-platform-roadmap.md](../e2e-platform-roadmap.md) is written from the cluster files, in this order:

1. Current state
2. Who it's for and the limits
3. Capability gap table: one row per capability, with the verdict and columns for Website, Phone app, Desktop app and API
4. One section for each kind of App
5. Trends and openings
6. Ordered backlog
7. Open questions, including the signed-in flows questions

It also lists the ADRs the build will need, without writing them: replacements for ADR 0008 (local server to hosted) and ADR 0009 (adding the AI explorer and selector fixes), plus a new one for Verified Domains.

A private shareable web page is published from the finished doc, for the pitch and hand-off.
