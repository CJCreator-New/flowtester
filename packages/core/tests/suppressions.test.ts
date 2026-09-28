import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SuppressionsManager } from '../src/suppressions.js';
import { promises as fs } from 'fs';
import path from 'path';
import type { Finding } from '@qa/types';

describe('SuppressionsManager', () => {
  const tmpDir = path.join(process.cwd(), '.tmp-suppression-test');

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should save and load suppressions properly', async () => {
    const manager = new SuppressionsManager(tmpDir);
    await manager.saveSuppression({
      findingTitle: 'Known cosmetic issue',
      urlPath: '/dashboard',
      triageStatus: 'Intended',
      dateAdded: new Date().toISOString(),
    });

    const list = await manager.loadSuppressions();
    expect(list).toHaveLength(1);
    expect(list[0].findingTitle).toBe('Known cosmetic issue');
    expect(list[0].triageStatus).toBe('Intended');
  });

  it('should apply suppressions to matching findings', async () => {
    const manager = new SuppressionsManager(tmpDir);
    await manager.saveSuppression({
      findingTitle: 'False positive alert',
      urlPath: '/login',
      triageStatus: 'False Positive',
      dateAdded: new Date().toISOString(),
    });

    const findings: Finding[] = [
      {
        id: 'F-1',
        title: 'False positive alert',
        severity: 'Minor',
        checker: 'ux-quality',
        where: { urlPath: '/login', role: 'anonymous', breakpoint: '1440px' },
        expectedVsActual: { expected: 'a', actual: 'b' },
        stepsToReproduce: [],
        evidence: {},
        resolution: 'None',
        verifyCommand: 'qa-test verify F-1',
      },
      {
        id: 'F-2',
        title: 'Real blocker',
        severity: 'Blocker',
        checker: 'bug-detection',
        where: { urlPath: '/invoices', role: 'manager', breakpoint: '1440px' },
        expectedVsActual: { expected: 'a', actual: 'b' },
        stepsToReproduce: [],
        evidence: {},
        resolution: 'Fix',
        verifyCommand: 'qa-test verify F-2',
      },
    ];

    const { activeFindings, suppressedFindings } = await manager.applySuppressions(findings);
    expect(suppressedFindings).toHaveLength(1);
    expect(suppressedFindings[0].id).toBe('F-1');
    expect(suppressedFindings[0].triageStatus).toBe('False Positive');

    expect(activeFindings).toHaveLength(1);
    expect(activeFindings[0].id).toBe('F-2');
  });
});
