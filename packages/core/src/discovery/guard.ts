import type { Page, Route } from 'playwright';

const CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Makes a page safe to click around on while the Spider explores (ADR 0025): every request that would
 * change something is aborted before it leaves the browser, and any confirm/alert dialog is dismissed.
 * Returns what was blocked and seen, and a function that lifts the guard.
 */
export async function guardPage(page: Page): Promise<{
  blocked: string[];
  dialogs: string[];
  release: () => Promise<void>;
}> {
  const blocked: string[] = [];
  const dialogs: string[] = [];
  const onDialog = (d: { type(): string; dismiss(): Promise<void> }) => {
    dialogs.push(d.type());
    void d.dismiss().catch(() => undefined);
  };
  const handler = async (route: Route) => {
    const method = route.request().method().toUpperCase();
    if (CHANGING.has(method)) {
      blocked.push(method);
      await route.abort('blockedbyclient').catch(() => undefined);
      return;
    }
    await route.fallback().catch(() => undefined);
  };
  page.on('dialog', onDialog);
  await page.route('**/*', handler);
  return {
    blocked,
    dialogs,
    release: async () => {
      page.off('dialog', onDialog);
      await page.unroute('**/*', handler).catch(() => undefined);
    },
  };
}
