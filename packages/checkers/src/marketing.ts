import type { Page } from 'playwright';
import type { Breakpoint, Finding, FindingSeverity } from '@qa/types';

export interface MarketingContext {
  testCaseId?: string;
  flowId?: string;
  role: string;
  breakpoint: Breakpoint;
  urlPath: string;
  /** Facts about the whole site already reported this run: each is reported once. */
  siteWide?: Set<string>;
}

/** What a visitor or a marketer would look for. Each is false only when the page was read and it's missing. */
export interface MarketingPageDetails {
  hasTwitterCard?: boolean;
  hasOgTitle?: boolean;
  hasOgImage?: boolean;
  hasCallToAction?: boolean;
  hasContactRoute?: boolean;
  hasPrivacyLink?: boolean;
  hasAnalytics?: boolean;
  hasSocialLinks?: boolean;
}

interface Rule {
  key: string;
  /** Whether it needs the home page (a fact about the whole site) rather than any page. */
  homeOnly: boolean;
  missing: (d: MarketingPageDetails) => boolean;
  severity: FindingSeverity;
  title: string;
  expected: string;
  actual: string;
  resolution: string;
}

const RULES: Rule[] = [
  {
    key: 'TWITTER-CARD',
    homeOnly: false,
    missing: (d) => d.hasTwitterCard === false,
    severity: 'Suggestion',
    title: 'Links shared on X and other social sites won’t show a rich preview card',
    expected: 'A twitter:card tag so shared links show a title, description and image',
    actual: 'No twitter:card meta tag found',
    resolution: 'Add <meta name="twitter:card" content="summary_large_image"> along with a title, description and image.',
  },
  {
    key: 'SHARE-IMAGE',
    homeOnly: false,
    missing: (d) => d.hasOgTitle === true && d.hasOgImage === false,
    severity: 'Minor',
    title: 'Shared links show no picture',
    expected: 'An og:image so shared links on social sites and chat apps show a picture',
    actual: 'The page has an og:title but no og:image',
    resolution: 'Add <meta property="og:image"> with a picture at least 1200×630 pixels.',
  },
  {
    key: 'CTA',
    homeOnly: true,
    missing: (d) => d.hasCallToAction === false,
    severity: 'Minor',
    title: 'The home page has no clear call to action',
    expected: 'A visible button or link that tells visitors what to do next, such as “Get started”, “Book a demo” or “Sign up”',
    actual: 'No call-to-action button or link was found on the home page',
    resolution: 'Add one clear primary button near the top of the home page that says what happens when it’s pressed.',
  },
  {
    key: 'CONTACT',
    homeOnly: true,
    missing: (d) => d.hasContactRoute === false,
    severity: 'Minor',
    title: 'There is no way to get in touch from the home page',
    expected: 'A contact, support or email link people can find without searching',
    actual: 'No contact page, email or phone link was found on the home page',
    resolution: 'Add a Contact link to the header or footer, or an email address people can write to.',
  },
  {
    key: 'PRIVACY',
    homeOnly: true,
    missing: (d) => d.hasPrivacyLink === false,
    severity: 'Minor',
    title: 'There is no privacy or terms link',
    expected: 'A link to a privacy policy or terms, which visitors, ad platforms and app stores look for',
    actual: 'No privacy or terms link was found on the home page',
    resolution: 'Add Privacy and Terms links to the footer.',
  },
  {
    key: 'ANALYTICS',
    homeOnly: true,
    missing: (d) => d.hasAnalytics === false,
    severity: 'Suggestion',
    title: 'No visitor analytics were found',
    expected: 'Some way to see where visitors come from and what they do, such as Google Analytics, Plausible or PostHog',
    actual: 'No analytics script was found on the home page',
    resolution: 'Add an analytics tool so you can tell which pages and campaigns bring people in.',
  },
  {
    key: 'SOCIAL',
    homeOnly: true,
    missing: (d) => d.hasSocialLinks === false,
    severity: 'Suggestion',
    title: 'No links to social media profiles',
    expected: 'Links to the site’s social profiles, which help people follow it and help search tools tie them together',
    actual: 'No links to LinkedIn, X, Instagram, YouTube or similar were found on the home page',
    resolution: 'Link to the profiles you keep up, from the footer.',
  },
];

/**
 * The marketing basics a site is expected to have: share previews, a clear call to action, a way to
 * get in touch, trust links, analytics and social profiles. Reported once per site, not per page.
 */
export class MarketingChecker {
  async checkPage(page: Page, context: MarketingContext): Promise<Finding[]> {
    const details = await this.collectDetails(page);
    if (!details) return [];

    const isHome = context.urlPath === '/' || context.urlPath === '' || context.urlPath === '/index.html';
    const tcId = context.testCaseId || 'MKT';
    const findings: Finding[] = [];
    for (const rule of RULES) {
      if (rule.homeOnly && !isHome) continue;
      if (!rule.missing(details)) continue;
      if (context.siteWide) {
        const key = `marketing:${rule.key}`;
        if (context.siteWide.has(key)) continue;
        context.siteWide.add(key);
      }
      findings.push({
        id: `F-MKT-${tcId}-${rule.key}-${findings.length + 1}`,
        testCaseId: context.testCaseId,
        flowId: context.flowId,
        severity: rule.severity,
        checker: 'seo',
        categoryTag: 'MKT',
        title: rule.title,
        where: { urlPath: context.urlPath, role: context.role, breakpoint: context.breakpoint },
        expectedVsActual: { expected: rule.expected, actual: rule.actual },
        stepsToReproduce: [`Visit ${context.urlPath}`, 'Look for it on the page and in its HTML'],
        evidence: {},
        resolution: rule.resolution,
        verifyCommand: `qa-test verify F-MKT-${rule.key}`,
      });
    }
    return findings;
  }

  private async collectDetails(page: Page): Promise<MarketingPageDetails | null> {
    try {
      const details = await page.evaluate((): MarketingPageDetails => {
        const meta = (sel: string) => !!document.querySelector(sel);
        const metaContent = (sel: string) => !!document.querySelector<HTMLMetaElement>(sel)?.content?.trim();
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
        const textOf = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();
        const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;

        const ctaWords = /\b(get started|start|try|sign up|join|buy|book|schedule|request|demo|subscribe|download|shop|order|free|contact us|learn more)\b/i;
        const hasCallToAction = Array.from(document.querySelectorAll('a, button, [role="button"]')).some(
          (el) => visible(el) && textOf(el).length > 0 && textOf(el).length <= 40 && ctaWords.test(textOf(el))
        );

        const hasContactRoute = links.some((a) => /^(mailto|tel):/i.test(a.getAttribute('href') || '') || /contact|support|help/i.test(textOf(a)) || /contact/i.test(a.getAttribute('href') || ''));
        const hasPrivacyLink = links.some((a) => /privacy|terms|legal/i.test(textOf(a)) || /privacy|terms/i.test(a.getAttribute('href') || ''));

        const analyticsPattern = /googletagmanager|google-analytics|gtag\(|plausible|posthog|segment\.(com|io)|fathom|matomo|umami|clarity\.ms|mixpanel|hotjar|amplitude|fbevents|vercel[-/]insights|_vercel\/insights/i;
        const w = window as unknown as Record<string, unknown>;
        const hasAnalytics =
          !!(w.dataLayer || w.gtag || w.ga || w.plausible || w.posthog || w.analytics || w.mixpanel || w._paq || w.fbq) ||
          Array.from(document.scripts).some((s) => analyticsPattern.test(s.src || '') || analyticsPattern.test(s.textContent || ''));

        const socialHosts = /(^|\.)(twitter\.com|x\.com|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com|github\.com|threads\.net|mastodon\.[a-z]+)$/i;
        const hasSocialLinks = links.some((a) => {
          try {
            return socialHosts.test(new URL(a.href).hostname);
          } catch {
            return false;
          }
        });

        return {
          hasTwitterCard: meta('meta[name="twitter:card"]'),
          hasOgTitle: metaContent('meta[property="og:title"]'),
          hasOgImage: metaContent('meta[property="og:image"]'),
          hasCallToAction,
          hasContactRoute,
          hasPrivacyLink,
          hasAnalytics,
          hasSocialLinks,
        };
      });
      return details && typeof details === 'object' ? details : null;
    } catch {
      return null;
    }
  }
}
