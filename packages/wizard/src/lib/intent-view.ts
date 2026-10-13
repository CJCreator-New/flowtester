import type { DiscoveredFlow, PlanIntent, PlanPageTest, ReviewPlan, TestCaseStep } from '@qa/types';
import { INTENTS, intentOf } from '@qa/types/src/intent.js';
import { stepToSentence } from './plan-translate.js';

/** The Intents in the words Plan Review uses. */
export const INTENT_LABELS: Record<PlanIntent, string> = {
  works: 'Works',
  rejects: 'Rejects',
  limits: 'Limits',
  denied: 'Denied',
};

/** What each Intent expects, for the chip and switch tooltips. */
export const INTENT_HINTS: Record<PlanIntent, string> = {
  works: 'Valid input succeeds',
  rejects: 'Bad or missing input shows an error',
  limits: 'Extreme values such as very long text or zero are handled',
  denied: 'The role is blocked',
};

/** The Intent an item shows under. Items planned without one are Works. */
export function intentKey(item: { intent?: PlanIntent; kind?: string }): PlanIntent {
  return intentOf(item) ?? 'works';
}

/** The items with the chosen Intent; all of them when none is chosen. */
export function filterByIntent<T extends { intent?: PlanIntent; kind?: string }>(
  items: T[],
  chosen: PlanIntent | null | undefined
): T[] {
  return chosen ? items.filter((i) => intentKey(i) === chosen) : items;
}

export interface IntentCount {
  intent: PlanIntent;
  label: string;
  items: number;
  tests: number;
}

/** Plan Items and Tests per Intent: from the approval summary, or counted from the items when it has none. */
export function intentCounts(plan: Pick<ReviewPlan, 'summary' | 'planPages' | 'flows'>): IntentCount[] {
  const fromSummary = plan.summary?.intents;
  return INTENTS.map((intent) => {
    if (fromSummary?.[intent]) return { intent, label: INTENT_LABELS[intent], ...fromSummary[intent] };
    const pageTests: Array<{ intent?: PlanIntent; kind?: string }> = (plan.planPages ?? []).flatMap((p) => p.tests);
    const items = [...pageTests, ...(plan.flows ?? [])].filter((i) => intentOf(i) === intent).length;
    return { intent, label: INTENT_LABELS[intent], items, tests: 0 };
  });
}

/** The Intents that appear on the Plan at all, with their counts. */
export function intentsInPlan(plan: Pick<ReviewPlan, 'summary' | 'planPages' | 'flows'>): IntentCount[] {
  return intentCounts(plan).filter((c) => c.items > 0);
}

/** "Works 12 Tests · Rejects 8 Tests": the approval summary line per Intent. */
export function intentSummaryLine(plan: Pick<ReviewPlan, 'summary' | 'planPages' | 'flows'>): string | null {
  const counts = intentCounts(plan).filter((c) => c.items > 0 || c.tests > 0);
  if (counts.length === 0) return null;
  return counts.map((c) => `${c.label} ${c.tests} ${c.tests === 1 ? 'Test' : 'Tests'}`).join(' · ');
}

/** The over-cap line, or null when the Plan is within the Test cap. */
export function overCapLine(plan: Pick<ReviewPlan, 'summary' | 'testCap'>, defaultCap = 2000): string | null {
  const n = plan.summary?.overCap ?? 0;
  if (n <= 0) return null;
  const cap = plan.testCap ?? defaultCap;
  return `${n} ${n === 1 ? 'Test is' : 'Tests are'} over the Test cap of ${cap} and won’t run. Raise the Test cap to run them.`;
}

/** The Intents with their switch on or off, after one is flipped. Stays in Intent order. */
export function withIntentSwitched(off: PlanIntent[], intent: PlanIntent, switchOff: boolean): PlanIntent[] {
  const set = new Set(off);
  if (switchOff) set.add(intent);
  else set.delete(intent);
  return INTENTS.filter((i) => set.has(i));
}

/** "Opens by: Click “Edit”, then …" under an item that needs a tab, drawer or dialog opened first; null when it doesn't. */
export function openingLine(test: { openingSteps?: TestCaseStep[] }): string | null {
  const steps = test.openingSteps ?? [];
  if (steps.length === 0) return null;
  return `Opens by: ${steps.map(stepToSentence).join(', then ')}`;
}

/** A reason from the Plan's "Won't run" list in the words the page uses (Test Copy is a defined term). */
export function wontRunReason(reason: string): string {
  return reason.replace(/^Needs a test copy/, 'Needs a Test Copy');
}

/** Whether a journey or form item is switched off by a switched-off Intent. */
export function offByIntent(item: PlanPageTest | DiscoveredFlow, off: PlanIntent[]): boolean {
  return off.includes(intentKey(item));
}
