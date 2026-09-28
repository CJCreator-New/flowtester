import { useEffect, useState, useCallback } from 'react';
import type { TestExecutionStep } from '../components/LiveExecutionStepper.js';

export interface RunnerStreamState {
  connected: boolean;
  isRunning: boolean;
  currentRunId?: string;
  testCaseName?: string;
  currentStepIndex: number;
  steps: TestExecutionStep[];
  error?: string;
}

export function useRunnerStream(streamEndpoint: string = '/api/runner/stream') {
  const [state, setState] = useState<RunnerStreamState>({
    connected: false,
    isRunning: false,
    currentStepIndex: 0,
    steps: [],
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        es = new EventSource(streamEndpoint);

        es.onopen = () => {
          setState((prev) => ({ ...prev, connected: true, error: undefined }));
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
              setState((prev) => ({ ...prev, connected: true }));
            } else if (data.type === 'RUN_STARTED') {
              setState({
                connected: true,
                isRunning: true,
                currentRunId: data.runId,
                testCaseName: data.testCaseName || data.testCaseId,
                currentStepIndex: 0,
                steps: [],
              });
            } else if (data.type === 'STEP_STARTED') {
              setState((prev) => {
                const nextSteps = [...prev.steps];
                nextSteps[data.stepIndex] = {
                  index: data.stepIndex,
                  name: data.stepName || `Step ${data.stepIndex + 1}`,
                  action: data.action,
                  target: data.target,
                  status: 'running',
                };
                return {
                  ...prev,
                  currentStepIndex: data.stepIndex,
                  steps: nextSteps,
                };
              });
            } else if (data.type === 'STEP_COMPLETED') {
              setState((prev) => {
                const nextSteps = [...prev.steps];
                if (nextSteps[data.stepIndex]) {
                  nextSteps[data.stepIndex] = {
                    ...nextSteps[data.stepIndex],
                    status: data.passed ? 'passed' : 'failed',
                    durationMs: data.durationMs,
                    screenshotUrl: data.screenshotUrl,
                    error: data.error,
                  };
                }
                return {
                  ...prev,
                  steps: nextSteps,
                };
              });
            } else if (data.type === 'RUN_COMPLETED') {
              setState((prev) => ({
                ...prev,
                isRunning: false,
              }));
            } else if (data.type === 'RUN_FAILED') {
              setState((prev) => ({
                ...prev,
                isRunning: false,
                error: data.error,
              }));
            }
          } catch (err) {
            console.error('Failed to parse SSE event payload:', err);
          }
        };

        es.onerror = () => {
          setState((prev) => ({ ...prev, connected: false }));
          if (es) {
            es.close();
            es = null;
          }
          // Attempt graceful reconnect after 15 seconds if offline
          reconnectTimeout = setTimeout(connect, 15000);
        };
      } catch (err: any) {
        setState((prev) => ({ ...prev, connected: false, error: err.message }));
      }
    };

    connect();

    return () => {
      if (es) es.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [streamEndpoint]);

  const resetState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRunning: false,
      currentStepIndex: 0,
      steps: [],
    }));
  }, []);

  return {
    ...state,
    resetState,
  };
}
