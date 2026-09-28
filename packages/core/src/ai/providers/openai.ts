import type { AIProvider } from '../ai-provider.js';
import type { AIMessage, AICompletionOptions, AIProviderType } from '@qa/types';

export class OpenAIProvider implements AIProvider {
  readonly providerType: AIProviderType;
  private apiKey: string;
  private baseUrl: string;

  private defaultModel?: string;

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1', defaultModel?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.providerType = baseUrl.includes('openrouter') ? 'openrouter' : 'openai';
    this.defaultModel = defaultModel;
  }

  async generateText(messages: AIMessage[], options: AICompletionOptions = {}): Promise<string> {
    const formattedMessages = messages.map((m) => {
      if (m.images && m.images.length > 0) {
        const contentParts: any[] = [{ type: 'text', text: m.content }];
        for (const img of m.images) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: img },
          });
        }
        return { role: m.role, content: contentParts };
      }
      return { role: m.role, content: m.content };
    });

    const body: Record<string, any> = {
      model: options.model || this.defaultModel || (this.providerType === 'openrouter' ? 'anthropic/claude-sonnet-5' : 'gpt-4o'),
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens || 4096,
      messages: formattedMessages,
    };

    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI/OpenRouter API error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }
}
