import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, ArrowRight } from 'lucide-react';

export interface TestExecutionStep {
  index: number;
  name: string;
  action: string;
  target?: string;
  durationMs?: number;
  status: 'passed' | 'failed' | 'running' | 'pending';
  screenshotUrl?: string;
  error?: string;
}

interface LiveExecutionStepperProps {
  steps: TestExecutionStep[];
  currentStepIndex: number;
  testCaseName: string;
}

export function LiveExecutionStepper({
  steps,
  currentStepIndex,
  testCaseName,
}: LiveExecutionStepperProps) {
  return (
    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
            Active Test Execution
          </span>
          <h3 className="text-sm font-semibold text-zinc-100 mt-0.5">{testCaseName}</h3>
        </div>
        <div className="text-xs text-zinc-400 font-mono">
          Step {Math.min(currentStepIndex + 1, steps.length)} of {steps.length}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {steps.map((step, idx) => {
          const isPassed = step.status === 'passed';
          const isFailed = step.status === 'failed';
          const isRunning = step.status === 'running';

          return (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-xs transition-all ${
                isRunning
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                  : isFailed
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                  : isPassed
                  ? 'bg-zinc-900/40 border-zinc-800 text-zinc-300'
                  : 'bg-zinc-900/10 border-zinc-800/40 text-zinc-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isRunning && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
                  {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {isFailed && <XCircle className="w-4 h-4 text-rose-400" />}
                  {!isRunning && !isPassed && !isFailed && (
                    <Clock className="w-4 h-4 text-zinc-600" />
                  )}

                  <span className="font-medium text-zinc-200">{step.name}</span>
                  <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                    {step.action}
                  </span>
                </div>

                {step.durationMs !== undefined && (
                  <span className="font-mono text-[11px] text-zinc-400">{step.durationMs}ms</span>
                )}
              </div>

              {step.error && (
                <div className="mt-2 p-2 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 font-mono text-[11px]">
                  {step.error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
