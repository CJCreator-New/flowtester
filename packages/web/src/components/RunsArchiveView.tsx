import React from 'react';
import {
  GitCommit,
  GitBranch,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { TestRun } from '../types/report.js';

interface RunsArchiveViewProps {
  runs: TestRun[];
  activeRunId: string;
  onSelectRun: (runId: string) => void;
  onTriggerRun: () => void;
  isRunning: boolean;
}

export function RunsArchiveView({
  runs,
  activeRunId,
  onSelectRun,
  onTriggerRun,
  isRunning,
}: RunsArchiveViewProps) {
  const formatDuration = (ms: number) => {
    const sec = Math.round(ms / 1000);
    return `${sec}s`;
  };

  return (
    <div className="space-y-5">
      {/* Header with trigger button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Test Execution Runs Archive</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit trail of historical local, CLI, and CI/CD test suite executions
          </p>
        </div>

        <button
          onClick={onTriggerRun}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold px-3.5 py-1.5 rounded-md text-xs transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunning ? 'Running Local Suite...' : 'Trigger New Suite Run'}</span>
        </button>
      </div>

      {/* Runs Table */}
      <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-900/30">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800 font-medium">
            <tr>
              <th className="px-4 py-3">Run & Scope</th>
              <th className="px-4 py-3">Commit & Branch</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Readiness Score</th>
              <th className="px-4 py-3">Tests Passed</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {runs.map((run) => {
              const isSelected = run.id === activeRunId;
              const isGated = run.status === 'gated' || run.status === 'failed';

              return (
                <tr
                  key={run.id}
                  onClick={() => onSelectRun(run.id)}
                  className={`hover:bg-zinc-800/40 cursor-pointer transition-colors ${
                    isSelected ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  {/* Run & Scope */}
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-zinc-100 flex items-center gap-2">
                      <span>{run.name}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                          Viewing
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      {run.targetUrl}
                    </div>
                  </td>

                  {/* Commit & Branch */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px]">
                      <GitBranch className="w-3 h-3 text-zinc-400" />
                      <span>{run.branch}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[10px] mt-0.5">
                      <GitCommit className="w-3 h-3 text-zinc-400" />
                      <span>{run.commitSha}</span>
                    </div>
                  </td>

                  {/* Trigger */}
                  <td className="px-4 py-3.5 uppercase text-[10px] font-mono tracking-wider text-zinc-400">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/50">
                      {run.trigger}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    {run.status === 'running' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        Running
                      </span>
                    ) : isGated ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <ShieldAlert className="w-3 h-3" />
                        Gated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3" />
                        Ready
                      </span>
                    )}
                  </td>

                  {/* Readiness Score */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold font-mono text-sm ${
                          run.readinessScore >= 85
                            ? 'text-emerald-400'
                            : run.readinessScore >= 60
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {run.readinessScore}
                      </span>
                      <span className="text-[10px] text-zinc-400">/ 100</span>
                    </div>
                  </td>

                  {/* Tests Passed */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-zinc-200">
                        {run.passedTests}/{run.totalTests}
                      </span>
                      {run.failedTests > 0 && (
                        <span className="text-[10px] text-rose-400 font-medium">
                          ({run.failedTests} failed)
                        </span>
                      )}
                    </div>
                    <div className="w-24 bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className={`h-full ${
                          run.failedTests === 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.round((run.passedTests / run.totalTests) * 100)}%`,
                        }}
                      />
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="px-4 py-3.5 text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(run.durationMs)}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{run.startedAt}</div>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRun(run.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <span>View Report</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
