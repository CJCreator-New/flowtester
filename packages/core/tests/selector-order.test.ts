import { describe, it, expect } from 'vitest';
import type { ElementInventoryItem, TestCase } from '@qa/types';
import { pickSelector, selectorForStep, NO_STABLE_SELECTOR_REASON } from '../src/plan/selector-order.js';
import { fallbackPageTests } from '../src/plan/ai-planner.js';
import { expandValidationTestCases } from '../src/validator-expander.js';

const el = (extra: Partial<ElementInventoryItem> = {}): ElementInventoryItem => ({
  role: 'button',
  name: 'Save',
  selector: '#save',
  tagName: 'button',
  visible: true,
  enabled: true,
  ...extra,
});

describe('selector order for new generated steps', () => {
  it('prefers role, then text, then test id', () => {
    expect(pickSelector({ role: 'button', name: 'Save', text: 'Save', testId: 'save' })?.selector).toBe(
      'role=button[name="Save"]'
    );
    expect(pickSelector({ text: 'Save', testId: 'save' })?.selector).toBe('text="Save"');
    expect(pickSelector({ testId: 'save' })?.selector).toBe('[data-testid="save"]');
  });

  it('never picks CSS without a reason, and records the reason when it does', () => {
    expect(pickSelector({ css: '#save' })).toBeUndefined();
    expect(pickSelector({ css: '#save', cssReason: '  ' })).toBeUndefined();
    expect(pickSelector({ css: '#save', cssReason: 'icon-only' })).toEqual({
      selector: '#save',
      selectorReason: 'icon-only',
    });
  });

  it('skips names that would break the selector string', () => {
    expect(pickSelector({ role: 'button', name: 'Say "hi"', testId: 'hi' })?.selector).toBe('[data-testid="hi"]');
  });

  it('maps a crawled element to role form; CSS fallback carries the reason', () => {
    expect(selectorForStep('#save', el())).toEqual({ selector: 'role=button[name="Save"]' });
    expect(selectorForStep('div.x > span', el({ role: 'generic', name: '' }))).toEqual({
      selector: 'div.x > span',
      selectorReason: NO_STABLE_SELECTOR_REASON,
    });
  });

  it('leaves selectors without element facts, and role/text forms, untouched', () => {
    expect(selectorForStep('#save', undefined)).toEqual({ selector: '#save' });
    expect(selectorForStep('text="Save"', el())).toEqual({ selector: 'text="Save"' });
  });

  it('fixed-rule page tests use the preferred selector', () => {
    const safety = { isSensitive: () => false } as never;
    const tests = fallbackPageTests(
      { urlPath: '/', title: '', interactiveElementsCount: 1, formsCount: 0, elements: [el({ name: 'Filter' })] },
      safety
    );
    expect(tests[0]?.steps[0]?.selector).toBe('role=button[name="Filter"]');
  });

  it('validator-expander copies steps with their selectorReason', () => {
    const base: TestCase = {
      id: 'TC-1',
      flowId: 'f',
      name: 'n',
      role: 'visitor',
      startPage: '/',
      steps: [{ action: 'fill', selector: '#age', selectorReason: 'no label', value: '5', name: 'Age' }],
      expectations: {},
      validationRules: [{ field: 'age', selector: '#age', min: 1, expectedError: 'too low' }],
    } as TestCase;
    const out = expandValidationTestCases([base]);
    expect(out.length).toBeGreaterThan(1);
    expect(out[1]!.steps[0]!.selectorReason).toBe('no label');
  });
});
