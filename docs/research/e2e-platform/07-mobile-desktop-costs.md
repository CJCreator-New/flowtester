# Cluster 07: phone apps, desktop apps and running costs

Checked 2026-10-05. Follows [00-brief.md](00-brief.md). Vendor marketing is marked *(vendor claim)*. Anything I couldn't confirm is marked *(unverified)*. Numbers marked *(estimate)* are my own arithmetic from stated assumptions, not facts from a source.

## 1. Scope

This file covers four things:

1. Mobile web on real WebKit and Android Chrome, which comes right after web depth.
2. Store apps (React Native, Expo, Flutter, native Swift and Kotlin) through one driver, including how a browser-only tool takes an app build, and what the Deterministic Spider and Layout Groups become for an app.
3. Desktop apps, which come last.
4. What it costs to run: device farms on the user's own account, $0 hosting, and AI.

The comparison is a founder or developer with no QA staff who would otherwise run Maestro or Playwright by hand. Terms follow [CONTEXT.md](../../../CONTEXT.md): **App**, **Check-up**, **Plan**, **Test Copy**, **Verified Domain**, **Security Probe**, **AI Request Budget**.

## 2. Market map

| Tool | Category | What's relevant here | Free tier / price | Source |
|---|---|---|---|---|
| Playwright | Browser driver | Real WebKit build (not Safari), Chrome for Android over ADB (experimental), Electron (experimental) | Free | [browsers](https://playwright.dev/docs/browsers), [Android](https://playwright.dev/docs/api/class-android), [Electron](https://playwright.dev/docs/api/class-electron) |
| Maestro | App driver (YAML) | Android emulators and devices, iOS simulators only, web. Works across React Native, Flutter and native. | CLI and Studio free (Apache 2.0). Maestro Cloud $250 per device a month. | [platforms](https://docs.maestro.dev/get-started/supported-platform), [repo](https://github.com/mobile-dev-inc/Maestro), [pricing](https://maestro.dev/pricing) |
| Appium | App driver (WebDriver) | Mobile, desktop (Windows, macOS) and TV through drivers. Open source, OpenJS Foundation. | Free | [docs](https://appium.io/docs/en/latest/) |
| Detox | App driver (gray box) | React Native only | Free | [docs](https://wix.github.io/Detox/docs/introduction/getting-started) |
| Patrol | App driver (Dart) | Flutter only. Adds native dialogs and settings on top of `integration_test`. | Free | [site](https://patrol.leancode.co/) |
| Flutter `integration_test` | App driver | Flutter only. Native dialogs are limited. | Free | [docs](https://docs.flutter.dev/testing/integration-tests) |
| Espresso, XCUITest | Native drivers | One platform each, written in Kotlin/Java and Swift | Free *(unverified: no page fetched)* | n/a |
| Expo EAS | Build and CI service | Builds and workflows for Expo and React Native | Free: 15 Android and 15 iOS builds and 60 CI minutes a month. Starter $19, Production $199. | [pricing](https://expo.dev/pricing), [workflows](https://docs.expo.dev/eas/workflows/get-started/) |
| Firebase Test Lab | Device farm | Spark: 15 runs a day. **Deprecated: shuts down 30 Sep 2027.** | See section 3.6 | [quotas](https://firebase.google.com/docs/test-lab/usage-quotas-pricing), [FAQ](https://firebase.google.com/docs/test-lab/migrate-faq) |
| AWS Device Farm | Device farm | Real phones, Appium endpoint, us-west-2 only | 1,000 free minutes once. $0.17 per device minute. | [pricing](https://aws.amazon.com/device-farm/pricing/), [docs](https://docs.aws.amazon.com/devicefarm/latest/developerguide/welcome.html) |
| BrowserStack App Automate | Device farm | Appium, Maestro, Espresso, Flutter, Detox, XCUITest; REST API | From $175 a month, 1 parallel, billed yearly. Free trial. | [pricing](https://www.browserstack.com/pricing?product=app-automate), [API](https://www.browserstack.com/docs/app-automate/api-reference/introduction) |
| Sauce Labs | Device farm | Real devices, REST API | $199 a month billed yearly ($249 monthly), 1 parallel. Free trial. | [pricing](https://saucelabs.com/pricing) |
| TestMu AI (was LambdaTest) | Device farm | Rebranded; `lambdatest.com/pricing` returns a 301 to `testmuai.com` | Free plan: 300 minutes. Real-device automation from $199 a month billed yearly. | [pricing](https://www.testmuai.com/pricing/) |
| Genymotion SaaS | Cloud emulators | Android only | $0.06 a minute, or $179 to $219 a month per device | [pricing](https://www.genymotion.com/pricing/) |
| Tauri + WebDriver | Desktop driver | Windows and Linux with `tauri-driver`. macOS only through a WebdriverIO service. | Free | [docs](https://v2.tauri.app/develop/tests/webdriver/) |
| WinAppDriver | Desktop driver | Windows apps (UWP, WinForms, WPF, Win32). Appium's Windows driver is the maintained alternative. | Free | [repo](https://github.com/microsoft/WinAppDriver) |
| Cloudflare Browser Run (was Browser Rendering) | Hosted browsers | Playwright, Puppeteer | Free: 10 minutes a day. Paid: 10 hours a month, then $0.09 an hour. | [pricing](https://developers.cloudflare.com/browser-rendering/pricing/) |
| Browserless | Hosted browsers | Hosted Chromium | Free: 1,000 units, 2 minutes a session. Paid from $25 a month. | [pricing](https://www.browserless.io/pricing) |

## 3. Capabilities

### 3.1 Mobile web: real WebKit and Android Chrome

- **What leading tools do:**
  - Playwright's WebKit "is derived from the latest WebKit main branch sources, often before these updates are incorporated into Apple Safari", and "doesn't work with the branded version of Safari" ([docs](https://playwright.dev/docs/browsers)). So it is a real WebKit engine, not Safari and not an iPhone.
  - The same page says WebKit on Linux CI "is usually the most affordable option", and that media codecs "vary substantially" between Linux, macOS and Windows. Video playback should be checked on macOS.
  - Android: Playwright drives Chrome 87 or newer on a real device or AVD emulator through ADB. It is labelled **experimental**, and devices must be awake for screenshots ([docs](https://playwright.dev/docs/api/class-android)).
  - Real iPhone Safari is only reachable through a device farm (section 3.6).
- **QA Tool today:** Chromium only. [`browser.ts`](../../../packages/core/src/browser.ts) imports `chromium` and calls `chromium.launch`. Mobile means a Chromium window at a phone size.
- **Gap:** no WebKit run, no Firefox run, no Android Chrome run.
- **Applies to:** **Website** (mobile layouts) directly. It is not a **Phone app** feature.
- **Platform notes:**
  - WebKit is a Playwright download of a few hundred MB. It runs on Linux, so it fits a $0 Linux machine. It will catch most engine-level layout and JavaScript differences, but not iOS-only behaviour such as the on-screen keyboard or Safari's toolbar *(unverified: no primary list of what a WebKit build misses)*.
  - Android Chrome needs an emulator. The Android Emulator docs say the hardware-accelerated emulator cannot run inside another VM, including cloud VMs with nested virtualization ([Android](https://developer.android.com/studio/run/emulator-acceleration)). That rules out the always-free cloud VMs in section 3.7. GitHub's Linux runners are a different case (section 3.7).
- **Verdict:**
  - **Build now (it's the next step after web depth):** a WebKit run of the same Plan on the hosted Linux machines. It is the cheapest real second engine.
  - **Build later:** Android Chrome through the user's own device farm or CI emulator. Do not host emulators.

### 3.2 One driver for store apps

- **What leading tools do:** the options split in two.

| Driver | Covers | iOS | Notes |
|---|---|---|---|
| Maestro | React Native, Flutter, native, hybrid, because it works at the UI layer and doesn't inject code ([docs](https://docs.maestro.dev/get-started/supported-platform)) | Simulators only: "Physical iOS devices are not yet supported" ([repo](https://github.com/mobile-dev-inc/Maestro)) | YAML flows, Apache 2.0, free locally |
| Appium | Mobile, desktop, TV, browsers ([docs](https://appium.io/docs/en/latest/)) | Real devices and simulators, through drivers | Code-based, needs a server and per-platform drivers |
| Detox | React Native only | Simulators and devices | Gray box: sees app internals for stable timing ([docs](https://wix.github.io/Detox/docs/introduction/getting-started)) |
| Patrol / `integration_test` | Flutter only | Yes | Dart code inside the project ([Patrol](https://patrol.leancode.co/), [Flutter](https://docs.flutter.dev/testing/integration-tests)) |
| Espresso, XCUITest | One platform each | n/a | Written in the app's own language *(unverified: no page fetched)* |

- **Recommendation: Maestro.** Reasons:
  1. It is the only one that is both free and black-box across all four framework families. Detox, Patrol and `integration_test` each cover one family. Espresso and XCUITest cover one platform each. The tool must work on an App it has never seen the source of, so a driver that lives inside the project is the wrong shape.
  2. A flow is a YAML file. The tool can generate it from a Plan, show it in the Plan Review, and export it for the user to keep, the same way it exports Playwright code.
  3. The device farms in section 3.6 accept it: BrowserStack lists Maestro next to Appium, Espresso, Flutter, Detox and XCUITest ([API docs](https://www.browserstack.com/docs/app-automate/api-reference/introduction)), and Maestro Cloud runs it natively.
  4. Free local use under Apache 2.0 matches the "$0 until revenue" limit.
- **What Maestro costs us:**
  - No real iPhones, so iOS runs on simulators, which need macOS.
  - Maestro's own AI commands (`assertWithAI`, `assertNoDefectsWithAI`) route through Maestro Cloud. The docs say users "no longer need to 'bring their own AI'" and "need a Maestro Cloud account"; a free account is enough ([docs](https://docs.maestro.dev/maestro-flows/workspace-management/ai-test-analysis)). That conflicts with our BYOK model, so the tool should use only Maestro's deterministic commands and keep AI in its own provider layer.
  - Maestro Cloud is $250 per device per month ([pricing](https://maestro.dev/pricing)). We would not resell it.
- **Fallback: Appium**, only for a user who needs a real iPhone. It is heavier, so treat it as an advanced option.
- **QA Tool today:** nothing for apps. [`browser.ts`](../../../packages/core/src/browser.ts) is the only driver.
- **Applies to:** **Phone app** (iOS and Android builds together). **Desktop app:** not through Maestro *(unverified: its docs list only mobile and web)*.
- **Verdict: Build later**, after web depth and mobile web. It is the right third step because a Plan can become a Maestro flow without new infrastructure on our side.

### 3.3 How a browser-only tool takes an app build

The user's browser can upload a file. What the file is and where it runs are the hard parts.

| Build | What it is | Runs where | Signing constraint |
|---|---|---|---|
| APK | Installable Android package | Any Android emulator or device | A debug-signed APK is fine for testing |
| AAB | Store upload format, not directly installable | Needs conversion | `bundletool build-apks --mode=universal` makes one APK for all devices, and "if you don't specify signing information" it signs with a debug key ([docs](https://developer.android.com/tools/bundletool)) |
| iOS Simulator build (`.app`) | Built by Xcode for the simulator | iOS Simulator on macOS | No device registration needed *(unverified: Apple's page returned 404 and I could not confirm)* |
| IPA for real devices | Signed build | A registered iPhone | Needs the device's UDID, an ad hoc provisioning profile and Apple Developer Program membership ([Apple](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)) |
| App Store IPA | Store build | Not testable directly | *(unverified: I could not confirm whether it can be installed outside TestFlight)* |

- **What follows:**
  - **Android is easy.** Ask for an APK, or an AAB and convert it ourselves with bundletool.
  - **iOS is the constraint.** A simulator build needs macOS to produce and to run. The user's own CI or Expo EAS produces it (EAS Free: 15 iOS builds a month, [pricing](https://expo.dev/pricing)). A real-device IPA needs the user's signing setup, which a tool with no installs can't hold for them.
  - Maestro cannot run on real iPhones, so real-iPhone coverage goes through a farm's own drivers.
- **Delivery options, simplest first:**
  1. **The user's CI uploads the build** to the farm (BrowserStack takes `.apk`, `.aab`, `.ipa`, [API](https://www.browserstack.com/docs/app-automate/api-reference/introduction)) and posts the result to the tool. We never see the binary.
  2. **The user uploads the build in the browser** and our server passes it on to the farm with the user's key. Larger bytes through our $0 machine. BrowserStack limits uploads to 5 a minute per user, which is fine.
  3. **The user connects Expo EAS** and we pick up the latest build *(unverified: I did not read the EAS API)*.
- **Verdict: Build later.** Start with option 1 plus an APK upload. Ask early users which build they actually have.

### 3.4 The app version of the Deterministic Spider and Layout Groups

This section is a design proposal, not something I found a source for.

- **Precedent:** Firebase's Robo test "analyzes the structure of your app's user interface… and then explores it methodically". It is deterministic ("identical actions in the same sequence each time") and produces a crawl graph with screenshots ([docs](https://firebase.google.com/docs/test-lab/android/robo-ux-test)). Android's Monkey sends pseudo-random events and can be replayed with a seed, but only reports crashes and ANRs ([docs](https://developer.android.com/studio/test/other-testing-tools/monkey)). Robo is the closer model.
- **Screen as a page:** the Spider reads the screen's view hierarchy through the driver (Maestro or Appium), lists tappable elements and text fields, taps each one in a fixed order, and records the **App Flow**: which screen leads to which, through which control.
- **Layout Group for an app:** group screens by a fingerprint of the hierarchy's structure (element types and nesting, with text and counts removed). Every product-detail screen then collapses into one group, and three Sample Pages (screens) get tested. The same idea as the web fingerprint.
- **Differences from web:**
  - No URLs. A screen is identified only by its fingerprint plus the path taken to reach it.
  - State matters more. A list that is empty on one run and full on the next changes the fingerprint, so the fingerprint should ignore repeated children.
  - Sign-in is a screen, not a cookie, so there is no storage-state reuse. Each run signs in, or the user supplies a build with a test account.
  - Sensitive Actions (buy, delete, send) look the same as other buttons. The existing Safety Filter words still apply, and exploration belongs on a Test Copy, meaning a build pointed at a test backend.
- **What the checks become:**
  - Crashes and not-responding screens replace console errors.
  - Tap-target size and contrast checks apply; browser-only checks (SEO, headers) don't.
  - Backend traffic goes into the API analyser (see [06-api-testing.md](06-api-testing.md), section 3.8). A farm's network log is an input, not our own proxy.
- **Verdict: Build later**, together with 3.2. Start with a fixed set of taps from the Plan and add crawling only when users ask.
- **AI explorer, opt-in:** the brief already allows it on Test Copies. For apps, it would give an AI the screen hierarchy and a tap list. Keep it behind the AI Request Budget (section 3.8).

### 3.5 Desktop apps (last)

- **Electron:** Playwright launches an Electron app through `_electron`. It is **experimental**. It supports v12.2 and later. Native dialogs are not intercepted, and need stubbing in the main process ([docs](https://playwright.dev/docs/api/class-electron)). The existing Playwright checks (console errors, axe, screenshots) mostly carry over because the window is a Chromium page.
- **Tauri:** `tauri-driver` supports Windows and Linux only, "as macOS has no WKWebView driver tool available". Tauri recommends the WebdriverIO service, which also covers macOS ([docs](https://v2.tauri.app/develop/tests/webdriver/)).
- **Native Windows and macOS:** Appium has Windows and macOS drivers ([docs](https://appium.io/docs/en/latest/)). Microsoft's WinAppDriver repository points to the Appium Windows driver as the active option ([repo](https://github.com/microsoft/WinAppDriver)). I did not check the macOS driver's state *(unverified)*.
- **What a browser-only hosted tool needs:** a Windows or macOS machine to run the app. Linux free VMs can't do that. GitHub's Windows and macOS runners can (section 3.7), at a higher cost.
- **Applies to:** **Desktop app** only.
- **Verdict: Skip for now.** No user has asked, as the brief says. If it comes, do Electron first, because it reuses the Playwright path almost unchanged.

### 3.6 Device farms on the user's own account

The tool never pays. The user brings an account, and we call the farm's API with their key.

| Farm | Price | Free quota | API with the user's key | Source |
|---|---|---|---|---|
| Firebase Test Lab | Blaze: $5 an hour per physical device, $1 per virtual | Spark: 15 runs a day (10 virtual, 5 physical). Blaze: 30 physical and 60 virtual minutes a month. | Yes (Testing API: 10M calls a day). **Shuts down 30 Sep 2027.** | [quotas](https://firebase.google.com/docs/test-lab/usage-quotas-pricing) |
| Google Developer Device Platform | Matches Test Lab rates to 30 Apr 2027, then pay-per-use plus per-slot plans | None. Billing must be enabled. | Device Run and Device Streaming APIs *(unverified: API not read)* | [FAQ](https://firebase.google.com/docs/test-lab/migrate-faq) |
| AWS Device Farm | $0.17 per device minute. Unmetered from $250 a month per slot. | 1,000 minutes, one time | Yes (AWS API). us-west-2 only. | [pricing](https://aws.amazon.com/device-farm/pricing/), [docs](https://docs.aws.amazon.com/devicefarm/latest/developerguide/welcome.html) |
| BrowserStack App Automate | From $175 a month, 1 parallel, billed yearly | Free trial. Trials exclude network logs (see 06). | Yes, REST API, username and access key | [pricing](https://www.browserstack.com/pricing?product=app-automate), [API](https://www.browserstack.com/docs/app-automate/api-reference/introduction) |
| Sauce Labs | $199 a month billed yearly | Free trial | Yes, REST API | [pricing](https://saucelabs.com/pricing) |
| TestMu AI (was LambdaTest) | Real-device automation from $199 a month billed yearly | Free plan: 300 minutes, no stated device type | API not checked *(unverified)* | [pricing](https://www.testmuai.com/pricing/) |
| Genymotion SaaS | $0.06 a minute | None found | API not checked *(unverified)* | [pricing](https://www.genymotion.com/pricing/) |
| Maestro Cloud | $250 per device a month | Free account for AI commands only | Yes: `maestro cloud` with an API key | [pricing](https://maestro.dev/pricing) |

- **The finding that matters most:** Firebase Test Lab was the only farm with a free daily quota, and it is shutting down. The replacement requires billing, so no major farm will give a new user a free recurring quota after April 2027. The free options left are one-time (AWS 1,000 minutes), trials, and a TestMu AI plan of unstated device coverage.
- **What it means for pricing:** mobile checks on real devices will cost the user at least $175 to $250 a month, or pennies per minute on AWS. Our own free tier cannot include them. Emulators in the user's CI are the free path (section 3.7).
- **Verdict: Connect.** Do not build a farm. Build an "upload build, run flows, read back the report" step for one farm first. AWS Device Farm (pay per minute, free first 1,000) or BrowserStack (documented Maestro support) suit a small team best. Pick after asking users.

### 3.7 $0 hosting

The brief says website check-ups run on always-free cloud machines with a daily limit per user.

**Assumptions for the estimates *(estimate, not a source-backed fact)*:** one Check-up of 200 pages takes about 15 minutes of one CPU core and about 2 GB of memory with Chromium. WebKit costs about the same. Machines run about half the day to leave room for retries and idle time. The real number depends on the site, so measure before relying on these.

| Option | Current free limit | Check-ups per day *(estimate)* | Problems | Source |
|---|---|---|---|---|
| Oracle Ampere A1 | 1,500 OCPU hours and 9,000 GB hours a month: 2 OCPUs and 12 GB. **Halved from 4 OCPUs and 24 GB, effective 15 Jun 2026, without an announcement.** | About 50 to 100: two at a time, 6 to 8 rounds a day | Can be reclaimed if idle for 7 days (CPU, network and memory under 20%). Support answers conflict on whether paid accounts are affected. Arm build of Chromium and WebKit *(unverified)*. | [Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [InfoQ](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/) |
| Oracle AMD micro | 2 VMs, 1/8 OCPU and 1 GB each | 0. Too small for Chromium. | | [Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) |
| Google Compute Engine e2-micro | 1 VM a month in 3 US regions, 1 GB outbound data | 0 to 2 *(machine specs not checked)* | Likely too small. US regions only. | [Google](https://docs.cloud.google.com/free/docs/free-cloud-features) |
| Google Cloud Run | 2M requests, 180,000 vCPU-seconds, 360,000 GiB-seconds a month | About 6 to 7: 180,000 ÷ 900 s ≈ 200 a month | A 15-minute job may exceed request time limits *(unverified)* | [Google](https://docs.cloud.google.com/free/docs/free-cloud-features) |
| Azure Container Apps | Same numbers: 180,000 vCPU-s, 360,000 GiB-s, 2M requests | About 6 to 7 | The free VMs (750 hours of B1s) last only 12 months. | [Azure](https://azure.microsoft.com/en-us/free/) |
| AWS Free plan | $100 to $200 credits; the account "closes on its own 6 months after you open it" | n/a, not always-free | Not a $0 host | [AWS](https://aws.amazon.com/free/) |
| Cloudflare Browser Run | Free: 10 browser minutes a day, 3 browsers | 0 to 1 | One 15-minute check-up exceeds a day's quota. Paid: 10 hours a month, so about 40 a month, then $0.09 an hour. | [Cloudflare](https://developers.cloudflare.com/browser-rendering/pricing/) |
| Browserless | Free: 1,000 units a month (30 seconds each), 2-minute sessions | 0 as one session. About 33 a month if split into 2-minute chunks. | Session limit breaks a crawl | [Browserless](https://www.browserless.io/pricing) |
| The user's GitHub Actions | Free: 2,000 minutes a month on private repos. Standard runners are free on public repos. | About 4 a day on private (133 a month); no cap on public | Per-minute rates: Linux $0.006, Windows $0.010, macOS $0.062. macOS minutes may count 10 times against free minutes *(unverified: the official docs I read show rates only; the 10x figure comes from third-party pages)*. | [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [rates](https://docs.github.com/en/billing/reference/actions-minute-multipliers) |

- **GitHub specs:** standard Linux runners get 4 CPUs and 16 GB on public repos, but 2 CPUs and 8 GB on private repos ([runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)). Self-hosted runners are free ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). A proposed charge was postponed after backlash, according to third-party reports *(unverified: [sengi.run](https://sengi.run/blog/github-actions-pricing))*.
- **Android emulators:**
  - They cannot run inside a VM ([Android](https://developer.android.com/studio/run/emulator-acceleration)), so not on Oracle, Google or Azure.
  - GitHub says hardware-accelerated Android virtualization is available on its hosted Linux runners, and free for public repos on larger runners ([third-party summary](https://github.com/ReactiveCircus/android-emulator-runner); I could not open GitHub's own changelog page) *(unverified)*.
  - So Android emulator runs belong in the user's CI.
- **iOS simulators** need macOS, and macOS minutes are the dearest. They belong in the user's CI or EAS.
- **Reading the table:**
  - The best always-free host (Oracle A1) just lost half its capacity without notice. A tool that depends on it needs a second location.
  - A plan that works with two Oracle OCPUs is about 50 to 100 Check-ups a day across all users *(estimate)*. That is the real "daily limit per user" budget.
  - The user's own GitHub Actions is the most durable free option because it scales with users, not with us.
- **Verdict: Connect** (user's CI) for heavy and mobile work. **Build now** for a hosted Linux runner on Oracle plus one fallback, with a daily limit per user.

### 3.8 AI cost

**What the tool does today:** the AI Planner and visual review use the user's key (OpenRouter, Claude, OpenAI or Gemini). [CONTEXT.md](../../../CONTEXT.md) defines the **AI Request Budget**: the requests a Plan needs, compared with what the key has left today. It is estimated before the scan, and items past it use the Fixed-Rule Fallback. The code is under [`packages/core/src/ai`](../../../packages/core/src/ai).

**Free limits against that budget:**

| Provider | Free limit | Against the AI Request Budget | Source |
|---|---|---|---|
| OpenRouter free models | Under 10 credits: 20 requests a minute and 50 a day. 10 credits or more: 1,000 a day. | 50 a day is a few Plans at most. One Plan batches by Layout Group, but repairs and the visual review add more. A 10-credit top-up raises the cap 20 times. | [OpenRouter](https://openrouter.ai/docs/api-reference/limits) |
| Gemini API | Free tier covers Flash and Flash-Lite and some other models. The rate-limit page publishes no numbers; it points to each user's AI Studio page ("not guaranteed"). | Can't be budgeted without reading each user's limits at run time. | [limits](https://ai.google.dev/gemini-api/docs/rate-limits), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |

- **Gemini free tier, other facts:**
  - Free-tier content is "used to improve our products", and paid-tier content is not ([pricing](https://ai.google.dev/gemini-api/docs/pricing)). A founder pasting a client's site through a free key sends it to Google for training. The tool should say so before using a free Gemini key.
  - The pricing page names no region restrictions, but doesn't prove there are none *(unverified)*.
  - Third parties report that Pro models left the free tier on 1 Apr 2026 and quotas were cut in Dec 2025 *(unverified: secondary source, [apiyi.com](https://help.apiyi.com/en/google-gemini-api-free-tier-changes-april-2026-guide-en.html))*.
- **How competitors handle BYOK:**
  - Maestro: no bring-your-own AI. AI commands route through Maestro Cloud, and a free account is enough ([docs](https://docs.maestro.dev/maestro-flows/workspace-management/ai-test-analysis)).
  - Stagehand (Browserbase): bring your own key is optional next to Browserbase's Model Gateway ([docs](https://docs.browserbase.com/introduction/stagehand)).
  - Postman bundles AI credits into plans (Free: 50, see [06-api-testing.md](06-api-testing.md)).
  - Octomind, an AI testing service, shut down in May 2026 after three years *(unverified: reported by third parties, [stackpick](https://stackpick.net/tools/octomind/)).* Hosted AI testers carry the model cost themselves, which is the cost the brief avoids with BYOK.
  - I found no AI testing tool that publishes BYOK terms beyond these *(unverified: search results only)*.
- **Verdict: Build now** the free-tier warnings and a clearer AI Request Budget. The first Check-up on our key should use a model with a known cap, and count against a daily limit per user.

## 4. Trends and openings (2025-2026)

1. **Free real-device testing is going away.** Firebase Test Lab shuts down 30 Sep 2027, and its replacement needs billing ([FAQ](https://firebase.google.com/docs/test-lab/migrate-faq)). The cheapest paid real-device plans are $175 to $250 a month. A tool that runs flows on emulators in the user's own free CI fills the gap.
2. **Free cloud hosting is shrinking.** Oracle halved its A1 allowance in June 2026 without an announcement ([InfoQ](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)). AWS now closes free accounts after 6 months ([AWS](https://aws.amazon.com/free/)). Plan for a host that can change in a quarter.
3. **Rebrands and shutdowns:** LambdaTest is now TestMu AI ([pricing](https://www.testmuai.com/pricing/)), Cloudflare's Browser Rendering is now Browser Run ([pricing](https://developers.cloudflare.com/browser-rendering/pricing/)), and Octomind closed *(unverified)*. Check each tool before linking to it.
4. **Maestro is the neutral driver:** BrowserStack, Maestro Cloud and others support it, and it runs across React Native, Flutter and native. Its YAML and MCP integration suit AI-written tests ([repo](https://github.com/mobile-dev-inc/Maestro)).
5. **AI features are being tied to the vendor's cloud** (Maestro). A tool that keeps AI in the user's own key is a clear alternative for people who care where their app data goes.
6. **Real WebKit on Linux** is a cheap second engine that most small teams don't run.

## 5. Fit with the limits

- **$0 hosting:**
  - Fine for web and mobile web on a hosted Linux machine, at a daily limit per user.
  - Not fine for apps. Android emulators can't run in the free VMs, iOS simulators need macOS, and real devices cost money. That matches the brief: mobile runs on the user's own accounts.
- **Browser-only:** an app build can be uploaded or delivered by the user's CI. iOS signing is the one place where a user will leave the browser and need Xcode, EAS or CI, unless they only have an Android app.
- **Teams without QA staff:** many have only an Android build or an Expo app. Ask what they have, because a Maestro flow plus an APK is the least-effort path.
- **Risks and conflicts:**
  - Sending a user's build and secrets to a farm needs the user's keys stored safely on a hosted machine. Same rule as the Okta point in 06: don't keep what you don't need.
  - Oracle capacity and rules can change again. A second host is needed before launch.
  - Free Gemini keys send data to Google for training, which may clash with Test Copy privacy promises.
  - Maestro's iOS limit (simulators only) means "real iPhone" claims need an Appium fallback or a farm's own drivers.
  - ADR 0008 chose one local server per person and rejected a shared server (sign-in, queue, keys, reaching localhost targets). Everything in 3.7 depends on replacing that ADR, as the brief says ([ADR 0008](../../adr/0008-single-local-server.md)).

## 6. Open questions

1. Which App types do early users actually have: Expo, bare React Native, Flutter or native? And which of them have only Android?
2. Would they hand over an APK, or want their CI to upload it?
3. Does any early user own a Mac or use EAS? That decides how iOS is done.
4. How much would they pay for real-device runs? Is $175 to $250 a month out of range?
5. How long does a real Check-up take, in CPU time and memory? This replaces my estimates in 3.7.
6. May the tool use a free Gemini key at all, given the training note?
7. Is Oracle's A1 cut permanent, and does a second always-free host exist? *(unverified)*

## 7. Sources

- Repo: [CONTEXT.md](../../../CONTEXT.md) · [browser.ts](../../../packages/core/src/browser.ts) · [packages/core/src/ai](../../../packages/core/src/ai) · [ADR 0008](../../adr/0008-single-local-server.md) · [06-api-testing.md](06-api-testing.md)
- Playwright: https://playwright.dev/docs/browsers · https://playwright.dev/docs/api/class-android · https://playwright.dev/docs/api/class-electron
- Drivers: https://docs.maestro.dev/get-started/supported-platform · https://docs.maestro.dev/maestro-flows/workspace-management/ai-test-analysis · https://github.com/mobile-dev-inc/Maestro · https://maestro.dev/pricing · https://appium.io/docs/en/latest/ · https://wix.github.io/Detox/docs/introduction/getting-started · https://patrol.leancode.co/ · https://docs.flutter.dev/testing/integration-tests · https://v2.tauri.app/develop/tests/webdriver/ · https://github.com/microsoft/WinAppDriver
- Builds and Android/Apple: https://developer.android.com/tools/bundletool · https://developer.android.com/studio/run/emulator-acceleration · https://developer.android.com/studio/test/other-testing-tools/monkey · https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices · https://expo.dev/pricing · https://docs.expo.dev/eas/workflows/get-started/
- Device farms: https://firebase.google.com/docs/test-lab/usage-quotas-pricing · https://firebase.google.com/docs/test-lab/migrate-faq · https://firebase.google.com/docs/test-lab/android/robo-ux-test · https://aws.amazon.com/device-farm/pricing/ · https://docs.aws.amazon.com/devicefarm/latest/developerguide/welcome.html · https://www.browserstack.com/pricing?product=app-automate · https://www.browserstack.com/docs/app-automate/api-reference/introduction · https://saucelabs.com/pricing · https://www.testmuai.com/pricing/ · https://www.genymotion.com/pricing/
- Hosting: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm · https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/ · https://docs.cloud.google.com/free/docs/free-cloud-features · https://aws.amazon.com/free/ · https://azure.microsoft.com/en-us/free/ · https://developers.cloudflare.com/browser-rendering/pricing/ · https://www.browserless.io/pricing · https://docs.github.com/en/billing/concepts/product-billing/github-actions · https://docs.github.com/en/billing/reference/actions-minute-multipliers · https://docs.github.com/en/actions/reference/runners/github-hosted-runners · https://github.com/ReactiveCircus/android-emulator-runner · https://sengi.run/blog/github-actions-pricing
- AI: https://openrouter.ai/docs/api-reference/limits · https://ai.google.dev/gemini-api/docs/rate-limits · https://ai.google.dev/gemini-api/docs/pricing · https://help.apiyi.com/en/google-gemini-api-free-tier-changes-april-2026-guide-en.html · https://docs.browserbase.com/introduction/stagehand · https://stackpick.net/tools/octomind/
