import React, { useState } from 'react';
import type { ReviewPlan, DiscoveredFlow, AmbiguityQuestion } from '@qa/types';
import { SiteMap, type PageGroup } from '../components/SiteMap';
import { stepToSentence, expectationsToChecks } from '../lib/plan-translate';
import { patchPlan, interpretSentence, type InterpretResult } from '../api';

export interface PlanReviewScreenProps {
  plan: ReviewPlan;
  onApprove: () => void;
  onSkipReview?: () => void;
  onPlanUpdated: (newPlan: ReviewPlan) => void;
  onBack?: () => void;
}

export function PlanReviewScreen({
  plan,
  onApprove,
  onPlanUpdated,
  onBack,
}: PlanReviewScreenProps) {
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [selectedPagePath, setSelectedPagePath] = useState<string | null>(
    plan.pages[0]?.urlPath || '/'
  );
  const [selectedGroup, setSelectedGroup] = useState<PageGroup | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [sidePanelTab, setSidePanelTab] = useState<'inspection' | 'specs'>('inspection');

  // Specs & Design Docs editing state
  const [editProductContext, setEditProductContext] = useState(plan.productContext || '');
  const [editDesignNotes, setEditDesignNotes] = useState(plan.designNotes || '');
  const [savingDocs, setSavingDocs] = useState(false);
  const [docsSaveMessage, setDocsSaveMessage] = useState<string | null>(null);

  // Question answers state: questionId -> selectedAnswer
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    (plan.questions || []).forEach((q) => {
      init[q.id] = q.selectedAnswer || q.safeAnswer || (q.options && q.options[0]) || '';
    });
    return init;
  });

  // "Add test by describing" state
  const [describeText, setDescribeText] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [interpretResult, setInterpretResult] = useState<InterpretResult | null>(null);
  const [interpretError, setInterpretError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Current page object
  const selectedPage = plan.pages.find((p) => p.urlPath === selectedPagePath);

  // Relevant flows for selected page or active journey
  const relevantFlows = plan.flows.filter((f) => {
    if (activeJourneyId) return f.id === activeJourneyId;
    if (selectedPagePath) {
      return (
        f.startPage === selectedPagePath ||
        (f.steps || []).some((s) => s.action === 'navigate' && s.value === selectedPagePath)
      );
    }
    return true;
  });

  // Relevant questions for this page
  const pageQuestions = (plan.questions || []).filter(
    (q) => !selectedPagePath || q.urlPath === selectedPagePath || relevantFlows.some((f) => f.id === q.targetElement)
  );

  const handleSelectPage = (path: string) => {
    setSelectedPagePath(path);
    setSelectedGroup(null);
    setIsSidePanelOpen(true);
    setSidePanelTab('inspection');
    setInterpretResult(null);
    setInterpretError(null);
  };

  const handleSelectGroup = (group: PageGroup) => {
    setSelectedGroup(group);
    setSelectedPagePath(null);
    setIsSidePanelOpen(true);
    setSidePanelTab('inspection');
  };

  const handleAnswerQuestion = async (qId: string, answer: string) => {
    const newAnswers = { ...answers, [qId]: answer };
    setAnswers(newAnswers);

    try {
      const updated = await patchPlan({
        answers: newAnswers,
      });
      onPlanUpdated(updated);
    } catch {
      // Keep optimistic answer locally
    }
  };

  const handleToggleSkipJourney = async (flowId: string) => {
    const updatedFlows = plan.flows.map((f) => {
      if (f.id === flowId) {
        return { ...f, outOfScope: !f.outOfScope };
      }
      return f;
    });

    try {
      setSavingEdit(true);
      const updated = await patchPlan({ flows: updatedFlows });
      onPlanUpdated(updated);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleInterpret = async () => {
    if (!describeText.trim()) return;
    setInterpreting(true);
    setInterpretError(null);
    setInterpretResult(null);

    try {
      const result = await interpretSentence({
        sentence: describeText,
        urlPath: selectedPagePath || '/',
      });
      if (result.ok && result.flow) {
        setInterpretResult(result);
      } else {
        setInterpretError(result.message || 'Could not understand that test sentence. Please rephrase.');
      }
    } catch (err: unknown) {
      setInterpretError(err instanceof Error ? err.message : 'Interpretation failed');
    } finally {
      setInterpreting(false);
    }
  };

  const handleAddInterpretedTest = async () => {
    if (!interpretResult?.flow) return;
    setSavingEdit(true);
    try {
      const updatedFlows = [...plan.flows, interpretResult.flow];
      const updated = await patchPlan({ flows: updatedFlows });
      onPlanUpdated(updated);
      setDescribeText('');
      setInterpretResult(null);
    } catch (err: unknown) {
      setInterpretError(err instanceof Error ? err.message : 'Failed to add test to plan');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveDocs = async () => {
    setSavingDocs(true);
    setDocsSaveMessage(null);
    try {
      const updated = await patchPlan({
        productContext: editProductContext,
        designNotes: editDesignNotes,
      });
      onPlanUpdated(updated);
      setDocsSaveMessage('Specs & design docs applied to plan!');
      setTimeout(() => setDocsSaveMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save docs to plan');
    } finally {
      setSavingDocs(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-57px)] w-full overflow-hidden bg-canvas">
      {/* ─── LEFT SIDEBAR ─── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-rule bg-surface/90">
        {onBack && (
          <div className="border-b border-rule px-4 py-2.5 bg-panel flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-soft hover:text-stamp transition-colors group"
            >
              <span className="transition-transform group-hover:-translate-x-0.5 font-bold">←</span>
              <span>Back to URL & Specs</span>
            </button>
            <span className="font-mono text-[10px] text-ink-soft/70">Stage 2</span>
          </div>
        )}

        {/* Site Header */}
        <div className="border-b border-rule p-4">
          <div className="truncate font-bold text-ink" title={plan.targetUrl}>
            {new URL(plan.targetUrl).hostname}
          </div>
          <div className="mt-1 font-mono text-xs text-ink-soft">
            {plan.siteType || 'Web app'} · {plan.flows.length} journeys · {plan.pages.length} pages
          </div>

          {/* Journey Filter Tabs */}
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveJourneyId(null)}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                activeJourneyId === null ? 'bg-stamp text-surface' : 'text-ink-soft hover:bg-canvas hover:text-ink'
              }`}
            >
              All
            </button>
            {plan.flows.map((flow, i) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => setActiveJourneyId(flow.id)}
                className={`truncate rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                  activeJourneyId === flow.id ? 'bg-stamp text-surface' : 'text-ink-soft hover:bg-canvas hover:text-ink'
                }`}
                title={flow.name}
              >
                J{i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Page / Journey Inventory List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            <span>Journeys & Pages</span>
            <button
              type="button"
              onClick={() => {
                setIsSidePanelOpen(true);
                setSidePanelTab('specs');
              }}
              className="text-stamp hover:underline"
            >
              + Docs
            </button>
          </div>
          <div className="space-y-1">
            {plan.pages.map((p, idx) => {
              const isSelected = selectedPagePath === p.urlPath && sidePanelTab === 'inspection';
              return (
                <button
                  key={p.urlPath}
                  type="button"
                  onClick={() => handleSelectPage(p.urlPath)}
                  className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition-colors ${
                    isSelected ? 'bg-stamp/15 text-ink font-bold border border-stamp/30' : 'text-ink-soft hover:bg-canvas hover:text-ink'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-rule" />
                  <span className="truncate flex-1">{p.title || p.urlPath}</span>
                  <span className="font-mono text-[10px] text-ink-soft">pg-{String(idx + 1).padStart(2, '0')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mandatory Approval Actions Bottom Bar */}
        <div className="border-t border-rule p-4 space-y-2.5 bg-panel">
          <div className="rounded border border-stamp/30 bg-stamp/10 p-2 font-mono text-[10px] text-stamp leading-tight flex items-center gap-1.5">
            <span>🔒</span>
            <span>Approval Required Before Testing</span>
          </div>

          <button
            type="button"
            onClick={onApprove}
            className="btn-primary w-full py-2.5 text-sm font-bold shadow-lg shadow-stamp/20"
          >
            Approve Plan & Begin Testing →
          </button>
        </div>
      </aside>

      {/* ─── CENTER: BLUEPRINT SITE MAP ─── */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <SiteMap
          pages={plan.pages}
          flows={plan.flows}
          mode="plan"
          activeJourneyId={activeJourneyId}
          selectedPagePath={selectedPagePath}
          onSelectPage={handleSelectPage}
          onSelectGroup={handleSelectGroup}
        />
      </main>

      {/* ─── RIGHT SIDE PANEL ─── */}
      {isSidePanelOpen && (
        <aside className="relative flex w-80 sm:w-96 flex-shrink-0 flex-col border-l border-rule bg-surface/95 overflow-y-auto">
          {/* Panel Header */}
          <div className="sticky top-0 z-10 border-b border-rule bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wide text-stamp">
                {sidePanelTab === 'specs'
                  ? 'DOCUMENTATION & SPECS'
                  : selectedPage
                  ? `PAGE · ${selectedPage.urlPath}`
                  : selectedGroup?.label || 'INSPECTION'}
              </span>
              <button
                type="button"
                onClick={() => setIsSidePanelOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded border border-rule text-ink-soft hover:border-ink hover:text-ink"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            {/* Tab switch between Inspector & Docs */}
            <div className="mt-3 flex rounded-md border border-rule bg-canvas p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSidePanelTab('inspection')}
                className={`flex-1 py-1 rounded transition-colors font-bold ${
                  sidePanelTab === 'inspection' ? 'bg-stamp text-surface' : 'text-ink-soft hover:text-ink'
                }`}
              >
                🔍 Journeys & Checks
              </button>
              <button
                type="button"
                onClick={() => setSidePanelTab('specs')}
                className={`flex-1 py-1 rounded transition-colors font-bold flex items-center justify-center gap-1.5 ${
                  sidePanelTab === 'specs' ? 'bg-stamp text-surface' : 'text-ink-soft hover:text-ink'
                }`}
              >
                📄 Specs & Design
                {(editProductContext.trim() || editDesignNotes.trim()) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-pass" />
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: Inspection & Journeys */}
          {sidePanelTab === 'inspection' ? (
            <div className="flex-1 p-5 space-y-6">
              {/* Journey Steps Section */}
              {relevantFlows.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-stamp">
                      Journey Steps ({relevantFlows.length})
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {relevantFlows.map((flow) => (
                      <div
                        key={flow.id}
                        className={`rounded-md border p-3 ${
                          flow.outOfScope ? 'border-rule/50 bg-canvas/40 opacity-60' : 'border-rule bg-canvas/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <strong className="text-xs text-ink">{flow.name}</strong>
                          <button
                            type="button"
                            onClick={() => handleToggleSkipJourney(flow.id)}
                            disabled={savingEdit}
                            className="font-mono text-[10px] text-ink-soft hover:text-ink underline"
                          >
                            {flow.outOfScope ? 'Include journey' : 'Skip journey'}
                          </button>
                        </div>

                        {flow.description && (
                          <p className="text-xs text-ink-soft mb-2 italic">{flow.description}</p>
                        )}

                        <ol className="space-y-1.5 border-l border-rule pl-3 ml-1 text-xs">
                          {(flow.steps || []).map((step, idx) => (
                            <li key={idx} className="text-ink">
                              <span className="font-mono text-[10px] text-stamp mr-1.5">{idx + 1}.</span>
                              {stepToSentence(step)}
                            </li>
                          ))}
                        </ol>

                        {/* Expected Checks */}
                        {flow.candidateExpectations && (
                          <div className="mt-3 pt-2 border-t border-rule/40 text-xs">
                            <span className="font-mono text-[10px] text-ink-soft block mb-1">Expected:</span>
                            {expectationsToChecks(flow.candidateExpectations).map((c, i) => (
                              <div key={i} className="text-pass text-[11px] flex items-center gap-1">
                                <span>✓</span> {c.sentence}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions Section (Ambiguity resolution) */}
              {pageQuestions.length > 0 && (
                <div>
                  <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-warn">
                    Ambiguity Questions ({pageQuestions.length})
                  </h3>
                  <div className="space-y-3">
                    {pageQuestions.map((q) => {
                      const currentAnswer = answers[q.id];
                      return (
                        <div key={q.id} className="rounded-md border border-warn/30 bg-warn-tint/20 p-3">
                          <p className="text-xs text-ink font-bold mb-2">{q.question}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(q.options || []).map((opt) => {
                              const isPicked = currentAnswer === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleAnswerQuestion(q.id, opt)}
                                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                                    isPicked
                                      ? 'bg-stamp text-surface font-bold'
                                      : 'border border-rule bg-surface/50 text-ink-soft hover:border-edge hover:text-ink'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* "Add a test by describing it" Section */}
              <div className="rounded-md border border-rule bg-canvas/60 p-4">
                <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-stamp">
                  Add test by describing it
                </h3>
                <p className="text-xs text-ink-soft mb-3">
                  Describe an action in plain English (e.g. &ldquo;Save with an empty amount — it should show an error&rdquo;):
                </p>

                <textarea
                  value={describeText}
                  onChange={(e) => setDescribeText(e.target.value)}
                  placeholder="Describe what to click, fill in, and what should happen..."
                  rows={3}
                  className="w-full rounded border border-edge bg-surface p-2 text-xs text-ink placeholder:text-ink-soft focus:border-stamp focus:outline-none"
                />

                {interpretError && (
                  <p className="mt-2 text-xs text-fail font-mono">{interpretError}</p>
                )}

                {interpretResult?.flow && (
                  <div className="mt-3 rounded border border-pass/30 bg-pass-tint/30 p-2 text-xs">
                    <div className="font-bold text-pass mb-1">Interpreted as: {interpretResult.flow.name}</div>
                    <ol className="space-y-1 list-decimal pl-4 text-ink-soft text-[11px]">
                      {(interpretResult.flow.steps || []).map((s, idx) => (
                        <li key={idx}>{stepToSentence(s)}</li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      onClick={handleAddInterpretedTest}
                      disabled={savingEdit}
                      className="mt-2 btn-primary py-1 px-3 text-xs w-full"
                    >
                      Add this test to plan
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleInterpret}
                  disabled={interpreting || !describeText.trim()}
                  className="btn-quiet mt-2 w-full py-1.5 text-xs font-bold"
                >
                  {interpreting ? 'Translating with AI...' : 'Translate sentence →'}
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: Specs & Design Docs */
            <div className="flex-1 p-5 space-y-5">
              <div>
                <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-stamp">
                  Product Specifications & PRD
                </h3>
                <p className="text-xs text-ink-soft mb-2">
                  Add functional rules, expected API behavior, or user stories to enrich the plan:
                </p>
                <textarea
                  rows={6}
                  value={editProductContext}
                  onChange={(e) => setEditProductContext(e.target.value)}
                  placeholder="## Requirement: Invoice Validation&#10;- Negative amounts must be rejected&#10;- Submitting with missing date displays inline warning"
                  className="w-full rounded border border-edge bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-soft/50 focus:border-stamp focus:outline-none"
                />
              </div>

              <div>
                <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-stamp">
                  Design System Guidelines
                </h3>
                <p className="text-xs text-ink-soft mb-2">
                  Tokens, brand colors, typography, or viewport constraints:
                </p>
                <textarea
                  rows={5}
                  value={editDesignNotes}
                  onChange={(e) => setEditDesignNotes(e.target.value)}
                  placeholder="- Primary Brand: #2E6BFF&#10;- Minimum mobile width 375px&#10;- Headings: Atkinson Hyperlegible Next"
                  className="w-full rounded border border-edge bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-soft/50 focus:border-stamp focus:outline-none"
                />
              </div>

              {docsSaveMessage && (
                <div role="status" className="rounded border border-pass/40 bg-pass-tint/30 p-2.5 text-xs text-pass font-bold flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{docsSaveMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveDocs}
                disabled={savingDocs}
                className="btn-primary w-full py-2 text-xs font-bold"
              >
                {savingDocs ? 'Saving docs...' : 'Apply & Update Plan with Docs →'}
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
