import type { RetryTelemetryEntry } from '@qa/types';

export interface RetryRunnerOptions {
  maxRetries?: number;
  flowId: string;
  testCaseId: string;
  /** Return false for an error that must not be retried, such as the user stopping the run. */
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryExecutionResult<T> {
  result?: T;
  outcome: 'PASSED' | 'FLAKY_PASSED' | 'FAILED';
  attempts: number;
  telemetry?: RetryTelemetryEntry;
  error?: Error;
}

export class RetryRunner {
  /**
   * Executes a flow with Clean Whole-Flow Retry semantics.
   * If an attempt fails, it discards and re-runs the action factory.
   */
  static async runWithCleanRetry<T>(
    actionFactory: (attempt: number) => Promise<T>,
    options: RetryRunnerOptions
  ): Promise<RetryExecutionResult<T>> {
    const maxRetries = options.maxRetries ?? 1;
    let attempts = 0;
    let firstError: Error | undefined;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        const result = await actionFactory(attempts);
        if (attempts === 1) {
          return {
            result,
            outcome: 'PASSED',
            attempts,
          };
        } else {
          const telemetry: RetryTelemetryEntry = {
            flowId: options.flowId,
            testCaseId: options.testCaseId,
            failedStepIndex: 0,
            retryCount: attempts - 1,
            status: 'FLAKY_PASSED',
            errorMessage: firstError?.message,
          };

          return {
            result,
            outcome: 'FLAKY_PASSED',
            attempts,
            telemetry,
          };
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (!firstError) {
          firstError = error;
        }

        if (attempts > maxRetries || options.shouldRetry?.(error) === false) {
          const telemetry: RetryTelemetryEntry = {
            flowId: options.flowId,
            testCaseId: options.testCaseId,
            failedStepIndex: 0,
            retryCount: attempts - 1,
            status: 'FAILED',
            errorMessage: error.message,
          };

          return {
            outcome: 'FAILED',
            attempts,
            error,
            telemetry,
          };
        }
      }
    }

    return {
      outcome: 'FAILED',
      attempts,
      error: firstError,
    };
  }
}
