import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { RunnerServer } from '../src/server.js';

describe('Spec Drift Override Endpoints (FR-2.6, FR-9.4.1)', () => {
  const PORT = 3899;
  const baseUrl = `http://localhost:${PORT}`;
  const tmpDir = path.join(os.tmpdir(), `qa-spec-override-test-${Date.now()}`);
  let server: RunnerServer;

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    server = new RunnerServer({
      port: PORT,
      outputDir: path.join(tmpDir, 'output'),
      dataDir: tmpDir,
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('records, updates and lists spec overrides in dataDir', async () => {
    // 1. Initial list is empty
    const list1 = await (await fetch(`${baseUrl}/api/runner/spec-overrides`)).json();
    expect(list1).toEqual([]);

    // 2. Record new spec override
    const postRes = await fetch(`${baseUrl}/api/runner/spec-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirementId: 'REQ-LOGIN-1',
        reason: 'Button text changed in live app',
        status: 'updated',
        newSelector: '#login-button-v2',
      }),
    });
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.ok).toBe(true);
    expect(postBody.override.requirementId).toBe('REQ-LOGIN-1');
    expect(postBody.override.newSelector).toBe('#login-button-v2');

    // 3. List contains the override
    const list2 = await (await fetch(`${baseUrl}/api/runner/spec-overrides`)).json();
    expect(list2).toHaveLength(1);
    expect(list2[0].requirementId).toBe('REQ-LOGIN-1');
    expect(list2[0].newSelector).toBe('#login-button-v2');

    // 4. Updating same requirement updates in-place
    const updateRes = await fetch(`${baseUrl}/api/runner/spec-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirementId: 'REQ-LOGIN-1',
        reason: 'Button retired',
        status: 'retired',
      }),
    });
    expect(updateRes.status).toBe(200);

    const list3 = await (await fetch(`${baseUrl}/api/runner/spec-overrides`)).json();
    expect(list3).toHaveLength(1);
    expect(list3[0].status).toBe('retired');
    expect(list3[0].reason).toBe('Button retired');
  });
});
