# How noisy is lab LCP on the check-up machine?

**Date:** 2026-10-05. Phase 0 of the [implementation plan](../E2E_PLATFORM_IMPLEMENTATION_PLAN.md) asks for this before item 0.1 is finished. It sets the number of repeat loads and the rule for "slower than last time".

## What was measured
- **Page:** https://books.toscrape.com/ (a scraping sandbox the benchmark already uses).
- **Machine:** the builder's Windows 11 laptop, otherwise idle. Chromium from Playwright, 375px wide, cache off.
- **Profile:** the one the tool uses: 150 ms round trip, 1.6 Mbps down, 750 Kbps up, 4x CPU slowdown.
- **Method:** 10 batches of the tool's own measurement (3 loads each, 5 when the first 3 looked slow), 32 loads in all.

## Results
| | LCP |
|---|---|
| Fastest load | 1,096 ms |
| Median | 1,424 ms |
| Slowest load | 2,012 ms |
| Standard deviation | 227 ms (15% of the mean) |
| Median of 3, lowest to highest across batches | 1,292 to 1,564 ms (a 20% spread of the median) |

## Decisions
- **Repeat loads: 3, and 2 more when the median is over a threshold.** One load swung by 900 ms on a page whose true value is about 1.4 s. The median of 3 swung by about 270 ms. That is good enough to tell a 1.4 s page from a 2.5 s one, but not to rule on a page near 2.5 s, which is why a page over the limit gets 5 loads.
- **"Slower than last time" (not built yet).** Compare medians, and only call a page slower when it is at least 20% and at least 300 ms worse. Anything smaller is inside the noise measured here.
- **Always report the spread.** Each finding carries the per-load numbers and the spread in its evidence, so a reader can see how steady the number was.
- **INP is sparse.** Only 3 of the 10 batches had an interaction slow enough for the browser to report (16 ms or more). When none is reported, no INP is shown. This is not a pass or a failure.

## Limits of this measurement
- One page and one machine. A shared runner or a GitHub Actions machine will differ. Repeat this on the host that runs check-ups in Phase 1.
- A page with heavier scripts will be noisier than this light page.
