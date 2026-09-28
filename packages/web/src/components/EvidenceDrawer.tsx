import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Code,
  AlertOctagon,
  Image as ImageIcon,
  CheckCircle,
  ShieldCheck,
  Bug,
} from 'lucide-react';
import { SeverityBadge, StatusBadge } from './ui/Badge.js';

export interface FindingDetail {
  id: string;
  title: string;
  severity: string;
  checker: string;
  route: string;
  fingerprint: string;
  status: string;
  occurrenceCount: number;
  selector?: string;
  expected?: string;
  actual?: string;
  stepsToReproduce?: string[];
  screenshotUrl?: string;
  consoleErrors?: string[];
}

interface EvidenceDrawerProps {
  finding: FindingDetail | null;
  onClose: () => void;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function EvidenceDrawer({ finding, onClose, onStatusChange }: EvidenceDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!finding) return null;

  const handleCopyRepro = () => {
    const text = (finding.stepsToReproduce || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 h-full flex flex-col shadow-2xl text-zinc-100 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <StatusBadge status={finding.status} />
              <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                {finding.fingerprint}
              </span>
            </div>
            <h2 className="text-base font-semibold text-zinc-100 leading-snug">{finding.title}</h2>
            <div className="text-xs text-zinc-400 flex items-center gap-2">
              <span>Checker: <strong className="text-zinc-200 font-mono">{finding.checker}</strong></span>
              <span>•</span>
              <span>Seen across <strong className="text-zinc-200">{finding.occurrenceCount}</strong> run(s)</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Route & Selector */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-medium">Route</span>
              <span className="font-mono text-emerald-400">{finding.route}</span>
            </div>
            {finding.selector && (
              <div className="flex items-center justify-between text-xs border-t border-zinc-800/60 pt-2">
                <span className="text-zinc-500 font-medium">Selector</span>
                <span className="font-mono text-zinc-300 max-w-xs truncate">{finding.selector}</span>
              </div>
            )}
          </div>

          {/* Expected vs Actual */}
          {(finding.expected || finding.actual) && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Expected vs Actual</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs">
                  <div className="text-emerald-400 font-medium mb-1">Expected</div>
                  <div className="text-zinc-300">{finding.expected || 'Conforms to spec without exceptions'}</div>
                </div>
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20 text-xs">
                  <div className="text-rose-400 font-medium mb-1">Actual</div>
                  <div className="text-zinc-300">{finding.actual || 'Encountered non-conformance failure'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Screenshot Evidence */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>Captured Screenshot Evidence</span>
            </h3>
            {finding.screenshotUrl ? (
              <div className="rounded-lg border border-zinc-800 overflow-hidden bg-black max-h-72 flex items-center justify-center">
                <img
                  src={finding.screenshotUrl}
                  alt="Failure Evidence Screenshot"
                  className="w-full object-contain max-h-72"
                />
              </div>
            ) : (
              <div className="p-6 rounded-lg border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                Screenshot captured in local runner directory (.qa-report/evidence)
              </div>
            )}
          </div>

          {/* Steps to Reproduce */}
          {finding.stepsToReproduce && finding.stepsToReproduce.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Steps to Reproduce</h3>
                <button
                  onClick={handleCopyRepro}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Steps'}</span>
                </button>
              </div>
              <ol className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-lg space-y-1.5 text-xs text-zinc-300 list-decimal list-inside font-sans">
                {finding.stepsToReproduce.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-zinc-200">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <button
            onClick={() => {
              const reproContent = `import { test, expect } from '@playwright/test';

// Automated Repro Script for: ${finding.id} - ${finding.title}
// Structural Fingerprint: ${finding.fingerprint}
test('reproduce finding: ${finding.id}', async ({ page }) => {
  await page.goto('http://localhost:3000${finding.route}');

${(finding.stepsToReproduce || []).map((s) => `  // ${s}`).join('\n')}

${finding.selector ? `  const target = page.locator('${finding.selector}');\n  await expect(target).toBeVisible();` : ''}
});
`;
              const blob = new Blob([reproContent], { type: 'text/typescript' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `repro-${finding.id.toLowerCase()}.spec.ts`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Export Playwright Script</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onStatusChange?.(finding.id, 'ACCEPTED_RISK')}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:bg-zinc-800 border border-zinc-700 transition-colors"
            >
              Accept Risk
            </button>
            <button
              onClick={() => onStatusChange?.(finding.id, 'VERIFIED_FIXED')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mark Verified Fixed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
