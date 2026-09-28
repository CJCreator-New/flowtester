import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  BarChart3,
  Server,
  Terminal,
  ExternalLink,
  History,
  FileSpreadsheet,
  Globe,
  Settings2,
} from 'lucide-react';
import { MetricCard } from './components/ui/MetricCard.js';
import { EvidenceInspector } from './components/EvidenceInspector.js';
import { RunsArchiveView } from './components/RunsArchiveView.js';
import { RunReportOverview } from './components/RunReportOverview.js';
import { RunConfigModal, type RunConfig } from './components/RunConfigModal.js';
import { TestRun, PersonaPreset, ExtendedFindingDetail } from './types/report.js';
import { useRunnerStream } from './hooks/useRunnerStream.js';
import type { FindingSeverity, ReleaseReport, ConsolidatedReleaseReport } from '@qa/types';

// Maps the engine's real severity taxonomy (Finding.severity is always one of these four
// values) onto the UI's severity vocabulary. Replaces the previous `f.severity || 'medium'`
// fallback, which was wrong for every real finding since 'Blocker'/'Major'/'Minor'/
// 'Suggestion' are never falsy and never equal to the UI's own 'critical'/'high'/etc strings.
const SEVERITY_MAP: Record<FindingSeverity, ExtendedFindingDetail['severity']> = {
  Blocker: 'critical',
  Major: 'high',
  Minor: 'medium',
  Suggestion: 'low',
};

function mapSeverity(severity: unknown): ExtendedFindingDetail['severity'] {
  if (typeof severity === 'string' && severity in SEVERITY_MAP) {
    return SEVERITY_MAP[severity as FindingSeverity];
  }
  return 'medium';
}

/**
 * Converts a real engine ReleaseReport (from the runner's /api/report, or the CLI's
 * findings.json) into the dashboard's TestRun view model. Extracted so both the
 * mount-time fetch and the live-run-completion fetch share one implementation.
 */
function reportToTestRun(data: any): TestRun {
  const loadedFindings: ExtendedFindingDetail[] = (data.findings || []).map((f: any) => ({
    id: f.id || `F-${Math.random().toString(36).slice(2, 6)}`,
    title: f.title || f.description || 'Reported Finding',
    severity: mapSeverity(f.severity),
    checker: f.checker || 'bug_detection',
    route: f.where?.urlPath || f.route || f.url || '/',
    fingerprint: f.fingerprint || `fp_${(f.id || 'live').toLowerCase()}`,
    status: f.triageStatus === 'Resolved' ? 'VERIFIED_FIXED' : f.triageStatus === 'Intended' || f.triageStatus === 'False Positive' ? 'ACCEPTED_RISK' : 'OPEN',
    occurrenceCount: f.occurrenceCount || 1,
    selector: f.where?.cssSelector || f.where?.dataTestId || f.selector,
    expected: f.expectedVsActual?.expected || f.expected,
    actual: f.expectedVsActual?.actual || f.actual,
    stepsToReproduce: f.stepsToReproduce || f.reproductionSteps || [],
    consoleErrors: (f.evidence?.consoleLogs || f.consoleErrors || []).map((c: any) =>
      typeof c === 'string' ? c : c.text
    ),
    screenshotUrl: f.evidence?.screenshotPath ? `/api/evidence/${toEvidenceRelPath(f.evidence.screenshotPath)}` : undefined,
  }));

  const failedCount = data.coverage?.failed || 0;

  return {
    id: data.runId,
    name: `Live Execution Run (${data.productId || 'default'})`,
    targetUrl: data.targetUrl || 'http://localhost:3000',
    releaseTarget: 'latest',
    branch: 'current',
    commitSha: 'HEAD',
    trigger: 'manual',
    status: failedCount > 0 ? 'gated' : 'passed',
    startedAt: data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Recent',
    durationMs: data.durationMs || 0,
    readinessScore: Math.max(0, 100 - failedCount * 20),
    totalTests: data.coverage?.totalTestPoints || 0,
    passedTests: data.coverage?.passed || 0,
    failedTests: failedCount,
    steps: (data.results || []).flatMap((r: any) =>
      (r.stepEvidence || []).map((se: any, idx: number) => ({
        index: idx,
        name: se.stepName || `Step ${idx + 1}`,
        action: se.action || 'step',
        target: se.urlAfter || se.urlBefore || 'action',
        durationMs: se.durationMs || 0,
        status: se.passed ? 'passed' : 'failed',
        error: se.error,
      }))
    ),
    findings: loadedFindings,
  };
}

// The runner serves evidence files rooted at its OWN output dir (not the "evidence/"
// subdirectory), so the URL must retain the "evidence/..." prefix — matching how
// FlowTestOrchestrator itself builds STEP_COMPLETED's screenshotUrl via path.relative(outputDir, ...).
function toEvidenceRelPath(absOrRelPath: string): string {
  const normalized = absOrRelPath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/evidence/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

const MOCK_RUNS: TestRun[] = [
  {
    id: 'run-042',
    name: 'v1.4.0-rc2 Full Regression Suite',
    targetUrl: 'http://localhost:3000',
    releaseTarget: 'v1.4.0-rc2',
    branch: 'release/v1.4.0',
    commitSha: '7f9a1c2',
    trigger: 'ci',
    status: 'gated',
    startedAt: '12 mins ago',
    durationMs: 14200,
    readinessScore: 55,
    totalTests: 24,
    passedTests: 21,
    failedTests: 3,
    steps: [
      { index: 0, name: 'Navigate to target origin', action: 'goto', target: 'http://localhost:3000/login', durationMs: 340, status: 'passed' },
      { index: 1, name: 'Authenticate as test user', action: 'fill', target: 'input[name="email"]', durationMs: 120, status: 'passed' },
      { index: 2, name: 'Open user flows inventory', action: 'click', target: 'a[href="/flows"]', durationMs: 250, status: 'passed' },
      { index: 3, name: 'Submit checkout payment button', action: 'click', target: 'button[data-testid="submit-payment-btn"]', durationMs: 412, status: 'failed', error: 'HTTP 500: payment gateway stub failure' },
    ],
    findings: [
      {
        id: 'F-001',
        title: 'Checkout payment submission triggers unhandled 500 error',
        severity: 'critical',
        checker: 'bug_detection',
        route: '/checkout/pay',
        fingerprint: 'fp_chk_b3f91a',
        status: 'OPEN',
        occurrenceCount: 8,
        selector: 'button[data-testid="submit-payment-btn"]',
        expected: 'Returns 200 with confirmation order id and redirect',
        actual: 'HTTP 500 Internal Server Error returned by payment gateway stub',
        stepsToReproduce: [
          'Navigate to /checkout/cart as role:customer',
          'Fill required shipping address fields',
          'Click "Proceed to Payment"',
          'Click submit payment button',
          'Observe console error and 500 response in network panel',
        ],
        consoleErrors: ['POST http://localhost:3000/api/pay net::ERR_HTTP_RESPONSE_CODE_FAILURE 500'],
      },
      {
        id: 'F-002',
        title: 'Missing accessible ARIA name on top navigation drawer toggle',
        severity: 'high',
        checker: 'conformance',
        route: '/dashboard',
        fingerprint: 'fp_nav_42a18f',
        status: 'OPEN',
        occurrenceCount: 15,
        selector: 'button.menu-toggle',
        expected: 'Interactive element has accessible name via aria-label or visible text',
        actual: 'Button element has no accessible name or text content',
        stepsToReproduce: [
          'Navigate to /dashboard as role:admin',
          'Inspect header hamburger toggle',
          'Verify accessibility tree has unnamed button',
        ],
      },
      {
        id: 'F-003',
        title: 'Password change input field allows whitespace-only submissions',
        severity: 'medium',
        checker: 'conformance',
        route: '/settings/security',
        fingerprint: 'fp_sec_99d21e',
        status: 'VERIFIED_FIXED',
        occurrenceCount: 3,
        selector: 'input[name="new_password"]',
        expected: 'Triggers inline validation "Password must contain non-whitespace characters"',
        actual: 'Form submits successfully without client-side error',
        stepsToReproduce: [
          'Go to /settings/security',
          'Enter spaces into new password field',
          'Click Save Changes',
        ],
      },
    ],
  },
  {
    id: 'run-041',
    name: 'PR #128 Auth Flow Verification',
    targetUrl: 'http://localhost:3000',
    releaseTarget: 'v1.4.0-rc1',
    branch: 'feat/oauth-flow',
    commitSha: '3d8e5b1',
    trigger: 'cli',
    status: 'passed',
    startedAt: '2 hours ago',
    durationMs: 8400,
    readinessScore: 97,
    totalTests: 18,
    passedTests: 18,
    failedTests: 0,
    steps: [
      { index: 0, name: 'Navigate to login', action: 'goto', target: 'http://localhost:3000/login', durationMs: 290, status: 'passed' },
      { index: 1, name: 'Click OAuth Provider', action: 'click', target: 'button[data-provider="google"]', durationMs: 180, status: 'passed' },
    ],
    findings: [
      {
        id: 'F-004',
        title: 'Minor layout shift on OAuth redirect badge',
        severity: 'low',
        checker: 'conformance',
        route: '/login',
        fingerprint: 'fp_cls_01a',
        status: 'OPEN',
        occurrenceCount: 1,
        selector: '.oauth-spinner',
        expected: 'CLS score below 0.05',
        actual: 'CLS measured at 0.08',
      },
    ],
  },
  {
    id: 'run-040',
    name: 'Nightly Scheduled Smoke Test',
    targetUrl: 'https://staging.qa-example.com',
    releaseTarget: 'v1.3.9',
    branch: 'main',
    commitSha: '1c09ab8',
    trigger: 'manual',
    status: 'passed',
    startedAt: 'Yesterday',
    durationMs: 31000,
    readinessScore: 100,
    totalTests: 45,
    passedTests: 45,
    failedTests: 0,
    steps: [],
    findings: [],
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'runs' | 'report' | 'hub'>('report');
  const [runs, setRuns] = useState<TestRun[]>(MOCK_RUNS);
  const [selectedRunId, setSelectedRunId] = useState<string>('run-042');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedFinding, setSelectedFinding] = useState<ExtendedFindingDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPreset, setCurrentPreset] = useState<PersonaPreset>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState('product-a');
  const [targetUrlInput, setTargetUrlInput] = useState('http://localhost:3000');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [runConfig, setRunConfig] = useState<RunConfig>({
    roles: [],
    mode: 'default',
    aiProvider: 'mock',
    apiKey: '',
    aiModel: '',
    specTestCases: [],
  });

  // Live Runner Stream Integration
  const runnerStream = useRunnerStream('/api/runner/stream');

  // Canonical Defect Register: cross-run consolidated data from the Hub. Falls back to
  // the current run's own findings (or the mock set) whenever the Hub is unreachable, so
  // the tab never renders blank.
  const [consolidatedReport, setConsolidatedReport] = useState<ConsolidatedReleaseReport | null>(null);
  const [hubUnreachable, setHubUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/products/${encodeURIComponent(selectedProduct)}/releases/latest`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: ConsolidatedReleaseReport) => {
        if (!cancelled) {
          setConsolidatedReport(data);
          setHubUnreachable(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConsolidatedReport(null);
          setHubUnreachable(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the selected product changes, or a run just finished (which may
    // have pushed new canonical findings into the Hub).
  }, [selectedProduct, runnerStream.isRunning]);

  // Active Test Run — while the selected run is the one currently streaming live from the
  // Runner service, overlay its in-flight steps/status onto the placeholder so the report
  // view reflects real progress instead of staying static until RUN_COMPLETED.
  const activeRun = useMemo(() => {
    const base = runs.find((r) => r.id === selectedRunId) || runs[0];
    if (!base) return base;
    const isLiveRunForThisRun = runnerStream.currentRunId === base.id && runnerStream.isRunning;
    if (!isLiveRunForThisRun) return base;

    return {
      ...base,
      status: 'running' as const,
      steps: runnerStream.steps.filter(Boolean),
      totalTests: Math.max(base.totalTests, runnerStream.steps.length),
    };
  }, [runs, selectedRunId, runnerStream.currentRunId, runnerStream.isRunning, runnerStream.steps]);

  // Synchronize state from URL parameters and fetch live report if backend is available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetParam = params.get('preset') as PersonaPreset | null;
    const routeParam = params.get('route');
    const runParam = params.get('run');
    const findingParam = params.get('finding');

    if (presetParam && ['all', 'blockers', 'developer', 'a11y'].includes(presetParam)) {
      setCurrentPreset(presetParam);
    }
    if (routeParam) setSelectedRoute(routeParam);
    if (runParam && runs.some((r) => r.id === runParam)) setSelectedRunId(runParam);
    if (findingParam && activeRun) {
      const match = activeRun.findings.find((f) => f.id === findingParam);
      if (match) setSelectedFinding(match);
    }

    // Attempt live report fetching from the Runner service (proxied at /api/report)
    fetch('/api/report')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReleaseReport | null) => {
        if (data && data.runId) {
          const liveRun = reportToTestRun(data);
          setRuns((prev) => [liveRun, ...prev.filter((r) => r.id !== liveRun.id)]);
          setSelectedRunId(liveRun.id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the live SSE stream reports a run has just finished, re-fetch the real report
  // and rebuild the TestRun from it, rather than trusting anything already in local state.
  const lastHandledCompletedRunId = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    if (runnerStream.isRunning) return;
    const finishedRunId = runnerStream.currentRunId;
    if (!finishedRunId || lastHandledCompletedRunId.current === finishedRunId) return;
    lastHandledCompletedRunId.current = finishedRunId;

    if (runnerStream.error) {
      // The run failed before producing a report (e.g. pre-flight rejected the target
      // URL) — mark the placeholder as failed instead of fetching a stale report.
      setRuns((prev) =>
        prev.map((r) =>
          r.id === finishedRunId ? { ...r, status: 'failed' as const, name: `${r.name} (failed: ${runnerStream.error})` } : r
        )
      );
      setTriggerError(runnerStream.error);
      return;
    }

    fetch('/api/report')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReleaseReport | null) => {
        if (!data || !data.runId) return;
        const completedRun = reportToTestRun(data);
        setRuns((prev) => [completedRun, ...prev.filter((r) => r.id !== completedRun.id)]);
        setSelectedRunId(completedRun.id);
      })
      .catch(() => {});
  }, [runnerStream.isRunning, runnerStream.currentRunId]);

  const handleStatusChange = (id: string, newStatus: string) => {
    // Sync with local state
    setRuns((prevRuns) =>
      prevRuns.map((run) => {
        if (run.id === selectedRunId) {
          const updatedFindings = run.findings.map((f) =>
            f.id === id ? { ...f, status: newStatus } : f
          );
          return { ...run, findings: updatedFindings };
        }
        return run;
      })
    );

    if (selectedFinding && selectedFinding.id === id) {
      setSelectedFinding((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    // Triage is canonical on the Hub (cross-run defect register), not the runner —
    // route through the /api/v1 proxy to Hub's PATCH /api/v1/findings/:id/triage.
    fetch(`/api/v1/findings/${id}/triage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
  };

  const handleShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('run', selectedRunId);
    url.searchParams.set('preset', currentPreset);
    if (selectedRoute !== 'all') {
      url.searchParams.set('route', selectedRoute);
    } else {
      url.searchParams.delete('route');
    }
    if (selectedFinding) {
      url.searchParams.set('finding', selectedFinding.id);
    } else {
      url.searchParams.delete('finding');
    }
    navigator.clipboard.writeText(url.toString());
  };

  const handleExportMarkdown = () => {
    const isGated = activeRun.readinessScore < 85;
    const criticalFindings = activeRun.findings.filter((f) => f.severity === 'critical');
    const highFindings = activeRun.findings.filter((f) => f.severity === 'high');

    const markdown = `## QA Test Report: ${activeRun.name}
- **Verdict**: ${isGated ? '❌ BLOCKED / GATED' : '✅ RELEASE READY'}
- **Quality Readiness Score**: ${activeRun.readinessScore}/100
- **Release Target**: \`${activeRun.releaseTarget}\`
- **Branch / Commit**: \`${activeRun.branch}\` (\`${activeRun.commitSha}\`)
- **Tests Summary**: ${activeRun.passedTests}/${activeRun.totalTests} passed (${activeRun.failedTests} failed)

### Key Findings (${activeRun.findings.length} total)
| ID | Severity | Route | Title | Status |
|----|----------|-------|-------|--------|
${activeRun.findings
  .map(
    (f) =>
      `| **${f.id}** | \`${f.severity.toUpperCase()}\` | \`${f.route}\` | ${f.title} | ${f.status} |`
  )
  .join('\n')}

> Generated automatically by QA Flow Studio.
`;
    navigator.clipboard.writeText(markdown);
  };

  const [triggerError, setTriggerError] = useState<string | null>(null);

  const handleTriggerRun = async (customUrl?: string) => {
    const effectiveUrl = customUrl || targetUrlInput || 'http://localhost:3000';
    setTriggerError(null);

    try {
      const res = await fetch('/api/runner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: effectiveUrl,
          productId: selectedProduct,
          releaseTarget: 'latest',
          hubUrl: window.location.origin, // proxied through /api/v1 -> Hub
          roles: runConfig.roles,
          useAI: runConfig.mode === 'ai',
          aiProvider: runConfig.mode === 'ai' ? runConfig.aiProvider : undefined,
          apiKey: runConfig.mode === 'ai' ? runConfig.apiKey : undefined,
          aiModel: runConfig.mode === 'ai' ? runConfig.aiModel || undefined : undefined,
          specTestCases: runConfig.mode === 'manual' ? runConfig.specTestCases : undefined,
        }),
      });

      if (res.status === 409) {
        setTriggerError('A run is already in progress. Wait for it to finish before starting another.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTriggerError(body.error || `Failed to start run (HTTP ${res.status})`);
        return;
      }

      const { runId } = await res.json();
      lastHandledCompletedRunId.current = undefined; // allow the next RUN_COMPLETED to be picked up

      // Show an in-progress placeholder immediately; useRunnerStream's live SSE events
      // (surfaced via the merged `activeRun` below) drive the step-by-step view until
      // RUN_COMPLETED triggers a real /api/report fetch that replaces this placeholder.
      const runningRun: TestRun = {
        id: runId,
        name: `Live Run: ${effectiveUrl.replace(/^https?:\/\//, '')}`,
        targetUrl: effectiveUrl,
        releaseTarget: 'latest',
        branch: 'current',
        commitSha: 'HEAD',
        trigger: 'manual',
        status: 'running',
        startedAt: 'Just now',
        durationMs: 0,
        readinessScore: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        steps: [],
        findings: [],
      };

      setRuns((prev) => [runningRun, ...prev.filter((r) => r.id !== runId)]);
      setSelectedRunId(runId);
      setActiveTab('report');
    } catch (err: any) {
      setTriggerError(err?.message || 'Could not reach the Runner service (is it running on port 3001?)');
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800/80 bg-zinc-900/40 flex flex-col justify-between">
        <div>
          {/* Brand header */}
          <div className="h-16 border-b border-zinc-800/80 flex items-center px-5 gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-wide text-zinc-100">QA Flow Studio</div>
              <div className="text-xs text-zinc-500 font-mono">v0.2.0 • triage</div>
            </div>
          </div>

          {/* Product selector */}
          <div className="p-4 border-b border-zinc-800/60">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-medium block mb-1.5">
              Active Target
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
            >
              <option value="product-a">Product A (Customer Portal)</option>
              <option value="product-b">Product B (Billing Gateway)</option>
              <option value="product-c">Product C (Security & Settings)</option>
            </select>
          </div>

          {/* Navigation modes */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('report')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'report'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <span className="flex items-center gap-3">
                <Activity className="w-4 h-4" />
                <span>Run Diagnostic Report</span>
              </span>
              {activeRun.status === 'gated' && (
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('runs')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'runs'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <span className="flex items-center gap-3">
                <History className="w-4 h-4" />
                <span>Runs Archive ({runs.length})</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('hub')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'hub'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Canonical Defect Register</span>
            </button>
          </nav>
        </div>

        {/* Backend health indicators */}
        <div className="p-4 border-t border-zinc-800/60 bg-zinc-900/60 text-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hub API (Port 4000)</span>
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Online
            </span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              <span>Runner Stream</span>
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                runnerStream.connected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {runnerStream.connected ? (runnerStream.isRunning ? 'Running' : 'Connected') : 'Disconnected'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Suite</span>
              <span className="text-zinc-700">/</span>
              {/* Active Run Selector Dropdown */}
              <select
                value={selectedRunId}
                onChange={(e) => {
                  setSelectedRunId(e.target.value);
                  setSelectedRoute('all');
                  setSelectedFinding(null);
                }}
                className="bg-zinc-800/80 border border-zinc-700/60 rounded-md px-3 py-1 text-xs text-zinc-200 font-semibold focus:outline-none focus:border-emerald-500/60"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}: {r.name} ({r.readinessScore} pts)
                  </option>
                ))}
              </select>
            </div>

            {/* Target URL Input Field */}
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1">
              <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-zinc-500 font-mono">URL:</span>
              <input
                type="text"
                placeholder="https://example.com"
                value={targetUrlInput}
                onChange={(e) => setTargetUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTriggerRun(targetUrlInput);
                }}
                className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-56 font-mono"
              />
            </div>

            <button
              onClick={() => setIsConfigOpen(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 px-2.5 py-1.5 rounded-md bg-zinc-900/60 transition-colors"
              title="Configure credentials and what to check"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Configure</span>
              {(runConfig.roles.length > 0 || runConfig.mode !== 'default') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="http://localhost:9001"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 border border-zinc-800 px-2.5 py-1.5 rounded bg-zinc-900/60 transition-colors"
            >
              <span>MinIO Artifacts</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => handleTriggerRun(targetUrlInput)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold px-3 py-1.5 rounded-md text-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Suite on URL</span>
            </button>
          </div>
        </header>

        {triggerError && (
          <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/50 text-rose-300 text-xs flex items-center justify-between">
            <span>{triggerError}</span>
            <button
              onClick={() => setTriggerError(null)}
              className="text-rose-400 hover:text-rose-200 font-medium ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dashboard Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'runs' && (
            <RunsArchiveView
              runs={runs}
              activeRunId={selectedRunId}
              onSelectRun={(runId) => {
                setSelectedRunId(runId);
                setActiveTab('report');
              }}
              onTriggerRun={handleTriggerRun}
              isRunning={false}
            />
          )}

          {activeTab === 'report' && (
            <RunReportOverview
              run={activeRun}
              selectedRoute={selectedRoute}
              onSelectRoute={setSelectedRoute}
              selectedFinding={selectedFinding}
              onSelectFinding={setSelectedFinding}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              currentPreset={currentPreset}
              onPresetChange={setCurrentPreset}
              selectedSeverity={selectedSeverity}
              onSeverityChange={setSelectedSeverity}
              onExportMarkdown={handleExportMarkdown}
              onShareLink={handleShareLink}
              onBackToRuns={() => setActiveTab('runs')}
            />
          )}

          {activeTab === 'hub' && (() => {
            // Prefer the Hub's real cross-run consolidated data; fall back to the current
            // run's own findings (mapped into the same shape) only when the Hub can't be
            // reached, so this tab never renders blank.
            const usingLiveHubData = !!consolidatedReport;
            const canonical = consolidatedReport?.canonicalFindings || [];
            const displayFindings = usingLiveHubData
              ? canonical.map((c) => ({
                  id: c.id,
                  title: c.title,
                  severity: mapSeverity(c.severity),
                  route: c.route,
                  fingerprint: c.fingerprint,
                  occurrenceCount: c.occurrenceCount,
                  status: c.status,
                }))
              : activeRun.findings;

            const totalOccurrences = usingLiveHubData
              ? canonical.reduce((sum, c) => sum + c.occurrenceCount, 0)
              : activeRun.findings.length;
            const canonicalCount = usingLiveHubData ? canonical.length : activeRun.findings.length;
            const dedupRatio = canonicalCount > 0 ? totalOccurrences / canonicalCount : 1;

            const totalFindingsForRate = consolidatedReport?.summary.totalFindings ?? 0;
            const regressedForRate = consolidatedReport?.summary.regressed ?? 0;
            const regressionRate = totalFindingsForRate > 0 ? (regressedForRate / totalFindingsForRate) * 100 : 0;

            const criticalCount = usingLiveHubData
              ? canonical.filter((c) => mapSeverity(c.severity) === 'critical').length
              : activeRun.findings.filter((f) => f.severity === 'critical').length;

            return (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100">Canonical Defect Register</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Consolidated and deduplicated defects across all test runs using structural DOM fingerprints
                    </p>
                  </div>
                  {!usingLiveHubData && (
                    <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                      {hubUnreachable ? 'Hub unreachable — showing current run only' : 'Loading Hub data…'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <MetricCard
                    title="Total Canonical Defects"
                    value={canonicalCount}
                    subtitle={usingLiveHubData ? `Deduplicated across ${consolidatedReport?.totalRuns ?? 0} runs` : 'Current run only'}
                  />
                  <MetricCard
                    title="Critical Blockers"
                    value={criticalCount}
                    subtitle="Immediate release halt"
                  />
                  <MetricCard
                    title="Deduplication Ratio"
                    value={`${dedupRatio.toFixed(1)}x`}
                    subtitle={`${totalOccurrences} raw occurrences → ${canonicalCount} canonical`}
                  />
                  <MetricCard
                    title="Regression Rate"
                    value={`${regressionRate.toFixed(1)}%`}
                    subtitle={usingLiveHubData ? `${regressedForRate} of ${totalFindingsForRate} findings` : 'Requires Hub data'}
                  />
                </div>

                <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-900/30">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800 font-medium">
                      <tr>
                        <th className="px-4 py-3">Severity</th>
                        <th className="px-4 py-3">Finding Title</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Fingerprint</th>
                        <th className="px-4 py-3">Occurrences</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      {displayFindings.map((finding) => (
                        <tr
                          key={finding.id}
                          onClick={() => usingLiveHubData ? undefined : setSelectedFinding(finding as ExtendedFindingDetail)}
                          className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                finding.severity === 'critical'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : finding.severity === 'high'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {finding.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-200">{finding.title}</td>
                          <td className="px-4 py-3 font-mono text-zinc-400">{finding.route}</td>
                          <td className="px-4 py-3 font-mono text-zinc-500">{finding.fingerprint}</td>
                          <td className="px-4 py-3">{finding.occurrenceCount} runs</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 font-mono">
                              {finding.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      {/* Level 3 Evidence Inspector */}
      <EvidenceInspector
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onStatusChange={handleStatusChange}
      />

      {/* Run Configuration: credentials + what to check */}
      <RunConfigModal
        open={isConfigOpen}
        initialConfig={runConfig}
        onClose={() => setIsConfigOpen(false)}
        onSave={setRunConfig}
      />
    </div>
  );
}
