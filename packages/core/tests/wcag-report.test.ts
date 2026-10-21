import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import type { ReleaseReport } from '@qa/types';
import { releaseVerdict } from '@qa/types';
import { ReportGenerator } from '../src/reporter.js';

const tempDir = path.resolve(__dirname, './temp-wcag-report-test');
afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
});

const base: ReleaseReport = {
  runId: 'r',
  productId: 'p',
  targetUrl: 'http://localhost:4000',
  timestamp: '2026-10-08T10:00:00Z',
  durationMs: 1,
  coverage: { totalTestPoints: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, couldNotVerify: 0, completionRate: 0 },
  results: [],
  findings: [],
  wcagCoverage: [
    { criterion: 'WCAG 1.1.1 Non-text Content', status: 'needs-human-judgment', pages: 3 },
    { criterion: 'WCAG 1.4.3 Contrast (Minimum)', status: 'violated', pages: 2 },
    { criterion: 'WCAG 2.1.1 Keyboard', status: 'none-found', pages: 2 },
  ],
};

describe('WCAG coverage in the report', () => {
  it('lists each criterion with its status, no single percentage, no "compliant"', async () => {
    const out = await new ReportGenerator(tempDir).generate(base);
    const md = await fs.readFile(out.mdPath, 'utf8');
    const section = md.slice(md.indexOf('## WCAG criteria checked'), md.indexOf('## What this did not check'));
    expect(section).toContain('| WCAG 1.1.1 Non-text Content | Needs human judgment | 3 |');
    expect(section).toContain('| WCAG 1.4.3 Contrast (Minimum) | Violated | 2 |');
    expect(section).toContain('| WCAG 2.1.1 Keyboard | No violation found by automation | 2 |');
    expect(section).not.toMatch(/%|compliant|passes? WCAG/i);
  });

  it('leaves the verdict alone', () => {
    expect(releaseVerdict(base.findings).ready).toBe(releaseVerdict([]).ready);
  });
});
