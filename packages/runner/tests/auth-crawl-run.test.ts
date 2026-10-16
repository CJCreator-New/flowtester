import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { RunnerServer } from '../src/server.js';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('T-117 Runner auth crawl SSE and report (auth-crawl-run.test.ts)', () => {
  let fixturePort: number;
  let runnerPort: number;
  let fixtureBase: string;
  let runnerBase: string;
  const outputDir = path.join(process.cwd(), '.tmp-auth-crawl-run');
  const dataDir = path.join(process.cwd(), '.tmp-auth-crawl-run-data');

  let runner: RunnerServer;

  beforeAll(async () => {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(dataDir, { recursive: true });

    await new Promise<void>((resolve) => {
      fixtureServer.listen(0, () => {
        const addr = fixtureServer.address();
        if (addr && typeof addr === 'object') {
          fixturePort = addr.port;
          fixtureBase = `http://localhost:${fixturePort}`;
        }
        resolve();
      });
    });

    runner = new RunnerServer({
      port: 0,
      outputDir,
      dataDir,
    });
    await runner.start();
    runnerPort = runner.port;
    runnerBase = `http://localhost:${runnerPort}`;
  });

  afterAll(async () => {
    await runner.stop();
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    await fetch(`${fixtureBase}/lab/reset`, { method: 'POST' });
  });

  afterEach(async () => {
    try {
      let status = await (await fetch(`${runnerBase}/api/runner/status`)).json();
      for (let attempt = 0; attempt < 3 && status.isRunning; attempt++) {
        await fetch(`${runnerBase}/api/runner/stop`, { method: 'POST' });
        status = await (await fetch(`${runnerBase}/api/runner/status`)).json();
      }
    } catch {}
  }, 30000);

  it('streams DISCOVERY_PROGRESS with optional fields and serves report with pageCoverage', async () => {
    const events: any[] = [];
    const streamController = new AbortController();
    const streamRes = await fetch(`${runnerBase}/api/runner/stream`, {
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
        // closed
      }
    })();

    await new Promise((r) => setTimeout(r, 200));

    // Launch a run with single breakpoint and 1 maxPage so it finishes quickly
    const runRes = await fetch(`${runnerBase}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: `${fixtureBase}/about`,
        skipReview: true,
        maxPages: 1,
        breakpoints: ['1440px'],
        owner: true,
        signInConsent: true,
        roles: [
          {
            role: 'manager',
            username: 'manager@example.com',
            password: 'manager-password',
            loginPath: '/signin',
          },
        ],
        customHeaders: {
          'x-qa-bypass-token': 'runner-bypass-test-token',
        },
      }),
    });

    expect(runRes.status).toBe(202);
    const { runId } = await runRes.json();
    expect(runId).toBeTruthy();

    // Poll until run completes
    let isRunning = true;
    for (let i = 0; i < 300 && isRunning; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await fetch(`${runnerBase}/api/runner/status`);
      const status = await statusRes.json();
      isRunning = status.isRunning;
    }
    expect(isRunning).toBe(false);

    streamController.abort();
    await pump;

    // Check DISCOVERY_PROGRESS events
    const progressEvents = events.filter((e) => e.type === 'DISCOVERY_PROGRESS');
    expect(progressEvents.length).toBeGreaterThan(0);
    // Assert optional fields
    const withOptional = progressEvents.find((e) => e.pagesVisited !== undefined || e.pagesFound !== undefined);
    expect(withOptional).toBeTruthy();

    // Check /api/report
    const reportRes = await fetch(`${runnerBase}/api/report`);
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();

    expect(report.runId).toBe(runId);
    expect(report.pageCoverage).toBeTruthy();
    expect(report.pageCoverage.reached).toBeGreaterThan(0);
    expect(Array.isArray(report.pageCoverage.skipped)).toBe(true);
  }, 120000);

  // T-309: the same crawl through the runner finishes, and the report's page coverage carries the
  // signed-in area — including the page that only shows a password field (LC-002), which must not be
  // dropped as a sign-in wall.
  it('runs the fixture signed in and reports the covered pages', async () => {
    const runRes = await fetch(`${runnerBase}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: `${fixtureBase}/account`,
        skipReview: true,
        maxPages: 20,
        breakpoints: ['1440px'],
        owner: true,
        signInConsent: true,
        roles: [
          {
            role: 'manager',
            username: 'manager@example.com',
            password: 'manager-password',
            loginPath: '/signin',
          },
        ],
      }),
    });
    expect(runRes.status).toBe(202);

    let isRunning = true;
    for (let i = 0; i < 300 && isRunning; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = await (await fetch(`${runnerBase}/api/runner/status`)).json();
      isRunning = status.isRunning;
    }
    expect(isRunning).toBe(false);

    const report = await (await fetch(`${runnerBase}/api/report`)).json();
    expect(report.pageCoverage.reached).toBeGreaterThan(0);
    const skippedPaths = (report.pageCoverage.skipped ?? []).map((s: { urlPath: string }) => s.urlPath);
    // A page with a password field that is not the sign-in page is reached, not skipped as a wall.
    expect(skippedPaths).not.toContain('/account/security');
  }, 180000);

  it('asserts RUN_FAILED event carries signInReason when credentials fail under consent', async () => {
    const events: any[] = [];
    const streamController = new AbortController();
    const streamRes = await fetch(`${runnerBase}/api/runner/stream`, {
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
        // closed
      }
    })();

    await new Promise((r) => setTimeout(r, 200));

    // Wrong password under consent
    const runRes = await fetch(`${runnerBase}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: `${fixtureBase}/`,
        skipReview: true,
        maxPages: 3,
        breakpoints: ['1440px'],
        owner: true,
        signInConsent: true,
        roles: [
          {
            role: 'manager',
            username: 'manager@example.com',
            password: 'wrong-password-here',
            loginPath: '/signin',
          },
        ],
      }),
    });

    expect(runRes.status).toBe(202);

    // Poll until run completes or fails
    let isRunning = true;
    for (let i = 0; i < 100 && isRunning; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await fetch(`${runnerBase}/api/runner/status`);
      const status = await statusRes.json();
      isRunning = status.isRunning;
    }
    expect(isRunning).toBe(false);

    streamController.abort();
    await pump;

    const failedEvent = events.find((e) => e.type === 'RUN_FAILED');
    expect(failedEvent).toBeTruthy();
    expect(failedEvent.signInReason).toBe('wrong-details');
  }, 90000);
});
