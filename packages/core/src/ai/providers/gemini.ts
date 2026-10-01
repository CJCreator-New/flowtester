import type { AIProvider } from '../ai-provider.js';
import { DEFAULT_MODELS } from '../default-models.js';
import type { AICompletion, AIMessage, AICompletionOptions, AIProviderType } from '@qa/types';

export class GeminiProvider implements AIProvider {
  readonly providerType: AIProviderType = 'gemini';
  private apiKey: string;
  private defaultModel?: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async generateText(messages: AIMessage[], options: AICompletionOptions = {}): Promise<string> {
    return (await this.complete(messages, options)).text;
  }

  async complete(messages: AIMessage[], options: AICompletionOptions = {}): Promise<AICompletion> {
    const model = options.model || this.defaultModel || DEFAULT_MODELS.gemini;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const contents = messages.map((m) => {
      const parts: any[] = [{ text: m.content }];
      if (m.images && m.images.length > 0) {
        for (const img of m.images) {
          const match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        }
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens || 4096,
      },
    };

    if (options.responseFormat === 'json') {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    const candidate = data.candidates?.[0];
    const usage = data.usageMetadata;
    return {
      text: candidate?.content?.parts?.[0]?.text || '',
      finishReason: candidate?.finishReason === 'MAX_TOKENS' ? 'length' : candidate?.finishReason,
      model,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
            reasoningTokens: usage.thoughtsTokenCount ?? undefined,
          }
        : undefined,
    };
  }
}
