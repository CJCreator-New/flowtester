/**
 * Test cap and Intent switch-offs on the runner: the cap is parsed and kept with the Waiting Plan,
 * `--test-cap` reaches the run body, `intentsOff` is validated, and a plan read back from disk is
 * expanded again (so gating follows the saved context, not a stale copy).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import type { AIMessage, AIProviderType, ReviewPlan } from '@qa/types';
import { RunnerServer } from '../src/server.js';
import { checkIntentsOff, checkTestCap } from '../src/run-inputs.js';
import { buildRunBody, parseArgs } from '../src/checkup.js';
import { server as fixtureServer } from '../../../fixtures/test-app/server.js';

describe('checkTestCap', () => {
  it('keeps a positive whole number, clamps to 1..100000, else uses the default', () => {
    expect(checkTestCap(50)).toBe(50);
    expect(checkTestCap('300')).toBe(300);
    expect(checkTestCap(12.9)).toBe(12);
    expect(checkTestCap(5_000_000)).toBe(100000);
    for (const v of [0, -3, 0.5, NaN, Infinity, 'abc', '', null, undefined, {}]) expect(checkTestCap(v)).toBeUndefined();
  });
});

describe('checkIntentsOff', () => {
  it('accepts known Intents once each, refuses the rest', () => {
    expect(checkIntentsOff(['rejects', 'limits', 'rejects'])).toEqual({ ok: true, value: ['rejects', 'limits'] });
    expect(checkIntentsOff([])).toEqual({ ok: true, value: [] });
    expect(checkIntentsOff(['nope']).ok).toBe(false);
    expect(checkIntentsOff('rejects').ok).toBe(false);
  });
});

describe('--test-cap', () => {
  it('reaches the run body, clamped; absent by default', () => {
    expect(buildRunBody(parseArgs(['http://x.test', '--test-cap', '40'], {})).testCap).toBe(40);
    expect(parseArgs(['http://x.test', '--test-cap', '9999999'], {}).testCap).toBe(100000);
    expect(parseArgs(['http://x.test', '--test-cap', 'zero'], {}).testCap).toBeUndefined();
    const args = parseArgs(['--test-cap', '7', 'http://x.test'], {});
    expect(args.url).toBe('http://x.test');
    expect(buildRunBody(parseArgs(['http://x.test'], {}))).not.toHaveProperty('testCap');
  });
});

const FIXTURE_PORT = 3722;
const RUNNER_PORT = 3723;
const runnerUrl = `http://localhost:${RUNNER_PORT}`;
const outputDir = path.join(process.cwd(), '.tmp-test-cap-endpoints');
const dataDir = `${outputDir}-data`;
let fixturePort = 0;
const getFixtureUrl = () => `http://localhost:${fixturePort}`;

class QuietAI {
  readonly providerType: AIProviderType = 'mock';
  async generateText(_messages: AIMessage[]): Promise<string> {
    return '{}';
  }
}

const post = (route: string, body: unknown = {}, method = 'POST') =>
  fetch(`${runnerUrl}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const getPlan = async () => (await (await fetch(`${runnerUrl}/api/runner/plan`)).json()) as ReviewPlan;

async function waitForPhase(wanted: string[], seconds = 200): Promise<void> {
  for (let i = 0; i < seconds * 2; i++) {
    const s = (await (await fetch(`${runnerUrl}/api/runner/status`)).json()) as { phase: string; lastRunError: string };
    if (wanted.includes(s.phase)) return;
    if (s.phase === 'failed') throw new Error(`run failed: ${s.lastRunError}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('timed out');
}

describe('Test cap on a Waiting Plan', () => {
  let runner: RunnerServer;
  const start = async () => {
    runner = new RunnerServer({ port: RUNNER_PORT, outputDir, dataDir, createAIProvider: () => new QuietAI() });
    await runner.start();
  };

  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        reject(err);
      };
      fixtureServer.once('error', onError);
      fixtureServer.listen(0, () => {
        const address = fixtureServer.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Unable to determine fixture server port'));
          return;
        }
        fixturePort = address.port;
        fixtureServer.off('error', onError);
        resolve();
      });
    });
    await start();
  });
  afterAll(async () => {
    await runner.stop();
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
  });

  it('echoes the cap, validates intentsOff, and expands a saved plan again after a restart', async () => {
    const res = await post('/api/runner/run', {
      targetUrl: `${getFixtureUrl()}/`,
      owner: false,
      useAI: true,
      aiProvider: 'mock',
      skipReview: false,
      breakpoints: ['1440px'],
      testCap: 77.8,
    });
    expect(res.status).toBe(202);
    await waitForPhase(['awaiting-review']);
    const before = await getPlan();
    expect(before.testCap).toBe(77);
    expect(before.readOnly).toBe(true);
    expect(before.summary?.intents).toBeDefined();

    const refused = await post('/api/runner/plan', { intentsOff: ['sideways'] }, 'PATCH');
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { code: string }).code).toBe('ERR_INVALID_INTENTS');
    expect((await post('/api/runner/plan', { intentsOff: ['rejects'] }, 'PATCH')).status).toBe(200);

    expect((await getPlan()).intentsOff).toEqual(['rejects']);

    await runner.stop();
    await start();
    const after = await getPlan();
    expect(after.intentsOff).toEqual(['rejects']);
    expect(after.testCap).toBe(77);
    expect(after.readOnly).toBe(true);
    // Gating is worked out again from the saved context, so the same items stay out of the run.
    expect((await post('/api/runner/plan', {}, 'PATCH')).status).toBe(200);
    const reread = await getPlan();
    expect(reread.wontRun).toEqual(after.wontRun);
    expect(reread.summary?.tests).toBe(after.summary?.tests);
  }, 240000);
});
