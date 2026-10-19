import type { AspectType, ReleaseReport } from '@qa/types';

export interface NotCheckedItem {
  name: string;
  /** Why it did not run, in plain words. */
  reason: string;
}

export interface NotChecked {
  /** Tests that were planned but skipped or blocked. */
  tests: NotCheckedItem[];
  /** Areas nothing in this run looked at. */
  areas: AspectType[];
  /** True when there is nothing to list. */
  empty: boolean;
}

/** What this check-up did not look at (ADR 0018): skipped or blocked tests and areas with no checks. Safe on old reports. */
export function notChecked(report: Pick<ReleaseReport, 'results' | 'traceability' | 'grades'>): NotChecked {
  const names = new Map((report.traceability ?? []).map((t) => [t.testCaseId, t.name || t.description]));
  const tests = (report.results ?? [])
    .filter((r) => r.status === 'Skipped' || r.status === 'Blocked')
    .map((r) => ({
      name: names.get(r.testCaseId) || r.testCaseId,
      reason: r.skipReason || (r.status === 'Blocked' ? 'An earlier step failed, so it could not run.' : 'Skipped.'),
    }));
  const areas = (Object.entries(report.grades?.aspects ?? {}) as Array<[AspectType, { checked?: boolean }]>)
    .filter(([, a]) => a && a.checked === false)
    .map(([name]) => name);
  return { tests, areas, empty: tests.length === 0 && areas.length === 0 };
}
