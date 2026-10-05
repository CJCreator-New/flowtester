# Cluster 04: Performance and Core Web Vitals

Checked 2026-10-05. Follows [00-brief.md](00-brief.md). Vendor marketing is marked *(vendor claim)*. Anything I couldn't confirm is marked *(unverified)*.

## 1. Scope

This file covers speed checks for an App. For a Website it means Core Web Vitals (LCP, INP, CLS) measured in a test browser, and how that differs from real-visitor data. It covers the free real-visitor sources (the CrUX API and PageSpeed Insights), how to make a test-browser number credible on a small shared cloud machine, budgets and regressions between check-ups, real-user monitoring tools, single-page apps (soft navigations), and load testing. It then covers Phone apps (startup, dropped frames, ANRs) and Desktop apps (Electron). The comparison is a founder or developer who today pastes a URL into PageSpeed Insights or runs Lighthouse by hand.

## 2. Market map

| Tool | Category | What's relevant here | Free tier / price | Source |
|---|---|---|---|---|
| Lighthouse | Lab tester (open source) | Simulated mobile throttling by default. v13.5.0 is the latest release listed. Moved to "Performance Insights" and removed some older audits. | Free | [releases](https://github.com/GoogleChrome/lighthouse/releases), [throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) |
| Lighthouse CI | Budgets and regressions in CI | `numberOfRuns` defaults to 3. Asserts on score, numeric values and resource budgets. | Free | [config](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) |
| PageSpeed Insights (PSI) and its API | Lab (Lighthouse) plus real-visitor data | Free, runs in Google's data centres. API quota is 25,000 tests a day and 240 a minute according to DebugBear, not Google *(unverified, see 3.2)*. | Free | [about](https://developers.google.com/speed/docs/insights/v5/about), [DebugBear on the API](https://www.debugbear.com/blog/pagespeed-insights-api) |
| CrUX API and CrUX History API | Real-visitor data (Chrome users) | LCP, INP, CLS and more per URL or origin. 150 queries a minute per Cloud project, free, no paid upgrade. | Free, API key needed | [API](https://developer.chrome.com/docs/crux/api), [History](https://developer.chrome.com/docs/crux/history-api) |
| web-vitals library | Real-user measurement code (Google) | About 3 KB. v5 in the README. Soft-navigation option needs Chromium 151 or later. | Free | [repo](https://github.com/GoogleChrome/web-vitals) |
| Vercel Speed Insights | Real-user monitoring | Free tier: 10,000 events per 30 days and a single Real Experience Score only. Plus: $10 per project a month plus $0.65 per 10,000 events on Pro. | Free tier, then paid | [pricing](https://vercel.com/docs/speed-insights/limits-and-pricing) |
| Sentry | Errors plus tracing | Developer plan is free, 1 user. Team $26 a month billed yearly. | Free tier, then paid | [pricing](https://sentry.io/pricing/) |
| DebugBear | Lab monitoring plus real-user monitoring | No free plan, 14-day trial. Plan prices differ by source, so none is stated here. | Trial only *(price unverified)* | [search results](https://www.softwareadvice.com/website-monitoring/debugbear-profile/) |
| SpeedCurve | Lab monitoring plus real-user monitoring | Starter from $90 a month, Growth from $576 a month. | Paid | [pricing](https://www.speedcurve.com/pricing/) |
| Calibre | Lab monitoring plus real-user monitoring | Starter $75 a month (5,000 synthetic tests, 5,000 user sessions), Team $150. 15-day trial. | Paid | [pricing](https://calibreapp.com/pricing) |
| WebPageTest (Catchpoint) | Lab tester | Free Starter plan: 150 test runs a month, 3 runs per test, 30 locations. Pro $18.75 a month *(from a review-site listing, unverified)*. | Free tier | [listing](https://www.trustradius.com/products/catchpoint-webpagetest/pricing), [Catchpoint](https://www.catchpoint.com/webpagetest) |
| k6 (Grafana) | Load testing | AGPL-3.0. Browser module is stable and collects Web Vitals. Cloud free: 500 virtual-user hours a month. Pro $19 a month plus $0.15 per virtual-user hour. | Free (self-run) | [repo](https://github.com/grafana/k6), [pricing](https://grafana.com/pricing/), [browser](https://grafana.com/docs/k6/latest/using-k6-browser/) |
| Artillery | Load testing | CLI is free (MPL-2.0). Cloud free plan: 30 reports a month. Team $199 a month. Runs Playwright browsers. | Free (self-run) | [pricing](https://www.artillery.io/pricing), [repo](https://github.com/artilleryio/artillery) |
| Locust | Load testing (Python) | MIT licence, scenarios are plain Python | Free | [repo](https://github.com/locustio/locust) |
| Android vitals / Macrobenchmark | Phone apps | Play Console field data. Macrobenchmark measures startup and frame timing on a physical device. | Free | [vitals](https://developer.android.com/topic/performance/vitals), [Macrobenchmark](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview) |
| MetricKit | Phone apps (iOS) | Daily launch time, hang and memory reports from real users | Free | [docs](https://developer.apple.com/documentation/metrickit) |

I did not find a Lighthouse release date I trust: the releases page excerpt gave a 2024 date next to a Chrome 156 note, which can't both be right *(unverified)*. Treat "v13.5.0" as the latest listed, not the date.

## 3. Capabilities

### 3.0 Thresholds (current)

| Metric | Good | Needs improvement | Poor | Source |
|---|---|---|---|---|
| LCP (loading) | up to 2.5 s | 2.5 s to 4.0 s | over 4.0 s | [web.dev](https://web.dev/articles/vitals) |
| INP (responsiveness) | up to 200 ms | 200 ms to 500 ms | over 500 ms | [web.dev](https://web.dev/articles/inp) |
| CLS (visual stability) | up to 0.1 | 0.1 to 0.25 | over 0.25 | [web.dev](https://web.dev/articles/vitals) |

A page "passes" when the 75th percentile of real page loads is Good for all three, split by mobile and desktop. web.dev says INP replaced First Input Delay in 2024 and that stable metrics "won't change more than once per year" ([web.dev](https://web.dev/articles/vitals)). Several 2026 SEO blogs claim Google cut the LCP "good" limit to 2.0 s in March 2026 or added a "Visual Stability Index". I found no such change on web.dev, so I treat those claims as wrong *(unverified, contradicted by the primary source)*.

The QA Tool's constants match this table ([`performance.ts`](../../../packages/checkers/src/performance.ts): 2,500 and 4,000 ms for LCP, 200 and 500 ms for INP, 0.1 and 0.25 for CLS).

### 3.1 Lab Core Web Vitals in the test browser

- **What leading tools do:**
  - Lighthouse loads the page once on a cold cache and replays it under simulated throttling, by default 150 ms latency, 1.6 Mbps down, 750 Kbps up, and a 4x CPU slowdown ([throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)). PSI says its mobile test simulates a Moto G4 on a mobile network ([PSI](https://developers.google.com/speed/docs/insights/v5/about)).
  - The Lighthouse variability guide ranks simulated throttling as the best of three options at reducing noise ([variability](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md)).
  - k6's browser module collects LCP, CLS, INP and others during scripted runs ([docs](https://grafana.com/docs/k6/latest/using-k6-browser/)).
- **What the QA Tool does today:**
  - [`performance.ts`](../../../packages/checkers/src/performance.ts) reads `largest-contentful-paint` and `layout-shift` entries with `performance.getEntriesByType` after the page settles. There's no throttling and no repeat run. A grep of `packages` found no CPU or network throttling anywhere.
  - Despite the brief, there's no INP measurement. The `inpMs` field exists in the type and thresholds, but nothing sets it, so no INP finding can be raised.
  - If no LCP entry exists, it falls back to `domContentLoadedEventEnd`. That is not LCP, so a finding titled "Largest Contentful Paint" may report a different number.
  - CLS is summed from `layout-shift` entries without session windows. web.dev's CLS is the worst burst of shifts, not the page-lifetime total, so this over-reports on long pages. web.dev defines CLS as "the largest burst of layout shift scores", where a burst has under 1 second between shifts and lasts at most 5 seconds ([web.dev](https://web.dev/articles/cls)).
  - One run, one browser. The finding text does say "Measured in a test browser, not by real visitors", which is honest.
  - It also bundles non-vitals checks (horizontal overflow, overlapping controls) under the `performance` checker. They're layout checks, and overlap with `ux-quality`.
- **Gap:**
  - No throttling, so numbers describe the machine that ran them.
  - No repeat runs, so one noisy run can flip a finding.
  - No real INP, and a misleading LCP fallback.
  - The page-lifetime CLS sum can overstate shifts.
- **Applies to:** **Website**: directly. **Phone app**: no; see 3.9. **Desktop app**: Electron's renderer is Chromium, so the same code could run later, but nothing here has been checked on it. **API**: response time is covered in cluster 06 instead.
- **Verdict: Build now.** Add throttling, repeat runs and a real lab INP, and remove the DOMContentLoaded fallback. The existing check is wrong in ways that produce false findings for users who trust it.

### 3.2 Real-visitor data: CrUX and PageSpeed Insights

- **What leading tools do:**
  - The CrUX API returns real Chrome users' LCP, INP, CLS and more, by URL or origin, as a 28-day rolling window, updated daily around 04:00 UTC. It needs a free API key and allows 150 queries a minute per Cloud project, with no paid upgrade ([API docs](https://developer.chrome.com/docs/crux/api)).
  - The CrUX History API returns the previous 40 weeks, one 28-day window per week, from the same quota ([History docs](https://developer.chrome.com/docs/crux/history-api)). That is a free trend line.
  - PSI shows one Lighthouse run plus CrUX field data, for free ([PSI](https://developers.google.com/speed/docs/insights/v5/about)).
- **Who is left out:** a page or site only gets data if it is publicly discoverable (indexable, no `noindex`, returns 200) and "sufficiently popular", with an undisclosed visitor threshold. It counts only Chrome users who opted in on desktop or Android, not iOS, so iPhone visitors are missing ([methodology](https://developer.chrome.com/docs/crux/methodology)). A startup with a few hundred visitors a month, a staging site or a sign-in-only page will usually get nothing.
- **Changes to watch:**
  - DebugBear reports that Google is discontinuing real-world CrUX data from the PSI API and pointing people to the CrUX and CrUX History APIs ([DebugBear](https://www.debugbear.com/blog/pagespeed-insights-api)). Google's own PSI pages I fetched don't say so *(unverified)*. Don't build on PSI's field data.
  - PSI's quota, 25,000 tests a day and 240 a minute, also comes only from DebugBear. The Google pages I fetched give no numbers *(unverified)*.
- **QA Tool today:** nothing. The finding text refers to "real visitors" but never fetches any.
- **Gap:** a Website check-up could show "your real visitors see LCP 3.1 s (poor); the test browser saw 2.2 s", which is the comparison founders can't get from a single Lighthouse run.
- **Applies to:** **Website** only (origin or URL). **Phone app**: use Play and Apple data instead (3.9). **API**: no.
- **Verdict: Build now.** It's a plain GET to a free API on the user's own key or ours, costs nothing to host, and needs no AI. Show "not enough visitor data yet" for small sites. That empty case is the common one for these users, so the lab number has to stand on its own.

### 3.3 Credible lab numbers on a small shared machine

What the sources say:

| Question | Answer | Source |
|---|---|---|
| How many runs? | "The median Lighthouse score of 5 runs is twice as stable as 1 run." Lighthouse CI defaults to 3 runs. | [variability](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md), [LHCI config](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) |
| Which value to keep? | Median, not the best or the average. LHCI offers median, optimistic, pessimistic and median-run, and its default is optimistic. | [LHCI config](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) |
| Which throttling? | Simulated is best, DevTools-style is partial, none gives no protection. Lighthouse defaults: 150 ms, 1.6 Mbps, 4x CPU. | [variability](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md), [throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) |
| What machine? | Minimum 2 dedicated cores and 2 GB RAM; recommended 4 cores and 4 to 8 GB. Avoid Lambda, shared-core instances and concurrent runs on the same hardware. | [variability](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md) |
| Is the machine fast or slow? | Lighthouse reports a `benchmarkIndex`: 1,500 to 2,000 for a high-end desktop, 125 to 800 for mid-tier mobile. If the host sits outside the expected range, adjust the CPU multiplier. | [throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) |
| What won't averaging fix? | A/B tests and random content ("irremovable" page nondeterminism). | [variability](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md) |

What this means for the QA Tool:

- The brief's target is small shared always-free machines. Lighthouse's own guide says to avoid shared-core hosts, and a crawl running several Playwright pages at once breaks the "no concurrent runs on the same hardware" rule. A lab number from our machine is therefore noisy by design.
- **Proposed rule (my inference from the table):** run the speed check on its own, one page at a time, outside the parallel crawl workers. Take 5 loads per Sample Page and report the median. Apply a fixed 4x CPU and 150 ms, 1.6 Mbps network profile through Chrome DevTools Protocol, which Playwright exposes through its CDP session ([docs](https://playwright.dev/docs/api/class-cdpsession)). Whether that Chromium-only route is reliable for Playwright's bundled browser wasn't confirmed in the docs I fetched *(unverified)*. Record `benchmarkIndex`-style machine speed with the result, and downgrade a finding to "might be the machine" when it is outside the mid-tier range.
- **Cost:** 5 loads of 3 Sample Pages at 2 screen sizes is 30 extra loads per Layout Group. That is a real extra on a free machine's daily limit. A cheaper compromise is 3 runs (the Lighthouse CI default) for every page and 5 only for pages that fail.
- **Don't flag small differences.** I found no published noise band for lab LCP on small machines, so any "plus or minus" figure I gave would be invented *(unverified)*. Measure it on the real machine first (see open questions).
- **Applies to:** **Website** and any Electron renderer. **Phone app**: farm devices are real hardware and need their own repeat-run rule (3.9).
- **Verdict: Build now.** This is the part that decides whether performance findings are believed.

### 3.4 Budgets and regressions between check-ups

- **What leading tools do:** Lighthouse CI asserts on a minimum score, a maximum numeric value and resource budgets, such as `resource-summary:script:size` in bytes ([config](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)). Calibre, SpeedCurve and DebugBear run scheduled lab tests and chart them over time ([Calibre](https://calibreapp.com/pricing), [SpeedCurve](https://www.speedcurve.com/pricing/)). CrUX History gives 40 weeks of field data for free ([docs](https://developer.chrome.com/docs/crux/history-api)).
- **QA Tool today:** a fixed `MAX_PAGE_WEIGHT_BYTES` of 4 MB and a slow-request threshold of 2 s are defined in `performance.ts`, but only the slow-request limit is checked. The weight limit is never used in a finding. Past check-ups keep reports ([`site-history.ts`](../../../packages/core/src/site-history.ts) is the history store, per the API cluster), but there's no per-page timing history.
- **Gap:** compare the median LCP and CLS per Layout Group with the last check-up and say "your product pages got slower since last time". The Report Hub's open, fixed and came-back statuses would work for this.
- **Applies to:** **Website**. **Phone app**: startup time between builds, later. **API**: median latency, see cluster 06.
- **Verdict: Build now** for stored medians and a "slower than last check-up" finding, once 3.3's repeat runs exist (a regression on single-run data would be noise). **Build later** for user-set budgets.

### 3.5 Real-user monitoring (RUM)

- **What leading tools do:**
  - The web-vitals library reports LCP, INP and CLS from real visitors with about 3 KB of script ([repo](https://github.com/GoogleChrome/web-vitals)).
  - Vercel Speed Insights' free tier shows only a single score and caps at 10,000 events per 30 days. If a team reaches it, collection pauses for at least 14 days ([pricing](https://vercel.com/docs/speed-insights/limits-and-pricing)).
  - Sentry's free Developer plan has one user ([pricing](https://sentry.io/pricing/)). Calibre starts at $75 a month, SpeedCurve at $90 ([Calibre](https://calibreapp.com/pricing), [SpeedCurve](https://www.speedcurve.com/pricing/)).
- **QA Tool today:** nothing, and by design. A check-up is a pre-release test, not an always-on collector.
- **Gap:** none worth closing. Collecting visitor data means hosting an ingestion endpoint and storing user data, which conflicts with $0 hosting and with the "test, don't watch" role.
- **Applies to:** **Website**. **Phone app**: Android vitals and MetricKit are the equivalents (3.9).
- **Verdict: Connect.** The report can say "install the web-vitals library or turn on Vercel Speed Insights, and the CrUX history will fill in once you have enough visitors". Skip building a collector.

### 3.6 Single-page apps and soft navigations

- **The problem:** CrUX attributes route changes inside a single-page app to the first page load, so later screens are invisible ([methodology](https://developer.chrome.com/docs/crux/methodology)).
- **Where Chrome is:** a soft navigation is a JavaScript-handled link click that updates the content and the URL. The Soft Navigations API adds `SoftNavigationEntry` and `InteractionContentfulPaint` entries so LCP, CLS, INP and FCP can be measured per route change. A final origin trial runs from Chrome 147 to 149, "with the API shipping later in 2026". The post says the trial is not about "how this data will be used in CrUX or tooling" ([Chrome blog](https://developer.chrome.com/blog/final-soft-navigations-origin-trial)). So as of today it has not shipped, and CrUX doesn't yet report soft navigations.
- **Library support:** web-vitals documents a `reportSoftNavs: true` option that needs Chromium 151 or later ([repo](https://github.com/GoogleChrome/web-vitals)). The Chrome version Playwright bundles today may be older, so it wasn't checked whether our test browser can use it *(unverified)*.
- **QA Tool today:** the Spider already treats a client-side route as a page, but `performance.ts` reads only the entries from the first document load. A page reached by clicking in a single-page app is measured on the wrong page's load, or not at all.
- **Gap and approach:** for a single-page app, measure each route with a hard load (fresh `goto`), which the lab can do today, and say that real visitors' soft-navigation numbers aren't in CrUX yet.
- **Applies to:** **Website** (React, Vue and similar). **Phone app** and **Desktop app**: not the same problem.
- **Verdict: Build later.** Use hard loads now. Add soft-navigation lab timing once the API ships in stable Chrome and Playwright bundles it.

### 3.7 Load testing

- **What leading tools do:**
  - k6 is AGPL-3.0, with a free cloud tier of 500 virtual-user hours a month and Pro at $19 a month plus $0.15 per virtual-user hour ([repo](https://github.com/grafana/k6), [pricing](https://grafana.com/pricing/)).
  - Artillery's CLI is free, and its cloud free plan includes 30 reports a month ([pricing](https://www.artillery.io/pricing)). Locust is MIT-licensed ([repo](https://github.com/locustio/locust)).
- **QA Tool today:** nothing, and `performance.ts` measures one visitor only.
- **Why not on our machines:**
  - Generating load from a shared free machine is unreliable as a measurement (3.3 says to avoid shared cores), and it sends many requests the owner could mistake for an attack. By the brief's definition that is a Security Probe, so it needs a Test Copy under a Verified Domain.
  - It would also cause abuse and cost risk for the shared hosting.
  - AGPL-3.0 on k6 matters if we bundled it into a hosted service. I haven't had this checked legally *(unverified)*.
- **Applies to:** **Website** and **API** (a public API under its own load). Not **Phone** or **Desktop**.
- **Verdict: Skip** as a built-in feature. **Connect:** the report can suggest k6 or Artillery run from the user's own machine or CI, and offer a ready-made script from the recorded traffic (the traffic analysis in cluster 06). That script generator is **Build later**.

### 3.8 Page weight and slow requests

- **What leading tools do:** Lighthouse CI budgets on resource size and count; Lighthouse's performance insights replaced several older audits ([releases](https://github.com/GoogleChrome/lighthouse/releases)).
- **QA Tool today:** the slow-request check flags only the single slowest request over 2 s. A request over 1.5 s is collected, but that duration includes waiting for a late third-party script that doesn't block the page.
- **Gap:** transfer size is collected but never reported (see 3.4), and slow third-party requests aren't separated from the site's own.
- **Verdict: Build now** (small): report total weight against the existing 4 MB constant, and label first-party and third-party requests separately. It's already collected, so it's nearly free.

### 3.9 Phone apps and Desktop apps

**Phone app (Android)**
- Android vitals is Play's field data. Bad-behaviour thresholds in the overall column are 1.09% user-perceived crashes and 0.47% user-perceived ANRs, measured on a 28-day rolling window, and exceeding them may reduce visibility on Google Play ([docs](https://developer.android.com/topic/performance/vitals)).
- Macrobenchmark measures `StartupTimingMetric` and `FrameTimingMetric` on a physical device. It needs a profileable, non-debuggable, minified build ([docs](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview)). A hosted browser-only tool can't provide that, and users would run it in their own CI on their own device accounts.
- Startup states are cold, warm and hot, and the guide says to optimise for cold start ([docs](https://developer.android.com/topic/performance/vitals/launch-time)). I did not find Play's startup-time thresholds in the page I fetched *(unverified)*.

**Phone app (iOS)**
- MetricKit delivers launch time, hang rate and memory data daily from real users ([docs](https://developer.apple.com/documentation/metrickit)). It lives inside the user's app, not in our tool.

**Verdict for phone apps: Build later**, as part of store apps (cluster 07). The cheapest credible version is a startup-time and dropped-frame reading from the device-farm run the user already pays for. Real-user crash and ANR rates stay in Play Console and MetricKit (**Connect**).

**Desktop app**
- Electron's guide lists eight tips (profile first, defer loading, keep the main process free, bundle code and others) but no measurement tool of its own ([docs](https://www.electronjs.org/docs/latest/tutorial/performance)). Startup time and memory would be read from the process.
- **Verdict: Skip for now.** Desktop comes last, and no user has asked.

## 4. Trends and openings (2025-2026)

1. **The metrics have been stable.** INP replaced FID in 2024, and web.dev commits to at most one change a year ([web.dev](https://web.dev/articles/vitals)). Rumours of new 2026 thresholds are unsourced (3.0). The QA Tool's constants are current. The opening is to be the tool that is right about what is measured, such as real INP and not a stand-in.
2. **Soft navigations are about to ship.** The final origin trial runs Chrome 147 to 149, with launch "later in 2026" and CrUX handling still undecided ([Chrome blog](https://developer.chrome.com/blog/final-soft-navigations-origin-trial)). Nobody free covers single-page apps well yet, so a check-up that tests each route could stand out. But it must wait for stable support.
3. **Google is steering people to CrUX and CrUX History** for field data, and away from PSI's field data (DebugBear's reading *(unverified)*). Both are free, so a small tool can show real-visitor data without any collection.
4. **Lighthouse is moving toward AI-era checks.** The release notes list an "Agentic Browsing" category with WebMCP and llms.txt checks ([releases](https://github.com/GoogleChrome/lighthouse/releases)). That overlaps with the existing `aeo` and `geo` checkers and is outside this cluster.
5. **Free RUM is getting thinner.** Vercel's free Speed Insights caps at 10,000 events and shows one score ([pricing](https://vercel.com/docs/speed-insights/limits-and-pricing)). Detailed vitals start at $10 per project plus usage. Small teams are left with CrUX and a lab tool.
6. **Load testing lives in the cloud-run, per-use model.** k6 and Artillery both give a small free cloud allowance and charge by usage ([k6](https://grafana.com/pricing/), [Artillery](https://www.artillery.io/pricing)). There's no gap worth a $0-hosted tool entering.

## 5. Fit with the limits

- **$0 hosting:**
  - CrUX is one GET per origin or page. Stored medians are kilobytes.
  - The cost is machine time. The Lighthouse guide's advice (2 dedicated cores, no shared-core hosts, no concurrent runs) is the opposite of a shared free machine, so lab numbers carry a "this machine was slow" caveat, and the daily check-up limit should count repeat runs.
  - CrUX's 150 a minute per Cloud project is shared across all our users if we use one key. Per-user keys, or a cached result per origin per day, avoid that.
- **Browser-only:** everything in Build now runs in the existing Playwright session or as an API call. Macrobenchmark, MetricKit and load generators need a device or a runner the user owns.
- **Teams without QA staff:**
  - The verdict should say "Your product pages load slowly for phone visitors" with the measured median, plus a one-line cause. The LCP, INP and CLS names go in the developer detail.
  - Showing real-visitor data next to the lab number answers "is this real?" honestly.
- **Deterministic tests:** repeat runs and medians make results stable but not identical. Say "median of 5" in the report, and don't make one number a hard blocker without the run count.
- **Risks:**
  - False findings from noise. If a speed finding fails a "Ready to release" verdict, it must come from medians, not a single run.
  - The current check can emit a "Largest Contentful Paint" finding that is really a load-event time (3.1). That should be fixed before anyone relies on it.
  - Bundling k6 (AGPL-3.0) is a licensing question for a source-available (FSL) product, so Connect rather than bundle.

## 6. Open questions

1. How noisy is lab LCP on the actual free machine we pick? Run the same page 30 times and find the spread before choosing "5 runs" or a "slower by X%" threshold.
2. Will early users have enough traffic for CrUX? If most don't, the lab number is the product, and the CrUX panel is a bonus.
3. Should a poor lab INP or LCP block "Ready to release", or only warn? The brief's verdict rule needs a stance on noisy metrics.
4. Do the users' sites run as single-page apps? That decides how soon soft navigations matter.
5. May we use one Google Cloud key for all users on CrUX, or ask each user for their own? I haven't read Google's terms on shared keys *(unverified)*.
6. Do users want a load-test script, or is a pointer to k6 enough?
7. Does the bundled Chromium in Playwright reach version 151, so `reportSoftNavs` works in a test run, and when?

## 7. Sources

- Repo code: [performance.ts](../../../packages/checkers/src/performance.ts), [CONTEXT.md](../../../CONTEXT.md), [00-brief.md](00-brief.md), [06-api-testing.md](06-api-testing.md)
- Core Web Vitals and field data: https://web.dev/articles/vitals · https://web.dev/articles/inp · https://web.dev/articles/lab-and-field-data-differences · https://developer.chrome.com/docs/crux/api · https://developer.chrome.com/docs/crux/history-api · https://developer.chrome.com/docs/crux/methodology · https://developers.google.com/speed/docs/insights/v5/about · https://developers.google.com/speed/docs/insights/rest/v5/pagespeedapi/runpagespeed · https://www.debugbear.com/blog/pagespeed-insights-api
- Soft navigations and web-vitals: https://developer.chrome.com/blog/final-soft-navigations-origin-trial · https://github.com/GoogleChrome/web-vitals
- Lab testing and noise: https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md · https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md · https://github.com/GoogleChrome/lighthouse/releases · https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md · https://playwright.dev/docs/api/class-cdpsession
- Monitoring and RUM vendors: https://vercel.com/docs/speed-insights/limits-and-pricing · https://sentry.io/pricing/ · https://www.speedcurve.com/pricing/ · https://calibreapp.com/pricing · https://www.softwareadvice.com/website-monitoring/debugbear-profile/ · https://www.trustradius.com/products/catchpoint-webpagetest/pricing · https://www.catchpoint.com/webpagetest
- Load testing: https://github.com/grafana/k6 · https://grafana.com/pricing/ · https://grafana.com/docs/k6/latest/using-k6-browser/ · https://www.artillery.io/pricing · https://github.com/artilleryio/artillery · https://github.com/locustio/locust
- Phone and desktop: https://developer.android.com/topic/performance/vitals · https://developer.android.com/topic/performance/vitals/launch-time · https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview · https://developer.apple.com/documentation/metrickit · https://www.electronjs.org/docs/latest/tutorial/performance
