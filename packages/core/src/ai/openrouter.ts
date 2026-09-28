/**
 * OpenRouter account helpers used by the non-technical wizard: key validation and
 * free-tier model discovery. Keys are only ever sent to OpenRouter; nothing here logs them.
 */

const OPENROUTER_API = 'https://openrouter.ai/api/v1';
const REQUEST_TIMEOUT_MS = 8000;

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  supportsJsonOutput: boolean;
}

export type KeyValidation = { valid: true } | { valid: false; reason: string };

export class OpenRouterAuthError extends Error {}

interface RawModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: string[];
  reasoning?: { mandatory?: boolean };
}

/** OpenRouter's own router across whatever free models are currently up; most resilient default. */
const PREFERRED_MODELS = ['openrouter/free'];

/** Classifier / moderation models are priced at zero but cannot write test plans. */
const NON_CHAT_PATTERN = /content-safety|guard|moderation|embed/i;

export class OpenRouterClient {
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async validateKey(apiKey: string | undefined): Promise<KeyValidation> {
    const key = apiKey?.trim();
    if (!key) return { valid: false, reason: 'Please paste your OpenRouter key.' };
    if (!key.startsWith('sk-or-')) {
      return { valid: false, reason: 'That doesn’t look like an OpenRouter key. They start with “sk-or-”.' };
    }

    let res: Response;
    try {
      res = await this.fetchImpl(`${OPENROUTER_API}/key`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { valid: false, reason: 'Couldn’t reach OpenRouter to check the key. Check your internet connection.' };
    }

    if (res.ok) return { valid: true };
    if (res.status === 401 || res.status === 403) {
      return { valid: false, reason: 'OpenRouter doesn’t recognise this key. It may have been deleted, or part of it is missing.' };
    }
    if (res.status === 402) {
      return { valid: false, reason: 'This key is out of credit.' };
    }
    return { valid: false, reason: `OpenRouter couldn’t check the key right now (error ${res.status}). Try again in a minute.` };
  }

  /**
   * Returns chat-capable models priced at zero. Throws OpenRouterAuthError when the key is rejected,
   * because the model list itself is public and would otherwise hide a bad key.
   */
  async listFreeModels(apiKey: string | undefined): Promise<OpenRouterModel[]> {
    const validation = await this.validateKey(apiKey);
    if (!validation.valid) throw new OpenRouterAuthError(validation.reason);

    const res = await this.fetchImpl(`${OPENROUTER_API}/models`, {
      headers: { Authorization: `Bearer ${apiKey!.trim()}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`OpenRouter model list failed: HTTP ${res.status}`);
    const { data } = (await res.json()) as { data?: RawModel[] };

    return (data ?? [])
      .filter((m) => isFree(m) && isChatModel(m))
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length ?? 0,
        supportsJsonOutput: (m.supported_parameters ?? []).includes('response_format'),
        reasoningMandatory: !!m.reasoning?.mandatory,
      }))
      .sort((a, b) => rank(b) - rank(a) || b.contextLength - a.contextLength)
      .map(({ reasoningMandatory: _r, ...model }) => model);
  }
}

function isFree(m: RawModel): boolean {
  return (m.pricing?.prompt === '0' && m.pricing?.completion === '0') || m.id.endsWith(':free');
}

function isChatModel(m: RawModel): boolean {
  const input = m.architecture?.input_modalities ?? ['text'];
  const output = m.architecture?.output_modalities ?? ['text'];
  return input.includes('text') && output.includes('text') && !NON_CHAT_PATTERN.test(`${m.id} ${m.name ?? ''}`);
}

/** Higher is better: a known-good router first, then JSON-mode support (discovery asks for JSON), then no forced reasoning (faster). */
function rank(m: { id: string; supportsJsonOutput: boolean; reasoningMandatory: boolean }): number {
  if (PREFERRED_MODELS.includes(m.id)) return 100;
  return (m.supportsJsonOutput ? 2 : 0) + (m.reasoningMandatory ? 0 : 1);
}

/** The list is already sorted best-first. */
export function pickRecommendedModel(models: OpenRouterModel[]): string | null {
  return models[0]?.id ?? null;
}
