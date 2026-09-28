import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Code,
  AlertOctagon,
  Image as ImageIcon,
  Activity,
  Terminal,
  FileCode,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { SeverityBadge, StatusBadge } from './ui/Badge.js';
import { FindingDetail } from './EvidenceDrawer.js';
import { ExtendedFindingDetail } from '../types/report.js';

interface EvidenceInspectorProps {
  finding: ExtendedFindingDetail | null;
  onClose: () => void;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function EvidenceInspector({ finding, onClose, onStatusChange }: EvidenceInspectorProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'trace' | 'stack' | 'repro'>('visual');
  const [copiedRepro, setCopiedRepro] = useState(false);
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!finding) return null;

  const generatePlaywrightSnippet = () => {
    return `import { test, expect } from '@playwright/test';

test('reproduce defect: ${finding.id} - ${finding.title.replace(/'/g, "\\'")}', async ({ page }) => {
  // Target route: ${finding.route}
  await page.goto('${finding.route}');

  // Steps to reproduce
${(finding.stepsToReproduce || [])
  .map((step) => `  // ${step}\n  // Execute corresponding interaction here`)
  .join('\n')}

  // Assert expected behavior:
  // Expected: ${finding.expected || 'Correct behavior'}
  ${
    finding.selector
      ? `const target = page.locator('${finding.selector}');\n  await expect(target).toBeVisible();`
      : `// Verify target state`
  }
});
`;
  };

  const handleCopySpec = () => {
    navigator.clipboard.writeText(generatePlaywrightSnippet());
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  const handleCopyRepro = () => {
    const markdown = `### Defect [${finding.id}]: ${finding.title}
- **Severity**: ${finding.severity.toUpperCase()}
- **Route**: \`${finding.route}\`
- **Checker**: \`${finding.checker}\`
- **Fingerprint**: \`${finding.fingerprint}\`

#### Expected Behavior
${finding.expected || 'N/A'}

#### Actual Behavior
${finding.actual || 'N/A'}

#### Steps to Reproduce
${(finding.stepsToReproduce || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

${
  finding.consoleErrors?.length
    ? `#### Console Errors\n\`\`\`\n${finding.consoleErrors.join('\n')}\n\`\`\``
    : ''
}
`;
    navigator.clipboard.writeText(markdown);
    setCopiedRepro(true);
    setTimeout(() => setCopiedRepro(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div
        className={`bg-zinc-900 border-l border-zinc-800 h-full flex flex-col shadow-2xl text-zinc-100 transition-all duration-200 ${
          isExpanded ? 'w-full max-w-4xl' : 'w-full max-w-2xl'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-4 bg-zinc-950/40">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <StatusBadge status={finding.status} />
              <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                {finding.id}
              </span>
              <span className="text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                {finding.checker}
              </span>
            </div>
            <h2 className="text-base font-semibold text-zinc-100 leading-snug truncate">
              {finding.title}
            </h2>
            <div className="text-xs text-zinc-400 font-mono flex items-center gap-2">
              <span>Route: <span className="text-emerald-400">{finding.route}</span></span>
              <span>•</span>
              <span>Occurrences: <span className="text-zinc-200">{finding.occurrenceCount} runs</span></span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse' : 'Expand full width'}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-5 gap-4">
          <button
            onClick={() => setActiveTab('visual')}
            className={`py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'visual'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Visual Proof</span>
          </button>

          <button
            onClick={() => setActiveTab('trace')}
            className={`py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'trace'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Execution & Network</span>
          </button>

          <button
            onClick={() => setActiveTab('stack')}
            className={`py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'stack'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console & Stack</span>
          </button>

          <button
            onClick={() => setActiveTab('repro')}
            className={`py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'repro'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Repro Spec & Export</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'visual' && (
            <div className="space-y-4">
              {/* Target Selector */}
              {finding.selector && (
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1">
                    <Code className="w-3 h-3 text-emerald-400" /> Failing Target Selector
                  </div>
                  <div className="font-mono text-xs text-emerald-400 bg-zinc-900/80 p-2 rounded border border-zinc-800 select-all overflow-x-auto">
                    {finding.selector}
                  </div>
                </div>
              )}

              {/* Expected vs Actual */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Expected Behavior
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {finding.expected || 'Specified behavior without defects or unhandled rejections.'}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 space-y-1.5">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                    Observed Failure
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {finding.actual || 'Assertion failure or unexpected error state occurred.'}
                  </p>
                </div>
              </div>

              {/* Visual Frame / Screenshot */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Viewport Evidence Snapshot
                </div>
                <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 min-h-[220px] flex flex-col items-center justify-center p-6 text-center">
                  {finding.screenshotUrl ? (
                    <img
                      src={finding.screenshotUrl}
                      alt="Defect screenshot"
                      className="max-h-[360px] object-contain rounded border border-zinc-800 shadow"
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-500">
                        <ImageIcon className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div className="text-xs text-zinc-400 font-medium">Element Bounding Box Captured</div>
                      <div className="text-[11px] text-zinc-600 font-mono max-w-sm">
                        Selector: {finding.selector || 'root viewport'} (Captured via headless Chromium CDP trace)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Steps Leading to Failure
              </div>
              <div className="space-y-2">
                {(finding.stepsToReproduce || []).map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2.5 rounded-md bg-zinc-950 border border-zinc-800/80 text-xs"
                  >
                    <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-mono text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-zinc-200">{step}</span>
                  </div>
                ))}
              </div>

              {/* Network Tracing */}
              <div className="pt-2 space-y-2">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Correlated Network Activity</span>
                  <span className="text-[10px] text-zinc-500 font-mono">1 Failed Request</span>
                </div>
                <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 font-mono text-xs">
                  <div className="p-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-rose-400 font-bold">POST</span>
                      <span className="text-zinc-300">/api/pay</span>
                    </span>
                    <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[10px] font-bold">
                      500 Internal Error
                    </span>
                  </div>
                  <div className="p-2.5 text-[11px] text-zinc-400">
                    Duration: 412ms • Response: <code className="text-rose-300">{"{\"error\": \"payment_gateway_down\"}"}</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stack' && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Browser Console & Runtime Errors
              </div>
              {finding.consoleErrors && finding.consoleErrors.length > 0 ? (
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs space-y-2 overflow-x-auto text-rose-400">
                  {finding.consoleErrors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-zinc-500 border border-zinc-800 rounded-lg">
                  No unhandled browser console errors detected.
                </div>
              )}

              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pt-2">
                Sanitized Stack Trace
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-400 overflow-x-auto space-y-1">
                <div>Error: Element expectation failed at Playwright.assertValidState</div>
                <div className="text-zinc-600 pl-4">at CheckoutController.submitPayment (/src/controllers/pay.ts:42:11)</div>
                <div className="text-zinc-600 pl-4">at async HTMLButtonElement.dispatchSubmit (/src/components/Checkout.tsx:98:5)</div>
                <div className="text-zinc-600 pl-4">at RunnerEngine.executeStep (/packages/core/src/runner.ts:184:7)</div>
              </div>
            </div>
          )}

          {activeTab === 'repro' && (
            <div className="space-y-4">
              {/* Playwright Test Spec */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Playwright Reproduction Spec
                  </div>
                  <button
                    onClick={handleCopySpec}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                  >
                    {copiedSpec ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copy Spec (.ts)</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3.5 font-mono text-[11px] text-zinc-300 overflow-x-auto leading-relaxed select-all">
                  {generatePlaywrightSnippet()}
                </pre>
              </div>

              {/* GitHub / Jira Issue Markdown */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    GitHub / Jira Bug Ticket Template
                  </div>
                  <button
                    onClick={handleCopyRepro}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                  >
                    {copiedRepro ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copy Bug Report</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-zinc-400">
                  Pre-formatted Markdown with steps to reproduce, expected vs actual behavior, and console errors.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions / Triage State */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Triage Status:</span>
            <select
              value={finding.status}
              onChange={(e) => onStatusChange?.(finding.id, e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 font-medium focus:outline-none focus:border-emerald-500/60"
            >
              <option value="OPEN">OPEN (Unresolved)</option>
              <option value="VERIFIED_FIXED">VERIFIED_FIXED</option>
              <option value="WONT_FIX">WONT_FIX (Expected)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
