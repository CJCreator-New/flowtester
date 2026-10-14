import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { normalizePlanIntents, intentOf } from '@qa/types';
import { loadSiteMemory } from '../src/site-memory.js';

const legacyTest = {
  id: 'x:denial:Viewer',
  name: 'Viewer cannot: create',
  role: 'Viewer',
  kind: 'denial',
  steps: [],
  source: 'fallback',
};

describe('saved plans written before Intent', () => {
  it('a saved Waiting Plan with kind:denial loads with intent:denied', () => {
    const saved = JSON.parse(JSON.stringify({ planPages: [{ urlPath: '/', tests: [legacyTest] }] }));
    const out = normalizePlanIntents(saved);
    const t = out.planPages[0].tests[0] as { intent?: string; kind?: string };
    expect(t.intent).toBe('denied');
    expect(t.kind).toBeUndefined();
  });

  it('remembered site tests are normalized on load', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-intent-'));
    try {
      await fs.mkdir(path.join(dir, 'sites'), { recursive: true });
      const files = await fs.readdir(dir);
      expect(files).toContain('sites');
      // Write through the loader's own file name by saving then re-reading with a legacy test.
      const { saveSiteMemory, emptySiteMemory } = await import('../src/site-memory.js');
      const memory = emptySiteMemory('legacy.test');
      memory.plan = { pages: { '/': { tests: [legacyTest as never], source: 'fallback' } }, navigation: {} };
      await saveSiteMemory(dir, memory);
      const loaded = await loadSiteMemory(dir, 'legacy.test');
      expect(intentOf(loaded!.plan!.pages['/'].tests[0])).toBe('denied');
      expect((loaded!.plan!.pages['/'].tests[0] as { kind?: string }).kind).toBeUndefined();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
