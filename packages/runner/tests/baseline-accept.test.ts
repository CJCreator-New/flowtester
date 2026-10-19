/**
 * Accepting a visual baseline: the id is a plain name, and nothing outside the output folder, or from a
 * saved sign-in session (auth/), is ever copied into the baselines.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { RunnerServer } from '../src/server.js';

const PORT = 3733;
const scratch = path.join(process.cwd(), '.tmp-baseline-accept');
const outputDir = path.join(scratch, 'report');
const baselineDir = path.join(process.cwd(), '.qa-baselines');
const ID = 'tmp-t34-baseline-test';

function accept(body: unknown): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        path: '/api/runner/baselines/accept',
        method: 'POST',
        headers: {
          host: `localhost:${PORT}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: text }));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

const exists = (file: string) =>
  fs.stat(file).then(
    () => true,
    () => false
  );

describe('POST /api/runner/baselines/accept', () => {
  let server: RunnerServer;

  beforeAll(async () => {
    await fs.rm(scratch, { recursive: true, force: true });
    await fs.mkdir(path.join(outputDir, 'auth'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'runs', 'run-1', 'evidence'), { recursive: true });
    await fs.writeFile(path.join(outputDir, 'auth', 'admin.json'), '{"cookies":"secret"}');
    await fs.writeFile(path.join(outputDir, 'runs', 'run-1', 'evidence', 'shot.png'), 'png');
    server = new RunnerServer({ port: PORT, outputDir, dataDir: path.join(scratch, 'data') });
    await server.start();
  });

  afterAll(async () => {
    await server?.stop();
    await fs.rm(path.join(baselineDir, `${ID}.png`), { force: true });
    await fs.rm(scratch, { recursive: true, force: true });
  });

  it.each(['../evil', 'a/b', '..', 'a\\b', '..%2Fx', ''])('refuses the id %j', async (id) => {
    const answer = await accept({ id, currentEvidencePath: 'runs/run-1/evidence/shot.png' });
    expect(answer.status).toBe(400);
  });

  it('refuses an id that is not text', async () => {
    expect((await accept({ id: ['x'] })).status).toBe(400);
  });

  it('never copies a saved sign-in session', async () => {
    const answer = await accept({ id: ID, currentEvidencePath: 'auth/admin.json' });
    expect(answer.status).toBe(200);
    expect(await exists(path.join(baselineDir, `${ID}.png`))).toBe(false);
  });

  it('never copies a file from outside the output folder', async () => {
    const answer = await accept({ id: ID, currentEvidencePath: '../../package.json' });
    expect(answer.status).toBe(200);
    expect(await exists(path.join(baselineDir, `${ID}.png`))).toBe(false);
  });

  it('copies a screenshot from a run', async () => {
    const answer = await accept({ id: ID, currentEvidencePath: 'runs/run-1/evidence/shot.png' });
    expect(answer.status).toBe(200);
    expect(await exists(path.join(baselineDir, `${ID}.png`))).toBe(true);
  });
});
