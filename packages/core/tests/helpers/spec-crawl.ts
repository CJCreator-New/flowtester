import type { ElementInventoryItem, PageInventoryItem } from '@qa/types';
import type { SpecCrawl } from '../../src/plan/spec-plan.js';

export const el = (name: string, selector: string, role = 'button'): ElementInventoryItem => ({
  role,
  name,
  selector,
  tagName: role === 'link' ? 'a' : 'button',
  visible: true,
  enabled: true,
});

export const page = (
  urlPath: string,
  elements: ElementInventoryItem[] = [],
  reachedBy = ['visitor']
): PageInventoryItem => ({
  urlPath,
  title: urlPath,
  interactiveElementsCount: elements.length,
  formsCount: 0,
  elements,
  reachedBy,
});

export const crawlOf = (who: string, pages: PageInventoryItem[]): SpecCrawl => ({ who, result: { pages, forms: [] } });
