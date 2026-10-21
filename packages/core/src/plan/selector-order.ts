/**
 * Selector order for newly generated plan steps: role (with its accessible name, which covers labels),
 * then text, then test ID, then CSS. CSS is only used with a recorded reason (`selectorReason`).
 * Applies to NEW output only: plans already saved are never rewritten or checked at load.
 */
import type { ElementInventoryItem } from '@qa/types';

/** ARIA roles the runtime's `role=` selector engine can match by accessible name. */
const NAMED_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'tab',
  'switch',
  'menuitem',
  'option',
  'slider',
  'spinbutton',
]);

export const NO_STABLE_SELECTOR_REASON = 'no stable role, text or test id found';

export interface SelectorFacts {
  role?: string;
  name?: string;
  text?: string;
  testId?: string;
  css?: string;
  /** Why CSS is acceptable. Without it, CSS is never picked. */
  cssReason?: string;
}

export interface PickedSelector {
  selector: string;
  selectorReason?: string;
}

/** A name is usable inside `[name="..."]` when it is short, single-line and has no quote or backslash. */
function plainText(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v || v.length > 80 || /["\\\n\r]/.test(v)) return undefined;
  return v;
}

/** The best selector the facts allow, or undefined when only CSS remains and no reason was given. */
export function pickSelector(facts: SelectorFacts): PickedSelector | undefined {
  const name = plainText(facts.name);
  if (facts.role && NAMED_ROLES.has(facts.role) && name) return { selector: `role=${facts.role}[name="${name}"]` };
  const text = plainText(facts.text);
  if (text) return { selector: `text="${text}"` };
  if (facts.testId && /^[\w-]+$/.test(facts.testId)) return { selector: `[data-testid="${facts.testId}"]` };
  if (facts.css && facts.cssReason?.trim()) return { selector: facts.css, selectorReason: facts.cssReason.trim() };
  return undefined;
}

/**
 * For a step on a crawled element: the preferred selector, or the original CSS with the reason recorded.
 * No element facts (a selector from elsewhere) means the selector is left exactly as given.
 */
export function selectorForStep(
  original: string,
  element: ElementInventoryItem | undefined
): { selector: string; selectorReason?: string } {
  if (!element) return { selector: original };
  // The crawler already produced a role/text form: keep it.
  if (/^(role|text)=/.test(original)) return { selector: original };
  const picked = pickSelector({
    role: element.role,
    name: element.name,
    testId: element.testId,
    css: original,
    cssReason: NO_STABLE_SELECTOR_REASON,
  });
  return picked ?? { selector: original };
}
