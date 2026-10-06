import { describe, it, expect, afterEach } from 'vitest';
import { ReportGenerator } from '../src/reporter.js';
import type { ReleaseReport } from '@qa/types';
import { promises as fs } from 'fs';
import path from 'path';

describe('ReportGenerator', () => {
  const tempDir = path.resolve(__dirname, './temp-reporter-test');

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('renders report.md and findings.json matching spec structure', async () => {
    const generator = new ReportGenerator(tempDir);

    const mockReport: ReleaseReport = {
      runId: 'run-12345',
      productId: 'product-omega',
      targetUrl: 'http://localhost:4000',
      timestamp: '2026-09-26T12:00:00Z',
      durationMs: 4200,
      coverage: {
        totalTestPoints: 4,
        passed: 3,
        failed: 1,
        blocked: 0,
        skipped: 0,
        couldNotVerify: 0,
        completionRate: 100,
      },
      results: [],
      findings: [
        {
          id: 'F-BLOCKER-001',
          severity: 'Blocker',
          checker: 'bug-detection',
          title: 'Critical checkout crash',
          where: { urlPath: '/checkout', role: 'member', breakpoint: '1440px' },
          expectedVsActual: { expected: 'Checkout succeeds', actual: 'Crash with 500 error' },
          stepsToReproduce: ['Navigate to /checkout', 'Click Pay'],
          evidence: {},
          resolution: 'Fix server endpoint',
        },
      ],
    };

    const { jsonPath, mdPath } = await generator.generate(mockReport);

    // Verify findings.json
    const jsonContent = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(jsonContent);
    expect(parsed.productId).toBe('product-omega');
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].id).toBe('F-BLOCKER-001');

    // Verify report.md
    const mdContent = await fs.readFile(mdPath, 'utf8');
    expect(mdContent).toContain('# Pre-Release Readiness Report');
    expect(mdContent).toContain('product-omega');
    expect(mdContent).toContain('**Not ready yet**: 1 problem must be fixed first.');
    expect(mdContent).toContain('F-BLOCKER-001');
    expect(mdContent).toContain('Critical checkout crash');
    expect(mdContent).toContain('Run the check-up again on the same address');
  });
});
