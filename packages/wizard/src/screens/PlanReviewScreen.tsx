import { useEffect, useMemo, useState } from 'react';
import type { Breakpoint, ReviewPlan } from '@qa/types';
import { SiteMap } from '../components/SiteMap';
import { FocusHeading, Notice, Spinner } from '../components/text';
import { count } from '../lib/format';
import { useDocumentTitle } from '../lib/title';
import { PlanDocument, type PlanActions } from '../components/plan/PlanDocument';
import { showItem } from '../components/plan/parts';
import { patchPlan, replanItem, replanEverything, addPageToPlan, includeHostInPlan, downloadPlanMarkdown, interpretSentence } from '../api';

/** A background change to the plan (re-planning, adding pages), as the QA Tool reports it. */
export interface PlanUpdateState {
  running: boolean;
  what?: string;
  step?: string;
  error?: string | null;
}

/** A banner over the plan: testing stopped or failed, or the site changed since the plan was approved. */
export interface PlanNotice {
  tone: 'fail' | 'warn' | 'stamp';
  title: string;
  body?: string;
}

export interface PlanReviewScreenProps {
  plan: ReviewPlan;
  onApprove: () => void;
  onPlanUpdated: (plan: ReviewPlan) => void;
  update: PlanUpdateState;
  approveError?: string | null;
  approving?: boolean;
  notice?: PlanNotice | null;
}

/**
 * The plan as the person sees it: switches they just flipped show at once, before the QA Tool has
 * saved them. An item's `skipped` comes from `switched`; the screen sizes from `sizes`.
 */
function withChanges(plan: ReviewPlan, switched: Record<string, boolean>, sizes: Breakpoint[] | null): ReviewPlan {
  if (Object.keys(switched).length === 0 && !sizes) return plan;
  const skip = <T extends { id: string; skipped?: boolean }>(item: T): T => (item.id in switched ? { ...item, skipped: switched[item.id] } : item);
  return {
    ...plan,
    screenSizes: sizes ?? plan.screenSizes,
    planPages: plan.planPages?.map((p) => skip({ ...p, tests: p.tests.map(skip) })),
    navigation: plan.navigation?.map(skip),
    flows: plan.flows.map((f) => (`journey:${f.id}` in switched ? { ...f, outOfScope: switched[`journey:${f.id}`] || undefined } : f)),
  };
}

/**
 * The Plan Review. Leaving it keeps the plan waiting (the new check-up screen offers it again), so
 * there's no Back here that could throw it away.
 */
export function PlanReviewScreen({ plan, onApprove, onPlanUpdated, update, approveError, approving = false, notice }: PlanReviewScreenProps) {
  const [tab, setTab] = useState<'plan' | 'map'>('plan');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switched, setSwitched] = useState<Record<string, boolean>>({});
  const [sizes, setSizes] = useState<Breakpoint[] | null>(null);
  const shown = useMemo(() => withChanges(plan, switched, sizes), [plan, switched, sizes]);

  // A background change started here waits until the QA Tool says it has finished or failed.
  useEffect(() => {
    if (!update.running) setPending(false);
  }, [update.running]);
  const busy = pending || update.running;

  const edit = async (change: () => Promise<ReviewPlan>) => {
    setError(null);
    try {
      onPlanUpdated(await change());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The plan couldn’t be changed. Try again.');
    }
  };
  const inBackground = async (start: () => Promise<void>) => {
    setError(null);
    setPending(true);
    try {
      await start();
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : 'The plan couldn’t be updated. Try again.');
    }
  };

  const actions: PlanActions = {
    busy,
    // Shown at once; kept until the saved plan comes back, or undone if saving fails.
    setSkipped: (id, skipped) => {
      setSwitched((s) => ({ ...s, [id]: skipped }));
      void edit(() => patchPlan({ items: [{ id, skipped }] })).finally(() =>
        setSwitched(({ [id]: _done, ...rest }) => rest)
      );
    },
    replan: (id, instructions) => void inBackground(() => replanItem(id, instructions)),
    promote: (id) => void inBackground(() => replanItem(id, undefined, true)),
    addPage: async (address) => {
      setError(null);
      setPending(true);
      try {
        await addPageToPlan(address);
      } catch (err) {
        setPending(false);
        throw err;
      }
    },
    includeHost: (host) => void inBackground(() => includeHostInPlan(host)),
    answer: (questionId, answer) => void edit(() => patchPlan({ answers: { [questionId]: answer } })),
    setScreenSizes: (chosen) => {
      setSizes(chosen);
      void edit(() => patchPlan({ screenSizes: chosen })).finally(() => setSizes(null));
    },
    replanEverything: () => void inBackground(() => replanEverything()),
    saveDocsAndReplan: async (productContext, designNotes) => {
      await edit(() => patchPlan({ productContext, designNotes }));
      await inBackground(() => replanEverything(productContext));
    },
    describeTest: (sentence, urlPath) => interpretSentence({ sentence, urlPath }),
    addJourney: (flow) => edit(() => patchPlan({ flows: [...plan.flows, flow] })),
  };

  // The site's real links, for the map.
  const links = useMemo(
    () => plan.pages.flatMap((p) => (p.links || []).filter((l) => !l.leavesSite).map((l) => ({ from: p.urlPath, to: l.landsOn ?? l.to }))),
    [plan.pages]
  );

  let host = plan.targetUrl;
  try {
    host = new URL(plan.targetUrl).host;
  } catch {
    // keep the address as it is
  }
  const lines = plan.summary?.lines || [];
  useDocumentTitle(`Plan for ${host}`);

  return (
    <div className="flex min-h-[calc(100vh-7rem)] w-full flex-col bg-canvas">
      <div className="border-b border-rule bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <FocusHeading className="break-words text-2xl font-bold text-ink sm:text-3xl">Review the plan for {host}</FocusHeading>
            <p className="text-sm text-ink-soft">
              {plan.siteType ? `${plan.siteType} · ` : ''}
              {count(plan.planPages?.length ?? plan.pages.length, 'page', 'pages')} · {count(plan.navigation?.length ?? 0, 'link', 'links')} ·{' '}
              {count(plan.flows.length, 'journey', 'journeys')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="How to show the plan" className="flex rounded border border-rule bg-panel p-0.5 text-sm">
              {(
                [
                  ['plan', 'Full plan'],
                  ['map', 'Map'],
                ] as const
              ).map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`min-h-[40px] rounded px-3 font-bold ${tab === id ? 'bg-stamp text-surface' : 'text-ink-soft hover:text-ink'}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <button type="button" className="btn-quiet min-h-[44px] px-3 text-sm" onClick={() => downloadPlanMarkdown().catch((err: Error) => setError(err.message))}>
              Download the plan
            </button>
          </div>
        </div>
        {notice && (
          <div className="mx-auto mt-4 max-w-6xl">
            <Notice tone={notice.tone} title={notice.title}>
              {notice.body}
            </Notice>
          </div>
        )}
        {busy && (
          <p role="status" className="mx-auto mt-3 flex max-w-6xl items-center gap-2 text-sm text-stamp">
            <Spinner label={`Updating the plan: ${update.step || update.what || 'starting'}…`} />
          </p>
        )}
        {(update.error || error) && (
          <p role="alert" className="mx-auto mt-3 max-w-6xl text-sm text-fail">
            {update.error || error}
          </p>
        )}
      </div>

      <div className="flex-1">
        {tab === 'plan' ? (
          <PlanDocument plan={shown} actions={actions} />
        ) : (
          <div className="flex h-[70vh]">
            <SiteMap
              pages={plan.pages}
              flows={plan.flows}
              mode="plan"
              links={links}
              maxCards={12}
              onSelectPage={(urlPath) => {
                setTab('plan');
                window.setTimeout(() => showItem(`page:${urlPath}`), 60);
              }}
            />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-40 border-t border-rule bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-sm text-ink">
            <p className="font-bold">{lines[0]?.text ?? 'Ready to test'}</p>
            <p className="text-ink-soft">{lines.length > 1 ? lines.slice(1).map((l) => l.text).join(' · ') : 'Nothing runs until you approve.'}</p>
            {approveError && (
              <p role="alert" className="font-bold text-fail">
                {approveError}
              </p>
            )}
          </div>
          <button type="button" className="btn-primary" disabled={busy || approving} onClick={onApprove}>
            {approving ? <Spinner label="Starting the tests…" /> : 'Approve the plan and start testing'}
          </button>
        </div>
      </div>
    </div>
  );
}
