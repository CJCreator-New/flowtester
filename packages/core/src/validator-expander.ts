import type { TestCase, TestCaseStep } from '@qa/types';

/**
 * Expands test cases containing validationRules into synthetic boundary & invalid test cases.
 */
export function expandValidationTestCases(testCases: TestCase[]): TestCase[] {
  const expanded: TestCase[] = [];

  for (const tc of testCases) {
    // Add base test case
    expanded.push(tc);

    if (!tc.validationRules || tc.validationRules.length === 0) {
      continue;
    }

    for (const rule of tc.validationRules) {
      const targetSelector = rule.selector || `[data-testid="${rule.field}-field"]`;

      // Helper to clone steps and replace target field value
      const createStepsWithFieldValue = (val: string): TestCaseStep[] => {
        return tc.steps.map((step) => {
          const isTarget =
            step.selector === targetSelector ||
            (step.selector && step.selector.includes(rule.field));
          if (step.action === 'fill' && isTarget) {
            return {
              ...step,
              value: val,
              name: `${step.name} (Val: "${val}")`,
            };
          }
          return { ...step };
        });
      };

      // 1. Min boundary (min - 1)
      if (typeof rule.min === 'number') {
        const boundaryVal = (rule.min - 1).toString();
        expanded.push({
          id: `${tc.id}-val-${rule.field}-min`,
          flowId: tc.flowId,
          name: `${tc.name || tc.id} [Validation: ${rule.field} min-1]`,
          role: tc.role,
          startPage: tc.startPage,
          steps: createStepsWithFieldValue(boundaryVal),
          expectations: {
            text: {
              contains: rule.expectedError,
              description: `Expected error for ${rule.field} < min (${boundaryVal})`,
            },
          },
        });
      }

      // 2. Max boundary (max + 1)
      if (typeof rule.max === 'number') {
        const boundaryVal = (rule.max + 1).toString();
        expanded.push({
          id: `${tc.id}-val-${rule.field}-max`,
          flowId: tc.flowId,
          name: `${tc.name || tc.id} [Validation: ${rule.field} max+1]`,
          role: tc.role,
          startPage: tc.startPage,
          steps: createStepsWithFieldValue(boundaryVal),
          expectations: {
            text: {
              contains: rule.expectedError,
              description: `Expected error for ${rule.field} > max (${boundaryVal})`,
            },
          },
        });
      }

      // 3. Empty input
      expanded.push({
        id: `${tc.id}-val-${rule.field}-empty`,
        flowId: tc.flowId,
        name: `${tc.name || tc.id} [Validation: ${rule.field} empty]`,
        role: tc.role,
        startPage: tc.startPage,
        steps: createStepsWithFieldValue(''),
        expectations: {
          text: {
            contains: rule.expectedError,
            description: `Expected error for empty ${rule.field}`,
          },
        },
      });
    }
  }

  return expanded;
}
