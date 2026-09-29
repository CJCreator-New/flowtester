import type { DiscoveredFlow } from './index.js';

/** The path part of an address, or the value itself when it isn't one. */
function pathOnly(value: string): string {
  try {
    return new URL(value, 'http://placeholder').pathname;
  } catch {
    return value;
  }
}

/**
 * The pages a journey passes through, in order: where it starts and every page it opens. (Where a
 * click leads isn't known before the run, so those pages show up once the run visits them.)
 */
export function journeyPages(flow: Pick<DiscoveredFlow, 'startPage' | 'steps'>): string[] {
  const pages = [pathOnly(flow.startPage || '/')];
  for (const step of flow.steps || []) {
    if (step.action !== 'navigate' || !step.value) continue;
    const page = pathOnly(step.value);
    if (pages[pages.length - 1] !== page) pages.push(page);
  }
  return pages.filter((p, i) => pages.indexOf(p) === i);
}
