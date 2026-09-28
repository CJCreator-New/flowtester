import React, { useState } from 'react';
import {
  ShieldAlert,
  Terminal,
  Eye,
  SlidersHorizontal,
  Search,
  Share2,
  FileText,
  Printer,
  Check,
  Filter,
} from 'lucide-react';
import { PersonaPreset } from '../types/report.js';

interface ReportViewToolbarProps {
  currentPreset: PersonaPreset;
  onPresetChange: (preset: PersonaPreset) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedSeverity: string;
  onSeverityChange: (severity: string) => void;
  onExportMarkdown: () => void;
  onShareLink: () => void;
  totalFindingsCount: number;
  filteredCount: number;
}

export function ReportViewToolbar({
  currentPreset,
  onPresetChange,
  searchQuery,
  onSearchChange,
  selectedSeverity,
  onSeverityChange,
  onExportMarkdown,
  onShareLink,
  totalFindingsCount,
  filteredCount,
}: ReportViewToolbarProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const handleShare = () => {
    onShareLink();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExport = () => {
    onExportMarkdown();
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
      {/* Top Bar: Persona Presets & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Persona Preset Buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-950/80 p-1 rounded-lg border border-zinc-800">
          <span className="text-[11px] font-medium text-zinc-400 px-2 uppercase tracking-wider">
            View Preset:
          </span>
          <button
            onClick={() => onPresetChange('all')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              currentPreset === 'all'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>All Findings</span>
          </button>

          <button
            onClick={() => onPresetChange('blockers')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              currentPreset === 'blockers'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Release Blockers</span>
          </button>

          <button
            onClick={() => onPresetChange('developer')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              currentPreset === 'developer'
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Developer Triage</span>
          </button>

          <button
            onClick={() => onPresetChange('a11y')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              currentPreset === 'a11y'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>A11y & Conformance</span>
          </button>
        </div>

        {/* Export and Sharing Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            title="Copy deep link with current filters to clipboard"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700/60 transition-colors"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Share View</span>
              </>
            )}
          </button>

          <button
            onClick={handleExport}
            title="Generate and copy GitHub PR markdown summary"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700/60 transition-colors"
          >
            {copiedMarkdown ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">PR Markdown Copied!</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Export PR Markdown</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            title="Print or Save PDF report"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700/60 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-400" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Bottom Bar: Search & Severity Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search findings by title, route, or fingerprint..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-500">Severity:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => onSeverityChange(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/60"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          Showing <span className="text-zinc-200 font-semibold">{filteredCount}</span> of {totalFindingsCount} findings
        </div>
      </div>
    </div>
  );
}
