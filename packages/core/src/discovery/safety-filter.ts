import type { SensitiveAction, AmbiguityQuestion } from '@qa/types';
import { sensitiveQuestion } from './questions.js';

export class SafetyFilter {
  private forbiddenActions: string[];

  constructor(forbiddenActions: string[] = []) {
    this.forbiddenActions = forbiddenActions.map((a) => a.toLowerCase());
  }

  isSensitive(elementText: string, selector: string, actionType?: string): SensitiveAction | null {
    const combined = `${elementText} ${selector} ${actionType || ''}`.toLowerCase();

    // 1. Check against explicit profile forbidden actions
    const normalizedCombined = combined.replace(/-/g, ' ');
    for (const forbidden of this.forbiddenActions) {
      const normalizedForbidden = forbidden.replace(/-/g, ' ');
      if (combined.includes(forbidden) || normalizedCombined.includes(normalizedForbidden)) {
        return {
          type: 'admin_setting',
          elementSelector: selector,
          elementText,
          urlPath: '',
          reason: `Matches forbidden action keyword: "${forbidden}"`,
        };
      }
    }

    // 2. Destructive Actions (deletions, purges)
    const deleteRegex = /\b(delete|remove|destroy|purge|erase|drop|truncate|cancel-account)\b/i;
    if (deleteRegex.test(combined)) {
      return {
        type: 'deletion',
        elementSelector: selector,
        elementText,
        urlPath: '',
        reason: 'Potential destructive data removal action',
      };
    }

    // 3. Payment & Billing
    const paymentRegex = /\b(pay|payment|charge|checkout|purchase|subscribe|buy-now|credit-card|invoice-pay)\b/i;
    if (paymentRegex.test(combined)) {
      return {
        type: 'payment',
        elementSelector: selector,
        elementText,
        urlPath: '',
        reason: 'Financial transaction or payment trigger',
      };
    }

    // 4. External Communications
    const commsRegex = /\b(send-email|email-blast|notify-users|broadcast|send-sms)\b/i;
    if (commsRegex.test(combined)) {
      return {
        type: 'external_communication',
        elementSelector: selector,
        elementText,
        urlPath: '',
        reason: 'External notification or messaging trigger',
      };
    }

    return null;
  }

  createAmbiguityQuestion(sensitive: SensitiveAction, index: number): AmbiguityQuestion {
    return sensitiveQuestion(sensitive, index);
  }
}
