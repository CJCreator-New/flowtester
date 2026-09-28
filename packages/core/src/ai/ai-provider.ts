import type { AIMessage, AICompletionOptions, AIProviderType } from '@qa/types';

export interface AIProvider {
  readonly providerType: AIProviderType;
  generateText(messages: AIMessage[], options?: AICompletionOptions): Promise<string>;
}

export { KeyResolver } from './key-resolver.js';
export { MockAIProvider } from './providers/mock.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
export { GeminiProvider } from './providers/gemini.js';

import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { MockAIProvider } from './providers/mock.js';

export function createAIProvider(
  type: AIProviderType,
  apiKey: string,
  baseUrl?: string,
  defaultModel?: string
): AIProvider {
  switch (type) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, undefined, defaultModel);
    case 'openai':
    case 'openrouter':
      return new OpenAIProvider(
        apiKey,
        type === 'openrouter' ? 'https://openrouter.ai/api/v1' : baseUrl,
        defaultModel
      );
    case 'gemini':
      return new GeminiProvider(apiKey, defaultModel);
    case 'mock':
    default:
      return new MockAIProvider();
  }
}
