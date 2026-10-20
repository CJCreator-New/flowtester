/** qaskills-patterns QSP-002/004/007/013: the new fields are optional, so older plans and reports still type-check. */
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ReleaseReport,
  RetryTelemetryEntry,
  RunStartBody,
  TestCaseStep,
  WcagCoverageEntry,
  WcagCriterionStatus,
} from '../src/index.js';

describe('qaskills-patterns optional fields', () => {
  it('RetryTelemetryEntry: old entries are still valid', () => {
    const old = {
      flowId: 'f',
      testCaseId: 't',
      failedStepIndex: 0,
      retryCount: 1,
      status: 'FLAKY_PASSED',
    } satisfies RetryTelemetryEntry;
    expectTypeOf(old).toMatchTypeOf<RetryTelemetryEntry>();
    expectTypeOf<RetryTelemetryEntry['passes']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<RetryTelemetryEntry['attempts']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<RetryTelemetryEntry['passRate']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<RetryTelemetryEntry['likelyCause']>().toEqualTypeOf<
      'timing' | 'state-leakage' | 'network' | 'unknown' | undefined
    >();
  });

  it('ReleaseReport: wcagCoverage and wcagUnmappedTags are optional', () => {
    expectTypeOf<ReleaseReport['wcagCoverage']>().toEqualTypeOf<WcagCoverageEntry[] | undefined>();
    expectTypeOf<ReleaseReport['wcagUnmappedTags']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<ReleaseReport['notChecked']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<WcagCriterionStatus>().toEqualTypeOf<'violated' | 'none-found' | 'needs-human-judgment'>();
  });

  it("RunStartBody: preset is 'smoke' | undefined", () => {
    expectTypeOf<RunStartBody['preset']>().toEqualTypeOf<'smoke' | undefined>();
    expectTypeOf<RunStartBody['healthPath']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RunStartBody['expectedVersion']>().toEqualTypeOf<string | undefined>();
  });

  it('TestCaseStep: selectorReason is optional', () => {
    expectTypeOf<TestCaseStep['selectorReason']>().toEqualTypeOf<string | undefined>();
  });
});
