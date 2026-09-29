import React, { useState } from 'react';
import type { ReleaseReport, Finding, ReviewPlan, PageInventoryItem, AspectType, AspectGrade } from '@qa/types';
import { SiteMap } from '../components/SiteMap';
import { downloadReportFiles, downloadHtmlReport, finishAiReview } from '../api';
import { summarizeReport } from '../lib/summary';

export interface ReportMapScreenProps {
  report: ReleaseReport;
  plan?: ReviewPlan | null;
  onRestart: () => void;
  onGoDeeper?: (credentials?: { username?: string; password?: string }) => void;
}

const FALLBACK_PAGES: PageInventoryItem[] = [
  { urlPath: '/', title: 'Home', interactiveElementsCount: 0, formsCount: 0 },
];

const GRADE_STYLES: Record<AspectGrade, { badge: string; border: string }> = {
  A: { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', border: 'border-emerald-500' },
  B: { badge: 'bg-sky-500/20 text-sky-400 border-sky-500/40', border: 'border-sky-500' },
  C: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40', border: 'border-amber-500' },
  D: { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40', border: 'border-orange-500' },
  F: { badge: 'bg-red-500/20 text-red-400 border-red-500/40', border: 'border-red-500' },
};

const ASPECTS: AspectType[] = [
  'Works',
  'Accessible',
  'Fast and mobile',
  'Findable',
  'Secure',
  'Looks and reads well',
];

export function ReportMapScreen({
  report: initialReport,
  plan,
  onRestart,
  onGoDeeper,
}: ReportMapScreenProps) {
  const [report, setReport] = useState<ReleaseReport>(initialReport);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedPagePath, setSelectedPagePath] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [finishingAi, setFinishingAi] = useState(false);
  const [showGoDeeper, setShowGoDeeper] = useState(false);
  const [deeperUsername, setDeeperUsername] = useState('');
  const [deeperPassword, setDeeperPassword] = useState('');

  const summary = summarizeReport(report);
  const isReady = summary.ready;
  const overallGrade = report.grades?.overallGrade || (isReady ? 'A' : 'D');
  const overallStyle = GRADE_STYLES[overallGrade] || GRADE_STYLES.A;

  // Compute page statuses for the site map
  const pageStatuses = React.useMemo(() => {
    const map: Record<string, { status: 'pass' | 'warn' | 'fail'; issuesCount?: number }> = {};
    (report.findings || []).forEach((f) => {
      const path = f.where?.urlPath || '/';
      const existing = map[path] || { status: 'pass', issuesCount: 0 };
      const isSerious = f.severity === 'Blocker' || f.severity === 'Major';
      map[path] = {
        status: isSerious || existing.status === 'fail' ? 'fail' : 'warn',
        issuesCount: (existing.issuesCount || 0) + 1,
      };
    });
    return map;
  }, [report.findings]);

  const handleDownloadHtml = async () => {
    setDownloading(true);
    try {
      await downloadHtmlReport();
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      await downloadReportFiles(false);
    } finally {
      setDownloading(false);
    }
  };

  const handleFinishAiReview = async () => {
    setFinishingAi(true);
    try {
      const res = await finishAiReview();
      if (res.grades) {
        setReport((prev) => ({ ...prev, grades: res.grades }));
      }
    } finally {
      setFinishingAi(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14 space-y-10">
      {/* ─── TOP VERDICT BAND (Direction B) ─── */}
      <div className="flex flex-col sm:flex-row items-stretch rounded-lg border border-edge bg-surface shadow-xl overflow-hidden">
        {/* Verdict Badge */}
        <div
          className={`flex min-w-[200px] flex-col items-center justify-center p-8 text-center sm:border-r ${
            isReady
              ? 'border-pass/30 bg-pass-tint/30 text-pass'
              : 'border-fail/30 bg-fail-tint/30 text-fail'
          }`}
        >
          <span className="font-mono text-xs font-bold uppercase tracking-widest opacity-80 mb-1">
            Readiness Grade
          </span>
          <div className="font-stamp text-5xl sm:text-6xl font-black uppercase tracking-wider my-1">
            {overallGrade}
          </div>
          <span className="font-mono text-xs opacity-75 font-semibold">
            {report.grades?.overallScore ?? 100}/100 Score
          </span>
        </div>

        {/* Verdict Copy */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-ink">
              {summary.headline}
            </h1>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase tracking-wider border ${overallStyle.badge}`}>
              {summary.stamp.toUpperCase()}
            </span>
          </div>
          <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
            {report.targetUrl} was evaluated across viewports and interactive journeys in{' '}
            {(report.durationMs / 1000).toFixed(1)}s.
            {isReady
              ? ' All accessibility, performance, security, and functional standards passed.'
              : ' Review the prioritized findings and aspect grades below.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadHtml}
              className="btn-primary py-2.5 px-6 text-sm font-bold shadow-md shadow-stamp/20 flex items-center gap-2"
            >
              <span>📄</span>
              <span>{downloading ? 'Downloading...' : 'Download Offline HTML Report'}</span>
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadAll}
              className="btn-secondary py-2.5 px-4 text-xs font-bold"
            >
              Download MD & JSON
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="btn-quiet py-2.5 px-4 text-xs font-bold"
            >
              Check another site
            </button>
            <button
              type="button"
              onClick={() => setShowGoDeeper(!showGoDeeper)}
              className="ml-auto font-mono text-xs text-stamp hover:underline py-2"
            >
              {showGoDeeper ? 'Hide “Go deeper”' : '+ Go deeper (add login credentials)'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── ASPECT GRADES CARDS (Task 2.5) ─── */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-rule pb-2">
          Readiness by Aspect (A–F Grades)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ASPECTS.map((aspect) => {
            const data = report.grades?.aspects[aspect] || { grade: 'A', score: 100, findings: [] };
            const style = GRADE_STYLES[data.grade] || GRADE_STYLES.A;
            return (
              <div
                key={aspect}
                className="rounded-lg border border-edge bg-surface p-4 shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm text-ink">{aspect}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${style.badge}`}>
                    Grade {data.grade}
                  </span>
                </div>
                <div className="w-full bg-edge/40 rounded-full h-2 mb-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.grade === 'A'
                        ? 'bg-emerald-500'
                        : data.grade === 'B'
                        ? 'bg-sky-500'
                        : data.grade === 'C'
                        ? 'bg-amber-500'
                        : data.grade === 'D'
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${data.score}%` }}
                  />
                </div>
                <div className="flex items-center justify-between font-mono text-xs text-ink-soft">
                  <span>Score: {data.score}/100</span>
                  <span>{data.findings.length} {data.findings.length === 1 ? 'issue' : 'issues'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── "CHANGES SINCE LAST RUN" BANNER (Task 2.8) ─── */}
      {report.history && (
        <section className="rounded-lg border border-edge bg-surface/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-ink flex items-center gap-2">
              <span>📈</span>
              <span>Changes Since Last Run</span>
            </h3>
            {report.history.previousTimestamp && (
              <span className="font-mono text-xs text-ink-soft">
                Compared to {new Date(report.history.previousTimestamp).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded border border-emerald-500/20 bg-emerald-500/5">
              <span className="block font-stamp text-2xl font-black text-emerald-400">
                {report.history.fixedFindingFingerprints.length}
              </span>
              <span className="font-mono text-xs text-ink-soft">Fixed Issues</span>
            </div>
            <div className="p-3 rounded border border-red-500/20 bg-red-500/5">
              <span className="block font-stamp text-2xl font-black text-red-400">
                {report.history.newFindingFingerprints.length}
              </span>
              <span className="font-mono text-xs text-ink-soft">New Issues</span>
            </div>
            <div className="p-3 rounded border border-amber-500/20 bg-amber-500/5">
              <span className="block font-stamp text-2xl font-black text-amber-400">
                {report.history.openFindingFingerprints.length}
              </span>
              <span className="font-mono text-xs text-ink-soft">Still Open</span>
            </div>
          </div>
        </section>
      )}

      {/* ─── "GO DEEPER" EXPANDABLE PANEL (Task 1.12) ─── */}
      {showGoDeeper && (
        <div className="rounded-lg border border-stamp/40 bg-surface/90 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔐</span>
            <strong className="text-base text-ink">Go deeper into signed-in areas</strong>
          </div>
          <p className="text-xs text-ink-soft">
            Provide test credentials to discover routes, invoices, and dashboards behind authentication. Credentials are
            never saved to disk.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block font-mono text-xs text-ink-soft mb-1">Username / Email</label>
              <input
                type="text"
                value={deeperUsername}
                onChange={(e) => setDeeperUsername(e.target.value)}
                placeholder="manager@example.com"
                className="w-full rounded border border-edge bg-canvas px-3 py-2 text-xs text-ink focus:border-stamp focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-ink-soft mb-1">Password</label>
              <input
                type="password"
                value={deeperPassword}
                onChange={(e) => setDeeperPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-edge bg-canvas px-3 py-2 text-xs text-ink focus:border-stamp focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!deeperUsername.trim() || !deeperPassword.trim()}
            onClick={() => onGoDeeper?.({ username: deeperUsername, password: deeperPassword })}
            className="btn-primary py-2 px-5 text-xs font-bold"
          >
            Start deeper re-run →
          </button>
        </div>
      )}

      {/* ─── PRIORITIZED IMPROVEMENT RECOMMENDATIONS (Task 2.6) ─── */}
      {report.recommendations && report.recommendations.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-rule pb-2">
            Prioritized Improvement Recommendations ({report.recommendations.length})
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {report.recommendations.slice(0, 5).map((rec) => (
              <div key={rec.id} className="rounded-lg border border-edge bg-surface p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    rec.category === 'quick-win' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {rec.category === 'quick-win' ? '⚡ Quick Win' : '🏗️ Bigger Change'}
                  </span>
                  <span className="font-mono text-xs text-stamp font-semibold">{rec.aspect}</span>
                  <span className="font-mono text-xs text-ink-soft">Effort: <strong>{rec.effort}</strong></span>
                  <span className="font-mono text-xs text-ink-soft">Impact: <strong>{rec.impact}</strong></span>
                </div>
                <h4 className="font-bold text-sm text-ink">{rec.title}</h4>
                <p className="text-xs text-ink-soft">{rec.summary}</p>
                <div className="rounded bg-canvas/60 border border-edge p-2.5 text-xs text-ink">
                  <strong className="text-stamp">Fix:</strong> {rec.suggestedFix}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── SITE MAP BY RESULT ─── */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft border-b border-rule pb-2">
          Site Architecture & Results Map
        </h2>
        <div className="h-[380px] rounded-lg border border-edge overflow-hidden">
          <SiteMap
            pages={plan?.pages || FALLBACK_PAGES}
            flows={plan?.flows || []}
            mode="report"
            selectedPagePath={selectedPagePath}
            pageStatuses={pageStatuses}
            onSelectPage={(path) => {
              setSelectedPagePath(path);
              const matchingFinding = report.findings.find((f) => f.where?.urlPath === path);
              if (matchingFinding) setSelectedFinding(matchingFinding);
            }}
          />
        </div>
      </section>

      {/* ─── FINDINGS LIST ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-2">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-soft">
            Audit Findings ({report.findings.length})
          </h2>
          <span className="font-mono text-xs text-ink-soft">
            {report.findings.filter((f) => f.severity === 'Blocker' || f.severity === 'Major').length} critical issues
          </span>
        </div>

        {report.findings.length === 0 ? (
          <div className="rounded-lg border border-pass/30 bg-pass-tint/20 p-8 text-center text-pass">
            <span className="text-3xl block mb-2">🎉</span>
            <strong className="text-lg">No defects or accessibility non-conformances identified!</strong>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {report.findings.map((finding) => {
              const isSerious = finding.severity === 'Blocker' || finding.severity === 'Major';
              const isSelected = selectedFinding?.id === finding.id;
              const selector = finding.where?.cssSelector || finding.where?.dataTestId;

              return (
                <div
                  key={finding.id}
                  onClick={() => setSelectedFinding(isSelected ? null : finding)}
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${
                    isSerious
                      ? 'border-l-4 border-l-fail border-rule bg-surface hover:border-fail'
                      : 'border-l-4 border-l-warn border-rule bg-surface hover:border-warn'
                  } ${isSelected ? 'ring-2 ring-stamp' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            isSerious ? 'bg-fail-tint text-fail' : 'bg-warn-tint text-warn'
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="font-mono text-[10px] text-ink-soft uppercase tracking-wider">
                          {finding.checker}
                        </span>
                        <span className="font-mono text-[10px] text-stamp">
                          {finding.where?.breakpoint}
                        </span>
                      </div>
                      <h3 className="font-semibold text-ink text-sm sm:text-base">
                        {finding.title}
                      </h3>
                      <div className="font-mono text-xs text-ink-soft mt-1">
                        {finding.where?.urlPath} {selector && `→ ${selector}`}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-ink-soft">{isSelected ? '▲ Hide' : '▼ View'}</span>
                  </div>

                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-rule space-y-3 text-xs">
                      <div>
                        <span className="font-mono font-bold text-ink-soft uppercase tracking-wider block mb-1">
                          Expected vs Actual
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded bg-canvas font-mono">
                          <div>
                            <span className="text-pass font-bold">Expected: </span>
                            <span className="text-ink">{finding.expectedVsActual?.expected}</span>
                          </div>
                          <div>
                            <span className="text-fail font-bold">Actual: </span>
                            <span className="text-ink">{finding.expectedVsActual?.actual}</span>
                          </div>
                        </div>
                      </div>

                      {finding.stepsToReproduce && finding.stepsToReproduce.length > 0 && (
                        <div>
                          <span className="font-mono font-bold text-ink-soft uppercase tracking-wider block mb-1">
                            Reproduction Steps
                          </span>
                          <ol className="list-decimal list-inside space-y-1 font-mono text-ink-soft bg-canvas p-3 rounded">
                            {finding.stepsToReproduce.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {finding.resolution && (
                        <div>
                          <span className="font-mono font-bold text-ink-soft uppercase tracking-wider block mb-1">
                            Recommended Fix
                          </span>
                          <p className="text-ink bg-stamp/5 p-3 rounded border border-stamp/20 leading-relaxed">
                            {finding.resolution}
                          </p>
                        </div>
                      )}

                      {finding.verifyCommand && (
                        <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-ink-soft">
                          <span>Verify with CLI:</span>
                          <code className="bg-canvas px-2 py-0.5 rounded border border-edge text-stamp">
                            {finding.verifyCommand}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
