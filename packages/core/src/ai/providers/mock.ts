import type { AIProvider } from '../ai-provider.js';
import type { AIMessage, AICompletionOptions, AIProviderType } from '@qa/types';

export class MockAIProvider implements AIProvider {
  readonly providerType: AIProviderType = 'mock';

  private customResponses: Map<string, string> = new Map();

  setMockResponse(promptSubstring: string, response: string): void {
    this.customResponses.set(promptSubstring, response);
  }

  async generateText(messages: AIMessage[], _options?: AICompletionOptions): Promise<string> {
    const fullText = messages.map((m) => m.content).join(' ');

    for (const [key, val] of this.customResponses.entries()) {
      if (fullText.includes(key)) {
        return val;
      }
    }

    // Default mock response when analyzing pages or generating flows
    if (
      fullText.includes('discover_flows') ||
      fullText.includes('discovered_flows') ||
      fullText.includes('synthesizing application flows') ||
      fullText.includes('DiscoveredFlow')
    ) {
      return JSON.stringify({
        flows: [
          {
            id: 'FLOW-001',
            name: 'Create Invoice',
            role: 'manager',
            description: 'Navigate to invoice form and submit valid details',
            startPage: '/invoices/new',
            steps: [
              { action: 'fill', selector: '[data-testid="customer-field"]', value: 'Acme Corp', name: 'Fill Customer' },
              { action: 'fill', selector: '[data-testid="amount-field"]', value: '1200', name: 'Fill Amount' },
              { action: 'click', selector: '[data-testid="save-btn"]', name: 'Submit Invoice' },
            ],
            inferredRules: ['Amount must be a positive integer', 'Customer is required'],
            candidateExpectations: {
              url: { pattern: '/invoices/*' },
              text: { contains: 'Invoice created successfully' },
            },
          },
        ],
        inferredRules: [
          'Invoices require authenticated manager role',
          'Dashboard tracks system telemetry',
        ],
      });
    }

    return 'Mock AI Provider analysis complete.';
  }
}
