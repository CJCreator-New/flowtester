import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { summariseWcag } from '../src/ux-quality.js';

const rule = (id: string, tags: string[]) => ({ id, tags });

describe('summariseWcag (pure)', () => {
  it('axe runs with the four WCAG tags (and 2.2 AA)', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/ux-quality.ts', import.meta.url)), 'utf8');
    const m = /withTags\(\[([^\]]+)\]\)/.exec(src);
    expect(m).not.toBeNull();
    for (const tag of ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']) expect(m![1]).toContain(`'${tag}'`);
  });

  it('maps passes, violations and incomplete to the three statuses', () => {
    const { entries, unmappedTags } = summariseWcag({
      passes: [rule('html-has-lang', ['wcag2a', 'wcag311']), rule('color-contrast', ['wcag2aa', 'wcag143'])],
      violations: [rule('color-contrast', ['wcag2aa', 'wcag143'])],
      incomplete: [rule('aria-valid', ['wcag2a', 'wcag412'])],
    });
    const by = Object.fromEntries(entries.map((e) => [e.criterion, e.status]));
    expect(by['WCAG 3.1.1 Language of Page']).toBe('none-found');
    expect(by['WCAG 1.4.3 Contrast (Minimum)']).toBe('violated');
    expect(by['WCAG 4.1.2 Name, Role, Value']).toBe('needs-human-judgment');
    expect(unmappedTags).toEqual([]);
  });

  it('lists a violation tag that names no criterion instead of dropping it', () => {
    const { entries, unmappedTags } = summariseWcag({
      violations: [rule('x', ['wcag2aa', 'best-practice']), rule('y', ['wcag2a'])],
    });
    expect(entries).toEqual([]);
    expect(unmappedTags).toEqual(['best-practice', 'rule:y']);
  });

  it('1.1.1 needs human judgment when images exist, unless already violated', () => {
    const passes = [rule('image-alt', ['wcag2a', 'wcag111'])];
    expect(summariseWcag({ passes }, { imagesPresent: true }).entries[0].status).toBe('needs-human-judgment');
    expect(summariseWcag({ passes }).entries[0].status).toBe('none-found');
    expect(summariseWcag({ passes, violations: passes }, { imagesPresent: true }).entries[0].status).toBe('violated');
  });

  it('never claims a pass or compliance', () => {
    const { entries } = summariseWcag({
      passes: [rule('a', ['wcag111'])],
      violations: [rule('b', ['wcag143'])],
      incomplete: [rule('c', ['wcag412'])],
    });
    expect(JSON.stringify(entries)).not.toMatch(/compliant|passes WCAG|accessible/i);
  });
});
