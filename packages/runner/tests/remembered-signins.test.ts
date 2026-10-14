import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RunnerServer } from '../src/server.js';
import { KeyResolver } from '@qa/core';
import type { SecretStore } from '@qa/core';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

class MemorySecretStore implements SecretStore {
  public data = new Map<string, string>();
  public shouldFailFor?: (key: string) => boolean;

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.shouldFailFor?.(key)) {
      throw new Error('KEYCHAIN_ACCESS_DENIED');
    }
    this.data.set(key, value);
  }
}

describe('Remembered Sign-Ins (remembered-signins.test.ts)', () => {
  const PORT = 3192;
  const baseUrl = `http://localhost:${PORT}`;
  let tmpDir: string;
  let runner: RunnerServer;
  let secretStore: MemorySecretStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remembered-signins-test-'));
    secretStore = new MemorySecretStore();
    const keyResolver = new KeyResolver(tmpDir, secretStore);
    runner = new RunnerServer({
      port: PORT,
      outputDir: path.join(tmpDir, 'output'),
      dataDir: path.join(tmpDir, 'data'),
      keyResolver,
    });
    await runner.start();
  });

  afterEach(async () => {
    await runner.stop().catch(() => {});
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('merging role A then role B preserves both roles and their selectors', async () => {
    const host = 'app.example.com';

    // 1. Remember Role A
    const resA = await fetch(`${baseUrl}/api/sites/${host}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rememberSignIns: [
          {
            role: 'admin',
            username: 'admin@example.com',
            password: 'secret-admin',
            loginPath: '/admin/login',
            usernameSelector: '#admin-user',
            passwordSelector: '#admin-pass',
            submitSelector: '#admin-btn',
            postLoginSelector: '#admin-dashboard',
            postLoginUrl: '/admin/dashboard',
          },
        ],
      }),
    });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.saved).toBe(true);
    expect(dataA.signIns).toHaveLength(1);
    expect(dataA.signIns[0].role).toBe('admin');
    expect(dataA.signIns[0].usernameSelector).toBe('#admin-user');

    // 2. Remember Role B
    const resB = await fetch(`${baseUrl}/api/sites/${host}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rememberSignIns: [
          {
            role: 'editor',
            username: 'editor@example.com',
            password: 'secret-editor',
            loginPath: '/editor/login',
            submitSelector: '#editor-submit',
          },
        ],
      }),
    });
    expect(resB.status).toBe(200);
    const dataB = await resB.json();
    expect(dataB.saved).toBe(true);
    expect(dataB.signIns).toHaveLength(2);

    const admin = dataB.signIns.find((s: any) => s.role === 'admin');
    const editor = dataB.signIns.find((s: any) => s.role === 'editor');

    expect(admin).toBeDefined();
    expect(admin.loginPath).toBe('/admin/login');
    expect(admin.usernameSelector).toBe('#admin-user');
    expect(admin.passwordSelector).toBe('#admin-pass');
    expect(admin.submitSelector).toBe('#admin-btn');
    expect(admin.postLoginSelector).toBe('#admin-dashboard');
    expect(admin.postLoginUrl).toBe('/admin/dashboard');

    expect(editor).toBeDefined();
    expect(editor.loginPath).toBe('/editor/login');
    expect(editor.submitSelector).toBe('#editor-submit');

    // 3. Verify GET /api/sites/<host> returns both sign-ins
    const getRes = await fetch(`${baseUrl}/api/sites/${host}`);
    expect(getRes.status).toBe(200);
    const siteData = await getRes.json();
    expect(siteData.signIns).toHaveLength(2);
    expect(siteData.needsPassword).toBeUndefined();
  });

  it('reports failed keychain saves in notSaved and saves other roles', async () => {
    const host = 'keys.example.com';

    // Simulate keychain failure for role 'faulty'
    secretStore.shouldFailFor = (key) => key.includes('faulty');

    const res = await fetch(`${baseUrl}/api/sites/${host}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rememberSignIns: [
          {
            role: 'reliable',
            username: 'reliable@example.com',
            password: 'pass-reliable',
          },
          {
            role: 'faulty',
            username: 'faulty@example.com',
            password: 'pass-faulty',
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.saved).toBe(true);
    expect(data.notSaved).toEqual(['faulty']);
    // 'reliable' was saved to memory and keychain
    expect(data.signIns.some((s: any) => s.role === 'reliable')).toBe(true);
  });

  it('GET /api/sites/<host> reports needsPassword for roles lacking keychain passwords', async () => {
    const host = 'nopass.example.com';

    // Save a role with password
    await fetch(`${baseUrl}/api/sites/${host}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rememberSignIns: [
          {
            role: 'user1',
            username: 'user1@example.com',
            password: 'pass1',
          },
        ],
      }),
    });

    // Delete the password from secretStore to simulate missing keychain password
    secretStore.data.clear();

    const getRes = await fetch(`${baseUrl}/api/sites/${host}`);
    expect(getRes.status).toBe(200);
    const siteData = await getRes.json();
    expect(siteData.signIns).toHaveLength(1);
    expect(siteData.needsPassword).toEqual(['user1']);
  });
});
