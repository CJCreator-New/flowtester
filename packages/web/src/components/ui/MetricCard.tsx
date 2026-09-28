import React, { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  trend?: 'positive' | 'negative' | 'neutral';
}

export function MetricCard({ title, value, subtitle, icon, badge }: MetricCardProps) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700/80 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{title}</span>
        {icon && <div className="text-zinc-400">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold tracking-tight text-zinc-100">{value}</div>
        {badge}
      </div>
      {subtitle && <div className="text-xs text-zinc-400 mt-1">{subtitle}</div>}
    </div>
  );
}
