import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTENT_HINTS, INTENT_LABELS } from '../src/lib/intent-view';

const BANNED = /negative test|positive test|happy path|categor(y|ies)/i;

describe('Intent wording', () => {
  it('uses no banned terms in labels, hints or the Plan Review sources', () => {
    for (const text of [...Object.values(INTENT_LABELS), ...Object.values(INTENT_HINTS)]) {
      expect(text).not.toMatch(BANNED);
    }
    for (const file of ['../src/lib/intent-view.ts', '../src/components/plan/PlanDocument.tsx']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source, file).not.toMatch(BANNED);
    }
  });
});
