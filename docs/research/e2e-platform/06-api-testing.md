# Cluster 06: API testing

Checked 2026-10-05. Follows [00-brief.md](00-brief.md). Vendor marketing is marked *(vendor claim)*. Anything I couldn't confirm is marked *(unverified)*.

## 1. Scope

This file covers API checks built from the traffic a website already sends during a check-up. That work is part of web depth and comes first. It also covers spec-based testing (OpenAPI, GraphQL and a little gRPC), contract testing, and the API tools small teams use today. Then it covers regression between check-ups, test data and the safety rules, the BOLA overlap with security, and APIs that sit behind other Apps: a public API released on its own, phone-app backends and desktop-app backends. The comparison throughout is a founder or developer who would otherwise write their own scripts or use Postman.

## 2. Market map

| Tool | Category | What's relevant here | Free tier / price | Source |
|---|---|---|---|---|
| Postman | API client and platform | Since March 2026 the Free plan is one user only. Application Inventory (May 2026) checks the API calls made during Playwright runs against collections. Agent Mode (June 2026) drives a browser and writes UI tests and API tests from one recording. | Free: 1 user, 1,000 monitoring requests a month, 50 AI credits. Solo $9 and Team $19 per user a month, billed yearly. Application Inventory needs Solo or higher. | [pricing](https://www.postman.com/pricing/), [March 2026 changes](https://blog.postman.com/new-capabilities-march-2026/), [App Inventory](https://learning.postman.com/docs/tests-and-scripts/test-applications/overview) |
| Postman Insights (formerly Akita) | Traffic-based API discovery | An agent on Linux, Kubernetes or ECS lists endpoints, errors and latency from live traffic. It drops values and keeps field names. | Enterprise plan only | [overview](https://learning.postman.com/docs/insights/overview), [data handling](https://learning.postman.com/docs/insights/data/repro-mode-security) |
| Bruno | Git-native API client | Files live in Git, with a CLI runner and OpenAPI import | Open source (MIT) is free. Pro $6 and Ultimate $11 per user a month, billed yearly. | [pricing](https://www.usebruno.com/pricing), [repo](https://github.com/usebruno/bruno) |
| Hoppscotch | Web-based API client | REST, GraphQL and realtime APIs, with a collection runner and CLI | Free. Business $6 and Enterprise $11 per user a month, billed yearly. Can be self-hosted (MIT). | [pricing](https://hoppscotch.com/pricing), [repo](https://github.com/hoppscotch/hoppscotch) |
| Insomnia (Kong) | API client | Collection runner, mocks and the Inso CLI | Essentials is free (Git Sync for up to 3 users, 1,000 mock requests a month). Pro $12 and Enterprise $45 per user a month. | [pricing](https://insomnia.rest/pricing) |
| Keploy | Generates tests from recorded traffic | Records with eBPF on the server. A Chrome extension records XHR and fetch calls and sends them to app.keploy.io. | Free Playground: 30 suites and 100 runs a month. Pro $19 per user a month plus usage. | [repo](https://github.com/keploy/keploy), [extension](https://keploy.io/docs/running-keploy/api-testing-chrome-extension/), [pricing](https://keploy.io/pricing) |
| Speedscale / proxymock | Traffic record and replay | Records, mocks and replays traffic locally | proxymock is free. Pro price on request. | [pricing](https://speedscale.com/pricing/) |
| mitmproxy2swagger, har-to-openapi | Traffic to OpenAPI | Turns a HAR file into an OpenAPI spec with path parameters | Free and open source | [m2s](https://github.com/alufers/mitmproxy2swagger), [h2o](https://github.com/jonluca/har-to-openapi) |
| Optic | Spec from traffic, plus diffs | Archived on 12 Jan 2026. "Optic Labs is now part of Atlassian." | n/a | [repo](https://github.com/opticdev/optic) |
| oasdiff | Detects breaking changes between OpenAPI versions | Knows 755 kinds of change, 339 of them breaking. Has a GitHub Action. | Free (Apache-2.0). Hosted reviews for teams; price not checked *(unverified)*. | [repo](https://github.com/oasdiff/oasdiff), [rules](https://www.oasdiff.com/docs/breaking-changes) |
| Schemathesis | Property-based testing from OpenAPI and GraphQL | 14 built-in checks, tests chains of calls, has a GitHub Action | Free (MIT). v4.29.2 came out 4 Oct 2026. | [repo](https://github.com/schemathesis/schemathesis), [PyPI](https://pypi.org/project/schemathesis/) |
| Prism (Stoplight) | Mock server and validating proxy | Mocks an API from OpenAPI and checks traffic against the spec | Free (Apache-2.0). v5.16.0 came out July 2026. | [repo](https://github.com/stoplightio/prism), [npm](https://www.npmjs.com/package/@stoplight/prism-cli) |
| Dredd | Checks an API against its spec | Archived on 8 Nov 2024 | n/a | [repo](https://github.com/apiaryio/dredd) |
| Pact / PactFlow | Contract testing | Consumer-driven contracts. Bi-directional contracts compare an OpenAPI spec with consumer mocks. | Pact is free. PactFlow Starter is free with 2 integrations. Team is $115.42 a month, billed yearly. | [pricing](https://pactflow.io/pricing/), [BDCT](https://pactflow.io/bi-directional-contract-testing/) |
| Step CI | API tests written in YAML | Last release was 2.8.2 in June 2024, so it looks inactive. | Free (MPL-2.0) | [repo](https://github.com/stepci/stepci), [npm](https://www.npmjs.com/package/stepci) |
| Karate / REST Assured | Frameworks for code-based API testing | Run on the JVM and are aimed at QA engineers | Free (MIT and Apache-2.0) | [Karate](https://github.com/karatelabs/karate/releases), [REST Assured](https://github.com/rest-assured/rest-assured) |
| Playwright | Browser automation and API calls | `recordHar`, `routeFromHAR`, and `APIRequestContext`, which shares cookies with the browser | Free. v1.63.0 came out Sept 2026. | [HAR](https://playwright.dev/docs/mock#mocking-with-har-files), [API testing](https://playwright.dev/docs/api-testing) |
| Checkly | API and browser monitoring | Checks status, JSON body, headers and response time, with "degraded" and "failed" time limits | Hobby is free: 1 user, 10,000 API runs and 1,000 browser runs a month, hard-capped. Starter $24 and Team $64 a month. | [pricing](https://www.checklyhq.com/pricing/), [ApiCheck](https://www.checklyhq.com/docs/constructs/api-check/) |
| BrowserStack, Sauce Labs | Device farms | Network logs from real-device app tests, saved as HAR | Paid; BrowserStack trials don't include network logs | [BrowserStack](https://www.browserstack.com/docs/app-automate/maestro/debug-failed-tests/network-logs), [Sauce](https://docs.saucelabs.com/mobile-apps/features/network-capture/) |
| graphql-cop, grpcurl | Protocol point tools | Security checks for GraphQL. curl for gRPC, using server reflection. | Free (MIT) | [graphql-cop](https://github.com/dolevf/graphql-cop), [grpcurl](https://github.com/fullstorydev/grpcurl) |

## 3. Capabilities

### 3.1 API checks from recorded browser traffic

**Capture (HAR and Playwright events)**
- **What leading tools do:**
  - Playwright's `browser.newContext({ recordHar })` records every page into a HAR file. Its options:
    - `content: omit | embed | attach` controls whether response bodies are kept.
    - `mode: minimal` "omits sizes, timing, page, cookies, security".
    - `urlFilter` limits which requests are recorded.
    - The file is written only on `context.close()` ([docs](https://playwright.dev/docs/api/class-browser#browser-new-context-option-record-har)).
  - `routeFromHAR` replays a recording as a mock backend ([docs](https://playwright.dev/docs/mock#mocking-with-har-files)).
  - `request.timing()` breaks each request into DNS, connect, first-byte and end times ([docs](https://playwright.dev/docs/api/class-request#request-timing)).
  - Postman's `postman-playwright` plugin captures method, URL, timing, headers and, optionally, bodies during the user's own Playwright runs ([docs](https://learning.postman.com/docs/tests-and-scripts/test-applications/overview)).
- **QA Tool today:**
  - [`evidence.ts`](../../../packages/core/src/evidence.ts) records only URL, method, status and timestamp from `page.on('response')`.
  - The `NetworkEntry` type has fields for headers, `postData` and `durationMs` ([types](../../../packages/types/src/index.ts)), but nothing fills them for responses.
  - `bug-detection` turns 4xx and 5xx responses into findings ([bug-detection.ts](../../../packages/checkers/src/bug-detection.ts)).
- **Gap:**
  - No timing, no content type, no fetch/XHR versus document distinction, and no response shape.
  - Nothing is kept between check-ups, so there's nothing to compare against.
- **Applies to:**
  - **Website:** directly.
  - **Desktop app:** Electron only. `electron.launch` accepts `recordHar`, but Playwright calls Electron support "experimental" ([docs](https://playwright.dev/docs/api/class-electron)).
  - **Phone app:** see 3.8.
- **Verdict: Build now.** Record the extra fields in `page.on('response')` instead of writing raw HAR. The capture is cheap, it's already wired up, and redaction can happen before anything reaches disk.

**Inferring endpoints, schemas and auth**
- **What leading tools do:**
  - mitmproxy2swagger reads HAR. It suggests path templates for a person to approve, then infers schemas from examples ([repo](https://github.com/alufers/mitmproxy2swagger)).
  - har-to-openapi (npm, MIT) turns `/uuids/123e…` into `/uuids/{uuid}` and can reuse shared schemas ([repo](https://github.com/jonluca/har-to-openapi), [npm](https://www.npmjs.com/package/har-to-openapi)).
  - Postman Insights keeps every endpoint's list up to date from live traffic ([overview](https://learning.postman.com/docs/insights/overview)).
  - Optic did this as well, but it's archived ([repo](https://github.com/opticdev/optic)).
  - Keploy's extension captures "headers, cookies, and authentication context", but it uploads them to its cloud ([docs](https://keploy.io/docs/running-keploy/api-testing-chrome-extension/)).
- **QA Tool today:** nothing. Layout Groups already collapse pages by template, and the same idea applies to API paths.
- **Gap:**
  - Endpoint grouping: `/api/orders/481` → `/api/orders/{id}`.
  - A JSON shape per endpoint.
  - Noting which signed-in role saw each endpoint, and whether the request carried a cookie or bearer auth.
- **Applies to:** **Website** now. The same analyzer later serves phone-app and desktop-app traffic.
- **Verdict: Build now** in TypeScript, in-process. Use har-to-openapi only as a reference, or as an optional "download OpenAPI draft" export. Keep shapes rather than bodies.

**Which checks to generate**

All of these are read-only on a live site unless marked otherwise.

| Check | How | Prior art |
|---|---|---|
| Server errors | 5xx from first-party API calls. This already exists. | [bug-detection](../../../packages/checkers/src/bug-detection.ts) |
| Hidden errors | HTTP 200 with a GraphQL `errors` array or an `{"error":…}` body. Status-only checks miss these. | Schemathesis `not_a_server_error` catches GraphQL `errors` arrays ([checks](https://schemathesis.readthedocs.io/en/stable/reference/checks/)) |
| Shape drift | A field removed or its type changed since the last check-up | Postman's "contract drift" ([blog](https://blog.postman.com/postman-playwright-integration-testing-ui-and-api-together/)) |
| Slow endpoints | Time to first byte per endpoint, with "degraded" and "failed" limits | Checkly `degradedResponseTime` and `maxResponseTime` ([docs](https://www.checklyhq.com/docs/constructs/api-check/)) |
| Error shape | Stack traces, SQL or framework debug pages in API error bodies | Security cluster overlap |
| Auth required | Replay a captured GET with no session. A 200 with the same body means "answers without sign-in". | Schemathesis `ignored_auth` ([checks](https://schemathesis.readthedocs.io/en/stable/reference/checks/)) |
| Other role | Replay a captured GET with another role's session (BOLA, see 3.7) | [OWASP API1:2023](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization) |

- **Verdict: Build now** for the first five, which need no extra requests. **Build now** for the two replay checks, but limited to GET and HEAD with the user's own role accounts (see 3.6). Each check exports as a Playwright `request` test, which fits the decided Playwright export ([API testing docs](https://playwright.dev/docs/api-testing)).

**Privacy: redacting personal data and tokens**
- **What leading tools do:**
  - Postman Insights "drops all data values … values (but not identifiers) in JSON". It keeps payloads only for 4xx and 5xx responses in an opt-in Repro Mode ([docs](https://learning.postman.com/docs/insights/data/repro-mode-security)).
  - Cloudflare built a client-side HAR sanitizer after HAR files stolen from Okta's support system were used to hijack sessions in October 2023 ([blog](https://blog.cloudflare.com/introducing-har-sanitizer-secure-har-sharing/)). That repo and Google's are both archived now ([Cloudflare](https://github.com/cloudflare/har-sanitizer), [Google](https://github.com/google/har-sanitizer)).
  - Speedscale reserves "sensitive data redaction" for paid tiers ([pricing](https://speedscale.com/pricing/)).
- **QA Tool today:** [`redact.ts`](../../../packages/core/src/redact.ts) hides the credentials the user typed in and secret-looking URL parameters. It doesn't touch cookies, `Authorization` headers, JWTs the server issues, or personal data in response bodies.
- **Gap:** a default that stores shapes only. Strip `Cookie`, `Set-Cookie`, `Authorization` and anything that looks like a JWT. Keep sample values only for failing calls, and only on Test Copies.
- **Verdict: Build now.** It ships together with capture and isn't optional. Hosted machines make this stricter, because the Okta case shows that raw HAR files are session keys.

### 3.2 Spec-based testing

**OpenAPI property-based testing, mocks and Dredd**
- **What leading tools do:**
  - Schemathesis generates inputs from the schema. Its checks include status, content type, schema conformance, `use_after_free`, `ignored_auth` and others ([checks](https://schemathesis.readthedocs.io/en/stable/reference/checks/)).
  - It chains calls using links it "inferred from your schema" *(vendor claim)* ([repo](https://github.com/schemathesis/schemathesis)), and it runs in CI through `schemathesis/action@v3` ([action](https://github.com/schemathesis/action)).
  - RESTler (Microsoft Research) also infers producer-consumer dependencies from OpenAPI ([repo](https://github.com/microsoft/restler-fuzzer)).
  - Prism mocks an API and validates traffic as a proxy ([repo](https://github.com/stoplightio/prism)).
  - Dredd has been archived since Nov 2024 ([repo](https://github.com/apiaryio/dredd)).
- **QA Tool today:** nothing. A Plan never looks for `/openapi.json` or `/swagger.json`.
- **Gap and verdict:**
  - **Website: Build later.** If the crawl finds an OpenAPI document, check the recorded traffic against it (the Prism-proxy idea, done offline).
  - **API App: Connect.** Fuzzing sends malformed POSTs, which counts as a Security Probe, so it runs only on Test Copies. Schemathesis is Python and mature, so run it rather than rebuild it.
  - **Prism: Skip.** Mocking is for developers building against an API, not for checking one.
  - **Dredd: Skip.** It's archived.

**GraphQL**
- **What leading tools do:**
  - Schemathesis loads a schema by introspection and generates queries with wrong types and missing arguments ([docs](https://schemathesis.readthedocs.io/en/stable/reference/python/)).
  - graphql-cop checks for introspection and field-suggestion leaks, batching and alias denial-of-service, and mutations over GET ([repo](https://github.com/dolevf/graphql-cop)).
  - Apollo Server turns introspection off when `NODE_ENV=production` ([docs](https://www.apollographql.com/docs/apollo-server/workflow/build-run-queries)), so a live schema often isn't available.
- **QA Tool today:**
  - On live sites, [`blockChanges`](../../../packages/core/src/live-site.ts) aborts every POST, PUT, PATCH and DELETE.
  - The GraphQL-over-HTTP spec says servers MUST support POST for all operations, and that GET "MUST NOT be used for executing mutation operations" ([spec](https://graphql.github.io/graphql-over-http/draft/)). So on live check-ups, GraphQL reads are blocked, and so are other read APIs that use POST, such as search.
  - The resulting broken pages are kept out of findings, so they fail silently.
- **Verdict:**
  - **Build now:** report GraphQL `errors` returned with a 200.
  - **Build now:** decide whether a POST whose body parses as a GraphQL `query` (not a `mutation`) may pass on live sites. This is a safety-model decision (see open questions).
  - **Build later:** introspection fuzzing, on Test Copies only.

**gRPC**
- Browsers can't call gRPC directly. gRPC-Web needs a proxy such as Envoy ([grpc.io](https://grpc.io/docs/platforms/web/basics/)), so a website's gRPC traffic shows up in captures as HTTP with binary bodies.
- grpcurl uses server reflection ([repo](https://github.com/fullstorydev/grpcurl)).
- **Verdict: Skip.** It's rare in the target users' web apps. If a public gRPC API ever becomes an App, connect to grpcurl or ghz.

### 3.3 Contract testing (Pact, PactFlow, bi-directional)

- **What it is:**
  - Pact's own docs say it fits when "you … control the development of both the consumer and the provider". They say it doesn't fit public APIs, functional testing, or "UI-involved tests" ([docs](https://docs.pact.io/getting_started/what_is_pact_good_for)).
  - Bi-directional contracts compare a provider's OpenAPI spec, plus its self-verification results (from Schemathesis or Postman), against consumer mocks from Cypress, MSW or WireMock ([PactFlow](https://pactflow.io/bi-directional-contract-testing/)).
  - PactFlow's comparison table marks bi-directional contracts as not included in the free Starter plan. Team costs $115.42 a month, billed yearly ([pricing](https://pactflow.io/pricing/)).
- **Is it relevant for small teams?**
  - Mostly not. A startup whose one repo holds both the front end and the API gets the same protection from the shape-drift checks in 3.1.
  - Postman now sells "contract drift" detection from Playwright traffic ([blog](https://blog.postman.com/postman-playwright-integration-testing-ui-and-api-together/)). That's the lightweight version these users would actually adopt.
- **Applies to:** an API App with outside consumers.
- **Verdict: Skip.** It needs both sides to cooperate and adds a broker. Shape drift covers the small-team case.

### 3.4 API testing tools and their models

- **Postman:**
  - In March 2026 the Free plan became "a single-player plan for individual developers" (Postman community post, 6 March 2026) ([community](https://community.postman.com/t/free-user-access-and-team-admin-role-adjustments-in-postman/89149)). The exact effective date and the old free-team size (earlier drafts said three users) were not confirmed on the cited pages *(unverified)*. The [March 2026 blog](https://blog.postman.com/new-capabilities-march-2026/) only describes Free and Solo as built for individual developers.
  - Free still includes unlimited collection runs and 1,000 monitoring requests a month ([pricing](https://www.postman.com/pricing/)).
- **Free alternatives:**
  - Bruno: 47k GitHub stars, Pro $6 ([pricing](https://www.usebruno.com/pricing)).
  - Hoppscotch: 80k stars, free and can be self-hosted ([repo](https://github.com/hoppscotch/hoppscotch)).
  - Insomnia: Git Sync is free for up to 3 users ([pricing](https://insomnia.rest/pricing)).
  - All three expect people to write the requests and assertions by hand.
- **Code frameworks:**
  - Karate (v2.1.3, Sept 2026) and REST Assured (Java) target QA engineers.
  - Step CI hasn't released anything since June 2024 ([npm](https://www.npmjs.com/package/stepci)).
  - Playwright's `APIRequestContext` shares storage state with the browser. `page.request` "will populate request's Cookie header from the browser context" ([docs](https://playwright.dev/docs/api-testing)).
- **Checkly:** monitoring as code. The free Hobby plan covers 10,000 API runs a month at intervals of 2 minutes or more ([pricing](https://www.checklyhq.com/pricing/)).
- **QA Tool today:** exports Playwright repro code only.
- **Verdict:**
  - **Connect.** Export the generated API checks as Playwright `request` tests first. A Bruno or Postman collection export is a **Build later** (one file, nothing hosted). For round-the-clock monitoring, point users to Checkly's free plan instead of running a scheduler, which a $0 setup can't host.
  - **Skip** Step CI, Karate and REST Assured as targets.

### 3.5 API regression across check-ups

- **What leading tools do:**
  - oasdiff classifies 755 kinds of change, such as "endpoint deleted without deprecation", "response required property removed" and "response property type changed" ([rules](https://www.oasdiff.com/docs/breaking-changes)).
  - Optic did spec diffs from traffic until it was archived after Atlassian bought it ([repo](https://github.com/opticdev/optic)).
  - pb33f's openapi-changes is another option ([repo](https://github.com/pb33f/openapi-changes)).
- **QA Tool today:** site history exists ([`site-history.ts`](../../../packages/core/src/site-history.ts)), but it keeps no API shapes. Report Hub tracks findings, not endpoints.
- **Gap:** keep each endpoint's shape and median latency with every check-up, then diff them. A removed field or changed type is a finding ("Your app's `/api/orders` stopped sending `total`"). New fields are only noted.
- **Applies to:** Website and API App alike. For a public API that publishes a spec, run oasdiff on the old and new spec. It's a Go binary, so it runs on the cloud machine or in CI.
- **Verdict: Build now** for shape diffs of recorded traffic, which are small and need no AI. **Connect** to oasdiff for an API App's spec.

### 3.6 Test data, state and safe methods

- RFC 9110 defines GET, HEAD, OPTIONS and TRACE as safe and adds PUT and DELETE as idempotent. It also warns that a method "cannot be assumed to be safe based solely on the server's response" ([RFC 9110 §9.2](https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods)). In practice, `GET /logout` or an unsubscribe link with a token in it still changes state.
- Leading tools create records in setup and delete them in teardown:
  - Playwright `beforeAll` and `afterAll` hooks ([docs](https://playwright.dev/docs/api-testing)).
  - Checkly setup and teardown scripts ([guide](https://www.checklyhq.com/docs/guides/setup-scripts-for-apis/)).
  - Schemathesis's `use_after_free` and `ensure_resource_availability` assume it may create and delete freely.
- **QA Tool today:** the safety model is already strict. Live sites are only looked at, mutating methods are aborted, and forms are sent only on a Test Copy ([CONTEXT.md](../../../CONTEXT.md), [`live-site.ts`](../../../packages/core/src/live-site.ts)).
- **Proposed rule:**
  - **Live sites:**
    - Replay only GET and HEAD requests the site itself made during the crawl.
    - Skip URLs that match the existing words that change something (logout, delete, unsubscribe).
    - Use the crawl's pacing and send no invented parameters.
  - **Test Copies:**
    - Replay non-GET requests too, and create records with a namespaced prefix, as [`entity-namespacing.ts`](../../../packages/core/src/entity-namespacing.ts) already does.
    - Clean up with the matching DELETE.
    - Run fuzzing only here.
- **Applies to:** every App. Phone and desktop backends usually have no Test Copy, so they stay GET-only.
- **Verdict: Build now** for the GET and HEAD rule, alongside the replay checks. **Build later** for the record-and-clean-up flow on Test Copies.

### 3.7 Security overlap: BOLA and IDOR

- OWASP API1:2023: attackers exploit BOLA "by manipulating the ID of an object that is sent within the request" ([OWASP](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization)).
- The QA Tool already has roles and a route-level [permission matrix](../../../packages/checkers/src/permission-matrix.ts). Replaying role A's captured `GET /api/orders/481` with role B's session is the API-level version of the same check, and it needs no guessed IDs.
- **Verdict: Build now**, as GET-only replay between the user's own accounts. Guessing or incrementing IDs is a Security Probe, so it belongs on Test Copies and in the security cluster.

### 3.8 Apps beyond websites

**A public API as its own App**
- **Inputs:**
  - Base URL (required).
  - OpenAPI or GraphQL schema URL (optional; offer to infer a draft from sample calls).
  - One token for each role (two roles are enough for BOLA).
  - A "this is a Test Copy" flag, under a Verified Domain when running on hosted machines.
- **Engine:**
  - On live APIs, use GET and HEAD from the spec's examples, plus the status, schema, auth-required, latency and breaking-change checks.
  - On Test Copies, use Schemathesis (Connect).
- **Plain-language verdict, for example:** "**Not ready yet.** 2 of 41 endpoints crash on unusual input. `GET /v1/invoices/{id}` answers without a token. 1 field your docs promise is missing. Everything else matches your docs; typical response 180 ms." Developer detail goes underneath: the check name (for example `ignored_auth`), a curl or Playwright repro, and the oasdiff output.
- **Verdict: Build later**, after phone apps, as the brief decides. Most of the pieces come from 3.1 and 3.5.

**Backend APIs of phone apps**
- **Device farms:**
  - BrowserStack App Automate saves network logs as HAR. Bodies need `captureContent`. The feature is "not supported for proxy-unaware apps" and not available on trials ([docs](https://www.browserstack.com/docs/app-automate/maestro/debug-failed-tests/network-logs)).
  - Sauce Labs captures HAR on real Android and iOS devices ([docs](https://docs.saucelabs.com/mobile-apps/features/network-capture/)).
- **Proxies:**
  - Apps targeting Android 7.0 or later don't trust user-installed CAs unless a debug build opts in with `debug-overrides` ([Android](https://developer.android.com/privacy-and-security/security-config)).
  - Android 17 turns on Certificate Transparency by default for apps targeting API 37 ([Android](https://developer.android.com/about/versions/17/behavior-changes-17)). HTTP Toolkit says this "breaks custom CAs" *(vendor claim)* ([blog](https://httptoolkit.com/blog/android-17-certificate-transparency/)).
  - Pinned apps need patching ([mitmproxy](https://docs.mitmproxy.org/stable/concepts/certificates/)).
- **Verdict: Build later**, together with store apps: feed the farm's HAR file into the same analyzer. Avoid running our own proxy, because of pinning, CT and CA trust.

**APIs of desktop apps**
- Electron: Playwright's `recordHar` (experimental), or HTTP Toolkit's Electron interceptor, which may miss native clients such as libcurl ([HTTP Toolkit](https://httptoolkit.com/electron/)).
- **Verdict: Skip for now.** No user has asked for desktop. When it comes, it's the same analyzer fed a HAR file.

## 4. Trends and openings (2025–2026)

1. **Postman has moved onto this direction.**
   - Application Inventory (26 May 2026) checks API calls made during Playwright runs for contract drift ([blog](https://blog.postman.com/postman-playwright-integration-testing-ui-and-api-together/)).
   - Agent Mode (11 June 2026) drives a real browser and generates "UI tests and API tests against the same observed behavior" ([blog](https://blog.postman.com/browser-testing-in-postman-agent-mode/)). It needs the desktop app, v12 or later. The post says the "free plan works for the basics" *(vendor claim)*, but Application Inventory needs a paid plan.
   - **The opening:** Postman assumes the user already has Playwright tests or will drive an AI agent. The QA Tool crawls by itself, runs deterministically, gives a plain verdict, and hands the API checks over as Playwright code the user owns.
2. **Postman's free tier now fits only one user** (March 2026), and teams are moving to Bruno and Hoppscotch ([Postman blog](https://blog.postman.com/new-capabilities-march-2026/)). A free tool that writes the checks by itself fills the gap those manual clients leave.
3. **Tools that infer specs from traffic are consolidating or dying.** Akita became Postman Insights and is Enterprise-only ([docs](https://learning.postman.com/docs/insights/overview)). Optic and Dredd are archived ([Optic](https://github.com/opticdev/optic), [Dredd](https://github.com/apiaryio/dredd)), and Step CI is dormant. Nothing free and maintained does "traffic → checks → diff over time" for a small team.
4. **Recording keeps moving to the client side.** Keploy's Chrome extension uploads captures to its cloud ([docs](https://keploy.io/docs/running-keploy/api-testing-chrome-extension/)). A local tool that keeps shapes only is an easy privacy win to point out.
5. **Specs keep changing.** OpenAPI 3.2 (Sept 2025) adds the QUERY method and streaming media types ([OAI](https://www.openapis.org/blog/2025/09/23/announcing-openapi-v3-2)). Under RFC 9110, QUERY is safe, so the GET/HEAD rule should treat it as safe once sites adopt it *(unverified: QUERY is still an IETF draft)*.
6. **Phone traffic capture is getting harder** (Android CT by default). That favours reading the farm's HAR over running a proxy.

## 5. Fit with the limits

- **$0 hosting:**
  - Shape capture and diffs are kilobytes per check-up and need no AI, so they fit always-free machines.
  - Schemathesis (Python) and oasdiff (Go) are heavier. They can run on the cloud machine, or in the user's CI through their GitHub Actions ([Schemathesis action](https://github.com/schemathesis/action), [oasdiff action](https://github.com/oasdiff/oasdiff-action)).
  - Monitoring between check-ups goes to Checkly's free plan, not ours.
- **Browser-only:** the checks run inside the check-up's existing Playwright session, so nothing new is installed.
- **Teams without QA staff:**
  - The verdict should talk about the website ("your order page's data call got slower", "a signed-out visitor can read `/api/me`"), not about endpoints.
  - Endpoint tables and the Playwright export go in the developer detail.
- **Risks and conflicts:**
  - Replay sends requests the browser didn't. Even GETs can change state (RFC 9110), and owners may read replays as scanning. Keep replay to the user's own roles, add pacing, and give it an off switch.
  - Hosted machines must never keep raw HAR files or tokens (the Okta precedent).
  - The live-site POST block hides GraphQL and search APIs, so API coverage on live sites will be thin until that rule is refined.
  - Shape drift can be noisy on A/B tests or feature flags. Show drift as "changed" and only count removals that repeat in two check-ups.

## 6. Open questions

1. Do early users' sites use GraphQL, or POST for reads? If so, may a POST that parses as a GraphQL `query` pass on live sites, or only on Test Copies?
2. Is replaying a GET without a session, or with another role's session, allowed on any site, or only on Verified Domains when running hosted?
3. Would users rather have API checks as Playwright tests, as a Bruno or Postman collection, or both?
4. Do any early users publish an OpenAPI file? That decides whether "check traffic against your spec" is worth building early.
5. Which latency limit means "slow" to these users: a fixed 1 s, or slower than last time by X%?
6. For phone apps later: will users' device-farm plans include network logs? They're not on BrowserStack trials.

## 7. Sources

- Repo code: [evidence.ts](../../../packages/core/src/evidence.ts), [live-site.ts](../../../packages/core/src/live-site.ts), [redact.ts](../../../packages/core/src/redact.ts), [bug-detection.ts](../../../packages/checkers/src/bug-detection.ts), [permission-matrix.ts](../../../packages/checkers/src/permission-matrix.ts), [types](../../../packages/types/src/index.ts), [CONTEXT.md](../../../CONTEXT.md)
- Playwright: https://playwright.dev/docs/mock#mocking-with-har-files · https://playwright.dev/docs/api/class-browser#browser-new-context-option-record-har · https://playwright.dev/docs/api/class-request#request-timing · https://playwright.dev/docs/api-testing · https://playwright.dev/docs/api/class-electron
- Postman: https://www.postman.com/pricing/ · https://blog.postman.com/new-capabilities-march-2026/ · https://community.postman.com/t/free-user-access-and-team-admin-role-adjustments-in-postman/89149 · https://blog.postman.com/postman-playwright-integration-testing-ui-and-api-together/ · https://blog.postman.com/browser-testing-in-postman-agent-mode/ · https://learning.postman.com/docs/tests-and-scripts/test-applications/overview · https://learning.postman.com/docs/insights/overview · https://learning.postman.com/docs/insights/data/repro-mode-security · https://blog.postman.com/postman-acquires-akita-for-automated-api-observability/
- Clients: https://www.usebruno.com/pricing · https://github.com/usebruno/bruno · https://hoppscotch.com/pricing · https://github.com/hoppscotch/hoppscotch · https://insomnia.rest/pricing
- Traffic to tests or specs: https://github.com/keploy/keploy · https://keploy.io/docs/running-keploy/api-testing-chrome-extension/ · https://keploy.io/pricing · https://speedscale.com/pricing/ · https://github.com/alufers/mitmproxy2swagger · https://github.com/jonluca/har-to-openapi · https://www.npmjs.com/package/har-to-openapi · https://github.com/opticdev/optic
- Spec testing and diffs: https://github.com/schemathesis/schemathesis · https://pypi.org/project/schemathesis/ · https://schemathesis.readthedocs.io/en/stable/reference/checks/ · https://schemathesis.readthedocs.io/en/stable/reference/python/ · https://github.com/schemathesis/action · https://github.com/microsoft/restler-fuzzer · https://github.com/stoplightio/prism · https://www.npmjs.com/package/@stoplight/prism-cli · https://github.com/apiaryio/dredd · https://github.com/oasdiff/oasdiff · https://www.oasdiff.com/docs/breaking-changes · https://github.com/oasdiff/oasdiff-action · https://github.com/pb33f/openapi-changes · https://www.openapis.org/blog/2025/09/23/announcing-openapi-v3-2
- Contracts: https://docs.pact.io/getting_started/what_is_pact_good_for · https://pactflow.io/bi-directional-contract-testing/ · https://pactflow.io/pricing/
- Frameworks and monitoring: https://github.com/stepci/stepci · https://www.npmjs.com/package/stepci · https://github.com/karatelabs/karate/releases · https://github.com/rest-assured/rest-assured · https://www.checklyhq.com/pricing/ · https://www.checklyhq.com/docs/constructs/api-check/ · https://www.checklyhq.com/docs/guides/setup-scripts-for-apis/
- Protocols and standards: https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods · https://graphql.github.io/graphql-over-http/draft/ · https://www.apollographql.com/docs/apollo-server/workflow/build-run-queries · https://github.com/dolevf/graphql-cop · https://grpc.io/docs/platforms/web/basics/ · https://github.com/fullstorydev/grpcurl · https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization
- Privacy: https://blog.cloudflare.com/introducing-har-sanitizer-secure-har-sharing/ · https://github.com/cloudflare/har-sanitizer · https://github.com/google/har-sanitizer
- Phone and desktop capture: https://www.browserstack.com/docs/app-automate/maestro/debug-failed-tests/network-logs · https://docs.saucelabs.com/mobile-apps/features/network-capture/ · https://developer.android.com/privacy-and-security/security-config · https://developer.android.com/about/versions/17/behavior-changes-17 · https://httptoolkit.com/blog/android-17-certificate-transparency/ · https://docs.mitmproxy.org/stable/concepts/certificates/ · https://httptoolkit.com/electron/
