import { describe, it, expect } from 'vitest';
import { DEFAULT_TEST_CAP } from '../src/plan.js';
import type { PlanPageTest, TestCaseStep, PageInventoryItem } from '../src/index.js';

describe('Intent and opening-step types', () => {
  it('Test cap defaults to 2000', () => {
    expect(DEFAULT_TEST_CAP).toBe(2000);
  });
  it('opening steps and CRUD facts type-check on their carriers', () => {
    const open: TestCaseStep = { action: 'click', selector: '[role=tab]', name: 'Open tab', opening: true };
    const t: Partial<PlanPageTest> = { openingSteps: [open] };
    const p: Pick<PageInventoryItem, 'crud'> = { crud: { list: true, add: 'Add', editFromRow: true, deleteConfirm: false } };
    expect(t.openingSteps?.[0].opening).toBe(true);
    expect(p.crud?.deleteConfirm).toBe(false);
  });
});
