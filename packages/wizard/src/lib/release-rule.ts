import { DEFAULT_RELEASE_GATES, type ReleaseGateCriteria } from '@qa/types/src/verdict.js';

/** The three named rules from verdict.ts (T-30). Descriptions restate those constants, nothing more. */
export type GatePreset = keyof typeof DEFAULT_RELEASE_GATES;

export const PRESET_META: Record<GatePreset, { name: string; description: string }> = {
  strict: {
    name: 'Strict',
    description: '0 Blockers, 0 Majors, every area A (score 90+), Accessible at A',
  },
  standard: {
    name: 'Standard',
    description: '0 Blockers, every area C or better',
  },
  lenient: {
    name: 'Lenient',
    description: '0 Blockers. Area grades never block release.',
  },
};

const CRITERIA_KEYS: Array<keyof ReleaseGateCriteria> = [
  'maxBlockers',
  'maxMajors',
  'maxMinors',
  'strictAccessibility',
  'minAreaScore',
  'minAreaGrade',
  'enforceAllAreas',
  'advisoryAreas',
];

/** Same criteria, whatever the key order or undefined-vs-missing. */
export function sameGate(a: ReleaseGateCriteria, b: ReleaseGateCriteria): boolean {
  return CRITERIA_KEYS.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
}

/** Which named rule a stored rule is, or 'custom'. Compares against the same constants verdict.ts uses. */
export function presetOf(gate: ReleaseGateCriteria): GatePreset | 'custom' {
  const found = (Object.keys(DEFAULT_RELEASE_GATES) as GatePreset[]).find((key) =>
    sameGate(gate, DEFAULT_RELEASE_GATES[key])
  );
  return found ?? 'custom';
}
