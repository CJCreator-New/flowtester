import React, { useState } from 'react';
import {
  FolderTree,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Code,
  Bug,
} from 'lucide-react';
import { SeverityBadge, StatusBadge } from './ui/Badge.js';
import { ReleaseReadinessScore } from './ReleaseReadinessScore.js';
import { LiveExecutionStepper } from './LiveExecutionStepper.js';
import { ReportViewToolbar } from './ReportViewToolbar.js';
import { TestRun, PersonaPreset, ExtendedFindingDetail } from '../types/report.js';

interface RunReportOverviewProps {
  run: TestRun;
  selectedRoute: string;
  onSelectRoute: (route: string) => void;
  selectedFinding: ExtendedFindingDetail | null;
  onSelectFinding: (finding: ExtendedFindingDetail) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPreset: PersonaPreset;
  onPresetChange: (preset: PersonaPreset) => void;
  selectedSeverity: string;
  onSeverityChange: (severity: string) => void;
  onExportMarkdown: () => void;
  onShareLink: () => void;
  onBackToRuns?: () => void;
}

export function RunReportOverview({
  run,
  selectedRoute,
  onSelectRoute,
  selectedFinding,
  onSelectFinding,
  searchQuery,
  onSearchChange,
  currentPreset,
  onPresetChange,
  selectedSeverity,
  onSeverityChange,
  onExportMarkdown,
  onShareLink,
  onBackToRuns,
}: RunReportOverviewProps) {
  const [showStepper, setShowStepper] = useState(run.status === 'running');

  // Compute unique routes with finding statistics
  const routeStats = React.useMemo(() => {
    const stats: Record<string, { total: number; critical: number; high: number; medium: number }> = {};
    for (const f of run.findings) {
      if (!stats[f.route]) {
        stats[f.route] = { total: 0, critical: 0, high: 0, medium: 0 };
      }
      stats[f.route].total += 1;
      if (f.severity === 'critical') stats[f.route].critical += 1;
      if (f.severity === 'high') stats[f.route].high += 1;
      if (f.severity === 'medium') stats[f.route].medium += 1;
    }
    return stats;
  }, [run.findings]);

  const uniqueRoutes = Object.keys(routeStats);

  // Filter findings based on preset, route, search, severity
  const filteredFindings = React.useMemo(() => {
    return run.findings.filter((f) => {
      // Route filter
      if (selectedRoute !== 'all' && f.route !== selectedRoute) return false;

      // Severity filter
      if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) return false;

      // Preset filter
      if (currentPreset === 'blockers') {
        const isBlocker = f.severity === 'critical' || f.severity === 'high';
        const isOpen = f.status === 'OPEN' || f.status === 'new';
        if (!isBlocker || !isOpen) return false;
      } else if (currentPreset === 'developer') {
        // Prioritize bug detection and functional errors
        if (f.checker !== 'bug_detection' && !f.consoleErrors?.length) return false;
      } else if (currentPreset === 'a11y') {
        if (f.checker !== 'conformance' && !f.title.toLowerCase().includes('aria')) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          f.title.toLowerCase().includes(q) ||
          f.route.toLowerCase().includes(q) ||
          f.fingerprint.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [run.findings, selectedRoute, selectedSeverity, currentPreset, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner: Quality Gate & Readiness Verdict */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            {onBackToRuns && (
              <button
                onClick={onBackToRuns}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                ← Runs Archive
              </button>
            )}
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 font-mono font-medium">{run.name} ({run.id})</span>
          </div>

          <button
            onClick={() => setShowStepper(!showStepper)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            <Play className="w-3 h-3 text-emerald-400" />
            <span>{showStepper ? 'Hide Execution Stepper' : 'View Step Execution Trace'}</span>
          </button>
        </div>

        <ReleaseReadinessScore findings={run.findings} releaseTarget={run.releaseTarget} />
      </div>

      {/* Stepper (collapsible) */}
      {showStepper && (
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
          <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Execution Flow Stepper: {run.name}
          </div>
          <LiveExecutionStepper
            steps={run.steps}
            currentStepIndex={run.steps.length - 1}
            testCaseName={`${run.name} • ${run.targetUrl}`}
          />
        </div>
      )}

      {/* Toolbar: View Presets, Search, Export */}
      <ReportViewToolbar
        currentPreset={currentPreset}
        onPresetChange={onPresetChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedSeverity={selectedSeverity}
        onSeverityChange={onSeverityChange}
        onExportMarkdown={onExportMarkdown}
        onShareLink={onShareLink}
        totalFindingsCount={run.findings.length}
        filteredCount={filteredFindings.length}
      />

      {/* Tri-Pane Diagnostic Layout: Left Route Tree + Right Triage Matrix */}
      <div className="grid grid-cols-12 gap-5 items-start">
        {/* Left Column: Route / Feature Explorer Tree */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Routes ({uniqueRoutes.length})</span>
            </span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => onSelectRoute('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedRoute === 'all'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <span>All Application Routes</span>
              <span className="text-[11px] font-mono text-zinc-500">{run.findings.length}</span>
            </button>

            {uniqueRoutes.map((route) => {
              const stat = routeStats[route];
              const isSelected = selectedRoute === route;
              const hasCritical = stat.critical > 0;
              const hasHigh = stat.high > 0;

              return (
                <button
                  key={route}
                  onClick={() => onSelectRoute(route)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="truncate font-mono text-[11px] pr-2">
                    {route}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {hasCritical ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500" title="Critical defect" />
                    ) : hasHigh ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500" title="High defect" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-zinc-600" />
                    )}
                    <span className="text-[11px] font-mono text-zinc-500">
                      {stat.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Findings Matrix */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-900/30">
          <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-200">
              Findings Matrix ({filteredFindings.length})
            </span>
            <span className="text-zinc-500">
              Click a row to inspect evidence, network traces & Playwright repro
            </span>
          </div>

          {filteredFindings.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-semibold text-zinc-200">No Defects In This Scope</div>
              <p className="text-xs text-zinc-500">
                All tests passed for the selected filters and routes.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/60 text-zinc-400 border-b border-zinc-800 font-medium">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Finding Title</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Checker</th>
                    <th className="px-4 py-3">Occurrences</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {filteredFindings.map((finding) => {
                    const isSelected = selectedFinding?.id === finding.id;

                    return (
                      <tr
                        key={finding.id}
                        onClick={() => onSelectFinding(finding)}
                        className={`hover:bg-zinc-800/40 cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <SeverityBadge severity={finding.severity} />
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-200">
                          <div>{finding.title}</div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            ID: {finding.id} • {finding.fingerprint}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">{finding.route}</td>
                        <td className="px-4 py-3 text-zinc-400">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono border border-zinc-700/60">
                            {finding.checker}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {finding.occurrenceCount}x
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={finding.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-medium">
                            <span>Evidence</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
