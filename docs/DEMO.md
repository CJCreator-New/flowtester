# Demo script

How to run the Release check-up demo from start to finish: start the app, run the golden path with the labels as they appear, run the test-copy form journey, and know what to expect on each page.

Conventions in this script:

- Text in double quotes is what the wizard shows on screen. A test (`packages/runner/tests/checkup-docs.test.ts`) checks every one of them against `packages/wizard/src`. If a label changes in the wizard, change it here too.
- Text in backticks is a command, an address, or the fixture app's own text.
- _Italic_ lines under **Say** are what the presenter tells the audience.

## Before the demo

1. First run only: `pnpm bootstrap` (installs, Playwright Chromium, builds everything).
2. Terminal 1: `pnpm fixture`. The test app runs at `http://localhost:3050`. Leave it running.
3. Terminal 2: `pnpm start`. The whole app runs at `http://localhost:3001`. Open it in a browser.
4. Optional, for the AI plan: get a free key from "Get a free key from OpenRouter" and paste it into "OpenRouter key" on the new check-up screen. Never paste a key into a command, a slide or a screenshot. Without a key, fixed rules write the plan.
5. Fallback if the app or the fixture will not start: open `packages/wizard/public/sample-report.html` in a browser. It is an example report, not a run of the fixture, so its numbers do not match the expected counts below.

## Golden path

Each step lists the screen, the labels to click or read, what to expect, and what to say.

### 1. Landing

- Click "Start a free check-up".
- Expect the new check-up screen. If you typed an address on the landing page, it is already filled in.
- **Say:** _Paste a site address and this checks the site in a real browser, then tells you whether it is ready to release._

### 2. Address and access

- In "Site address", type `http://localhost:3050`, or click "Try the built-in test app", which fills it in.
- Under "What may the check-up do?", choose "Test it fully: it’s my test copy". The address is on this computer, so the wizard treats it as a test copy. The form journey below needs this choice.
- Expect the address to be accepted with no warning.
- **Say:** _Forms are only filled in and sent on a copy you are allowed to test. On a live site, the safe choice is "Only look at it: nothing is sent or changed"._

### 3. Leave the sign-in closed

- Leave "Sign in to test pages behind a login" closed for the golden path.
- **Say:** _Pages behind a login need sign-in details, so the golden path skips them._
- If you do add sign-in details, testing starts as soon as the plan is written, unless you tick "Let me review the plan before testing starts". Tick it before you go on.

### 4. Pages to explore

- Leave "Explore up to" at its default, 200 pages, and leave "More options" as it is.
- Leave "For developers" closed. It holds "Test cap".

### 5. Start

- Click "Start the check-up".
- The scan shows three stages in order: "Exploring every page", "Looking at phone and tablet menus", "Writing the plan". It also shows pages found and the AI requests left today.
- "Stop scanning" asks first ("Stop and plan what’s found"). Do not press it in the golden path.
- **Say:** _The tool explores the site like a visitor would, then writes a plan. Nothing is tested yet._

### 6. Plan review

- Two tabs: "Full plan" and "Map". Stay on "Full plan" and go down the page:
  - "What approving runs": how many tests, on how many pages, at which screen sizes.
  - "Pages", "Navigation", "Journeys", "Checks on every tested page".
  - "Won’t run": what is left out, and why.
  - "Questions before testing", and "Product context and design notes" at the bottom.
- From the command palette, pick "Jump to Product context and design notes" to show the jump works.
- Switch to "Map" to show the pages and the links between them.
- Click "Download the plan" if the audience wants a file for sign-off.
- **Say:** _You approve the plan before anything is tested. Every test is listed, with the reason it is there._

### 7. Approve

- Click "Approve the plan and start testing".

### 8. Testing

- Expect "Now testing", a "Latest screen" image, and a "Found so far" count that grows.
- The counter reads `Test X of Y` as tests run. Y is what this run started, and it can differ from the plan count (see Expected counts).
- "Stop testing" asks first ("Make a report from what’s done"). Do not press it in the golden path.
- **Say:** _This is a real browser clicking through the plan, and the findings come from what it sees._

### 9. Report

- The stamp is the verdict. It reads `Ready to release` or `Not ready yet`. The reason line under it says why.
- Under the stamp: `N must fix before release · N problems in all · N tests in M minutes`, with the numbers filled in.
- Show the problem list, grouped as "Must fix before release", "Should fix" and "Suggestions", under "Problems found".
- Open one problem's "Details for developers". Show "Copy bug report" and "Copy Playwright test".
- Scroll to "Map of results", "What to improve first" and "How each area did" (the grades).
- **Say:** _The verdict follows one rule: no blockers, and every area at C or better. Areas that were not checked say so._

### 10. Download and run again

- Show the download buttons: "Download report.md", "Download findings.json", "Download issues.md", "Download issues.html".
- "Past check-ups" in the top bar keeps every report.
- "New check-up of this site" starts again on the same address, with the plan you approved.
- **Say:** _After you fix something, run it again. The finding should be gone._

## Test-copy form journey

This shows the tool filling in a form and sending it. It needs the "Test it fully: it’s my test copy" choice from step 2 and an AI key (the description is turned into a test by the AI).

1. On the plan review screen, find "Add a test by describing it" in "Journeys".
2. Under "On the page", pick `/invoices/new`. If it is not in the list, say so: the tool did not find that page.
3. In the sentence box, type: _Fill in the invoice form with a customer and an amount, press Save, and expect the invoice to be saved._
4. Click "Turn into a test", then "Add this test to the plan".
5. Click "Approve the plan and start testing".
6. On the testing screen, "Latest screen" shows the form. The fixture's form (`/invoices/new`) has Customer `Acme Corp` and Amount `1200` filled in already. Save sends them to `/api/invoices`, which answers with invoice `INV-101`.
7. On the report, the journey counts among the tests. On the fixture it should pass and add no problem. If it adds one, say so and check the fixture first.

- **Say:** _Forms are filled in and sent only because this is a test copy. The same journey on a live site is only looked at._

## What to expect on each fixture page

The answer key is `fixtures/benchmarks/fixture.json`. The planted defects are in `fixtures/test-app/server.js`.

| Page                                                   | Expected finding                                                                 | Notes                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/dashboard`                                           | The `Trigger Console Error` button logs an error to the console.                 | Planted.                                                                      |
| `/dashboard`                                           | The `Trigger 500 API Failure` button calls `/api/failing-endpoint`, which fails. | Planted.                                                                      |
| `/dashboard`                                           | The small `X` button is 20 × 20 px, under the 44 px touch target.                | Planted.                                                                      |
| `/deadend` (the `Orphaned Page` link on the dashboard) | `Dead End Page` has no link or button back.                                      | Planted.                                                                      |
| `/login`                                               | The form sends the password in the page address (GET). Security check.           | Planted.                                                                      |
| `/about`                                               | No page title. Document-title and missing title tag.                             | Planted.                                                                      |
| `/reports`                                             | Answers after 2 seconds. Performance check.                                      | Planted, but the answer key expects it in a later phase. It may not show yet. |
| Every page                                             | No security headers such as Content-Security-Policy.                             | Planted, but the answer key expects it in a later phase. It may not show yet. |
| Header menu and a Save button                          | Plain text links under 44 px tall on a phone.                                    | Not planted. A real finding, so it may appear.                                |

Things that are not problems for this fixture. If they appear, say they are known non-issues: a missing canonical URL tag; missing breadcrumbs; the marketing checks on `/` (call to action, contact, privacy link, analytics, social links, pricing, reviews, email sign-up); social preview tags; Organization or WebSite structured data; slow clicks on `/dashboard`.

Things the fixture fixed on purpose: a missing meta description, h1, mobile viewport or favicon link, and an unreachable sitemap. These are kept so that a regression counts. If one of them appears, the fixture has regressed. Say so, and check the fixture before blaming the tool.

## Expected counts

These are working ranges, not promises. They come from the answer key and the fixture's pages. The count and score items are confirmed on a dry run (human item Demo 6). If a dry run lands outside a range, update the range here.

| Count                   | Where it shows                                                   | Expected range                                      |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Tests in the plan       | "What approving runs", as `N tests on M pages at K screen sizes` | 30 to 150 tests, 8 to 25 pages, 1 to 3 screen sizes |
| Tests in the run        | `Test X of Y` while testing                                      | Y is within about 30 to 150                         |
| Problems in all         | Report line `N problems in all`                                  | 8 to 25                                             |
| Must fix before release | Report line `N must fix before release`                          | 4 to 12                                             |
| Verdict                 | The stamp                                                        | `Not ready yet`                                     |

**The plan count and the testing count can differ, and that is expected.** The plan count is what you approved. The testing count is what the run actually started, so a page that does not open, or a test that is skipped, makes it lower. Say so when the two numbers do not match.

The stamp is shown by the wizard but its words come from `packages/types/src/verdict.ts`. The stamp words are `Ready to release` and `Not ready yet`.

## Checking the labels

After any wizard label changes, check this script:

- Automated: `pnpm exec vitest run packages/runner/tests/checkup-docs.test.ts`. The test fails if a quoted label here is not in `packages/wizard/src`.
- By hand, for one label: `grep -rF "Approve the plan and start testing" packages/wizard/src`.
