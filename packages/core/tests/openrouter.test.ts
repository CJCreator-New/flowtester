import { describe, it, expect } from 'vitest';
import { OpenRouterClient, OpenRouterAuthError, pickRecommendedModel } from '../src/ai/openrouter.js';

const GOOD_KEY = 'sk-or-v1-good';

function fakeOpenRouter(models: unknown[], opts: { keyStatus?: number } = {}) {
  const calls: Array<{ url: string; auth?: string }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    calls.push({ url, auth });
    if (url.endsWith('/key')) {
      const status = auth === `Bearer ${GOOD_KEY}` ? opts.keyStatus ?? 200 : 401;
      return new Response(JSON.stringify(status === 200 ? { data: {} } : { error: { message: 'User not found.' } }), { status });
    }
    if (url.endsWith('/models')) return new Response(JSON.stringify({ data: models }));
    return new Response('', { status: 404 });
  }) as typeof fetch;
  return { client: new OpenRouterClient(fetchImpl), calls };
}

const model = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  context_length: 100000,
  pricing: { prompt: '0', completion: '0' },
  architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  supported_parameters: ['response_format'],
  ...extra,
});

describe('OpenRouterClient.validateKey', () => {
  it('accepts a key OpenRouter recognises', async () => {
    expect(await fakeOpenRouter([]).client.validateKey(GOOD_KEY)).toEqual({ valid: true });
  });

  it('rejects an unknown key with a readable reason instead of throwing', async () => {
    const result = await fakeOpenRouter([]).client.validateKey('sk-or-v1-revoked');
    expect(result.valid).toBe(false);
    expect(!result.valid && result.reason).toMatch(/doesn’t recognise/);
  });

  it('rejects malformed keys without calling OpenRouter', async () => {
    const { client, calls } = fakeOpenRouter([]);
    for (const key of ['', '   ', 'hello', undefined]) {
      const result = await client.validateKey(key);
      expect(result.valid).toBe(false);
    }
    expect(calls).toHaveLength(0);
  });

  it('reports an out-of-credit key', async () => {
    const result = await fakeOpenRouter([], { keyStatus: 402 }).client.validateKey(GOOD_KEY);
    expect(!result.valid && result.reason).toMatch(/out of credit/);
  });

  it('reports network failure as a reason, not an exception', async () => {
    const client = new OpenRouterClient((async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch);
    const result = await client.validateKey(GOOD_KEY);
    expect(!result.valid && result.reason).toMatch(/internet connection/);
  });
});

describe('OpenRouterClient.listFreeModels', () => {
  it('returns only free, chat-capable models, best first', async () => {
    const { client } = fakeOpenRouter([
      model('paid/model', { pricing: { prompt: '0.000001', completion: '0.000002' } }),
      model('vendor/no-json:free', { supported_parameters: [], context_length: 900000 }),
      model('vendor/big-json', { context_length: 500000 }),
      model('vendor/small-json', { context_length: 32000 }),
      model('google/lyria-3', { architecture: { input_modalities: ['text'], output_modalities: ['audio'] } }),
      model('nvidia/content-safety:free'),
      model('vendor/forced-reasoning', { reasoning: { mandatory: true }, context_length: 2000000 }),
    ]);
    const models = await client.listFreeModels(GOOD_KEY);
    expect(models.map((m) => m.id)).toEqual([
      'vendor/big-json',
      'vendor/small-json',
      'vendor/forced-reasoning',
      'vendor/no-json:free',
    ]);
    expect(pickRecommendedModel(models)).toBe('vendor/big-json');
  });

  it("prefers OpenRouter's free router when it is offered", async () => {
    const { client } = fakeOpenRouter([model('vendor/big-json', { context_length: 900000 }), model('openrouter/free')]);
    expect(pickRecommendedModel(await client.listFreeModels(GOOD_KEY))).toBe('openrouter/free');
  });

  it('returns an empty list, and no recommendation, when nothing is free', async () => {
    const { client } = fakeOpenRouter([model('paid/model', { pricing: { prompt: '1', completion: '1' } })]);
    const models = await client.listFreeModels(GOOD_KEY);
    expect(models).toEqual([]);
    expect(pickRecommendedModel(models)).toBeNull();
  });

  it('refuses to list models for a bad key, even though the list itself is public', async () => {
    await expect(fakeOpenRouter([model('a')]).client.listFreeModels('sk-or-v1-bad')).rejects.toBeInstanceOf(
      OpenRouterAuthError
    );
  });
});
