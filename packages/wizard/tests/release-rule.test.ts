import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RELEASE_GATES } from '@qa/types/src/browser.js';
import { getStoredReleaseGates } from '../src/api';
import { PRESET_META, presetOf, sameGate } from '../src/lib/release-rule';

describe('wizard release rule default', () => {
  it('uses the Standard constant when nothing is stored (node has no localStorage)', () => {
    expect(getStoredReleaseGates()).toEqual(DEFAULT_RELEASE_GATES.standard);
  });

  it('keeps the Standard rule as the same object, so verdict.ts sees it as the default', () => {
    expect(getStoredReleaseGates()).toBe(DEFAULT_RELEASE_GATES.standard);
  });
});

describe('preset detection', () => {
  it('round-trips each named rule through storage (JSON) as the same preset', () => {
    for (const key of ['strict', 'standard', 'lenient'] as const) {
      const reloaded = JSON.parse(JSON.stringify({ ...DEFAULT_RELEASE_GATES[key] }));
      expect(presetOf(reloaded), key).toBe(key);
    }
  });

  it('shows Standard after reload, not custom', () => {
    const reloaded = JSON.parse(JSON.stringify(DEFAULT_RELEASE_GATES.standard));
    expect(presetOf(reloaded)).toBe('standard');
  });

  it('reports custom when a criterion differs from every named rule', () => {
    expect(presetOf({ ...DEFAULT_RELEASE_GATES.standard, maxMajors: 3 })).toBe('custom');
  });

  it('ignores undefined versus missing keys', () => {
    expect(sameGate({ maxBlockers: 0, maxMajors: undefined }, { maxBlockers: 0 })).toBe(true);
  });
});

describe('preset copy follows the T-30 rule', () => {
  it('describes Standard as 0 Blockers and every area C or better', () => {
    expect(PRESET_META.standard.name).toBe('Standard');
    expect(PRESET_META.standard.description).toBe('0 Blockers, every area C or better');
  });

  it('describes Strict and Lenient with their real criteria', () => {
    expect(PRESET_META.strict.description).toMatch(/0 Blockers, 0 Majors, every area A/);
    expect(PRESET_META.lenient.description).toMatch(/0 Blockers/);
    expect(PRESET_META.lenient.description).toMatch(/Area grades never block release/);
  });
});

describe('one gate name in visible text', () => {
  it('no longer uses the old gate names', () => {
    const files = [
      '../src/screens/SettingsScreen.tsx',
      '../src/screens/ReportScreen.tsx',
      '../src/components/CommandPalette.tsx',
      '../src/lib/release-rule.ts',
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source, file).not.toMatch(
        /Release Readiness Gates|Quality gate|Gate Criteria|Configure Release Readiness/
      );
    }
  });
});
