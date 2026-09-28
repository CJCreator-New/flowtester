import { describe, it, expect } from 'vitest';
import { detectSiteType, generateFallbackJourneys } from '../src/discovery/site-type.js';
import type { PageInventoryItem } from '@qa/types';
import type { SpiderResult } from '../src/discovery/deterministic-spider.js';

describe('detectSiteType and generateFallbackJourneys (Task 1.4 / D4)', () => {
  it('detects books.toscrape.com as "shop" and synthesizes a browse -> product journey', () => {
    const pages: PageInventoryItem[] = [
      {
        urlPath: '/',
        title: 'All products | Books to Scrape',
        elements: [
          { role: 'link', name: 'A Light in the Attic', selector: 'article.product_pod h3 a' },
          { role: 'button', name: 'Add to basket', selector: 'form button[type="submit"]' },
        ],
      },
      {
        urlPath: '/catalogue/a-light-in-the-attic_1000/index.html',
        title: 'A Light in the Attic | Books to Scrape',
        elements: [
          { role: 'button', name: 'Add to basket', selector: 'button.btn-primary' },
        ],
      },
    ];

    const type = detectSiteType(pages, 'https://books.toscrape.com/');
    expect(type).toBe('shop');

    const spiderResult: SpiderResult = {
      pages,
      forms: [],
      routes: ['/', '/catalogue/a-light-in-the-attic_1000/index.html'],
      buttons: [],
      anchors: [],
    };

    const journeys = generateFallbackJourneys(type, spiderResult);
    expect(journeys.length).toBeGreaterThanOrEqual(1);

    const browseJourney = journeys.find((j) => j.name.toLowerCase().includes('browse') || j.name.toLowerCase().includes('product'));
    expect(browseJourney).toBeDefined();
    expect(browseJourney!.description).toBeTruthy();
    expect(browseJourney!.description.length).toBeGreaterThan(10);
    // Should have navigate and click steps
    expect(browseJourney!.steps.some((s) => s.action === 'navigate')).toBe(true);
    expect(browseJourney!.steps.some((s) => s.action === 'click')).toBe(true);
  });

  it('detects TodoMVC as "app" and synthesizes task creation journey', () => {
    const pages: PageInventoryItem[] = [
      {
        urlPath: '/',
        title: 'TodoMVC',
        elements: [
          { role: 'textbox', name: 'What needs to be done?', selector: 'input.new-todo', testId: 'new-todo' },
        ],
      },
    ];

    const type = detectSiteType(pages, 'https://demo.playwright.dev/todomvc/');
    expect(type).toBe('app');

    const spiderResult: SpiderResult = {
      pages,
      forms: [],
      routes: ['/'],
      buttons: [],
      anchors: [],
    };

    const journeys = generateFallbackJourneys(type, spiderResult);
    expect(journeys.length).toBeGreaterThanOrEqual(1);

    const taskJourney = journeys.find((j) => j.name.toLowerCase().includes('submit') || j.name.toLowerCase().includes('item') || j.name.toLowerCase().includes('create'));
    expect(taskJourney).toBeDefined();
    expect(taskJourney!.description).toBeTruthy();
    expect(taskJourney!.steps.some((s) => s.action === 'fill')).toBe(true);
  });

  it('detects SaaS and content sites based on content and structure signals', () => {
    const saasPages: PageInventoryItem[] = [
      {
        urlPath: '/dashboard',
        title: 'Team Dashboard',
        elements: [
          { role: 'link', name: 'Billing & Invoices', selector: 'a[href="/billing"]' },
          { role: 'button', name: 'Upgrade Plan', selector: 'button.upgrade' },
        ],
      },
    ];
    expect(detectSiteType(saasPages, 'https://cloud-app.io/dashboard')).toBe('SaaS');

    const contentPages: PageInventoryItem[] = [
      {
        urlPath: '/blog/first-post',
        title: 'Company Blog Articles & News',
        elements: [],
      },
      {
        urlPath: '/guides/getting-started',
        title: 'Documentation Guide',
        elements: [],
      },
    ];
    expect(detectSiteType(contentPages, 'https://news-docs.org')).toBe('content');
  });

  it('synthesizes 3-5 journeys with reasons when forms and multiple pages exist', () => {
    const pages: PageInventoryItem[] = [
      { urlPath: '/', title: 'Home', elements: [] },
      { urlPath: '/contact', title: 'Contact Us', elements: [] },
      { urlPath: '/pricing', title: 'Pricing', elements: [] },
    ];

    const spiderResult: SpiderResult = {
      pages,
      forms: [
        {
          id: 'contact-form',
          name: 'Contact',
          urlPath: '/contact',
          selector: 'form#contact',
          submitButtonSelector: 'button[type="submit"]',
          inputs: [
            { type: 'text', name: 'name', selector: 'input[name="name"]', label: 'Full Name' },
            { type: 'email', name: 'email', selector: 'input[name="email"]', label: 'Email Address' },
          ],
        },
        {
          id: 'newsletter-form',
          name: 'Newsletter',
          urlPath: '/',
          selector: 'form#newsletter',
          submitButtonSelector: 'button#sub',
          inputs: [
            { type: 'email', name: 'sub_email', selector: 'input#sub_email', label: 'Newsletter Email' },
          ],
        },
      ],
      routes: ['/', '/contact', '/pricing'],
      buttons: [],
      anchors: [],
    };

    const journeys = generateFallbackJourneys('other', spiderResult);
    expect(journeys.length).toBeGreaterThanOrEqual(3);
    expect(journeys.length).toBeLessThanOrEqual(5);

    for (const journey of journeys) {
      expect(journey.name).toBeTruthy();
      expect(journey.description).toBeTruthy();
      expect(journey.description.length).toBeGreaterThan(10);
      expect(journey.steps.length).toBeGreaterThanOrEqual(1);
    }
  });
});
