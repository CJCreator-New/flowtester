# Cluster 03: Accessibility and compliance

Checked 2026-10-05. Follows [00-brief.md](00-brief.md). Vendor marketing is marked *(vendor claim)*. Anything I couldn't confirm is marked *(unverified)*. This is research, not legal advice.

## 1. Scope

This file covers accessibility testing for a team without QA staff: which standard to test against (WCAG 2.1, 2.2, 3.0, EN 301 549), what US and EU law requires and when, how much of the problem automation can find, the tools founders use today, and what the QA Tool already does and lacks. It also covers overlays, checks after interaction (keyboard, focus, reflow), accessibility statements, phone and desktop apps, and privacy and consent checks. The comparison is a developer who runs the free axe extension or Lighthouse, or nothing.

## 2. Market map

| Tool | Category | What's relevant | Free tier / price | Source |
|---|---|---|---|---|
| axe-core and `@axe-core/playwright` | Open-source rules engine | Covers WCAG 2.0, 2.1 and 2.2 at A, AA and AAA, plus best-practice rules. Reports "incomplete" items that need a person. Deque says it finds 57% of issues on average *(vendor claim)*. | Free (MPL-2.0) | [repo](https://github.com/dequelabs/axe-core), [Playwright docs](https://playwright.dev/docs/accessibility-testing) |
| axe DevTools (Deque) | Extension and paid suite | Free extension. Pro adds Intelligent Guided Tests. A Bundle needs a quote. | Free extension. Pro: free trial, price not published. Bundle: contact sales. | [pricing page](https://www.deque.com/axe/devtools/pricing/), [product](https://www.deque.com/axe/devtools/) |
| Lighthouse | Free point tool | 63 axe-based audits, weighted score. Manual checks sit outside the score. | Free | [docs](https://developer.chrome.com/docs/lighthouse/accessibility/scoring) |
| WAVE (WebAIM) | Checker and API | The API evaluates the page after CSS and JavaScript are applied. | 100 free credits for new accounts, then $0.04 down to $0.025 per credit. 1 credit is a basic page. | [API](https://wave.webaim.org/api/) |
| Pa11y | CLI runner | Runs axe or HTML_CodeSniffer from the command line. Version 10 is current. | Free (LGPL-3.0) | [repo](https://github.com/pa11y/pa11y) |
| IBM Equal Access | Checker, CI package | Browser extensions and an `accessibility-checker` package that works with Playwright. WCAG 2.0 to 2.2 and US Section 508. | Free (Apache-2.0) | [repo](https://github.com/IBMa/equal-access) |
| Accessibility Insights (Microsoft) | Free checker with guided manual tests | FastPass in under 5 minutes, plus a Windows desktop app | Free, open source | [site](https://accessibilityinsights.io/) |
| Siteimprove, Level Access, Evinced | Enterprise suites | Monitoring, audits and managed services. No public price. Third-party sites estimate about $15,000 to $30,000 a year for Siteimprove accessibility, $25,000 or more for Level Access software and $20,000 or more for Evinced *(unverified, vendor-neutral sources not found)*. | Quote only | [Vendr (Level Access)](https://www.vendr.com/marketplace/level-access), [TrustRadius (Evinced)](https://www.trustradius.com/products/evinced/pricing), [TestParty (Siteimprove)](https://testparty.ai/blog/siteimprove-alternatives) |
| accessiBe | Overlay | Subject of an FTC order, see section 3.8 | n/a | [FTC](https://www.ftc.gov/news-events/news/press-releases/2025/04/ftc-approves-final-order-requiring-accessibe-pay-1-million) |
| Android Accessibility Test Framework | Phone app checks | Runs checks on Android View objects | Free (Apache-2.0) | [repo](https://github.com/google/Accessibility-Test-Framework-for-Android) |
| `performAccessibilityAudit` (Xcode) | Phone app checks | iOS 17 and later. Audit types: contrast, element detection, hit region, element description, Dynamic Type, text clipped, trait. | Free with Xcode | [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10035/), [overview](https://www.polpiella.dev/xcode-15-automated-accessibility-audits/) |

Axe DevTools Pro's price, the exact axe-core version and the Evinced, Siteimprove and Level Access prices could not be confirmed from the vendors. I tried the npm page and got a 403.

## 3. Capabilities

### 3.0 Standards and law

**Standards as of 2026-10-05**

| Standard | Status | Source |
|---|---|---|
| WCAG 2.1 AA | Required by the US ADA Title II web rule | [ADA.gov](https://www.ada.gov/resources/web-rule-first-steps/) |
| WCAG 2.2 | W3C Recommendation, current text dated 12 Dec 2024. It adds 9 criteria. AA ones: Focus Not Obscured (Minimum), Dragging Movements, Target Size (Minimum), Accessible Authentication (Minimum). Level A: Consistent Help, Redundant Entry. 4.1.1 Parsing was removed. Content that meets 2.2 also meets 2.1 and 2.0. | [W3C](https://www.w3.org/TR/WCAG22/) |
| WCAG 3.0 | A "Group Note Draft" dated 10 Sept 2026, "may be updated, replaced, or obsoleted at any time". It "does not deprecate WCAG 2". It proposes Bronze, Silver and Gold levels and an experimental percentage score. Not usable as a legal standard. | [W3C explainer](https://www.w3.org/TR/2026/DNOTE-wcag-3.0-explainer-20260910/) |
| EN 301 549 v4.1.1 | Published September 2026. Aligns with WCAG 2.2 A and AA and adds a mapping to the EAA. **Not yet cited in the Official Journal**, so v3.2.1 (2021) is still the legal reference. | [EU Accessible EU Centre](https://accessible-eu-centre.ec.europa.eu/content-corner/news/european-accessibility-standard-en-301-549-has-been-updated-2026-09-07_en) |

I couldn't confirm the original date WCAG 2.2 first became a Recommendation. The W3C page shows 12 Dec 2024 *(unverified: earlier publication)*.

**Law and deadlines**

| Law | Who it covers | Date | Notes | Source |
|---|---|---|---|---|
| EU Accessibility Act, Directive 2019/882 | E-commerce and other listed products and services sold in the EU | Applies from 28 June 2025 | Article 4(5) exempts microenterprises providing services. A microenterprise has fewer than 10 staff and no more than EUR 2 million turnover or balance sheet. The exemption covers services, not products. Penalties are set by each member state. | [EUR-Lex](https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng), [Commission](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en), [SME definition](https://single-market-economy.ec.europa.eu/smes/sme-fundamentals/sme-definition_en) |
| EAA fines | Per country | Since 28 June 2025 | Examples quoted by a compliance vendor range from EUR 60,000 in Ireland to about EUR 900,000 in Sweden *(unverified, secondary source)* | [web-accessibility-checker.com](https://web-accessibility-checker.com/en/blog/eaa-fines-penalties-by-country) |
| ADA Title II web rule (state and local governments) | Governments with 50,000 or more people | Moved from 24 Apr 2026 to **26 Apr 2027** | Interim final rule effective 20 Apr 2026 | [Federal Register](https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web), [ADA.gov](https://www.ada.gov/resources/web-rule-first-steps/) |
| ADA Title II, smaller entities | Under 50,000 people and special districts | Moved from 26 Apr 2027 to **26 Apr 2028** | WCAG 2.1 AA | same |
| ADA Title III | Private businesses | No web rule, no deadline | Enforced by private lawsuits. Seyfarth counted 5,006 federal Title III filings in the first half of 2026, all kinds, not web only *(secondary source)*. UsableNet projects about 6,000 web accessibility suits in 2026, a nearly 20% rise on 2025 *(vendor claim)*. E-commerce and food service make up 79%. 36% of sued companies had over $25 million revenue. | [UsableNet](https://blog.usablenet.com/inside-the-2026-midyear-numbers-where-digital-accessibility-litigation-is-going), [Seyfarth summary](https://www.adatitleiii.com/2026/03/federal-court-website-accessibility-lawsuit-filings-bounce-back-in-2025/) |

Title II applies to public bodies. Most of the QA Tool's target users are private startups, so their US exposure is Title III lawsuits, where courts look at WCAG 2.1 or 2.2 AA as a yardstick. I didn't find a court ruling that fixes this, so treat the yardstick point as *(unverified)*.

**What "covering ADA and EAA" can honestly mean for a testing tool.**
- It can mean: tests mapped to WCAG 2.2 AA (which also meets 2.1 AA), a list of failures with the criterion number, and a record of what was and wasn't checked.
- It can't mean: "compliant". The EAA's legal test uses EN 301 549 and national rules. The ADA has no web rule for private firms. Automation can't judge most criteria (section 3.1). The FTC has already acted against a company for claiming automated WCAG compliance (section 3.8).
- Honest wording: "No automated WCAG 2.2 AA failures found on the pages we tested. 14 checks need a person."

### 3.1 What share of issues automation finds

| Study | Method | Result | Source |
|---|---|---|---|
| Deque, March 2021 | More than 2,000 audits, over 13,000 pages and nearly 300,000 issues. All were first-time evaluations, run with axe. Counted by **volume of issues**, not by number of WCAG criteria. | **57%** of issues found by automation *(vendor claim)*. The old 20 to 30% figure counts criteria. | [Deque](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/) |
| UK Government Digital Service, 2017 | Planted 142 barriers on one test page and ran 13 tools. | Best tool found **40%**, worst **13%**. SortSite 40%, Tenon 34%, AChecker 31%, WAVE 30%. | [GDS audit](https://alphagov.github.io/accessibility-tool-audit/) |
| WebAIM Million 2026 | WAVE on 1,000,000 home pages, February 2026. | 95.9% of home pages had detected WCAG 2 failures. 56.1 errors a page, up from 51. Six error types make up 96% of errors: low contrast (83.9% of pages), missing alt text (53.1%), missing form labels (51%), empty links (46.3%), empty buttons (30.6%), missing language (13.5%). | [WebAIM](https://webaim.org/projects/million/) |

How to read these:
- The two studies measure different things. Deque counts real-world issues weighted by how often they occur. GDS counts a fixed set of planted barriers. 57% and 40% don't contradict each other.
- Deque makes axe and sells axe. Its figure is a *(vendor claim)*. I didn't find an independent replication.
- WebAIM counts only what WAVE detects. It shows that common, detectable failures are everywhere, not how many total failures exist.
- Playwright's docs say tools find "some common accessibility problems" and "many … can only be discovered through manual testing" ([Playwright](https://playwright.dev/docs/accessibility-testing)). Lighthouse puts manual checks outside its score ([docs](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)).
- Practical reading: automation finds the frequent, mechanical issues, probably a bit under or around half by volume, and almost none of the judgment calls (is this alt text meaningful, does the focus order make sense, are error messages understandable).

### 3.2 Automated WCAG checks (axe)

- **What leading tools do:** axe-core, Pa11y, IBM Equal Access, WAVE and Lighthouse all run rule engines in the page. axe-core states it "returns zero false positives (bugs notwithstanding)" and reports uncertain items as "incomplete" ([repo](https://github.com/dequelabs/axe-core)).
- **QA Tool today:** [`ux-quality.ts`](../../../packages/checkers/src/ux-quality.ts) runs `@axe-core/playwright` with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`. So it already tests WCAG 2.2 AA rules that axe supports, not only 2.1 as the brief says. The glossary still says 2.1 AA ([CONTEXT.md](../../../CONTEXT.md)).
  - Impact maps to severity: critical to Blocker, serious to Major, the rest to Minor.
  - It reports only the first failing element per rule (`nodes[0]`).
  - It ignores axe's `incomplete` results, which are the "needs a person" list.
  - The tag list drops `wcag22a` (2.2 Level A rules such as Redundant Entry and Consistent Help). I couldn't check whether axe has any such rules *(unverified)*.
  - Findings don't name the WCAG criterion number, only the axe rule id.
  - Errors from axe are swallowed in an empty `catch`, so a failed scan looks like a pass.
- **Gap:** criterion numbers and A/AA labels on findings, the "needs a person" list, a visible "scan failed" state, and a 2.2 wording fix in docs.
- **Applies to:** **Website** directly. **Phone app** and **Desktop app** use other engines (3.7, 3.8).
- **Verdict: Build now.** It's small, deterministic and already running. Add `incomplete` results, criterion numbers and failure reporting.

### 3.3 Checks after interaction

The glossary calls the existing idea a State-Aware UX Check: axe runs at settled points after clicks, open modals and invalid form submissions ([CONTEXT.md](../../../CONTEXT.md)).

| Check | Needs | Source for the rule |
|---|---|---|
| Keyboard-only use: reach and use every control with Tab, Enter, Space | Playwright `keyboard` | WCAG 2.2, 2.1.1 and 2.1.2 ([W3C](https://www.w3.org/TR/WCAG22/)) |
| Focus order and focus not hidden by sticky headers | Compare tab order with visual order. Check the focused element's box against fixed elements. | 2.4.11 Focus Not Obscured (Minimum), AA ([W3C](https://www.w3.org/TR/WCAG22/)) |
| Reflow at 320 px | Set a 320 px wide viewport and look for horizontal scroll | WCAG 1.4.10 (not fetched, *unverified* wording) |
| Reduced motion | `prefers-reduced-motion` emulation | WCAG 2.3.3 is AAA, so only a best-practice note *(unverified)* |
| Target size | Measure with `getBoundingClientRect` | 2.5.8 Target Size (Minimum), AA |

- **QA Tool today:** `ux-quality.ts` has a tap-target rule at 375 px, but it tests **44 by 44 px**, not the WCAG 2.2 AA minimum of 24 by 24 CSS px (the 44 px figure is the stricter AAA criterion and the guideline platforms use). It also has a horizontal overflow rule, run at the plan's breakpoints (375 px is listed; I didn't confirm that 320 px is one). It has no keyboard, focus or reduced-motion check.
- **Gap:** keyboard traversal with a trap check (a keyboard trap fails 2.1.2), a focus-visible check, and a 320 px reflow run.
- **Applies to:** **Website** and mobile web. Phone and desktop apps need platform tools (3.7, 3.8).
- **Verdict: Build now** for keyboard traversal with focus-obscured and trap detection, and a 320 px reflow check. **Build later** for reduced motion. All are deterministic. The traversal needs safe interaction: Tab and focus only, no Enter on unknown buttons on live sites.

### 3.4 Guided manual tests for the rest

- **What leading tools do:** Deque's axe DevTools Pro has Intelligent Guided Tests, which walk a person through checks and record answers ([Deque](https://www.deque.com/axe/devtools/)). Accessibility Insights has a free manual Assessment mode ([site](https://accessibilityinsights.io/)).
- **QA Tool today:** nothing. Plan Review is the nearest idea, but it covers what to test, not human judgment of results.
- **Gap:** a short checklist of what automation can't judge: alt text quality, heading logic, link purpose, captions, error message clarity, screen reader pass on the main flow. Each item links to the failing page and records a pass, fail or "not checked" with date.
- **Applies to:** every App, but the checklist is per platform.
- **Verdict: Build later.** It's the honest bridge to ADA and EAA. Start as a Markdown checklist in the report. A guided in-browser flow comes later. QA testers are the second user group, so this also helps them.

### 3.5 Overlays

- **Facts:** The FTC's final order of 22 April 2025 made accessiBe pay $1 million and bars it from claiming that its automated products can make a website WCAG-compliant "unless it has the evidence to support such claims". It also bars fake independent reviews. The vote was 3-0 ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/04/ftc-approves-final-order-requiring-accessibe-pay-1-million)).
- UsableNet's midyear report says companies using widgets "continue facing lawsuits at rising rates" *(vendor claim, and UsableNet sells a competing service)* ([UsableNet](https://blog.usablenet.com/inside-the-2026-midyear-numbers-where-digital-accessibility-litigation-is-going)).
- **Verdict: Skip.** An overlay is a runtime patch on the user's site, and a testing tool shouldn't add one. A testing tool should find real defects, and the QA Tool's "Ready to release" verdict must never read as a WCAG compliance claim.

### 3.6 Accessibility statements and VPAT/ACR drafts

- **What the law asks:** the EAA requires services to provide information on how they meet accessibility requirements ([EUR-Lex](https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng), Annex V; I didn't read the annex text, so the exact wording is *(unverified)*). A VPAT or ACR is a vendor document used in US procurement, not a legal requirement for private firms *(unverified: ITI VPAT page not fetched)*.
- **QA Tool today:** nothing.
- **Gap:** a draft statement that lists only what was tested ("axe rules for WCAG 2.2 A and AA on 18 pages, 3 roles, 3 screen sizes"), known failures, and the contact line, to be completed by the owner.
- **Applies to:** every App. The statement is written for each App.
- **Verdict: Build later**, as a Markdown export. Don't call it a conformance report. A VPAT or ACR draft needs a person's judgment for each criterion, so skip an automatic one.

### 3.7 Phone apps

- **Android:** the Accessibility Test Framework runs checks on View objects and `AccessibilityNodeInfo` ([repo](https://github.com/google/Accessibility-Test-Framework-for-Android)). It's used from instrumented tests *(unverified: the repo page didn't mention Espresso)*.
- **iOS:** `performAccessibilityAudit()` runs inside XCUITest from iOS 17 and checks contrast, hit region, element description, Dynamic Type and clipped text ([WWDC23](https://developer.apple.com/videos/play/wwdc2023/10035/)).
- **React Native and Flutter:** both expose accessibility labels to the platform trees, so the native tools can read them. I didn't verify framework-specific tools *(unverified)*.
- **QA Tool today:** nothing, since it tests websites only.
- **Verdict: Build later**, with store apps in the brief's order. The audits run inside the user's own UI test build, so a browser-only tool would run them through the same driver as the app tests, on the user's device farm or CI. Mobile web gets the web checks now.

### 3.8 Desktop apps

- Accessibility Insights has a Windows app that inspects UI Automation properties ([site](https://accessibilityinsights.io/)). For macOS (AX) and Electron I didn't fetch primary docs. Electron renders web content, so web checks may apply inside it *(unverified)* ([Electron accessibility docs](https://www.electronjs.org/docs/latest/tutorial/accessibility), not read).
- **Verdict: Skip for now.** No user has asked, and it needs software on the user's machine.

### 3.9 Privacy and consent

- **Checks:** trackers firing before consent; whether a Global Privacy Control signal is honoured; cookie banners that block the page.
- **What GPC is:** a browser signal that asks sites to stop selling or sharing data. It was made an official work item of the W3C Privacy Working Group in November 2024, and CCPA is the main US law named ([GPC](https://globalprivacycontrol.org/)). Which other states require it I couldn't confirm *(unverified)*.
- **Leading tools:** cookie scanners such as Cookiebot and OneTrust do this. I didn't verify their prices or features *(unverified)*.
- **QA Tool today:** [`seo`, `security` and other checkers](../../../packages/checkers/src) have no consent or cookie check I found. I searched only for accessibility keywords there, so a consent check elsewhere isn't ruled out *(unverified)*.
- **Applies to:** **Website** (and mobile web). Phone apps use SDK consent flows, which are out of scope here.
- **Verdict: Build later.** It's read-only and deterministic: record which third-party requests fire before any click, and send the GPC header on one pass. It sits well with the security cluster. It's not accessibility, so don't mix it into the accessibility score.

## 4. Trends and openings (2025-2026)

1. **The EAA turned on in June 2025**, and the standard behind it just moved. EN 301 549 v4.1.1 (Sept 2026) points at WCAG 2.2, but v3.2.1 stays legal until the Commission cites the new one in the Official Journal ([EU](https://accessible-eu-centre.ec.europa.eu/content-corner/news/european-accessibility-standard-en-301-549-has-been-updated-2026-09-07_en)). The opening: test against WCAG 2.2 AA now, which meets 2.1 AA too, and label findings so either version can be read off.
2. **The US Title II deadline slipped a year** (April 2027 and 2028). Governments aren't the target market, but private-sector lawsuits kept growing, with about 6,000 web suits projected for 2026 *(vendor claim)*. Plaintiffs also file more in state courts ([UsableNet](https://blog.usablenet.com/inside-the-2026-midyear-numbers-where-digital-accessibility-litigation-is-going)).
3. **Overlay claims are now a regulatory risk** (FTC, April 2025). Honest limits in report wording is itself a selling point.
4. **Enterprise tools are out of reach.** The suites quote prices at about $15,000 to $30,000 or more a year *(unverified)*, and Deque's Pro price isn't public. A free tier with plain-language results for small teams is open ground.
5. **WCAG 3.0 is still a draft** with no date for completion. Its Bronze, Silver and Gold levels and percentage score are only proposals. Don't build for it ([W3C](https://www.w3.org/TR/2026/DNOTE-wcag-3.0-explainer-20260910/)).
6. **Pages are getting more complex.** Average elements per home page rose 14.3% in a year, and pages with ARIA had more errors, 59.1 against 42 without ([WebAIM](https://webaim.org/projects/million/)).

## 5. Fit with the limits

- **$0 hosting and browser-only:** axe-core and the interaction checks run inside the check-up's existing Playwright session and cost no AI calls. Nothing extra to install. Phone and desktop checks need the user's own device farm or computer.
- **Teams without QA staff:** show a plain line ("3 problems that stop some people using your checkout") on top, with the criterion number and repro under it. Never show a "compliance score" or the words "ADA compliant".
- **Deterministic:** all web checks here are rule-based. AI is only useful for drafting alt-text suggestions, which a person must approve.
- **FSL licence and global selling:** axe-core is MPL-2.0 and Pa11y is LGPL-3.0. IBM Equal Access is Apache-2.0. Check how MPL's file-level rules fit with FSL before bundling or modifying axe-core itself *(unverified: legal review needed)*.
- **Risks:**
  - A clean report could be read as proof of compliance. Wording and a "not checked" list are the defence.
  - Live-site keyboard traversal can trigger actions. Limit it to Tab and focus on live sites.
  - Several issues in `ux-quality.ts` (swallowed errors, first node only) could hide real problems.

## 6. Open questions

1. Do early users sell into the EU, the US or both? That decides whether to lead with EN 301 549 or WCAG wording.
2. Are they under the EAA's microenterprise limit (fewer than 10 staff and EUR 2 million or less)? If most are, the EAA matters less to them than customer contracts.
3. Is a legal-style statement wanted, or just a list of defects?
4. Should the 44 px target rule stay (stricter than the WCAG 2.2 AA 24 px minimum) or be split into "required" and "recommended"?
5. May keyboard traversal run on live sites, or only on Test Copies?
6. Is a consent and tracker check wanted in the same report, or as a separate Privacy area?

## 7. Sources

- Repo: [ux-quality.ts](../../../packages/checkers/src/ux-quality.ts), [checkers folder](../../../packages/checkers/src), [CONTEXT.md](../../../CONTEXT.md)
- Standards: https://www.w3.org/TR/WCAG22/ · https://www.w3.org/TR/2026/DNOTE-wcag-3.0-explainer-20260910/ · https://accessible-eu-centre.ec.europa.eu/content-corner/news/european-accessibility-standard-en-301-549-has-been-updated-2026-09-07_en
- Law: https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng · https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en · https://single-market-economy.ec.europa.eu/smes/sme-fundamentals/sme-definition_en · https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web · https://www.ada.gov/resources/web-rule-first-steps/ · https://web-accessibility-checker.com/en/blog/eaa-fines-penalties-by-country
- Lawsuits: https://blog.usablenet.com/inside-the-2026-midyear-numbers-where-digital-accessibility-litigation-is-going · https://www.adatitleiii.com/2026/03/federal-court-website-accessibility-lawsuit-filings-bounce-back-in-2025/
- Automation share: https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/ · https://alphagov.github.io/accessibility-tool-audit/ · https://webaim.org/projects/million/ · https://playwright.dev/docs/accessibility-testing
- Tools: https://github.com/dequelabs/axe-core · https://www.deque.com/axe/devtools/ · https://www.deque.com/axe/devtools/pricing/ · https://developer.chrome.com/docs/lighthouse/accessibility/scoring · https://wave.webaim.org/api/ · https://github.com/pa11y/pa11y · https://github.com/IBMa/equal-access · https://accessibilityinsights.io/ · https://www.vendr.com/marketplace/level-access · https://www.trustradius.com/products/evinced/pricing · https://testparty.ai/blog/siteimprove-alternatives
- Overlays: https://www.ftc.gov/news-events/news/press-releases/2025/04/ftc-approves-final-order-requiring-accessibe-pay-1-million
- Phone and desktop: https://github.com/google/Accessibility-Test-Framework-for-Android · https://developer.apple.com/videos/play/wwdc2023/10035/ · https://www.polpiella.dev/xcode-15-automated-accessibility-audits/ · https://www.electronjs.org/docs/latest/tutorial/accessibility (not read)
- Privacy: https://globalprivacycontrol.org/
