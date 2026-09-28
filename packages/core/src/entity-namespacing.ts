import type { TestCaseStep } from '@qa/types';

export class EntityNamespacer {
  /**
   * Generates a unique, collision-resistant identifier prefixed with worker ID.
   */
  static generateName(baseName: string, workerId: string | number): string {
    const cleanBase = baseName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${cleanBase}_w${workerId}_${randomSuffix}`;
  }

  /**
   * Replaces variables like `{{entityName}}` or `{{unique_id}}` inside test step values.
   */
  static injectStepValues(step: TestCaseStep, workerId: string | number): TestCaseStep {
    if (!step.value) {
      return step;
    }

    let modifiedValue = step.value;
    if (modifiedValue.includes('{{unique}}') || modifiedValue.includes('{{entityName}}')) {
      const uniqueToken = `w${workerId}_${Math.random().toString(36).substring(2, 7)}`;
      modifiedValue = modifiedValue
        .replace(/\{\{unique\}\}/g, uniqueToken)
        .replace(/\{\{entityName\}\}/g, `entity_${uniqueToken}`);
    }

    return {
      ...step,
      value: modifiedValue,
    };
  }
}
