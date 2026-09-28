import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeyResolver, MockAIProvider, createAIProvider } from '../src/ai/ai-provider.js';
import type { SecretStore } from '../src/ai/key-resolver.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('AIProvider and KeyResolver', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-ai-keys-test');

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should resolve key from explicit parameter first', async () => {
    const resolver = new KeyResolver(tmpDir);
    const resolved = await resolver.resolveKey('openai', 'sk-explicit-test-key');

    expect(resolved).not.toBeNull();
    expect(resolved?.provider).toBe('openai');
    expect(resolved?.apiKey).toBe('sk-explicit-test-key');
    expect(resolved?.source).toBe('cli');
  });

  class MemoryStore implements SecretStore {
    secrets = new Map<string, string>();
    async get(account: string) {
      return this.secrets.get(account) ?? null;
    }
    async set(account: string, secret: string) {
      this.secrets.set(account, secret);
    }
  }

  it('should save a BYOK key to the keychain, not to disk', async () => {
    const store = new MemoryStore();
    const resolver = new KeyResolver(tmpDir, store);
    expect(await resolver.saveByokKey('anthropic', 'sk-ant-test-1234')).toBe('keychain');

    const resolved = await resolver.resolveKey('anthropic');
    expect(resolved).toMatchObject({ provider: 'anthropic', apiKey: 'sk-ant-test-1234', source: 'keychain' });
    await expect(fs.access(path.join(tmpDir, '.qa-keys.json'))).rejects.toThrow();
  });

  it('should fall back to the local key file when no keychain is available', async () => {
    const brokenStore: SecretStore = {
      get: async () => null,
      set: async () => {
        throw new Error('no secret service');
      },
    };
    const resolver = new KeyResolver(tmpDir, brokenStore);
    expect(await resolver.saveByokKey('openai', 'sk-file-key')).toBe('byok_file');

    const resolved = await resolver.resolveKey('openai');
    expect(resolved).toMatchObject({ apiKey: 'sk-file-key', source: 'byok_file' });
  });

  it('MockAIProvider should produce synthesized flow responses', async () => {
    const provider = new MockAIProvider();
    const result = await provider.generateText([
      { role: 'user', content: 'Please discover_flows for the application' },
    ]);

    expect(result).toContain('FLOW-001');
    const parsed = JSON.parse(result);
    expect(parsed.flows).toHaveLength(1);
    expect(parsed.flows[0].name).toBe('Create Invoice');
  });

  it('createAIProvider should instantiate corresponding providers', () => {
    const mock = createAIProvider('mock', 'none');
    expect(mock.providerType).toBe('mock');

    const claude = createAIProvider('anthropic', 'test-key');
    expect(claude.providerType).toBe('anthropic');

    const oai = createAIProvider('openai', 'test-key');
    expect(oai.providerType).toBe('openai');
  });
});
