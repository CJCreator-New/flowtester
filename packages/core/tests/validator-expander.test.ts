import { describe, it, expect } from 'vitest';
import { expandValidationTestCases } from '../src/validator-expander.js';
import type { TestCase } from '@qa/types';

describe('ValidatorExpander', () => {
  it('should pass through test cases without validationRules unchanged', () => {
    const testCases: TestCase[] = [
      {
        id: 'TC-001',
        flowId: 'test-flow',
        role: 'member',
        startPage: '/home',
        steps: [{ action: 'wait', name: 'Wait' }],
        expectations: { url: { pattern: '/*' } },
      },
    ];

    const result = expandValidationTestCases(testCases);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('TC-001');
  });

  it('should expand min, max, and empty validation rules into synthetic test cases', () => {
    const testCases: TestCase[] = [
      {
        id: 'TC-INVOICE',
        flowId: 'create-invoice',
        role: 'manager',
        startPage: '/invoices/new',
        steps: [
          { action: 'fill', selector: '[data-testid="amount-field"]', value: '500', name: 'Fill Amount' },
          { action: 'click', selector: '[data-testid="save-btn"]', name: 'Submit' },
        ],
        expectations: { url: { pattern: '/invoices/*' } },
        validationRules: [
          {
            field: 'amount',
            selector: '[data-testid="amount-field"]',
            min: 1,
            max: 1000,
            expectedError: 'Amount must be between 1 and 1000',
          },
        ],
      },
    ];

    const result = expandValidationTestCases(testCases);
    // 1 base + 1 min boundary + 1 max boundary + 1 empty = 4 test cases
    expect(result).toHaveLength(4);

    const minCase = result.find((tc) => tc.id === 'TC-INVOICE-val-amount-min');
    expect(minCase).toBeDefined();
    expect(minCase?.steps[0].value).toBe('0'); // 1 - 1 = 0
    expect(minCase?.expectations.text?.contains).toBe('Amount must be between 1 and 1000');
    // Regression guard: a negative/validation test case must NOT inherit the happy-path
    // flow's URL assertion (e.g. "expect navigation to /invoices/success") — a correctly
    // rejected submission stays on the same page, so keeping the URL check here would
    // produce a false blocker.
    expect(minCase?.expectations.url).toBeUndefined();

    const emptyCaseUrlCheck = result.find((tc) => tc.id === 'TC-INVOICE-val-amount-empty');
    expect(emptyCaseUrlCheck?.expectations.url).toBeUndefined();

    const maxCase = result.find((tc) => tc.id === 'TC-INVOICE-val-amount-max');
    expect(maxCase).toBeDefined();
    expect(maxCase?.steps[0].value).toBe('1001'); // 1000 + 1 = 1001

    const emptyCase = result.find((tc) => tc.id === 'TC-INVOICE-val-amount-empty');
    expect(emptyCase).toBeDefined();
    expect(emptyCase?.steps[0].value).toBe('');
  });
});
