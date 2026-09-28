import type { AIProvider } from '../ai-provider.js';
import type { AIMessage, AICompletionOptions, AIProviderType } from '@qa/types';

export class AnthropicProvider implements AIProvider {
  readonly providerType: AIProviderType = 'anthropic';
  private apiKey: string;
  private baseUrl: string;

  private defaultModel?: string;

  constructor(apiKey: string, baseUrl = 'https://api.anthropic.com/v1', defaultModel?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async generateText(messages: AIMessage[], options: AICompletionOptions = {}): Promise<string> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const formattedMessages = nonSystemMessages.map((m) => {
      if (m.images && m.images.length > 0) {
        const contentBlocks: any[] = [{ type: 'text', text: m.content }];
        for (const img of m.images) {
          // Extract base64 and media type
          const match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
          if (match) {
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: match[1],
                data: match[2],
              },
            });
          }
        }
        return { role: m.role, content: contentBlocks };
      }
      return { role: m.role, content: m.content };
    });

    const body: Record<string, any> = {
      model: options.model || this.defaultModel || 'claude-sonnet-5',
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.2,
      messages: formattedMessages,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    const textBlock = data.content?.find((c: any) => c.type === 'text');
    return textBlock?.text || '';
  }
}
