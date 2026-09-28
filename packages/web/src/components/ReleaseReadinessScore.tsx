import React from 'react';
import { ShieldCheck, ShieldAlert, Award } from 'lucide-react';
import type { FindingDetail } from './EvidenceDrawer.js';

interface ReleaseReadinessScoreProps {
  findings: FindingDetail[];
  releaseTarget: string;
}

export function ReleaseReadinessScore({ findings, releaseTarget }: ReleaseReadinessScoreProps) {
  const openFindings = findings.filter((f) => f.status === 'OPEN' || f.status === 'new');
  const criticalCount = openFindings.filter((f) => f.severity === 'critical').length;
  const highCount = openFindings.filter((f) => f.severity === 'high').length;
  const mediumCount = openFindings.filter((f) => f.severity === 'medium').length;

  // Gate Calculation
  let score = 100 - (criticalCount * 30 + highCount * 12 + mediumCount * 3);
  score = Math.max(0, Math.min(100, score));

  const isGated = criticalCount > 0 || score < 85;

  return (
    <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center border font-bold text-xl ${
            isGated
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}
        >
          {score}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
              Pre-Release Quality Gate
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isGated
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isGated ? (
                <>
                  <ShieldAlert className="w-3 h-3" /> Gated (Blocked)
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3" /> Release Ready
                </>
              )}
            </span>
          </div>

          <div className="text-sm font-semibold text-zinc-100 mt-1">
            Target: <span className="font-mono text-emerald-400">{releaseTarget}</span>
          </div>

          <p className="text-xs text-zinc-400 mt-0.5">
            {isGated
              ? `${criticalCount} critical blocker(s) must be verified fixed prior to release sign-off.`
              : 'All quality gates passed. Zero critical regressions detected across test runs.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-zinc-400 border-l border-zinc-800 pl-6">
        <div>
          <div className="text-[11px] text-zinc-500 uppercase">Blockers</div>
          <div className="text-base font-bold text-rose-400">{criticalCount}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 uppercase">High Priority</div>
          <div className="text-base font-bold text-amber-400">{highCount}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 uppercase">Resolved</div>
          <div className="text-base font-bold text-emerald-400">
            {findings.filter((f) => f.status === 'VERIFIED_FIXED').length}
          </div>
        </div>
      </div>
    </div>
  );
}
