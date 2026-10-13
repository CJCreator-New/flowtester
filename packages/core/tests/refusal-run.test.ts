/** The run captures the page right before the submit click and the refusal rule judges the result (ADR 0024). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import { promises as fs } from 'fs';
import path from 'path';
import { FlowTestOrchestrator } from '../src/orchestrator.js';
import type { TestCase } from '@qa/types';
import { server } from '../../../fixtures/test-app/server.js';

const outputDir = path.join(process.cwd(), '.tmp-refusal-run-report');
let base: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
});

async function run(startPage: string, emailSel: string) {
  const testCase: TestCase = {
    id: 'TC-REF-1',
    flowId: 'rejects',
    name: 'Empty email',
    role: 'anonymous',
    startPage,
    steps: [
      { action: 'fill', selector: emailSel, value: '', name: 'Leave email empty' },
      { action: 'click', selector: 'button[type="submit"]', name: 'Press Save' },
    ],
    expectations: { refusal: { formPath: startPage.split('?')[0]!, submitSelector: 'button[type="submit"]' } },
    kind: 'page-test',
    intent: 'rejects',
  };
  return new FlowTestOrchestrator().run({
    targetUrl: base,
    productId: 'refusal-run',
    specTestCases: [testCase],
    outputDir,
    enableA11y: false,
    enableSecurity: false,
    enablePerformance: false,
    enableSeo: false,
    recordVideo: false,
    onEvent: () => {},
  });
}

describe('refusal rule in a run', () => {
  it('a form that accepts the empty value gets a finding', async () => {
    const report = await run('/lab/lenient', '#l-email');
    const titles = report.results[0]!.findings.map((f) => f.title);
    expect(titles.some((t) => /accepted a value it should refuse/.test(t))).toBe(true);
  }, 60000);

  it('a form that refuses it gets none', async () => {
    const report = await run('/lab/signup?mode=server', '#s-email');
    const titles = report.results[0]!.findings.map((f) => f.title);
    expect(titles.some((t) => /accepted a value it should refuse/.test(t))).toBe(false);
  }, 60000);
});
