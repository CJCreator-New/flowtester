# Cluster 05: Security testing

Checked 2026-10-05. Follows [00-brief.md](00-brief.md). Vendor marketing is marked *(vendor claim)*. Anything I couldn't confirm is marked *(unverified)*. This is defensive research: an owner checking their own App. It names check classes and tools, not payloads or attack steps. The legal section reports what sources say and is not legal advice.

## 1. Scope

This file covers:

- **Read-only checks:** what an App already sends, run on any site.
- **Security Probes:** checks that send something an owner could mistake for an attack, run only on a Test Copy.
- **API security:** the OWASP API Top 10, using the traffic from cluster 06.
- **Tools:** which scanners exist and what they cost today.
- **Proving ownership:** how scanners stop people scanning sites that aren't theirs, and what the QA Tool should use for a Verified Domain.
- **Legal limits and the Apps beyond websites:** phone apps and desktop apps.

The comparison is a founder or developer who would otherwise run the free ZAP scan, paste their URL into an online header grader, or skip security altogether.

## 2. Market map

| Tool | Category | What's relevant here | Free tier / price | Source |
|---|---|---|---|---|
| ZAP (by Checkmarx) | Open-source scanner | Passive baseline scan (spider about 1 minute, "doesn't perform any actual attacks"), active scan ("should only be used with permission"), and a YAML Automation Framework. Apache-2.0. | Free | [repo](https://github.com/zaproxy/zaproxy), [baseline](https://www.zaproxy.org/docs/docker/baseline-scan/), [active scan](https://www.zaproxy.org/docs/desktop/addons/automation-framework/job-ascan/), [framework](https://www.zaproxy.org/docs/automate/automation-framework/) |
| MDN HTTP Observatory | Header and cookie grader | Scans any host, once per 60 seconds per host. Scan history is public. Tests CSP, cookies, HTTP-to-HTTPS redirect, X-Frame-Options, Referrer-Policy, CORP, HSTS and X-Content-Type-Options. No TLS data. Open source (MPL-2.0), with a CLI and API. | Free | [FAQ](https://developer.mozilla.org/en-US/observatory/docs/faq), [repo](https://github.com/mdn/mdn-http-observatory) |
| securityheaders.com | Header grader | Page returned 403 to my fetch, so ownership and current terms are *(unverified)*. | *(unverified)* | [site](https://securityheaders.com/) |
| Qualys SSL Labs | TLS grader | Public servers only. Results are private unless the user publishes them. "Commercial use is generally not allowed" without Qualys's permission. | Free | [API docs](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md) |
| StackHawk | Developer DAST | Wingman plan: 50 scans per user a month, unlimited apps, works inside coding agents. Scale is custom. Its hosted scanner is "being replaced by Cloud Deployment". | Wingman $10 per user a month, 14-day trial. Scale quote only. | [pricing](https://www.stackhawk.com/pricing/), [hosted scanner](https://docs.stackhawk.com/platform/hosted-scanner/) |
| Detectify | Hosted DAST | Starter is free (5 users, REST and GraphQL API scanning). Extra domains and targets cost more. | Starter free. Standard EUR 2,500, Professional EUR 5,000, Enterprise EUR 15,000 a year. | [pricing](https://www.detectify.com/pricing) |
| Probely (now Snyk API & Web) | Hosted DAST | Snyk bought Probely in Nov 2024. A free plan of 5 scan hours a month for 3 users appears in aggregator listings. I couldn't load Probely's own pricing page, so that is *(unverified)*. | Free plan *(unverified)*. Enterprise by quote. | [Snyk announcement](https://snyk.io/news/snyk-acquires-developer-first-dast-provider-probely/), [Snyk docs](https://docs.snyk.io/scan-fix-and-prevent/scan-with-snyk/snyk-api-web/configure-targets/verify-domain-ownership), [listing](https://www.softwareadvice.com/encryption/probe-ly-profile/) |
| Invicti (includes Acunetix) | Enterprise DAST | Quote-based pricing, proof-of-concept licences. Agentic Pentest is listed at "$500 max per pentest" *(vendor claim)*. | Quote only | [pricing](https://www.invicti.com/pricing/) |
| Burp Suite | Pentester's proxy, plus enterprise DAST | Professional is $499 on PortSwigger's page. Community has no automated scanner (per PortSwigger's page, "manual testing tools"). Burp DAST is the enterprise product. Its quote-only price was not on the page *(unverified)*. | Community free. Pro $499. | [Burp Pro](https://portswigger.net/burp/pro) |
| Nuclei (ProjectDiscovery) | Template-based scanner | MIT, 31.7k stars. YAML templates, plus a `-dast` fuzzing mode. The README warns that running it as a service "may pose security risks". | Free | [repo](https://github.com/projectdiscovery/nuclei), [docs](https://docs.projectdiscovery.io/tools/nuclei/overview) |
| Retire.js | Known-CVE libraries | Finds JavaScript libraries with known vulnerabilities, including ones missing from manifests. Headless site scanner and a ZAP plugin. Apache-2.0. | Free | [repo](https://github.com/retirejs/retire.js) |
| Gitleaks | Secret scanner | Scans directories and files, so it can read downloaded JS bundles. MIT. The maintainer says it is feature-complete and is moving to a successor, Betterleaks. | Free | [repo](https://github.com/gitleaks/gitleaks) |
| MobSF | Phone-app scanner | Static (APK, IPA, APPX) and dynamic analysis, with a REST API and Docker image. GPL-3.0. | Free | [repo](https://github.com/MobSF/Mobile-Security-Framework-MobSF) |
| OWASP MASVS and MASTG | Phone-app standard and test guide | Eight control groups. MASTG lists over 400 tests. | Free | [MASVS](https://mas.owasp.org/MASVS/), [MASTG](https://mas.owasp.org/MASTG/) |
| Electron security checklist | Desktop-app checklist | 20 recommendations. | Free | [docs](https://www.electronjs.org/docs/latest/tutorial/security) |
| XBOW and other AI pentesters | Agentic pentest | XBOW reached the top of HackerOne's US leaderboard in 2025. Reports say each finding is confirmed with a working exploit. | Not checked *(unverified)* | [Dark Reading](https://www.darkreading.com/vulnerabilities-threats/ai-based-pen-tester-top-bug-hunter-hackerone), [Intruder list](https://www.intruder.io/blog/ai-pentesting-tools) |

Prices come from vendor pages where I could load them. Burp DAST, Probely and Invicti prices are not public or couldn't be confirmed.

## 3. Capabilities

### What the QA Tool does today

[`security.ts`](../../../packages/checkers/src/security.ts) is a passive checker. It reads what a visit produced and never probes. It reports:

- A password in the address, from the URL or from a sign-in form that uses GET.
- HTTP resources on a page. Scripts over `http://` count anywhere. Images, links and iframes count only on HTTPS pages.
- Stack-trace text in the page body.
- Cookie flags: missing `Secure` on HTTPS, missing `HttpOnly` on cookies whose names look like sessions, and loose `SameSite`. The `SameSite` finding only fires when the cookie also lacks `Secure`, so it misses `SameSite=None` on a `Secure` cookie.
- Response headers: Content-Security-Policy present or absent, `nosniff`, frame protection, Referrer-Policy, and HSTS on HTTPS.

[`live-site.ts`](../../../packages/core/src/live-site.ts) sets the safety model. `blockChanges` aborts every POST, PUT, PATCH and DELETE on live sites. `isTestHost` treats localhost, private ranges, `*.devtunnels.ms` and hosts the owner typed as staging as Test Copies. It judges by the hostname text only. There is no Verified Domain concept yet.

[`permission-matrix.ts`](../../../packages/checkers/src/permission-matrix.ts) checks which roles open which routes, using GET.

### 3.1 Read-only checks

Everything in this table reads what the App already sends during a normal check-up, so it is safe on any site. "False-positive risk" is my judgement, not a vendor figure.

| Check | What it reads | False-positive risk | Safe on any site? | QA Tool today | Verdict |
|---|---|---|---|---|---|
| CSP quality | The CSP header: `unsafe-inline`, wildcards, missing `frame-ancestors`, `default-src` | Medium. Report-only policies and policies set by `<meta>` are easy to miss. | Yes | Presence only | Build now |
| Cookie flags | `Set-Cookie` attributes | Medium. Name-guessing for "session" cookies misfires on analytics cookies. | Yes | Done, with the `SameSite` gap above | Build now: fix the gap |
| TLS and redirects | HTTP-to-HTTPS redirect, HSTS value, certificate expiry | Low | Yes | HSTS present only | Build later. SSL Labs bars commercial use, so read the certificate in-process instead of calling it. |
| Mixed content | HTML references to `http://` | Low | Yes | Done, but misses CSS `url()` and fetches made by scripts | Build now |
| CORS | `Access-Control-Allow-Origin` and `-Credentials` on responses already seen. MDN warns against `*` with credentials and against reflecting `Origin` ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CORS)). | Medium. Public APIs allow `*` on purpose. | Yes, passive only. Sending a fake `Origin` is a Security Probe. | None | Build now |
| Subresource Integrity | `integrity` on cross-origin `<script>` and `<link>` ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)) | Low. Some CDNs vary the file per browser, so owners can't always pin it. | Yes | None | Build now |
| Client libraries with known CVEs | Library names and versions in loaded scripts, matched to a vulnerability list | Medium. Version detection is guesswork on minified files. | Yes | None | Connect: use Retire.js's data, or OSV *(unverified)*. Do not keep our own list. |
| Exposed source maps | `sourceMappingURL` comments and whether the `.map` file loads | Low | Yes: one GET for a URL the page named | None | Build now |
| Exposed files | Fixed paths such as `/.git/HEAD`, `/.env` | Low if a body check is used, high on sites that return 200 for everything | Borderline: these are paths nobody linked to, so some owners read them as probing. Treat as a Security Probe. | None | Build later, on Test Copies, or only after a person turns it on |
| Secrets in client bundles | The JS and HTML already downloaded, scanned for key patterns | Medium | Yes | Secret-looking URL parameters only ([`redact.ts`](../../../packages/core/src/redact.ts)) | Connect: use Gitleaks rules or similar. The maintainer says Gitleaks is moving to Betterleaks, so check before depending on it. |
| `security.txt` | `/.well-known/security.txt`. RFC 9116 requires `Contact` and `Expires` ([RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)). | Low | Yes: one GET at a standard path | None | Build now (cheap) |
| SPF and DMARC | DNS TXT records. DMARC is published at `_dmarc.<domain>` ([RFC 7489](https://www.rfc-editor.org/rfc/rfc7489), now marked obsolete and replaced by RFCs 9989 to 9991). | Low | Yes: public DNS reads | None | Build later. It is mail, not the App, so it only matters to teams that send mail from their domain. |
| Error pages | Stack traces and debug pages | Low | Yes | Done for visible text | Build now: extend to API error bodies (see cluster 06) |

**Applies to:**

- **Website:** all of the above.
- **API:** headers, CORS, error bodies, TLS and `security.txt` apply directly. CSP and SRI don't.
- **Phone app:** its web backend gets the API checks. The app binary needs static analysis (3.5).
- **Desktop app:** an Electron renderer page gets the CSP and header checks. Other desktop apps are out of reach.

**Grading is a risk.** The Observatory FAQ says an A+ "does not mean perfect security" because it tests headers only ([FAQ](https://developer.mozilla.org/en-US/observatory/docs/faq)). The verdict for a team without QA staff should say "your headers are fine" and "these were not checked", not "secure".

### 3.2 Security Probes (Test Copies only)

Each probe class sends something a firewall, WAF or hosting provider could read as an attack. I describe the class and the reason, not the inputs.

| Probe class | What it sends | Why it needs a Test Copy | Quiet enough for a free tier? | Verdict |
|---|---|---|---|---|
| ZAP active scan | Many generated requests per page and parameter. ZAP says it "actively attacks the target so should only be used with permission". It has `threadPerHost`, `delayInMs` and duration limits ([job docs](https://www.zaproxy.org/docs/desktop/addons/automation-framework/job-ascan/)). | It writes data and can degrade the App. Its traffic is exactly what an owner's alarms are built to catch. | No. It is long and heavy, so it would eat a free-tier machine's daily allowance. Run it in the user's own CI or machine. | Connect |
| Basic injection checks | Crafted inputs in form fields and URL parameters | Can create or corrupt records and trigger WAF bans | Partly. A short, capped set is feasible. A full run is not. | Build later |
| Open redirects | Redirect-style values in URL parameters that look like return addresses | Looks like phishing preparation to a WAF | Yes. A few requests per redirect parameter. | Build later |
| Sign-in rate limits | Repeated failed sign-ins on a test account | Can lock real accounts and trip alerts | Yes if capped at a handful of attempts. Only on a Test Copy with a throwaway account. | Build later |
| Broken access control, writes | Replaying another role's requests with PUT, POST and DELETE | Changes data | Yes (few requests) | Build later |
| Sessions and CSRF | Replaying a state-changing request without its token, or after logout | Changes data | Yes | Build later |
| Fuzzing and Nuclei DAST mode | Large template or fuzz sets | Same as active scan. Nuclei's README warns about running it as a service ([repo](https://github.com/projectdiscovery/nuclei)). | No | Connect or skip |

**Order inside the Probes:**

1. **Access control.** It extends the permission matrix and is the likeliest real finding for small teams. OWASP ranks it first: API1:2023 Broken Object Level Authorization and API5:2023 Broken Function Level Authorization ([OWASP list](https://api-security.owasp.org/editions/2023/en/0x11-t10)).
2. **Sign-in limits and sessions.**
3. **Redirects and a small injection set.**
4. **Full active scanning** stays with ZAP, run by the user.

**Applies to:** Website and API directly. Phone and desktop backends have no Test Copy of their own, so Probes apply only when the owner has one.

**Quiet versus quick.** "Quiet" means few requests with delays, so a WAF doesn't ban the cloud machine's address. That matters for a tool that shares a few IP addresses across users. Even the ZAP baseline docs describe their scan as a short run for CI and production, so a passive baseline is the nearest thing to our read-only layer ([ZAP baseline](https://www.zaproxy.org/docs/docker/baseline-scan/)).

### 3.3 API security (OWASP API Top 10 2023)

The list is API1 Broken Object Level Authorization, API2 Broken Authentication, API3 Broken Object Property Level Authorization, API4 Unrestricted Resource Consumption, API5 Broken Function Level Authorization, API6 Unrestricted Access to Sensitive Business Flows, API7 Server Side Request Forgery, API8 Security Misconfiguration, API9 Improper Inventory Management, API10 Unsafe Consumption of APIs ([OWASP](https://api-security.owasp.org/editions/2023/en/0x11-t10)).

Cluster 06 covers the recorded-traffic base. How the list maps to what we can do from it:

| OWASP item | Read-only version | Probe version | Verdict |
|---|---|---|---|
| API1 and API5 (object and function level) | Replay a captured GET with another role's session or no session, as set out in [06 section 3.7](06-api-testing.md) | Guessing IDs and non-GET replay | Build now (read-only), Build later (probe) |
| API2 Broken Authentication | Check that tokens aren't in URLs and that responses without a token get 401 or 403 | Repeated sign-in attempts | Build now, Build later |
| API3 Property level | Flag fields in responses that look sensitive (such as `isAdmin`, `passwordHash`) *(my reading of the item, not a vendor method)* | Writing extra fields | Build later |
| API4 Resource consumption | Check for pagination limits on list endpoints seen in traffic | Load or large-input tests | Skip. Load belongs to cluster 04. |
| API8 Misconfiguration | Headers, CORS, verbose errors | None needed | Build now |
| API9 Inventory | Endpoints seen in traffic that aren't in a published spec | None needed | Build later, with the OpenAPI work in cluster 06 |
| API6, API7, API10 | Hard to judge from traffic alone | Need knowledge of business rules or outbound calls | Skip |

### 3.4 Proving ownership: how scanners stop abuse

| Scanner | Methods | Subdomains | Re-checking | Before verification |
|---|---|---|---|---|
| Detectify | DNS TXT, file at `/.well-known/detectify-verification` over HTTPS, meta tag in homepage `<head>` | "Subdomains under a verified root domain are automatically covered" | Periodic. If the proof disappears "scanning will pause until verification is restored". | Not stated |
| Snyk API & Web (Probely) | TXT file, DNS TXT, DNS CNAME, meta tag | A subdomain under an already-verified parent is verified automatically ([search summary](https://docs.snyk.io/scan-fix-and-prevent/scan-with-snyk/snyk-api-web/configure-targets/verify-domain-ownership), subdomain rule *(unverified: the doc page I loaded did not state it)*) | Not stated | Only "Lightning scans" (TLS, headers, cookies) |
| StackHawk | DNS TXT with a per-account key, or automatic when the sign-up email domain matches ([quick start](https://docs.stackhawk.com/getting-started/quickstart/), [hosted scanner](https://docs.stackhawk.com/platform/hosted-scanner/)) | A TXT value can name a wildcard or one subdomain | Not stated | Not stated |
| Invicti and Acunetix | HTML file (recommended), meta tag, DNS TXT | Not stated | Not stated | Not stated. Invicti says scanning without authorization "is against the law". |
| Google Search Console | HTML file, meta tag, DNS TXT or CNAME, Analytics, Tag Manager | Only a DNS-verified Domain property covers all subdomains and both protocols. File and meta verify a single URL prefix. | "Periodically" checks the token and notifies owners on failure. | n/a |
| Cloudflare certificate checks | DNS TXT | n/a | Records "can be removed … as soon as the certificate is issued", so ownership isn't kept as a standing fact | n/a |

Sources: [Detectify](https://docs.detectify.com/getting-started/asset-verification), [Detectify why](https://support.detectify.com/support/solutions/articles/48001049280-why-do-you-require-verification-of-domain-ownership-), [Snyk](https://docs.snyk.io/scan-fix-and-prevent/scan-with-snyk/snyk-api-web/configure-targets/verify-domain-ownership), [Probely API](https://developers.probely.com/api/tutorials/targets/how-to-create-verify-target-domain/), [Invicti](https://docs.invicti.com/ie-is/verify-target-ownership), [Google](https://support.google.com/webmasters/answer/9008080), [Cloudflare](https://developers.cloudflare.com/ssl/edge-certificates/changing-dcv-method/methods/txt/).

**What the pattern shows:**

- **Three methods are standard:** a file, a meta tag and a DNS record. This matches the brief.
- **Detectify says why:** it "performs automated security attacks, which means our tests will most likely reveal sensitive information", so only the owner should see results.
- **Mozilla's grader works the other way.** It scans any host, but only reads headers, limits to one scan a minute, and makes history public ([FAQ](https://developer.mozilla.org/en-US/observatory/docs/faq)). That matches our read-only layer: no ownership needed because nothing is sent that a visitor wouldn't send, and the QA Tool should keep results private.
- **Stricter versions exist.** StackHawk's terms, as summarised from the page I loaded, allow scanning only "development or testing instances" of the customer's own apps, and make the customer indemnify StackHawk for unauthorized use ([terms](https://www.stackhawk.com/terms-of-service/); the fetch tool summarised the page, so read the full text before copying any wording). That is the same shape as our Test Copy rule.

**Recommendation for a Verified Domain (a proposal, not a standard):**

1. **Offer all three methods, and say DNS is best.** Only DNS can cover every subdomain and preview URL under one proof. File and meta tag fit people who can't edit DNS, but cover one origin.
2. **Verify the registered domain, not the host.** Then `pr-42.example.com` is covered. This is how Detectify and Google's Domain property work.
3. **Don't extend verification to hosting suffixes.** Anyone can create `x.vercel.app` or `x.github.io`. Those suffixes are on the Public Suffix List because users register subdomains under them ([PSL](https://publicsuffix.org/learn/)). So for those, require a file or meta tag at the exact origin, and never accept a proof from the parent suffix. The PSL's own page warns that using it for validating domain names is "dangerous", so use it only to decide where the boundary falls, and keep DNS as the authority.
4. **Re-verify.** Re-check the token before every check-up that sends Probes, and on a schedule. Pause Probes if the proof is gone, as Detectify does. Tell the owner, because deleting a record by accident is common. Cloudflare's own certificate TXT records are deleted after use, so owners may do the same to ours: say clearly in the UI to leave it.
5. **Defend the check itself.** Resolve the hostname, then connect to the IP you checked, and refuse private, loopback and cloud-metadata addresses. OWASP's SSRF cheat sheet describes the same defences: validate resolved IPs, "bind connections to validated addresses" to avoid time-of-check races, and "disable HTTP redirects" in the client ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)). Today `isTestHost` judges hostname text only, so a hostname that points at a private address is not caught. On shared machines that needs fixing first.
6. **Redirects.** Verify the origin that actually serves the page. A file proof that arrives through a redirect to another host should not count. Detectify requires HTTPS and a 200 for its file ([docs](https://docs.detectify.com/getting-started/asset-verification)). Re-run the checks on every redirect hop during Probes.
7. **Keep results private,** and don't let "mark as Test Copy" (today a typed hostname in `isTestHost`) work on shared machines without a Verified Domain.

### 3.5 Phone apps and desktop apps

**Phone apps**

- **Standards:** OWASP MASVS has eight control groups (storage, crypto, auth, network, platform, code, resilience, privacy) and MASTG supplies over 400 tests ([MASVS](https://mas.owasp.org/MASVS/), [MASTG](https://mas.owasp.org/MASTG/)).
- **MobSF:** automated static analysis of an APK or IPA, plus dynamic analysis, with a REST API and a Docker image. It is GPL-3.0 ([repo](https://github.com/MobSF/Mobile-Security-Framework-MobSF)).
- **Fit:** a hosted tool accepting an uploaded build is a "browser-only" fit, but static analysis is memory-heavy and the licence is GPL. That suggests running MobSF as a separate process the user's CI starts, not linking it into an FSL product *(my reading; a lawyer should check)*.
- **Verdict: Connect** (MobSF for static results, shown beside our checks). Skip our own dynamic analysis, for the reasons about proxy trust in [cluster 06 section 3.8](06-api-testing.md). Build later: only a short MASVS-based list of plain-language questions.

**Desktop apps**

- The Electron checklist has 20 items: remote content only over HTTPS, no Node integration for remote content, context isolation on, sandbox on, session permission requests handled, `webSecurity` left on, a CSP set, navigation and new windows limited, no `shell.openExternal` on untrusted content, a current Electron version, IPC sender checks and fuses reviewed ([docs](https://www.electronjs.org/docs/latest/tutorial/security)).
- Much of this is readable from a window's creation options or a packaged app's fuse settings. That is static, so it is safe.
- **Verdict: Skip for now.** No user has asked for desktop. When it comes, a config reader for the checklist is cheap and the Electron renderer page already gets the header checks.

### 3.6 Legal limits (what the sources say, not legal advice)

Counsel should review the product's terms before Security Probes ship. A review should also cover whether our terms must make the customer warrant ownership, and whether the hosting of probes on shared IP addresses creates liability for us.

- **United States, 18 U.S.C. 1030.** Section 1030(a)(2)(C) covers intentionally accessing a protected computer "without authorization" and obtaining information. Section 1030(a)(5) covers causing damage that way. Section 1030(g) lets anyone who suffers damage or loss sue for damages and injunctions ([text](https://www.law.cornell.edu/uscode/text/18/1030)). The DOJ's May 2022 policy says good-faith security research will not be charged. It defines it as accessing a computer "solely for purposes of good-faith testing, investigation, and/or correction of a security flaw", done to "avoid any harm", with results used mainly to improve security. Law-firm summaries say the policy does not affect civil CFAA claims or state laws ([Arnold & Porter](https://www.arnoldporter.com/en/perspectives/blogs/enforcement-edge/2022/05/cybersecurity-research-with-violating-cfaa), [Jones Day](https://www.jonesday.com/en/insights/2022/06/department-of-justice-significantly-revises-policy-on-charging-cfaa-violations)). I couldn't load justice.gov directly, so the policy wording is from those summaries *(unverified against the DOJ text)*.
- **United Kingdom.** The Computer Misuse Act 1990 has no general research defence today. I couldn't load the Act's text, so I rely on news reports of the reform ([Computer Weekly via search](https://www.computerweekly.com/news/366635624/UK-government-pledges-to-rewrite-Computer-Misuse-Act), [Computing](https://www.computing.co.uk/news/2025/legislation-regulation/government-reform-computer-misuse-act)) *(statute text unverified)*. The proposed defence is not law yet, and critics say it would exclude automated tools ([The Record](https://therecord.media/uk-plans-for-cybercrime-law-reform-limited-protections)).
- **European Union.** Directive 2013/40/EU requires member states to punish intentional access "without right" to an information system when it infringes a security measure, at least in cases that aren't minor, according to a summary I found ([Tandfonline summary](https://www.tandfonline.com/doi/abs/10.1080/13600869.2015.1016278)). I couldn't load the EUR-Lex text *(unverified)*. NIS2 sets up coordinated vulnerability disclosure through national bodies, per secondary summaries ([ISMS.online](https://www.isms.online/nis-2/articles/12-coordinated-vulnerability-disclosure-and-eu-database/)) *(unverified)*. National implementations differ.
- **What hosted scanners do in practice:**
  - They require a proof of ownership (3.4).
  - They tell the customer the responsibility is theirs. Invicti: "Scanning a website without authorization is against the law" ([docs](https://docs.invicti.com/ie-is/verify-target-ownership)).
  - StackHawk's terms limit scanning to the customer's own dev or test instances and carry an indemnity, per the summary I loaded ([terms](https://www.stackhawk.com/terms-of-service/)) *(read the full text)*.
  - Detectify's own terms of use did not load, so I can't say what they require *(unverified)*.
- **What this means for the QA Tool.** The read-only layer sends only what a normal visit sends, which is the lowest-risk design. The Probe layer needs, before launch:
  1. The Verified Domain proof.
  2. Acceptance of terms stating the customer owns, or is authorised to test, the target.
  3. Pacing and a stop button.
  4. A record of who proved what and when.
  Third-party hosting platforms may have their own rules about tests against sites they host. I did not check them *(unverified)*.

## 4. Trends and openings (2025-2026)

1. **AI is entering offensive testing.** XBOW reached the top of HackerOne's US leaderboard in 2025, and reports say it confirms each finding with a working exploit to filter false positives ([Dark Reading](https://www.darkreading.com/vulnerabilities-threats/ai-based-pen-tester-top-bug-hunter-hackerone)). Intruder's 2026 list names eight such tools ([Intruder](https://www.intruder.io/blog/ai-pentesting-tools)). Agentic pentest is priced and built for security teams. Nobody on that list targets a team with no security staff and no QA staff *(my reading of the list, not checked tool by tool)*.
2. **DAST vendors target coding agents.** StackHawk's cheapest plan is $10 per user a month and works inside Claude Code, Cursor and Copilot *(vendor claim)* ([pricing](https://www.stackhawk.com/pricing/)). Detectify's free Starter plan covers REST and GraphQL API scanning ([pricing](https://www.detectify.com/pricing)). The opening: those tools demand ownership proof and want a security-minded user. Our read-only layer needs neither.
3. **Consolidation.** Snyk bought Probely ([Snyk](https://snyk.io/news/snyk-acquires-developer-first-dast-provider-probely/)), ZAP is now run by Checkmarx ([repo](https://github.com/zaproxy/zaproxy)), and StackHawk's hosted scanner is being replaced by Cloud Deployment ([docs](https://docs.stackhawk.com/platform/hosted-scanner/)). Free tools keep changing owners, so a connector should not depend on one tool's hosted service.
4. **UK law is moving.** In December 2025 the UK security minister committed to a statutory defence for researchers in the Computer Misuse Act, and by May 2026 it was expected in a new bill, with no draft published ([summary](https://www.computing.co.uk/news/2025/legislation-regulation/government-reform-computer-misuse-act), [Security Boulevard](https://securityboulevard.com/2026/05/uk-moves-to-shield-security-researchers-in-cybercrime-law-overhaul/)). Critics say it covers only about 300 accredited people and excludes testing done through automated tools ([The Record](https://therecord.media/uk-plans-for-cybercrime-law-reform-limited-protections)). So nothing in it would help a hosted tool.

## 5. Fit with the limits

- **$0 hosting:** read-only checks add no requests, only analysis of data already collected, so they are free. Probes are short and capped to protect shared IP addresses. ZAP and Nuclei stay on the user's side (CI or their own machine).
- **Browser-only, nothing to install:** the read-only layer runs inside the existing Playwright session. Verification needs the user to edit DNS, a file or a page, which is what Google and every scanner above ask.
- **Teams without QA staff:** the plain verdict should say "Your login cookie can be read by scripts on the page" and "A signed-out visitor can read `/api/me`", with the check name and fix underneath. It should also say what wasn't checked, because header grades tempt owners to read "A" as "secure".
- **FSL licence:** MobSF (GPL-3.0) is best kept as a separate process we connect to. ZAP (Apache-2.0), Nuclei (MIT), Retire.js (Apache-2.0) and Gitleaks (MIT) are permissive *(licences from each repo page; this is not legal advice)*.
- **Risks:**
  - Shared-IP bans from Probes.
  - Verification mistakes: stale DNS, a hostname that resolves to a private address, and a user who deletes the record.
  - False positives from heuristics such as session-cookie name guessing. Over-alerting costs trust fast with people who have no one to ask.

## 6. Open questions

1. Will early users accept editing DNS or adding a file, or does that stop them? If so, the first Probes could stay local-only, with Verified Domains coming after hosting.
2. Should exposed-file checks (such as `/.git/HEAD`) count as read-only, or as Probes? I put them under Probes because nobody linked to those paths, but a counsel or owner view may differ.
3. May the free tier run any Probes at all, or only read-only checks until the user pays?
4. Who sees the results of a Probe run on shared machines? They can contain secrets and leaked data, as Detectify's documentation notes.
5. Do early users handle email on their domain? That decides whether SPF and DMARC checks matter.
6. Which hosting platforms do early users deploy to (Vercel, Netlify, GitHub Pages, Cloudflare Pages)? That decides how much of the public-suffix handling to build first.
7. Would users rather get the ZAP scan as a ready-made CI workflow than as something we run?

## 7. Sources

- Repo code: [security.ts](../../../packages/checkers/src/security.ts) · [live-site.ts](../../../packages/core/src/live-site.ts) · [permission-matrix.ts](../../../packages/checkers/src/permission-matrix.ts) · [redact.ts](../../../packages/core/src/redact.ts) · [06-api-testing.md](06-api-testing.md) · [CONTEXT.md](../../../CONTEXT.md)
- ZAP: https://github.com/zaproxy/zaproxy · https://www.zaproxy.org/docs/docker/baseline-scan/ · https://www.zaproxy.org/docs/automate/automation-framework/ · https://www.zaproxy.org/docs/desktop/addons/automation-framework/job-ascan/
- Header and TLS graders: https://developer.mozilla.org/en-US/observatory/docs/faq · https://github.com/mdn/mdn-http-observatory · https://securityheaders.com/ (not loaded) · https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md
- Hosted scanners: https://www.stackhawk.com/pricing/ · https://docs.stackhawk.com/platform/hosted-scanner/ · https://docs.stackhawk.com/getting-started/quickstart/ · https://www.stackhawk.com/terms-of-service/ · https://www.detectify.com/pricing · https://docs.detectify.com/getting-started/asset-verification · https://support.detectify.com/support/solutions/articles/48001049280-why-do-you-require-verification-of-domain-ownership- · https://snyk.io/news/snyk-acquires-developer-first-dast-provider-probely/ · https://docs.snyk.io/scan-fix-and-prevent/scan-with-snyk/snyk-api-web/configure-targets/verify-domain-ownership · https://developers.probely.com/api/tutorials/targets/how-to-create-verify-target-domain/ · https://www.softwareadvice.com/encryption/probe-ly-profile/ · https://www.invicti.com/pricing/ · https://docs.invicti.com/ie-is/verify-target-ownership · https://portswigger.net/burp/pro
- Open-source tools: https://github.com/projectdiscovery/nuclei · https://docs.projectdiscovery.io/tools/nuclei/overview · https://github.com/retirejs/retire.js · https://github.com/gitleaks/gitleaks
- Standards and web docs: https://api-security.owasp.org/editions/2023/en/0x11-t10 · https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CORS · https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity · https://www.rfc-editor.org/rfc/rfc9116 · https://www.rfc-editor.org/rfc/rfc7489 · https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html · https://publicsuffix.org/learn/
- Domain verification elsewhere: https://support.google.com/webmasters/answer/9008080 · https://developers.cloudflare.com/ssl/edge-certificates/changing-dcv-method/methods/txt/
- Phone and desktop: https://mas.owasp.org/MASVS/ · https://mas.owasp.org/MASTG/ · https://github.com/MobSF/Mobile-Security-Framework-MobSF · https://www.electronjs.org/docs/latest/tutorial/security
- Law: https://www.law.cornell.edu/uscode/text/18/1030 · https://www.arnoldporter.com/en/perspectives/blogs/enforcement-edge/2022/05/cybersecurity-research-with-violating-cfaa · https://www.jonesday.com/en/insights/2022/06/department-of-justice-significantly-revises-policy-on-charging-cfaa-violations · https://www.computing.co.uk/news/2025/legislation-regulation/government-reform-computer-misuse-act · https://www.computerweekly.com/news/366635624/UK-government-pledges-to-rewrite-Computer-Misuse-Act · https://securityboulevard.com/2026/05/uk-moves-to-shield-security-researchers-in-cybercrime-law-overhaul/ · https://therecord.media/uk-plans-for-cybercrime-law-reform-limited-protections · https://www.tandfonline.com/doi/abs/10.1080/13600869.2015.1016278 · https://www.isms.online/nis-2/articles/12-coordinated-vulnerability-disclosure-and-eu-database/
- AI pentesting: https://www.darkreading.com/vulnerabilities-threats/ai-based-pen-tester-top-bug-hunter-hackerone · https://www.intruder.io/blog/ai-pentesting-tools
