import { describe, it, expect } from 'vitest';
import { SeoChecker } from '../src/seo.js';
import type { Page } from 'playwright';

describe('SeoChecker', () => {
  const checker = new SeoChecker();

  function createMockPage(details: any, fetchHandler?: (url: string) => Promise<any>): Page {
    return {
      evaluate: async () => details,
      context: () => ({
        request: {
          fetch: fetchHandler || (async () => ({ status: () => 200 })),
        },
      }),
    } as unknown as Page;
  }

  it('flags missing page title as Major (fixture planted defect)', async () => {
    const pageNoTitle = createMockPage({
      title: '',
      metaDescription: 'Some description',
      h1Count: 1,
      headings: [{ level: 1, text: 'About Fixture' }],
      htmlLang: 'en',
      sameSiteLinks: [],
    });

    const findings = await checker.checkPage(pageNoTitle, {
      testCaseId: 'TC-ABOUT',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/about',
    });

    const titleFinding = findings.find((f) => f.title.includes('missing a title tag'));
    expect(titleFinding).toBeDefined();
    expect(titleFinding?.severity).toBe('Major');
  });

  it('flags missing meta description as Minor', async () => {
    const pageNoDesc = createMockPage({
      title: 'About Fixture',
      metaDescription: '',
      h1Count: 1,
      headings: [{ level: 1, text: 'About Fixture' }],
      htmlLang: 'en',
      sameSiteLinks: [],
    });

    const findings = await checker.checkPage(pageNoDesc, {
      testCaseId: 'TC-ABOUT',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/about',
    });

    const descFinding = findings.find((f) => f.title.includes('missing a meta description'));
    expect(descFinding).toBeDefined();
    expect(descFinding?.severity).toBe('Minor');
  });

  it('flags missing H1 and heading level skips', async () => {
    const pageBadHeadings = createMockPage({
      title: 'Docs',
      metaDescription: 'Documentation',
      h1Count: 0,
      headings: [
        { level: 2, text: 'Subheading' },
        { level: 4, text: 'Deeply nested heading' },
      ],
      htmlLang: 'en',
      sameSiteLinks: [],
    });

    const findings = await checker.checkPage(pageBadHeadings, {
      testCaseId: 'TC-HEADINGS',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/docs',
    });

    expect(findings.some((f) => f.title.includes('no primary <h1>'))).toBe(true);
    expect(findings.some((f) => f.title.includes('Heading levels skipped'))).toBe(true);
  });

  it('flags missing html lang attribute', async () => {
    const pageNoLang = createMockPage({
      title: 'Home',
      metaDescription: 'Home description',
      h1Count: 1,
      headings: [{ level: 1, text: 'Home' }],
      htmlLang: '',
      sameSiteLinks: [],
    });

    const findings = await checker.checkPage(pageNoLang, {
      testCaseId: 'TC-LANG',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/',
    });

    const langFinding = findings.find((f) => f.title.includes('missing a lang attribute'));
    expect(langFinding).toBeDefined();
    expect(langFinding?.severity).toBe('Minor');
  });

  it('detects broken internal link returning HTTP 404', async () => {
    const pageWithLinks = createMockPage(
      {
        title: 'Home',
        metaDescription: 'Home page',
        h1Count: 1,
        headings: [{ level: 1, text: 'Home' }],
        htmlLang: 'en',
        sameSiteLinks: ['/dead-link'],
      },
      async (url: string) => {
        if (url.includes('/dead-link')) {
          return { status: () => 404 };
        }
        return { status: () => 200 };
      }
    );

    const findings = await checker.checkPage(pageWithLinks, {
      testCaseId: 'TC-LINKS',
      role: 'visitor',
      breakpoint: '1440px',
      urlPath: '/',
      baseUrl: 'http://localhost:3050',
    });

    const brokenLinkFinding = findings.find((f) => f.title.includes('Broken link found'));
    expect(brokenLinkFinding).toBeDefined();
    expect(brokenLinkFinding?.severity).toBe('Major');
    expect(brokenLinkFinding?.expectedVsActual.actual).toContain('404');
  });
});
