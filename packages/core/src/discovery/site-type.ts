import type {
  DiscoveredFlow,
  PageInventoryItem,
  RoleCredential,
} from '@qa/types';
import type { SpiderResult } from './deterministic-spider.js';

export type SiteType = 'shop' | 'SaaS' | 'content' | 'booking' | 'app' | 'other';

/**
 * Detects the site category using deterministic structural signals from scanned pages,
 * interactive elements, and URL paths.
 */
export function detectSiteType(pages: PageInventoryItem[], targetUrl: string): SiteType {
  const urlLower = targetUrl.toLowerCase();

  // Fast-path URL / domain matches
  if (urlLower.includes('books.toscrape.com') || urlLower.includes('shop') || urlLower.includes('store') || urlLower.includes('ecommerce')) {
    return 'shop';
  }
  if (urlLower.includes('todomvc') || urlLower.includes('todo')) {
    return 'app';
  }
  if (urlLower.includes('booking') || urlLower.includes('hotel') || urlLower.includes('flight') || urlLower.includes('reservation')) {
    return 'booking';
  }

  // Aggregate signals across all scanned pages and interactive elements
  let shopSignals = 0;
  let saasSignals = 0;
  let appSignals = 0;
  let bookingSignals = 0;
  let contentSignals = 0;

  for (const page of pages) {
    const pPath = page.urlPath.toLowerCase();
    const pTitle = (page.title || '').toLowerCase();

    // Check path & title signals
    if (/cart|basket|checkout|product|item|catalogue|order/i.test(pPath) || /cart|basket|shop|store/i.test(pTitle)) {
      shopSignals += 3;
    }
    if (/invoice|billing|pricing|plan|dashboard|team|organization|account/i.test(pPath) || /dashboard|pricing/i.test(pTitle)) {
      saasSignals += 3;
    }
    if (/book|reservation|appointment|hotel|room|flight/i.test(pPath)) {
      bookingSignals += 3;
    }
    if (/blog|article|news|post|doc|guide/i.test(pPath) || /blog|articles|news/i.test(pTitle)) {
      contentSignals += 2;
    }

    // Check element text, testids, and roles
    for (const el of page.elements || []) {
      const name = (el.name || '').toLowerCase();
      const testId = (el.testId || '').toLowerCase();
      const sel = (el.selector || '').toLowerCase();
      const combined = `${name} ${testId} ${sel}`;

      if (/add to (?:basket|cart)|checkout|buy now|£|\$|€|in stock|out of stock/i.test(combined)) {
        shopSignals += 2;
      }
      if (/new-todo|todo-list|todo-count|clear-completed|calculator/i.test(combined)) {
        appSignals += 3;
      }
      if (/check-in|check-out|reserve|book now|guests/i.test(combined)) {
        bookingSignals += 2;
      }
      if (/upgrade|subscribe|pricing|invoice/i.test(combined)) {
        saasSignals += 2;
      }
    }
  }

  // Single-page interactive applications with few pages but interactive controls
  if (pages.length <= 2 && appSignals > 0) {
    return 'app';
  }

  const scores: Array<{ type: SiteType; score: number }> = [
    { type: 'shop', score: shopSignals },
    { type: 'app', score: appSignals },
    { type: 'SaaS', score: saasSignals },
    { type: 'booking', score: bookingSignals },
    { type: 'content', score: contentSignals },
  ];

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score >= 2) {
    return scores[0].type;
  }

  return 'other';
}

/**
 * Builds 3-5 high-value default journeys when AI flow synthesis is unavailable or fails,
 * tailored to the detected site type.
 */
export function generateFallbackJourneys(
  siteType: SiteType,
  spiderResult: SpiderResult,
  roles: RoleCredential[] = []
): DiscoveredFlow[] {
  const flows: DiscoveredFlow[] = [];
  const defaultRole = roles[0]?.role || 'anonymous';
  let flowCounter = 1;

  // 1. Site-type specific primary journey
  if (siteType === 'shop') {
    // Look for a product or category link to browse
    const homePage = spiderResult.pages.find((p) => p.urlPath === '/' || p.urlPath === '') || spiderResult.pages[0];
    const productLink = homePage?.elements?.find(
      (el) => el.role === 'link' && (/catalogue|product|book|item/i.test(el.selector) || /catalogue|product|book|item/i.test(el.name))
    );

    if (productLink) {
      flows.push({
        id: `FLOW-${String(flowCounter++).padStart(3, '0')}`,
        name: 'Browse and view product',
        role: defaultRole,
        description: 'Verifies shoppers can browse the catalogue and open a product details page.',
        startPage: homePage.urlPath || '/',
        steps: [
          { action: 'navigate', value: homePage.urlPath || '/', name: 'Open store homepage' },
          { action: 'click', selector: productLink.selector, name: `Click "${productLink.name || 'product'}"` },
        ],
        candidateExpectations: {
          url: { pattern: '/*' },
        },
      });
    }
  } else if (siteType === 'app') {
    // Look for an input textbox on the main screen (e.g. TodoMVC new todo input)
    const homePage = spiderResult.pages[0];
    const input = homePage?.elements?.find((el) => el.role === 'textbox');

    if (input) {
      flows.push({
        id: `FLOW-${String(flowCounter++).padStart(3, '0')}`,
        name: 'Create and submit item',
        role: defaultRole,
        description: 'Tests the core interactive input and submission flow of the application.',
        startPage: homePage.urlPath || '/',
        steps: [
          { action: 'navigate', value: homePage.urlPath || '/', name: 'Open application' },
          { action: 'fill', selector: input.selector, value: 'Test Item 1', name: `Fill "${input.name || 'item'}"` },
          { action: 'wait', name: 'Wait for item update' },
        ],
        candidateExpectations: {
          text: { contains: 'Test Item 1' },
        },
      });
    }
  }

  // 2. Add form submission flows from discovered forms
  const NON_FILLABLE_TYPES = new Set(['submit', 'button', 'reset', 'checkbox', 'radio', 'file', 'image', 'hidden']);
  for (const form of spiderResult.forms) {
    if (flows.length >= 4) break;
    const fillableInputs = form.inputs.filter((inp) => !NON_FILLABLE_TYPES.has(inp.type));
    const clickableInputs = form.inputs.filter((inp) => inp.type === 'button');

    flows.push({
      id: `FLOW-${String(flowCounter++).padStart(3, '0')}`,
      name: `Submit form on ${form.urlPath}`,
      role: defaultRole,
      description: `Verifies data entry and submission on the ${form.urlPath} form.`,
      startPage: form.urlPath,
      steps: [
        { action: 'navigate', value: form.urlPath, name: `Open ${form.urlPath}` },
        ...fillableInputs.map((inp) => ({
          action: 'fill' as const,
          selector: inp.selector,
          value: inp.type === 'number' ? '100' : 'Test Value',
          name: `Fill ${inp.label || 'field'}`,
        })),
        ...clickableInputs.map((inp) => ({
          action: 'click' as const,
          selector: inp.selector,
          name: `Click ${inp.label || 'button'}`,
        })),
        ...(form.submitButtonSelector
          ? [{ action: 'click' as const, selector: form.submitButtonSelector, name: 'Submit form' }]
          : []),
      ],
      candidateExpectations: {
        url: { pattern: '/*' },
      },
    });
  }

  // 3. Navigation / Explore flow if we have multiple pages
  if (flows.length < 3 && spiderResult.pages.length > 1) {
    const secondPage = spiderResult.pages[1];
    flows.push({
      id: `FLOW-${String(flowCounter++).padStart(3, '0')}`,
      name: `Explore ${secondPage.title || secondPage.urlPath}`,
      role: defaultRole,
      description: `Verifies navigation from the homepage to ${secondPage.urlPath}.`,
      startPage: '/',
      steps: [
        { action: 'navigate', value: '/', name: 'Open homepage' },
        { action: 'navigate', value: secondPage.urlPath, name: `Navigate to ${secondPage.urlPath}` },
      ],
      candidateExpectations: {
        url: { pattern: secondPage.urlPath },
      },
    });
  }

  // Ensure at least one baseline sanity flow exists
  if (flows.length === 0) {
    flows.push({
      id: `FLOW-${String(flowCounter++).padStart(3, '0')}`,
      name: 'Homepage visit and sanity check',
      role: defaultRole,
      description: 'Verifies the application start page loads and responds correctly.',
      startPage: '/',
      steps: [
        { action: 'navigate', value: '/', name: 'Open homepage' },
        { action: 'wait', name: 'Wait for page load' },
      ],
      candidateExpectations: {
        url: { pattern: '/*' },
      },
    });
  }

  return flows;
}
