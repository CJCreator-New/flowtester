import type { Page } from 'playwright';

/**
 * Overlay and cookie banner dismissal for Deterministic Spider (T-112).
 * Clicks the first visible button inside a fixed/sticky container whose accessible name
 * matches common consent/dismissal wording, only if not inside a form, and never matching risky names.
 */
export async function dismissOverlays(page: Page): Promise<boolean> {
  try {
    const candidateSelector = await page.evaluate(() => {
      const dismissPattern = /^(accept( all)?|agree|got it|ok|allow( all)?|i understand|close)$/i;
      const riskyPattern =
        /reset|delete|remove|destroy|clear|cancel|pay|purchase|buy|place order|subscribe|send|submit|finish|confirm|save|apply|upload|download|print|share|invite|deactivate/i;

      function isFixedOrSticky(el: Element): boolean {
        let curr: Element | null = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          const style = window.getComputedStyle(curr);
          if (style.position === 'fixed' || style.position === 'sticky') return true;
          curr = curr.parentElement;
        }
        return false;
      }

      const elements = Array.from(document.querySelectorAll('button, [role="button"], a[role="button"]'));
      for (const el of elements) {
        if (el.closest('form')) continue;
        if (!isFixedOrSticky(el)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;

        const name = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || '').trim();
        if (!dismissPattern.test(name)) continue;
        if (name.toLowerCase() !== 'close' && riskyPattern.test(name)) continue;

        if (el.id) return `#${CSS.escape(el.id)}`;
        el.setAttribute('data-qa-dismiss-overlay', 'true');
        return '[data-qa-dismiss-overlay="true"]';
      }
      return null;
    });

    if (candidateSelector) {
      const locator = page.locator(candidateSelector).first();
      await locator.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(100);
      return true;
    }
  } catch {
    // Overlay dismissal is best-effort and never fails the page
  } finally {
    await page
      .evaluate(() => {
        document.querySelector('[data-qa-dismiss-overlay="true"]')?.removeAttribute('data-qa-dismiss-overlay');
      })
      .catch(() => {});
  }
  return false;
}
