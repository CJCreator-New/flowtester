# Gap review: URL-first review vs the current QA Tool

Sep 28, 2026 · Live review of the wizard and runner as they stand today, measured against the 28 decisions
agreed for the URL-first review (enter a URL; the tool walks the flows, lets you review its plan, and
returns one layered report on every aspect with ranked improvements).

## Summary

Today the tool can't yet deliver "enter a URL, get a review you can trust". Three things stand in the way:

1. **AI-planned tests can't be trusted yet.** Of 28 issues reported across five runs, 12 were real (43%;
   the spec's target is 70%). All 12 real ones came from the fixed-rule checks. None of the 15 issues from
   AI-planned tests held up: the AI invented buttons and error messages, then failed the site for not
   having them.
2. **It barely explores.** The website path looks at one page and never follows a link. The product path's
   discovery never signs in, so anything behind a login is invisible to the AI.
3. **Most of the "all aspects" report doesn't exist yet.** There are no speed, mobile, SEO, security or AI
   visual checks, and no grades or improvement recommendations for a single site.

What works: the accessibility findings were all real, the wizard's wording is calm and clear, and the data
model already supports a plan-review step.

**One change to the agreed order:** add a "Phase 0: trust fixes" before the new UI. A beautiful map of
made-up tests would still be wrong, and the plan-review screen is only useful if the plan is grounded in
the real page. See [Suggested order of work](#suggested-order-of-work).

## What was tested

Every site is either local or built for automated testing. Screenshots of the wizard are in
`.playwright-mcp/review/` (not committed).

| Site | What it is | Path used | Time | Pages reached | Issues reported | Real | False or guessed |
|---|---|---|---|---|---|---|---|
| Fixture app (`localhost:3050`) | Invoicing test app with 4 planted defects | Product, 1 login, AI | ~2 min | 5 found, 3 tested | 9 | 0; found 0 of 4 planted defects | 4 false, 5 guesses |
| saucedemo.com | Demo shop with a published test login | Product, 1 login, AI | 2 min 22 s | 1 (the login page) | 6 | 0 | 6 false |
| books.toscrape.com | Shop built as a scraping sandbox | Website, read-only | 10 s | 1 | 3 | 3 (2 distinct) | 0 |
| W3C "BAD" demo, before version | Site with known accessibility faults | Website, read-only | 2 s | 1 | 8 | 8 (6 distinct) | 0 |
| demo.playwright.dev/todomvc | One-screen to-do app | Website, read-only | 2 s | 1 | 2 | 1 | 1 false |

The fixture's planted defects: a button that logs a console error, a button that calls an API returning
500, a 20 × 20 px tap target, and a dead-end page with no way out.

## Gaps that break trust

Fix these before anything is built on top of them.

### T1. The AI invents buttons, then reports them as blockers

On the fixture, 2 of the 3 blockers were "Couldn't complete 'Interact with first dashboard element'". The
AI planned clicks on `[data-testid="dashboard-element-1"]` and `-2`, which don't exist.

- **Why:** discovery gives the AI each page's *count* of interactive elements, not the elements
  themselves ([discovery-agent.ts](packages/core/src/discovery/discovery-agent.ts)), so it guesses
  selectors. Nothing checks the plan against the page before it runs.
- **Fix:** send the AI the real element inventory for each page (role, visible name, `data-testid`,
  selector). Reject or repair any step whose selector isn't in that inventory before the plan is shown or
  run.

### T2. The AI invents error messages and rules, then fails the site for not matching

- **Fixture (5 issues, all Major):** "Expected text not found: 'Invalid email format'", "Amount must be
  greater than zero" and others. The app really does accept empty fields, so a person might agree
  something is missing. But the tool rated each one Major on the strength of rules it made up.
- **saucedemo (6 issues, all Major):** "Expected text not found: 'Field is empty'". The site *does* show an
  error ("Epic sadface: Username is required"), just not the wording the AI guessed. It also generated
  length-limit tests (0 to 50 characters) from nothing.
- **Why:** the AI's inferred rules and expected messages become exact-text tests without confirmation.
  The validation expander multiplies each guess into boundary tests.
- **Fix:**
  - Label AI guesses as guesses until the user confirms them in the plan review.
  - Test the behaviour ("an error appears next to the field") rather than the exact wording, unless the
    user supplied the wording.
  - Record what the site actually shows.
  - Report an unconfirmed guess as "Could not verify", never as Major.

### T3. Discovery never signs in

Logins are used only when tests run, never while the AI explores
([discovery-agent.ts:37](packages/core/src/discovery/discovery-agent.ts#L37)). On saucedemo the AI saw
one page, the login form, and planned nothing beyond it: no products, cart or checkout.

- **Fix:** sign in as each role before crawling, and crawl once per role. This also produces the
  "what each role can see" data the permission checks need.

### T4. The website path looks at one page

The read-only crawler only opens tabs, accordions and toggles on the first page. It never follows a link
([safe-crawler.ts:304](packages/core/src/competitive/safe-crawler.ts#L304)). All three public sites
stopped at page 1; books.toscrape.com has a thousand book pages.

- **Fix:** follow links on the same site, breadth-first, within the agreed budget of about 25 pages. Group
  pages that share a layout. Stay read-only.

### T5. Test passwords are written into the report

The fixture's sign-in form sends its fields in the page address, and the tool stored that address in
`findings.json`: `/dashboard?email=manager%40example.com&password=manager-password`. The spec says
credentials never appear in reports. The tool also didn't flag "password sent in the page address" as a
security problem on the site.

- **Fix:** redact known credentials and password-like URL parameters everywhere evidence is written. Add a
  security check for passwords in URLs and for GET forms that contain a password field.

## Major gaps

### M1. None of the 4 planted defects were found

| Planted defect | Why it was missed |
|---|---|
| Console error | Needs a button click. The AI's plan clicked invented buttons instead (T1). |
| API call returning 500 | Same reason as the console error. |
| Dead-end page | The crawler found `/deadend`, but no test ever visited it. |
| 20 px tap target | Only checked at mobile widths. The product path runs at 1440 px only ([server.ts:532](packages/runner/src/server.ts#L532)). |

- **Fix:** after the journeys, run a generic pass that visits every discovered page and uses each safe
  control, at all three widths (375, 768 and 1440 px).

### M2. One problem is reported two or three times

- **W3C BAD demo:** one missing analytics file became three Major findings: a console error, an HTTP 404,
  and "HTTP failed, status 0".
- **books.toscrape.com:** one blocked insecure script became a console error plus a failed third-party
  request.
- **Fix:** group findings that share a root cause (the same URL). Rate third-party failures lower unless
  they break the page.

### M3. The AI's questions are never shown, and one is broken

Discovery asked 2 questions on the fixture and 1 on saucedemo, and nobody ever saw them. One reads "Found
form … with fields [, ]" because the crawler only reads the `name` attribute.

- **Fix:** show them in the plan review (decision 20). Name fields by label, then `id`, then placeholder.

### M4. The AI key screen appears on every new browser

The runner has a working key (`configured: true`), but the wizard keeps the chosen model in browser storage
([App.tsx:67](packages/wizard/src/App.tsx#L67), [api.ts:152](packages/wizard/src/api.ts#L152)). A new
browser or device is sent to the key screen.

- **Fix:** the runner stores the model too. The wizard asks only when the runner has no key (decision 12).

### M5. The free model changes from call to call and can't see screenshots

- **Changes from call to call:** the recommended model is `openrouter/free`, a router that sends each call
  to whichever free model is available. So the plan can differ from run to run.
- **Wrong kind of model:** second in the list is Google Lyria, a music-generation model.
- **No screenshot support:** the filter never checks for image input
  ([openrouter.ts:99](packages/core/src/ai/openrouter.ts#L99)), so the visual review (decisions 13–14) has
  no model to use.
- **Fix:** pick one fixed text model and one fixed vision model (image input, text-only output), and name
  both in the report.

### M6. Technical wording reaches the plain-language screen

- **Raw pattern:** the report's "most important" list showed `URL did not match expected pattern:
  "^/invoices/new$"`.
- **Library wording:** accessibility issues use the accessibility library's own titles ("Elements must meet
  minimum color contrast ratio thresholds").
- **Security described as an error:** a security issue (an insecure script on a secure page) was shown as
  "The page reported an error behind the scenes".
- **Fix:** give every finding type a plain-language title, and put security findings under their own
  heading.

### M7. The product path submits forms on live sites

The URL screen says "It can be a live site", and the run then fills and submits forms there. This conflicts
with decision 3 (full interaction only on test hosts).

- **Fix:** the owner checkbox plus the test-host rule.

## Minor gaps

- **The dead-end rule misfires on one-screen apps.** TodoMVC was flagged "no back button or navigation"
  ([ux-quality.ts:123](packages/checkers/src/ux-quality.ts#L123)).
- **A test can fail with no finding.** saucedemo's main login test was marked Failed with zero findings,
  so the report can't say why.
- **Evidence paths are absolute Windows paths** (`C:\Users\HP\…`), so a shared report points at files
  nobody else has. The self-contained HTML report (decision 10) removes this.
- **There's nothing to watch during discovery.** For about a minute the screen shows one sentence and a
  progress bar drawn as a single dot at the far right (addressed by decisions 24–25).
- **The accessibility check uses WCAG 2.1 AA rule sets only** (`wcag21aa` in
  [ux-quality.ts:28](packages/checkers/src/ux-quality.ts#L28)). Add `wcag22aa` (decision 18).

## Missing entirely

| Agreed | Decisions | Today |
|---|---|---|
| One URL box and an owner checkbox, no product/website choice | 1, 3 | A 2-way choice then up to 5 steps; no owner checkbox |
| Pause for plan review, with a skip option | 19–20 | The runner goes straight from discovery to tests ([server.ts:512-534](packages/runner/src/server.ts#L512-L534)) |
| Site map for plan, live progress and report | 24–26 | None |
| AI names the site type and picks 3–5 journeys | 4 | The AI gets a page list; no site-type step |
| About 25 pages at 3 widths | 5 | Website path: 1 page. Product path: 1440 px only |
| Speed and mobile (Core Web Vitals) | 6 | None |
| SEO and link health | 6 | Broken links show only as failed requests |
| Security basics | 6 | None; mixed content shows only as a console error |
| AI visual and copy review | 6, 13–15 | The AI adapters accept images, but nothing sends screenshots |
| A–F grade per aspect | 7 | One ready / not-ready verdict |
| Ranked improvement recommendations | 8 | Only when comparing two sites ([ux-gap-synthesizer.ts](packages/core/src/competitive/ux-gap-synthesizer.ts)) |
| Layered report and single HTML file | 9–10 | `report.md` and `findings.json` only |
| Per-site history and changes since last run | 11 | The hub has fingerprints and deltas; the wizard and runner have none |
| Remember answers and edits per site | 22 | None |
| Add a test by describing it | 21 | None |
| Partial AI results with "finish later" | 15 | None |
| "Go deeper" with logins after the first report | 2 | None |

## What works and should be kept

- **Accessibility findings were accurate.** Six distinct real problems on the BAD demo, and genuine
  contrast failures on the other two public sites.
- **The safety design is sound in code.** A script blocks every form submission, the crawler intercepts
  POST, PUT, PATCH and DELETE requests, and it obeys robots.txt. It wasn't re-tested today because the
  crawler never went past the first page. The wizard plan recorded it passing earlier.
- **The wizard's wording and calm visual base.** Plain verbs, readable type, AA contrast enforced by a
  test.
- **The review step is half-built already.** Journeys and pages can be marked out of scope, and questions
  have an answer slot; the planner already respects both
  ([test-planner.ts](packages/core/src/discovery/test-planner.ts)).
- **The runner's live events**, including reconnecting and the "another check is running" message.

## Suggested order of work

Decision 28 put the plan review and new UI first. Given T1–T5, I suggest one phase in front of it:

| Phase | Scope |
|---|---|
| **0. Trust fixes** (new) | T1–T5, M1–M5: plans grounded in the real page, guesses labelled, discovery that signs in and follows links, credential redaction, root-cause grouping, a fixed text and vision model |
| 1. Plan review and new UI | As agreed: pause and resume, plain-language plan, map-based plan, live progress and report screens, prototypes first |
| 2. New aspects | As agreed: speed and mobile, SEO, security, AI visual review, grades, recommendations |

The goal for Phase 0: rerun the five sites above and reach at least 70% real findings, with at least 3 of
the 4 planted defects found.

## Appendix: the 28 agreed decisions

Agreed on Sep 28, 2026. The numbers above refer to this list.

**Starting a review**
1. The wizard opens on one URL box and an "I own this site or it's a test copy" checkbox. The
   product/website choice is removed. Logins and product notes move to a "Go deeper" panel on the report.
   QA Flow Studio (`packages/web`) is unchanged.
2. Without a login, the review covers the public part and lists the pages behind the login as "not
   reached". Adding a login in "Go deeper" starts a deeper re-run.
3. Read-only by default. Filling and submitting forms with test data (Safety Filter on) needs both the owner
   checkbox and a test host: localhost, a private IP, a tunnel, or a host marked as staging. Live public
   domains always stay read-only.
4. A quick crawl first. The AI then names the site type and walks its 3–5 main journeys, and the report
   says which journeys and why.
5. By default, about 25 pages at 375, 768 and 1440 px, in about 10 minutes. "Go deeper" runs a longer
   review.

**The report**

6. The aspects: Works, Accessible (WCAG 2.2 AA), Fast and mobile (Core Web Vitals), Findable (SEO), Secure
   (passive checks only), Looks and reads well (AI review of screenshots and wording).
7. An A–F grade per aspect, calculated by fixed rules from the findings. The AI never sets a grade.
8. Ranked improvement recommendations, split into quick wins and bigger changes. Each is labelled as
   AI-generated and points to a screenshot and its evidence.
9. Layered: plain language on top, technical detail underneath.
10. Files: one self-contained HTML report, plus `report.md` and `findings.json`.
11. A local history per site. Each report shows grade changes and what's new, fixed and still open.

**AI**

12. Free OpenRouter models only. The key is set once at install and leaves the main flow. With no key, the
    AI sections show as "skipped".
13. A free model that accepts screenshots is chosen separately.
14. One AI call per unique page layout, with all three widths in that one call: about 10–20 calls per run.
15. When the free limit runs out, the AI sections show as partial ("8 of 14 screens reviewed"). A
    "Finish AI review" button completes them later without crawling again.

**Delivery**

16. Runs in local Docker, as today.
17. The order: live review, then this gap review and an implementation plan (in the repo and as a
    shareable doc), then prototypes, then the build.
18. Spec updates: WCAG 2.1 becomes 2.2, and AI is optional rather than required.

**Reviewing the plan**

19. After a 1–2 minute scan, the run pauses and shows the plan. "Looks good, start testing" continues.
    "Skip review, just test it" on the URL screen keeps the one-URL path. A skipped review answers each AI
    question with its safe option.
20. The user can skip a journey or check, fix an expected result, answer the AI's questions, and add
    business rules in plain words.
21. A missing test is added by describing it in a sentence. The AI turns it into steps and an expected
    result, and shows that back for the user to confirm.
22. Edits, answers, rules and added tests are remembered per site. The next run only flags what's new or
    changed.
23. On a live site, a test that needs a form sent is kept, marked "needs a test copy", and reported as
    not run.

**The map**

24. Plan: a site map. Journey pages are screenshot thumbnails joined by coloured paths. Other pages
    collapse into groups by section. Clicking a page opens a side panel with its steps, checks and
    questions.
25. Live: the same map lights up as pages are visited. The latest screenshot and action show in a panel,
    and issues pin to the page where they were found.
26. Report: grades and recommendations at the top, then the map coloured by result. Clicking a page shows
    every check that ran, passed ones collapsed.

**Order of work**

27. The visual direction is chosen from 2–3 clickable prototypes before building.
28. Phase 1: plan review and the new UI, with today's checks. Phase 2: the new aspects.
