/**
 * T-306 (LC-007). The address check is what the wizard shows before a Check-up starts: a 4xx start address must
 * arrive as reachable **and** warned, while a 200 or a 401 stays reachable without a warning.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { RunnerServer } from '../src/server.js';

const RUNNER_PORT = 3370;
const SITE_PORT = 3371;
const runnerUrl = `http://localhost:${RUNNER_PORT}`;
const siteUrl = `http://localhost:${SITE_PORT}`;

describe('POST /api/runner/preflight: response shape and the 4xx start warning (T-306)', () => {
  const outputDir = path.join(process.cwd(), '.tmp-preflight-route');
  let runner: RunnerServer;
  let site: http.Server;

  beforeAll(async () => {
    site = http.createServer((req, res) => {
      const pathname = new URL(req.url || '/', siteUrl).pathname;
      const send = (body: string, status: number) => {
        res.writeHead(status, { 'Content-Type': 'text/html' });
        res.end(body);
      };
      if (pathname === '/') return send('<h1>Home</h1>', 200);
      if (pathname === '/restricted') return send('<h1>Sign in</h1>', 401);
      return send('Not found', 404);
    });
    await new Promise<void>((resolve) => site.listen(SITE_PORT, resolve));
    runner = new RunnerServer({ port: RUNNER_PORT, outputDir, dataDir: `${outputDir}-data` });
    await runner.start();
  });

  afterAll(async () => {
    await runner.stop();
    await new Promise<void>((resolve) => site.close(() => resolve()));
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.rm(`${outputDir}-data`, { recursive: true, force: true }).catch(() => {});
  });

  const post = (targetUrl: string) =>
    fetch(`${runnerUrl}/api/runner/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl }),
    }).then((res) => res.json());

  it('a 200 address is reachable and carries no warning', async () => {
    const body = await post(siteUrl);
    expect(body).toMatchObject({ reachable: true, statusCode: 200 });
    expect(body.startWarning).toBeUndefined();
  }, 30000);

  it('a 404 address is reachable and carries the start warning', async () => {
    const body = await post(`${siteUrl}/gone`);
    expect(body).toMatchObject({ reachable: true, statusCode: 404, startWarning: 'start-4xx' });
  }, 30000);

  it('a 401 address is reachable and carries no warning', async () => {
    const body = await post(`${siteUrl}/restricted`);
    expect(body).toMatchObject({ reachable: true, statusCode: 401 });
    expect(body.startWarning).toBeUndefined();
  }, 30000);
});
