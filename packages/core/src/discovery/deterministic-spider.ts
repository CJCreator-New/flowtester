import type { BrowserContext, Page } from 'playwright';
import type { PageInventoryItem, SensitiveAction, AmbiguityQuestion } from '@qa/types';
import { SafetyFilter } from './safety-filter.js';

export interface FormInputInfo {
  name: string;
  type: string;
  selector: string;
  defaultValue?: string;
  required?: boolean;
}

export interface DiscoveredFormInfo {
  id?: string;
  action: string;
  method: string;
  urlPath: string;
  inputs: FormInputInfo[];
  submitButtonSelector?: string;
}

export interface SpiderResult {
  pages: PageInventoryItem[];
  forms: DiscoveredFormInfo[];
  sensitiveActions: SensitiveAction[];
  ambiguityQuestions: AmbiguityQuestion[];
}

export class DeterministicSpider {
  private safetyFilter: SafetyFilter;
  private maxPages: number;

  constructor(forbiddenActions: string[] = [], maxPages = 30) {
    this.safetyFilter = new SafetyFilter(forbiddenActions);
    this.maxPages = maxPages;
  }

  async crawl(context: BrowserContext, targetUrl: string): Promise<SpiderResult> {
    const baseUrlObj = new URL(targetUrl);
    const targetHost = baseUrlObj.host;

    const visited = new Set<string>();
    const queue: string[] = [baseUrlObj.pathname || '/'];

    const pages: PageInventoryItem[] = [];
    const forms: DiscoveredFormInfo[] = [];
    const sensitiveActions: SensitiveAction[] = [];
    const ambiguityQuestions: AmbiguityQuestion[] = [];
    let questionCounter = 1;

    const page = await context.newPage();

    while (queue.length > 0 && visited.size < this.maxPages) {
      const currentPath = queue.shift()!;
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);

      const fullUrl = new URL(currentPath, targetUrl).toString();

      try {
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const title = await page.title().catch(() => currentPath);

        // 1. Discover links
        const hrefs = await page.$$eval('a[href]', (anchors) =>
          anchors.map((a) => a.getAttribute('href') || '')
        );

        for (const href of hrefs) {
          try {
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
            const resolved = new URL(href, fullUrl);
            if (resolved.host === targetHost && !visited.has(resolved.pathname)) {
              queue.push(resolved.pathname);
            }
          } catch {
            // invalid URL ignored
          }
        }

        // 2. Discover interactive elements and check safety
        const elements = await page.$$eval(
          'button, a, input[type="submit"], input[type="button"]',
          (els) =>
            els.map((el) => {
              const text = el.textContent?.trim() || '';
              const testId = el.getAttribute('data-testid');
              const selector = testId ? `[data-testid="${testId}"]` : el.tagName.toLowerCase();
              return { text, selector, tagName: el.tagName.toLowerCase() };
            })
        );

        for (const el of elements) {
          const sensitive = this.safetyFilter.isSensitive(el.text, el.selector);
          if (sensitive) {
            sensitive.urlPath = currentPath;
            sensitiveActions.push(sensitive);
            const q = this.safetyFilter.createAmbiguityQuestion(sensitive, questionCounter++);
            ambiguityQuestions.push(q);
          }
        }

        // 3. Discover Forms
        const pageForms = await page.$$eval('form', (formEls) =>
          formEls.map((f) => {
            const action = f.getAttribute('action') || '';
            const method = (f.getAttribute('method') || 'GET').toUpperCase();
            const inputs = Array.from(f.querySelectorAll('input, select, textarea')).map((inp) => {
              const name = inp.getAttribute('name') || '';
              const type = inp.getAttribute('type') || inp.tagName.toLowerCase();
              const testId = inp.getAttribute('data-testid');
              const id = inp.getAttribute('id');
              const selector = testId
                ? `[data-testid="${testId}"]`
                : id
                ? `#${id}`
                : `[name="${name}"]`;
              const required = inp.hasAttribute('required');
              return { name, type, selector, required };
            });

            const submitBtn = f.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
            let submitSelector: string | undefined;
            if (submitBtn) {
              const sTestId = submitBtn.getAttribute('data-testid');
              const sId = submitBtn.getAttribute('id');
              submitSelector = sTestId
                ? `[data-testid="${sTestId}"]`
                : sId
                ? `#${sId}`
                : submitBtn.tagName.toLowerCase() === 'input'
                ? 'input[type="submit"]'
                : 'button[type="submit"]';
            }

            return { action, method, inputs, submitButtonSelector: submitSelector };
          })
        );

        for (const f of pageForms) {
          forms.push({
            action: f.action,
            method: f.method,
            urlPath: currentPath,
            inputs: f.inputs,
            submitButtonSelector: f.submitButtonSelector,
          });
        }

        pages.push({
          urlPath: currentPath,
          title,
          interactiveElementsCount: elements.length,
          formsCount: pageForms.length,
        });
      } catch {
        // Skip page on navigation failure
      }
    }

    await page.close();

    return {
      pages,
      forms,
      sensitiveActions,
      ambiguityQuestions,
    };
  }
}
