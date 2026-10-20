import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import type { WcagCoverageEntry } from '@qa/types';
import { UXQualityChecker } from '../src/ux-quality.js';

describe('alt text quality goes to could-not-verify', () => {
  const checker = new UXQualityChecker();
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser.close();
  });
  const ctx = { testCaseId: 'TC-ALT', role: 'visitor', breakpoint: '1440px' as const, urlPath: '/' };
  const run = async (img: string) => {
    const page = await (await browser.newContext()).newPage();
    try {
      await page.setContent(
        `<html lang="en"><head><title>t</title></head><body><main><h1>Hi</h1>${img}</main></body></html>`
      );
      let cov: WcagCoverageEntry[] = [];
      const findings = await checker.check(page, { ...ctx, onCoverage: (e) => (cov = e) });
      return { findings, cov };
    } finally {
      await page.context().close();
    }
  };
  const PX = 'src="data:image/gif;base64,R0lGODlhAQABAAAAACw="';

  it('IMG_1234.png alt yields a Suggestion needing confirmation, not a defect or a pass', async () => {
    const { findings, cov } = await run(`<img ${PX} alt="IMG_1234.png">`);
    const f = findings.find((x) => x.id.startsWith('F-UNVERIFIED-ux-quality'));
    expect(f?.severity).toBe('Suggestion');
    expect(f?.needsConfirmation).toBe(true);
    expect(f?.title).toMatch(/^Could not verify/);
    expect(findings.some((x) => x.title.includes('image-alt'))).toBe(false);
    expect(cov.find((e) => e.criterion.includes('1.1.1'))?.status).toBe('needs-human-judgment');
  });

  it('a good alt yields no could-not-verify finding', async () => {
    const { findings } = await run(`<img ${PX} alt="Bar chart of monthly invoices">`);
    expect(findings.some((x) => x.id.startsWith('F-UNVERIFIED'))).toBe(false);
  });
});
