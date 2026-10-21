import type { RetryTelemetryEntry } from '@qa/types';

export type FlakyCause = NonNullable<RetryTelemetryEntry['likelyCause']>;

export interface FlakyEvidence {
  /** Error messages of the failed attempts. */
  errors: string[];
  /** Whether a form or other write was sent during the test. */
  sentAny?: boolean;
}

const TIMING = /\bTimeout\b|timed out|waiting for|exceeded/i;
const NETWORK = /\bERR_[A-Z_]+|net::|ECONN\w+|ENOTFOUND|socket hang up|aborted|\b5\d\d\b|failed request/i;
const STATE = /already exists|duplicate|conflict|stale|SendGuard|sent a form/i;

/**
 * Likely cause of a flaky test, from the evidence only. Network wins over timing (a dead
 * request often shows up as a timeout too); no evidence means "unknown".
 */
export function categoriseFlakyCause(evidence: FlakyEvidence): FlakyCause {
  const text = evidence.errors.join('\n');
  if (!text.trim()) return 'unknown';
  if (STATE.test(text) || (evidence.sentAny && /not found|missing|expected/i.test(text))) return 'state-leakage';
  if (NETWORK.test(text)) return 'network';
  if (TIMING.test(text)) return 'timing';
  return 'unknown';
}
