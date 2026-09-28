import React from 'react';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FindingStatus = 'OPEN' | 'VERIFIED_FIXED' | 'REGRESSED' | 'ACCEPTED_RISK' | 'new';

interface SeverityBadgeProps {
  severity: Severity | string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const norm = severity.toLowerCase();
  switch (norm) {
    case 'critical':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-rose-500/10 text-rose-400 border border-rose-500/25">
          Critical
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
          High
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-sky-500/10 text-sky-400 border border-sky-500/25">
          Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
          Low
        </span>
      );
  }
}

interface StatusBadgeProps {
  status: FindingStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'VERIFIED_FIXED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          Verified Fixed
        </span>
      );
    case 'REGRESSED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
          Regressed
        </span>
      );
    case 'ACCEPTED_RISK':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
          Accepted Risk
        </span>
      );
    case 'OPEN':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
          Open
        </span>
      );
  }
}
