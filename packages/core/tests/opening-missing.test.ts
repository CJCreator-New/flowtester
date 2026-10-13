/** A step that opens a tab or dialog failing means the form was never reached: "Could not verify", no form finding. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { FlowTestOrchestrator } from '../src/orchestrator.js';
import type { TestCase } from '@qa/types';

const PORT = 3547;
const outputDir = path.join(process.cwd(), '.tmp-opening-missing-report');

const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(
    '<html lang="en"><head><title>T</title></head><body><main><h1>Settings</h1><p>Nothing to open here.</p></main></body></html>'
  );
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
});

async function run(openingFlag: boolean) {
  const testCase: TestCase = {
    id: 'TC-OPEN-1',
    flowId: 'open-flow',
    name: 'Invite form',
    role: 'anonymous',
    startPage: '/',
    steps: [
      { action: 'click', selector: '#open-invite', name: 'Open the invite dialog', opening: openingFlag || undefined },
      { action: 'fill', selector: '#invite-email', value: 'a@b.co', name: 'Fill email' },
      { action: 'click', selector: '#send', name: 'Press Send' },
    ],
    expectations: { refusal: { formPath: '/', submitSelector: '#send' } },
    kind: 'page-test',
  };
  return new FlowTestOrchestrator().run({
    targetUrl: `http://localhost:${PORT}`,
    productId: 'opening-test',
    specTestCases: [testCase],
    outputDir,
    enableA11y: false,
    enableSecurity: false,
    enablePerformance: false,
    enableSeo: false,
    recordVideo: false,
    stepTimeoutMs: 3000,
    onEvent: () => {},
  });
}

describe('opening step missing', () => {
  it('is Could not verify with "Could not reach", and no form finding', async () => {
    const report = await run(true);
    const r = report.results[0]!;
    expect(r.status).toBe('Could not verify');
    expect(r.error).toMatch(/^Could not reach Invite form/);
    expect(r.findings.filter((f) => f.checker === 'spec-conformance' || f.id.startsWith('F-STEP-'))).toEqual([]);
  }, 60000);

  it('the same missing step without the opening flag still fails the test', async () => {
    const report = await run(false);
    expect(report.results[0]!.status).toBe('Failed');
  }, 60000);
});
