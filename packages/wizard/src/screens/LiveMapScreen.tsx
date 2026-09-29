import React, { useState } from 'react';
import type { ReviewPlan, DiscoveredFlow, PageInventoryItem } from '@qa/types';
import { SiteMap } from '../components/SiteMap';
import type { FeedState, RunnerEvent } from '../lib/translate';

export interface LiveMapScreenProps {
  plan?: ReviewPlan | null;
  targetUrl: string;
  feed: FeedState;
  events?: RunnerEvent[];
  onCancel?: () => void;
}

const FALLBACK_PAGES: PageInventoryItem[] = [
  { urlPath: '/', title: 'Home', interactiveElementsCount: 0, formsCount: 0 },
];

export function LiveMapScreen({
  plan,
  targetUrl,
  feed,
}: LiveMapScreenProps) {
  const [selectedPagePath, setSelectedPagePath] = useState<string | null>(null);

  // Extract hostname
  let host = targetUrl;
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    // fallback
  }

  // Derive pages and flows from plan or fallback
  const pages: PageInventoryItem[] = plan?.pages || FALLBACK_PAGES;
  const flows: DiscoveredFlow[] = plan?.flows || [];

  const currentAction = feed.current || 'Executing pre-release test journeys...';
  const activePagePath = selectedPagePath || pages[0]?.urlPath || '/';

  // Compute status map for pages visited
  const pageStatuses = React.useMemo(() => {
    const map: Record<string, { status: 'pass' | 'warn' | 'fail'; issuesCount?: number }> = {};
    pages.forEach((p) => {
      if (p.urlPath === activePagePath) {
        map[p.urlPath] = { status: 'pass' };
      }
    });
    return map;
  }, [pages, activePagePath]);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] w-full overflow-hidden bg-canvas">
      {/* ─── LIVE TOP STATUS BAR ─── */}
      <div className="flex items-center gap-4 border-b border-rule bg-surface px-5 py-2.5">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-stamp">
          <span className="h-2.5 w-2.5 rounded-full bg-stamp animate-ping" />
          <span className="tracking-widest">LIVE</span>
        </div>

        <div className="flex-1 truncate text-xs font-bold text-ink">
          {currentAction}
        </div>

        <div className="hidden sm:flex items-center gap-4 font-mono text-xs text-ink-soft">
          <span>{feed.findings} issues found</span>
        </div>

        <div className="w-28 sm:w-36 h-1.5 rounded-full bg-edge/40 overflow-hidden">
          <div className="h-full bg-stamp progress-indeterminate" />
        </div>
      </div>

      {/* ─── MAIN LAYOUT: SIDEBAR + BLUEPRINT MAP + LIVE INSPECTOR ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-rule bg-surface/80">
          <div className="border-b border-rule p-4">
            <h2 className="truncate font-bold text-sm text-ink">{host}</h2>
            <p className="font-mono text-xs text-ink-soft mt-0.5">Testing live journeys</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {pages.map((p) => {
              const isRunning = p.urlPath === activePagePath;
              const status = pageStatuses[p.urlPath]?.status;
              return (
                <button
                  key={p.urlPath}
                  type="button"
                  onClick={() => setSelectedPagePath(p.urlPath)}
                  className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition-colors ${
                    isRunning ? 'bg-stamp/15 font-bold text-ink border border-stamp/30' : 'text-ink-soft hover:bg-canvas hover:text-ink'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isRunning
                        ? 'bg-stamp animate-pulse'
                        : status === 'fail'
                          ? 'bg-fail'
                          : status === 'warn'
                            ? 'bg-warn'
                            : status === 'pass'
                              ? 'bg-pass'
                              : 'bg-rule'
                    }`}
                  />
                  <span className="truncate flex-1">{p.title || p.urlPath}</span>
                  <span className="font-mono text-[10px] text-ink-soft">
                    {isRunning ? 'checking' : status || 'waiting'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Blueprint Map */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <SiteMap
            pages={pages}
            flows={flows}
            mode="live"
            selectedPagePath={activePagePath}
            runningPagePath={activePagePath}
            pageStatuses={pageStatuses}
            onSelectPage={(path) => setSelectedPagePath(path)}
          />
        </main>

        {/* Right Live Action Inspector Panel */}
        <aside className="w-80 sm:w-96 flex-shrink-0 border-l border-rule bg-surface/95 p-5 overflow-y-auto space-y-5">
          <div className="border-b border-rule pb-3">
            <span className="font-mono text-[10px] uppercase text-stamp">LIVE EXECUTION INSPECTOR</span>
            <h3 className="text-base font-bold text-ink truncate mt-0.5">{activePagePath}</h3>
          </div>

          {/* Latest action card */}
          <div>
            <span className="font-mono text-xs uppercase text-ink-soft block mb-1.5 font-bold">Latest Action</span>
            <div className="rounded-md border border-rule bg-canvas p-3 font-mono text-xs text-ink space-y-1">
              <div className="text-stamp">
                {currentAction}
              </div>
            </div>
          </div>

          {/* Checks on this page */}
          <div>
            <span className="font-mono text-xs uppercase text-ink-soft block mb-2 font-bold">Audits Running</span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 rounded border border-pass/30 bg-pass-tint/30 p-2 text-pass">
                <span>✓</span>
                <span>Page navigation & HTTP status</span>
              </div>
              <div className="flex items-center gap-2 rounded border border-pass/30 bg-pass-tint/30 p-2 text-pass">
                <span>✓</span>
                <span>Accessibility compliance (WCAG 2.1 AA)</span>
              </div>
              <div className="flex items-center gap-2 rounded border border-rule bg-canvas/60 p-2 text-ink">
                <span className="text-stamp animate-pulse">●</span>
                <span>Responsive viewport checks (375px, 768px, 1440px)</span>
              </div>
              <div className="flex items-center gap-2 rounded border border-rule bg-canvas/60 p-2 text-ink-soft">
                <span>…</span>
                <span>Interactive DOM and console monitors</span>
              </div>
            </div>
          </div>

          {/* Milestones so far */}
          {feed.history.length > 0 && (
            <div>
              <span className="font-mono text-xs uppercase text-ink-soft block mb-2 font-bold">
                Completed Milestones ({feed.history.length})
              </span>
              <div className="space-y-1.5">
                {feed.history.map((item, i) => (
                  <div key={i} className="rounded border border-rule bg-canvas/60 p-2 text-xs text-ink-soft flex items-center gap-1.5">
                    <span className="text-pass">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
