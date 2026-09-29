import type { Page } from 'playwright';
import type { Breakpoint, Finding, FindingSeverity } from '@qa/types';

export interface SeoContext {
  testCaseId?: string;
  flowId?: string;
  role: string;
  breakpoint: Breakpoint;
  urlPath: string;
  baseUrl?: string;
}

export interface SeoPageDetails {
  title?: string;
  metaDescription?: string;
  h1Count: number;
  headings: Array<{ level: number; text: string }>;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  htmlLang?: string;
  metaRobots?: string;
  sameSiteLinks: string[];
}

export class SeoChecker {
  /**
   * Check SEO fundamentals and link health for a page.
   */
  async checkPage(page: Page, context: SeoContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const details = await this.collectDetails(page);
    if (!details) return findings;

    // 1. Page Title
    if (!details.title || details.title.trim().length === 0) {
      findings.push({
        id: `F-SEO-${context.testCaseId || 'GEN'}-TITLE-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: 'Major',
        checker: 'seo',
        title: 'Page is missing a title tag',
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: 'Page should have a descriptive <title> tag between 10 and 60 characters',
          actual: 'The <title> tag is missing or empty',
        },
        stepsToReproduce: [`Visit ${context.urlPath}`, 'Inspect the <head> element for a <title> tag'],
        evidence: {},
        resolution: 'Add a distinct, descriptive <title> in the <head> of the HTML document.',
        verifyCommand: `qa-test verify F-SEO-TITLE`,
      });
    }

    // 2. Meta Description
    if (!details.metaDescription || details.metaDescription.trim().length === 0) {
      findings.push({
        id: `F-SEO-${context.testCaseId || 'GEN'}-DESC-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: 'Minor',
        checker: 'seo',
        title: 'Page is missing a meta description',
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: 'Page should have a <meta name="description"> tag summarizing the page for search engines',
          actual: 'No meta description tag was found',
        },
        stepsToReproduce: [`Visit ${context.urlPath}`, 'Search for <meta name="description"> in <head>'],
        evidence: {},
        resolution: 'Add a <meta name="description" content="..."> tag with a 50–160 character summary.',
        verifyCommand: `qa-test verify F-SEO-DESC`,
      });
    }

    // 3. Heading Structure: Exactly one H1 and sequential order
    if (details.h1Count === 0) {
      findings.push({
        id: `F-SEO-${context.testCaseId || 'GEN'}-H1-MISSING-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: 'Major',
        checker: 'seo',
        title: 'Page has no primary <h1> heading',
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: 'Every page should have exactly one primary <h1> heading',
          actual: 'Found 0 <h1> headings on the page',
        },
        stepsToReproduce: [`Visit ${context.urlPath}`, 'Check the document headings'],
        evidence: {},
        resolution: 'Add a single top-level <h1> heading identifying the page content.',
        verifyCommand: `qa-test verify F-SEO-H1`,
      });
    } else if (details.h1Count > 1) {
      findings.push({
        id: `F-SEO-${context.testCaseId || 'GEN'}-H1-MULTIPLE-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: 'Minor',
        checker: 'seo',
        title: `Page has multiple <h1> headings (${details.h1Count} found)`,
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: 'Page should have a single <h1> heading representing the main topic',
          actual: `Found ${details.h1Count} <h1> headings`,
        },
        stepsToReproduce: [`Visit ${context.urlPath}`, 'Query document.querySelectorAll("h1")'],
        evidence: {},
        resolution: 'Demote secondary <h1> tags to <h2> or <h3> to maintain a single page heading.',
        verifyCommand: `qa-test verify F-SEO-H1-MULTIPLE`,
      });
    }

    // Heading hierarchy skip (e.g. h1 followed directly by h3 or h4)
    if (details.headings.length > 1) {
      for (let i = 0; i < details.headings.length - 1; i++) {
        const curr = details.headings[i].level;
        const next = details.headings[i + 1].level;
        if (next > curr + 1) {
          findings.push({
            id: `F-SEO-${context.testCaseId || 'GEN'}-HEADING-SKIP-${findings.length + 1}`,
            testCaseId: context.testCaseId,
            flowId: context.flowId,
            severity: 'Minor',
            checker: 'seo',
            title: `Heading levels skipped: <h${curr}> followed directly by <h${next}>`,
            where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
            expectedVsActual: {
              expected: `Headings should follow hierarchical order without skipping levels (e.g. h${curr} -> h${curr + 1})`,
              actual: `Heading hierarchy jumped from <h${curr}> to <h${next}> ("${details.headings[i + 1].text.slice(0, 30)}")`,
            },
            stepsToReproduce: [`Visit ${context.urlPath}`, `Inspect heading flow between h${curr} and h${next}`],
            evidence: {},
            resolution: `Ensure heading tags don't skip levels. Use CSS classes if styling needs to differ from semantic rank.`,
            verifyCommand: `qa-test verify F-SEO-HEADING-SKIP`,
          });
          break; // Only flag once per page
        }
      }
    }

    // 4. HTML Language Attribute
    if (!details.htmlLang || details.htmlLang.trim().length === 0) {
      findings.push({
        id: `F-SEO-${context.testCaseId || 'GEN'}-LANG-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: 'Minor',
        checker: 'seo',
        title: '<html> element is missing a lang attribute',
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: 'The <html> tag must specify the document language (e.g. <html lang="en">)',
          actual: 'The <html> tag has no lang attribute',
        },
        stepsToReproduce: [`Visit ${context.urlPath}`, 'View source and inspect <html lang="...">'],
        evidence: {},
        resolution: 'Add a valid lang attribute to the <html> root element, such as lang="en".',
        verifyCommand: `qa-test verify F-SEO-LANG`,
      });
    }

    // 5. OpenGraph Tags (Social preview)
    const missingOg: string[] = [];
    if (!details.ogTitle) missingOg.push('og:title');
    if (!details.ogDescription) missingOg.push('og:description');
    if (!details.ogImage) missingOg.push('og:image');
    if (missingOg.length === 3) {
      findings.push({
        id: `F-SEO-${context.testCaseId || 'GEN'}-OG-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: 'Suggestion',
        checker: 'seo',
        title: 'Page is missing OpenGraph social preview tags',
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: {
          expected: 'Pages should define OpenGraph tags (og:title, og:description, og:image) for rich link previews on social platforms',
          actual: `Missing OpenGraph tags: ${missingOg.join(', ')}`,
        },
        stepsToReproduce: [`Visit ${context.urlPath}`, 'Inspect meta tags for property="og:*"'],
        evidence: {},
        resolution: 'Add <meta property="og:title">, <meta property="og:description">, and <meta property="og:image"> tags.',
        verifyCommand: `qa-test verify F-SEO-OG`,
      });
    }

    // 6. Check for broken links on page (limited rate, same-site only)
    if (details.sameSiteLinks && details.sameSiteLinks.length > 0) {
      const linkFindings = await this.checkBrokenLinks(page, details.sameSiteLinks, context);
      findings.push(...linkFindings);
    }

    return findings;
  }

  private async collectDetails(page: Page): Promise<SeoPageDetails | null> {
    try {
      return await page.evaluate(() => {
        const title = document.title;
        const metaDescEl = document.querySelector('meta[name="description"]');
        const metaDescription = metaDescEl ? metaDescEl.getAttribute('content') || '' : undefined;

        const h1s = document.querySelectorAll('h1');
        const headingEls = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const headings: Array<{ level: number; text: string }> = [];
        headingEls.forEach((h) => {
          const level = parseInt(h.tagName.substring(1), 10);
          headings.push({ level, text: (h.textContent || '').trim() });
        });

        const canonicalEl = document.querySelector('link[rel="canonical"]');
        const canonicalUrl = canonicalEl ? canonicalEl.getAttribute('href') || '' : undefined;

        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || undefined;
        const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || undefined;
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined;

        const htmlLang = document.documentElement.getAttribute('lang') || undefined;
        const metaRobots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || undefined;

        // Collect same-site links
        const currentOrigin = window.location.origin;
        const rawLinks = Array.from(document.querySelectorAll('a[href]'));
        const sameSiteLinks: string[] = [];
        const seen = new Set<string>();

        for (const a of rawLinks) {
          const href = a.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            continue;
          }
          try {
            const urlObj = new URL(href, window.location.href);
            if (urlObj.origin === currentOrigin && !seen.has(urlObj.pathname)) {
              seen.add(urlObj.pathname);
              sameSiteLinks.push(urlObj.pathname);
            }
          } catch {
            // invalid URL
          }
        }

        return {
          title,
          metaDescription,
          h1Count: h1s.length,
          headings,
          canonicalUrl,
          ogTitle,
          ogDescription,
          ogImage,
          htmlLang,
          metaRobots,
          sameSiteLinks: sameSiteLinks.slice(0, 10), // Limit to 10 links to avoid flooding
        };
      });
    } catch {
      return null;
    }
  }

  private async checkBrokenLinks(page: Page, paths: string[], context: SeoContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const request = page.context().request;

    // Check up to 5 links asynchronously with a strict timeout
    const toCheck = paths.slice(0, 5);
    for (const linkPath of toCheck) {
      try {
        const fullUrl = context.baseUrl ? new URL(linkPath, context.baseUrl).href : linkPath;
        const response = await request.fetch(fullUrl, { method: 'HEAD', timeout: 3000 }).catch(async () => {
          return await request.fetch(fullUrl, { method: 'GET', timeout: 3000 }).catch(() => null);
        });

        if (response && response.status() >= 400 && response.status() !== 403 && response.status() !== 401) {
          findings.push({
            id: `F-SEO-${context.testCaseId || 'GEN'}-BROKENLINK-${findings.length + 1}`,
            testCaseId: context.testCaseId,
            flowId: context.flowId,
            severity: 'Major',
            checker: 'seo',
            title: `Broken link found: ${linkPath} returned HTTP ${response.status()}`,
            where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
            expectedVsActual: {
              expected: `All internal links should resolve to valid pages (HTTP 200/300)`,
              actual: `Link to ${linkPath} responded with HTTP ${response.status()}`,
            },
            stepsToReproduce: [`Visit ${context.urlPath}`, `Click or request link to ${linkPath}`],
            evidence: {},
            resolution: `Fix the broken link target or set up a 301 redirect if the page moved.`,
            verifyCommand: `qa-test verify F-SEO-BROKENLINK`,
          });
        }
      } catch {
        // Skip link on network error
      }
    }
    return findings;
  }
}
