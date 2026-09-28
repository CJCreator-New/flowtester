import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RunnerServer } from '../src/server.js';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('RunnerServer', () => {
  const FIXTURE_PORT = 3186;
  const RUNNER_PORT = 3187;
  const fixtureBaseUrl = `http://localhost:${FIXTURE_PORT}`;
  const runnerBaseUrl = `http://localhost:${RUNNER_PORT}`;
  const outputDir = path.join(process.cwd(), '.tmp-runner-report');

  let runner: RunnerServer;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      fixtureServer.listen(FIXTURE_PORT, () => resolve());
    });
    runner = new RunnerServer({ port: RUNNER_PORT, outputDir, dataDir: `${outputDir}-data` });
    await runner.start();
  });

  afterAll(async () => {
    await runner.stop();
    await new Promise<void>((resolve) => {
      fixtureServer.close(() => resolve());
    });
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(`${outputDir}-data`, { recursive: true, force: true }).catch(() => {});
  });

  it('rejects a missing targetUrl with 400', async () => {
    const res = await fetch(`${runnerBaseUrl}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 from /api/report before any run has completed', async () => {
    const res = await fetch(`${runnerBaseUrl}/api/report`);
    expect(res.status).toBe(404);
  });

  it('accepts a POST /api/runner/run, streams events over SSE, and exposes the finished report', async () => {
    const events: any[] = [];
    const streamController = new AbortController();
    const streamRes = await fetch(`${runnerBaseUrl}/api/runner/stream`, {
      signal: streamController.signal,
    });
    const reader = streamRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const pump = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (dataLine) {
              try {
                events.push(JSON.parse(dataLine.slice(6)));
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // aborted/closed — expected during teardown
      }
    })();

    // give the SSE connection a beat to establish before triggering the run
    await new Promise((r) => setTimeout(r, 200));

    const runRes = await fetch(`${runnerBaseUrl}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: fixtureBaseUrl, productId: 'runner-test' }),
    });
    expect(runRes.status).toBe(202);
    const { runId } = await runRes.json();
    expect(runId).toBeTruthy();

    // Second concurrent trigger must be rejected (single-flight).
    const concurrentRes = await fetch(`${runnerBaseUrl}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: fixtureBaseUrl }),
    });
    expect(concurrentRes.status).toBe(409);

    // Poll status until the run finishes.
    let isRunning = true;
    for (let i = 0; i < 60 && isRunning; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await fetch(`${runnerBaseUrl}/api/runner/status`);
      const status = await statusRes.json();
      isRunning = status.isRunning;
    }
    expect(isRunning).toBe(false);

    const reportRes = await fetch(`${runnerBaseUrl}/api/report`);
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();
    expect(report.productId).toBe('runner-test');
    expect(report.results.length).toBeGreaterThan(0);

    streamController.abort();
    await pump.catch(() => {});

    expect(events.some((e) => e.type === 'RUN_STARTED')).toBe(true);
    expect(events.some((e) => e.type === 'STEP_STARTED')).toBe(true);
    expect(events.some((e) => e.type === 'STEP_COMPLETED')).toBe(true);
    expect(events.some((e) => e.type === 'RUN_COMPLETED')).toBe(true);
  }, 45000);

  it('never serves saved sign-in sessions, which hold live session cookies', async () => {
    await fs.mkdir(path.join(outputDir, 'auth'), { recursive: true });
    await fs.writeFile(path.join(outputDir, 'auth', 'manager.json'), '{"cookies":[{"name":"session","value":"secret"}]}');
    await fs.writeFile(path.join(outputDir, 'visible.json'), '{}');

    expect((await fetch(`${runnerBaseUrl}/api/evidence/auth/manager.json`)).status).toBe(403);
    expect((await fetch(`${runnerBaseUrl}/api/evidence/auth%2Fmanager.json`)).status).toBe(403);
    expect((await fetch(`${runnerBaseUrl}/api/evidence/visible.json`)).status).toBe(200);
  });

  it('pauses in awaiting-review when skipReview: false, survives runner reload, accepts PATCH edits, and resumes on approve', async () => {
    const runRes = await fetch(`${runnerBaseUrl}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: fixtureBaseUrl,
        productId: 'pause-test',
        useAI: true,
        aiProvider: 'mock',
        skipReview: false,
        breakpoints: ['375px'],
      }),
    });
    expect(runRes.status).toBe(202);
    const { runId } = await runRes.json();
    expect(runId).toBeTruthy();

    // Poll until discovery completes and runner pauses in awaiting-review
    let phase = 'scanning';
    for (let i = 0; i < 60 && phase === 'scanning'; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await fetch(`${runnerBaseUrl}/api/runner/status`);
      const status = await statusRes.json();
      phase = status.phase;
    }
    expect(phase).toBe('awaiting-review');

    // GET /api/runner/plan returns the formulated plan
    const planRes = await fetch(`${runnerBaseUrl}/api/runner/plan`);
    expect(planRes.status).toBe(200);
    const plan = await planRes.json();
    expect(plan.runId).toBe(runId);
    expect(plan.pages.length).toBeGreaterThan(0);
    expect(plan.flows.length).toBeGreaterThan(0);

    // Plan survives runner reload
    await runner.stop();
    runner = new RunnerServer({ port: RUNNER_PORT, outputDir, dataDir: `${outputDir}-data` });
    await runner.start();

    const reloadedPlanRes = await fetch(`${runnerBaseUrl}/api/runner/plan`);
    expect(reloadedPlanRes.status).toBe(200);
    const reloadedPlan = await reloadedPlanRes.json();
    expect(reloadedPlan.runId).toBe(runId);

    // PATCH /api/runner/plan applies user edits
    const patchRes = await fetch(`${runnerBaseUrl}/api/runner/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flows: [
          {
            id: 'FLOW-CUSTOM-001',
            name: 'Custom User Flow',
            role: 'anonymous',
            startPage: '/',
            steps: [{ action: 'wait', name: 'Wait on home page' }],
          },
        ],
      }),
    });
    expect(patchRes.status).toBe(200);
    const patchedPlan = await patchRes.json();
    expect(patchedPlan.flows[0].id).toBe('FLOW-CUSTOM-001');

    // POST /api/runner/plan/approve starts testing
    const approveRes = await fetch(`${runnerBaseUrl}/api/runner/plan/approve`, {
      method: 'POST',
    });
    expect(approveRes.status).toBe(200);
    const approveData = await approveRes.json();
    expect(approveData.status).toBe('approved');

    // Poll until run completes
    let isRunning = true;
    for (let i = 0; i < 90 && isRunning; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await fetch(`${runnerBaseUrl}/api/runner/status`);
      const status = await statusRes.json();
      isRunning = status.isRunning;
    }
    expect(isRunning).toBe(false);

    const reportRes = await fetch(`${runnerBaseUrl}/api/report`);
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();
    expect(report.runId).toBe(runId);
  }, 90000);

  it('runs straight through to completion when skipReview: true is provided', async () => {
    const runRes = await fetch(`${runnerBaseUrl}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: fixtureBaseUrl,
        productId: 'skip-review-test',
        useAI: true,
        aiProvider: 'mock',
        skipReview: true,
        breakpoints: ['375px'],
      }),
    });
    expect(runRes.status).toBe(202);
    const { runId } = await runRes.json();

    let isRunning = true;
    for (let i = 0; i < 150 && isRunning; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await fetch(`${runnerBaseUrl}/api/runner/status`);
      const status = await statusRes.json();
      // Must never get stuck in awaiting-review
      expect(status.phase).not.toBe('awaiting-review');
      isRunning = status.isRunning;
    }
    expect(isRunning).toBe(false);

    const reportRes = await fetch(`${runnerBaseUrl}/api/report`);
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();
    expect(report.runId).toBe(runId);
  }, 120000);


});

