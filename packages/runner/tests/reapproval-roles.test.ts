import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RunnerServer } from '../src/server.js';
import { writeJsonAtomic } from '@qa/core';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Re-approval Roles (reapproval-roles.test.ts)', () => {
  const PORT = 3194;
  const baseUrl = `http://localhost:${PORT}`;
  let tmpDir: string;
  let runner: RunnerServer;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reapproval-roles-test-'));
  });

  afterEach(async () => {
    if (runner) await runner.stop().catch(() => {});
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('handles partial roles reapproval with 409 ERR_SIGN_IN_REQUIRED and needsSignInDetails, ignores unknown roles', async () => {
    const dataDir = path.join(tmpDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });
    const planFile = path.join(dataDir, '.qa-plan.json');

    // Simulate stored plan on disk after restart (passwords missing)
    const storedPlan = {
      schemaVersion: 1,
      status: 'awaiting-review',
      plan: {
        runId: 'plan-101',
        targetUrl: 'http://localhost:3050',
        discoveredAt: '2026-01-01T00:00:00.000Z',
        pages: [],
        flows: [],
        questions: [],
        // A reviewed test: an approval with nothing to run is refused (ERR_NO_TESTS).
        testCases: [
          {
            id: 'TC-1',
            flowId: 'home',
            name: 'Home page loads',
            role: 'anonymous',
            startPage: '/',
            steps: [{ action: 'wait', name: 'Wait for page load' }],
            expectations: { url: { pattern: '/*' } },
          },
        ],
      },
      context: {
        targetUrl: 'http://localhost:3050',
        productId: 'roles-test',
        runId: 'plan-101',
        signInNotSaved: ['admin', 'editor'],
        profile: {
          name: 'roles-test',
          productId: 'roles-test',
          roles: [
            {
              role: 'admin',
              username: '',
              loginPath: '/a/login',
              usernameSelector: '#admin-username',
              passwordSelector: '#admin-password',
            },
            {
              role: 'editor',
              username: '',
              loginPath: '/editor/sign-in',
            },
          ],
        },
        draft: {
          pages: [],
          flows: [],
          ambiguityQuestions: [],
        },
      },
    };
    await writeJsonAtomic(planFile, storedPlan);

    runner = new RunnerServer({
      port: PORT,
      outputDir: path.join(tmpDir, 'output'),
      dataDir,
    });
    await runner.start();

    // Verify revived into awaiting-review
    const statusRes = await fetch(`${baseUrl}/api/runner/status`);
    const status = await statusRes.json();
    expect(status.phase).toBe('awaiting-review');

    // 1. Approve with only 'admin' credential
    const partialApprove = await fetch(`${baseUrl}/api/runner/plan/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: [{ role: 'admin', username: 'admin@example.com', password: 'admin-password' }],
      }),
    });

    expect(partialApprove.status).toBe(409);
    const partialJson = await partialApprove.json();
    expect(partialJson.code).toBe('ERR_SIGN_IN_REQUIRED');
    expect(partialJson.needsSignIn).toEqual(['editor']);
    expect(partialJson.needsSignInDetails).toEqual([{ role: 'editor', loginPath: '/editor/sign-in' }]);

    // 2. Sending an unknown role named 'member' is ignored (no new role appears)
    const unknownRoleApprove = await fetch(`${baseUrl}/api/runner/plan/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: [{ role: 'member', username: 'member@example.com', password: 'member-password' }],
      }),
    });

    expect(unknownRoleApprove.status).toBe(409);
    const unknownJson = await unknownRoleApprove.json();
    expect(unknownJson.code).toBe('ERR_SIGN_IN_REQUIRED');
    // Still needs editor (admin was already supplied in step 1, editor is still missing, member was ignored)
    expect(unknownJson.needsSignIn).toEqual(['editor']);

    // 3. Now send editor credentials to complete approval
    const fullApprove = await fetch(`${baseUrl}/api/runner/plan/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: [{ role: 'editor', username: 'editor@example.com', password: 'editor-password' }],
      }),
    });

    expect(fullApprove.status).toBe(200);
    const approveJson = await fullApprove.json();
    expect(approveJson.status).toBe('approved');
    expect(approveJson.runId).toBe('plan-101');
  });

  it('a done plan is not revived by ensurePlanLoaded on server start', async () => {
    const dataDir = path.join(tmpDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });
    const planFile = path.join(dataDir, '.qa-plan.json');

    // Write a plan with status: 'done'
    const donePlan = {
      schemaVersion: 1,
      status: 'done',
      plan: {
        runId: 'plan-done-999',
        targetUrl: 'http://localhost:3050',
        discoveredAt: '2026-01-01T00:00:00.000Z',
        pages: [],
        flows: [],
        questions: [],
      },
      context: {
        targetUrl: 'http://localhost:3050',
        productId: 'done-test',
        runId: 'plan-done-999',
        draft: { pages: [] },
      },
    };
    await writeJsonAtomic(planFile, donePlan);

    runner = new RunnerServer({
      port: PORT,
      outputDir: path.join(tmpDir, 'output'),
      dataDir,
    });
    await runner.start();

    // Verify it was NOT revived: status must be idle, not awaiting-review
    const statusRes = await fetch(`${baseUrl}/api/runner/status`);
    const status = await statusRes.json();
    expect(status.phase).toBe('idle');
    expect(status.isRunning).toBe(false);

    // Plan endpoint should return 404
    const planRes = await fetch(`${baseUrl}/api/runner/plan`);
    expect(planRes.status).toBe(404);
  });
});
