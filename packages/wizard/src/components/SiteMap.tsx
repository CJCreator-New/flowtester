import React, { useId, useMemo, useRef, useState, useEffect } from 'react';
import type { PageInventoryItem, DiscoveredFlow } from '@qa/types';
import { journeyPages } from '@qa/types/src/site-map.js';

export interface PageNode {
  ref: string; // e.g. "pg-01"
  urlPath: string;
  title: string;
  screenshotUrl?: string;
  journeys: Array<{ id: string; colorClass: string; index: number }>;
  status?: 'pending' | 'running' | 'pass' | 'warn' | 'fail';
  issuesCount?: number;
}

export interface PageGroup {
  id: string;
  label: string;
  count: number;
  layout?: string;
  pages: string[];
}

export interface SiteMapProps {
  pages: PageInventoryItem[];
  flows: DiscoveredFlow[];
  mode: 'plan' | 'live' | 'report';
  activeJourneyId?: string | null;
  selectedPagePath?: string | null;
  runningPagePath?: string | null;
  pageStatuses?: Record<string, { status: 'pass' | 'warn' | 'fail'; issuesCount?: number }>;
  onSelectPage?: (urlPath: string) => void;
  onSelectGroup?: (group: PageGroup) => void;
}

const JOURNEY_COLORS = [
  'var(--j1, #B69CFB)',
  'var(--j2, #6FB0FA)',
  'var(--j3, #4ADE9A)',
  'var(--j4, #F59AC6)',
  'var(--j5, #FBA35C)',
];

const JOURNEY_CLASSES = ['j1', 'j2', 'j3', 'j4', 'j5'];

export function SiteMap({
  pages,
  flows,
  mode,
  activeJourneyId,
  selectedPagePath,
  runningPagePath,
  pageStatuses,
  onSelectPage,
  onSelectGroup,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'blueprint' | 'list'>('blueprint');
  const [connectorPaths, setConnectorPaths] = useState<Array<{ id: string; d: string; color: string; active: boolean }>>([]);

  // Map flows to assigned journey colors
  const flowColorMap = useMemo(() => {
    const map = new Map<string, { color: string; colorClass: string; index: number }>();
    flows.forEach((flow, i) => {
      const idx = i % JOURNEY_COLORS.length;
      map.set(flow.id, {
        color: JOURNEY_COLORS[idx],
        colorClass: JOURNEY_CLASSES[idx],
        index: i + 1,
      });
    });
    return map;
  }, [flows]);

  // Identify journey pages vs other pages
  const { nodes, groups } = useMemo(() => {
    const journeyPageSet = new Set<string>();
    const pageJourneyMap = new Map<string, Array<{ id: string; colorClass: string; index: number }>>();

    flows.forEach((flow) => {
      const pList = journeyPages(flow);
      pList.forEach((p) => {
        journeyPageSet.add(p);
        const current = pageJourneyMap.get(p) || [];
        const colorInfo = flowColorMap.get(flow.id) || { colorClass: 'j1', index: 1 };
        if (!current.some((c) => c.id === flow.id)) {
          current.push({ id: flow.id, colorClass: colorInfo.colorClass, index: colorInfo.index });
        }
        pageJourneyMap.set(p, current);
      });
    });

    const nodeList: PageNode[] = [];
    const otherPages: PageInventoryItem[] = [];

    pages.forEach((p, idx) => {
      if (journeyPageSet.has(p.urlPath) || p.urlPath === '/' || nodeList.length < 6) {
        let nodeStatus: PageNode['status'] = 'pending';
        let issuesCount = 0;

        if (runningPagePath === p.urlPath) {
          nodeStatus = 'running';
        } else if (pageStatuses && pageStatuses[p.urlPath]) {
          nodeStatus = pageStatuses[p.urlPath].status;
          issuesCount = pageStatuses[p.urlPath].issuesCount || 0;
        }

        nodeList.push({
          ref: `pg-${String(nodeList.length + 1).padStart(2, '0')}`,
          urlPath: p.urlPath,
          title: p.title || p.urlPath,
          screenshotUrl: p.screenshotPath,
          journeys: pageJourneyMap.get(p.urlPath) || [],
          status: nodeStatus,
          issuesCount,
        });
      } else {
        otherPages.push(p);
      }
    });

    // Group other pages by root directory prefix or layout group
    const groupMap = new Map<string, string[]>();
    otherPages.forEach((p) => {
      const segments = p.urlPath.split('/').filter(Boolean);
      const prefix = segments.length > 0 ? `/${segments[0]}` : '/other';
      const list = groupMap.get(prefix) || [];
      list.push(p.urlPath);
      groupMap.set(prefix, list);
    });

    const groupList: PageGroup[] = [];
    groupMap.forEach((pList, prefix) => {
      groupList.push({
        id: prefix,
        label: prefix.replace(/^\//, '').charAt(0).toUpperCase() + prefix.slice(2) || 'Other',
        count: pList.length,
        pages: pList,
      });
    });

    return { nodes: nodeList, groups: groupList };
  }, [pages, flows, flowColorMap, runningPagePath, pageStatuses]);

  // Compute card positions in a responsive canvas grid
  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; width: number; height: number }>();
    const cardWidth = 160;
    const cardHeight = 110;
    const colGap = 80;
    const rowGap = 50;
    const startX = 60;
    const startY = 80;

    // Distribute nodes across tiers based on flow progression or index
    nodes.forEach((node, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      // Slight vertical staggering like architectural blueprint drawings
      const stagger = col % 2 === 1 ? 30 : 0;
      pos.set(node.urlPath, {
        x: startX + col * (cardWidth + colGap),
        y: startY + row * (cardHeight + rowGap) + stagger,
        width: cardWidth,
        height: cardHeight,
      });
    });

    return pos;
  }, [nodes]);

  // Calculate SVG curve paths between connected journey nodes
  useEffect(() => {
    if (viewMode !== 'blueprint') return;

    const paths: Array<{ id: string; d: string; color: string; active: boolean }> = [];

    flows.forEach((flow) => {
      const pList = journeyPages(flow);
      const colorInfo = flowColorMap.get(flow.id) || { color: '#6FB0FA' };
      const isFlowActive = !activeJourneyId || activeJourneyId === flow.id;

      for (let i = 0; i < pList.length - 1; i++) {
        const from = nodePositions.get(pList[i]);
        const to = nodePositions.get(pList[i + 1]);

        if (from && to) {
          const x1 = from.x + from.width;
          const y1 = from.y + from.height / 2;
          const x2 = to.x;
          const y2 = to.y + to.height / 2;
          const dx = Math.max(Math.abs(x2 - x1) * 0.5, 30);
          const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          paths.push({
            id: `${flow.id}-${i}`,
            d,
            color: colorInfo.color,
            active: isFlowActive,
          });
        }
      }
    });

    setConnectorPaths(paths);
  }, [flows, nodePositions, flowColorMap, activeJourneyId, viewMode]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-canvas">
      {/* Blueprint Grid Canvas Header Controls */}
      <div className="flex items-center justify-between border-b border-rule bg-panel/80 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 font-mono text-ink-soft">
          <span className="inline-block h-2 w-2 rounded-full bg-stamp animate-pulse" />
          BLUEPRINT ARCHITECTURE VIEW · {nodes.length} PAGES · {flows.length} JOURNEYS
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('blueprint')}
            className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
              viewMode === 'blueprint' ? 'bg-stamp text-surface font-bold' : 'text-ink-soft hover:bg-surface hover:text-ink'
            }`}
            aria-pressed={viewMode === 'blueprint'}
          >
            Blueprint Map
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
              viewMode === 'list' ? 'bg-stamp text-surface font-bold' : 'text-ink-soft hover:bg-surface hover:text-ink'
            }`}
            aria-pressed={viewMode === 'list'}
          >
            Accessible List
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* Accessible List Fallback (Passes WCAG 2.1 AA) */
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          <h2 className="text-xl font-bold mb-4 text-ink">Pages and Interaction Map</h2>
          <div className="space-y-3">
            {nodes.map((node) => {
              const isSelected = selectedPagePath === node.urlPath;
              return (
                <div
                  key={node.urlPath}
                  tabIndex={0}
                  role="button"
                  onClick={() => onSelectPage?.(node.urlPath)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPage?.(node.urlPath);
                    }
                  }}
                  className={`flex items-center justify-between p-4 rounded-md border-2 transition-all cursor-pointer ${
                    isSelected ? 'border-stamp bg-surface' : 'border-rule bg-surface/50 hover:border-edge'
                  }`}
                >
                  <div>
                    <span className="font-mono text-xs text-ink-soft mr-3">{node.ref}</span>
                    <strong className="text-ink">{node.title}</strong>
                    <span className="block font-mono text-xs text-ink-soft mt-0.5">{node.urlPath}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {node.status === 'running' && (
                      <span className="flex items-center gap-1.5 font-mono text-xs text-stamp animate-pulse">
                        <span className="h-2 w-2 rounded-full bg-stamp" /> Checking...
                      </span>
                    )}
                    {node.status === 'pass' && (
                      <span className="font-mono text-xs text-pass font-bold">✓ Pass</span>
                    )}
                    {node.status === 'warn' && (
                      <span className="font-mono text-xs text-warn font-bold">⚠ {node.issuesCount} issue(s)</span>
                    )}
                    {node.status === 'fail' && (
                      <span className="font-mono text-xs text-fail font-bold">✕ {node.issuesCount} issue(s)</span>
                    )}
                    <span className="text-xs text-ink-soft">Inspect →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Blueprint Canvas View */
        <div
          ref={containerRef}
          className="relative flex-1 overflow-auto bg-canvas p-8"
          style={{
            backgroundImage: `
              linear-gradient(rgba(91,141,239,0.08) 1px, transparent 1px),
              linear-gradient(to right, rgba(91,141,239,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            minHeight: '620px',
            minWidth: '960px',
          }}
        >
          {/* SVG Connector Layer */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#5B8DEF" floodOpacity="0.4" />
              </filter>
            </defs>
            {connectorPaths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={p.active ? 2 : 1}
                strokeOpacity={p.active ? 0.9 : 0.25}
                strokeDasharray={p.active ? undefined : '4 4'}
                filter={p.active ? 'url(#line-glow)' : undefined}
                className="transition-all duration-300"
              />
            ))}
          </svg>

          {/* Blueprint Cards */}
          {nodes.map((node) => {
            const pos = nodePositions.get(node.urlPath) || { x: 40, y: 40, width: 160, height: 110 };
            const isSelected = selectedPagePath === node.urlPath;
            const isRunning = node.status === 'running';

            let statusBorder = 'border-rule hover:border-stamp';
            let statusBadge = null;

            if (node.status === 'pass') {
              statusBorder = 'border-l-4 border-l-pass border-rule';
              statusBadge = <span className="font-mono text-[10px] text-pass font-bold">✓ Pass</span>;
            } else if (node.status === 'warn') {
              statusBorder = 'border-l-4 border-l-warn border-rule';
              statusBadge = <span className="font-mono text-[10px] text-warn font-bold">⚠ {node.issuesCount} issue</span>;
            } else if (node.status === 'fail') {
              statusBorder = 'border-l-4 border-l-fail border-rule';
              statusBadge = <span className="font-mono text-[10px] text-fail font-bold">✕ {node.issuesCount} issues</span>;
            }

            return (
              <div
                key={node.urlPath}
                onClick={() => onSelectPage?.(node.urlPath)}
                tabIndex={0}
                role="button"
                aria-label={`Page ${node.title} at ${node.urlPath}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectPage?.(node.urlPath);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${pos.width}px`,
                }}
                className={`group cursor-pointer rounded-md border bg-surface/95 shadow-md backdrop-blur-sm transition-all duration-150 ${statusBorder} ${
                  isSelected ? 'ring-2 ring-stamp border-stamp shadow-stamp/20' : ''
                } ${isRunning ? 'animate-pulse ring-2 ring-stamp' : ''}`}
              >
                {/* Reference Tag & URL */}
                <div className="flex items-center justify-between border-b border-rule/50 px-2.5 py-1.5 font-mono text-[10px] text-ink-soft">
                  <span>{node.ref}</span>
                  <span className="truncate max-w-[80px]">{node.urlPath}</span>
                </div>

                {/* Thumbnail sketch representation */}
                <div className="relative mx-2 my-1.5 aspect-video overflow-hidden rounded bg-canvas/70 border border-rule/30 p-1.5">
                  <div className="h-1 w-2/3 rounded-sm bg-rule mb-1" />
                  <div className="h-3 w-full rounded bg-stamp/10 mb-1" />
                  <div className="h-1 w-1/2 rounded-sm bg-rule/70" />
                </div>

                {/* Card Title & Tags */}
                <div className="flex items-center justify-between px-2.5 pb-2 pt-0.5">
                  <span className="truncate text-xs font-bold text-ink" title={node.title}>
                    {node.title}
                  </span>
                  <div className="flex items-center gap-1">
                    {statusBadge ||
                      node.journeys.map((j) => (
                        <span
                          key={j.id}
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: JOURNEY_COLORS[(j.index - 1) % JOURNEY_COLORS.length],
                          }}
                          title={`Journey ${j.index}`}
                        />
                      ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Group Nodes */}
          {groups.map((group, idx) => (
            <div
              key={group.id}
              onClick={() => onSelectGroup?.(group)}
              style={{
                position: 'absolute',
                left: `${60 + (idx % 2) * 240}px`,
                top: `${420 + Math.floor(idx / 2) * 100}px`,
                width: '150px',
              }}
              className="cursor-pointer rounded-md border border-dashed border-rule bg-surface/40 p-3 text-center transition-all hover:border-stamp hover:bg-surface/70"
            >
              <div className="text-lg">📁</div>
              <div className="text-xs font-bold text-ink">{group.label}</div>
              <div className="font-mono text-[10px] text-ink-soft">{group.count} pages</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
