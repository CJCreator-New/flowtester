import { useEffect, useRef, useState } from 'react';
import type { RunSummary } from '@qa/types';
import { checkReachable, RunnerError, type AiSetup, type RunnerStatus, type SiteFacts } from '../api';
import { KeyField } from '../components/KeyField';
import { ErrorMessage, Notice, Question, Spinner } from '../components/text';
import { rejectReason } from '../lib/context';
import { DEFAULT_MAX_PAGES, type CheckupForm } from '../lib/form';
import { formatWhen } from '../lib/format';
import { Link, PATHS } from '../lib/router';
import { hostOf, normalizeUrl } from '../lib/url';

/** What the address check found, for the address as it is now. */
type AddressCheck =
  | { state: 'empty' }
  | { state: 'invalid'; reason: string }
  | { state: 'checking'; url: string }
  | { state: 'ok'; url: string; facts: SiteFacts }
  | { state: 'unreachable'; url: string; reason: string; suggestion?: string; facts: SiteFacts };

/** What starting needs from the address check. */
export interface StartFacts {
  url: string;
  /** Sent only when the address looks live, so the runner remembers the person's answer. */
  stagingHost?: boolean;
}

const CHECK_DELAY_MS = 600;

/** The runner's own site facts decide whether the address is a Test Copy; the person can mark a live-looking one. */
function testCopyOf(facts: SiteFacts, form: CheckupForm): { natural: boolean; showMark: boolean; isTestCopy: boolean } {
  const natural = !!facts.testCopy && !facts.remembered?.markedTestCopy;
  return { natural, showMark: !natural, isTestCopy: natural || form.markedTestCopy };
}

export function NewCheckupScreen({
  ai,
  onKeySaved,
  form,
  onFormChange,
  onStart,
  starting,
  startError,
  inProgress,
  recent,
}: {
  /** null while it's being read. */
  ai: AiSetup | null;
  onKeySaved: (model: string) => void;
  form: CheckupForm;
  onFormChange: (update: (form: CheckupForm) => CheckupForm) => void;
  onStart: (facts: StartFacts) => void;
  starting: boolean;
  startError: string | null;
  /** The runner's state, when a check-up is in progress: shown as a Resume card. */
  inProgress: RunnerStatus | null;
  recent: RunSummary[] | null;
}) {
  const [check, setCheck] = useState<AddressCheck>({ state: 'empty' });
  const [recheck, setRecheck] = useState(0);
  const latest = useRef(0);
  const keyReady = !!ai?.configured;
  const [keyJustSaved, setKeyJustSaved] = useState(false);

  // The address is checked a moment after typing stops, like the key.
  useEffect(() => {
    const typed = form.address.trim();
    if (!typed) {
      setCheck({ state: 'empty' });
      return;
    }
    const normal = normalizeUrl(typed);
    const id = ++latest.current;
    if (!normal.ok) {
      const timer = setTimeout(() => id === latest.current && setCheck({ state: 'invalid', reason: normal.reason }), CHECK_DELAY_MS);
      return () => clearTimeout(timer);
    }
    setCheck({ state: 'checking', url: normal.url });
    const timer = setTimeout(async () => {
      try {
        const result = await checkReachable(normal.url);
        if (id !== latest.current) return;
        const facts: SiteFacts = { host: result.host, testCopy: result.testCopy, remembered: result.remembered };
        setCheck(result.ok ? { state: 'ok', url: normal.url, facts } : { state: 'unreachable', url: normal.url, reason: result.reason, suggestion: result.suggestion, facts });
      } catch (err) {
        if (id !== latest.current) return;
        setCheck({
          state: 'unreachable',
          url: normal.url,
          reason: err instanceof RunnerError ? err.message : 'The address couldn’t be checked. Try again.',
          facts: {},
        });
      }
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form.address, recheck]);

  // A site checked before starts from the choices made for it last time; a new one starts unticked.
  const checkedHost = check.state === 'ok' || check.state === 'unreachable' ? check.facts.host ?? hostOf(check.url) : null;
  const remembered = check.state === 'ok' || check.state === 'unreachable' ? check.facts.remembered : undefined;
  useEffect(() => {
    if (!checkedHost) return;
    onFormChange((f) =>
      f.choicesFor === checkedHost
        ? f
        : { ...f, owner: remembered?.owner ?? false, markedTestCopy: remembered?.markedTestCopy ?? false, choicesFor: checkedHost }
    );
  }, [checkedHost, remembered?.owner, remembered?.markedTestCopy, onFormChange]);

  const hostNow = (() => {
    const normal = normalizeUrl(form.address);
    return normal.ok ? hostOf(normal.url) : null;
  })();
  const setChoice = (change: Partial<Pick<CheckupForm, 'owner' | 'markedTestCopy'>>) =>
    onFormChange((f) => ({ ...f, ...change, choicesFor: hostNow ?? f.choicesFor }));

  const kind = check.state === 'ok' ? testCopyOf(check.facts, form) : null;
  const canStart = keyReady && check.state === 'ok' && !starting;
  const start = () => {
    if (check.state !== 'ok' || !kind || !canStart) return;
    onStart({ url: check.url, stagingHost: kind.showMark ? form.markedTestCopy : undefined });
  };

  const added = [form.specs, form.designNotes, form.journeys].filter((t) => t.trim()).length;

  return (
    <div className="mx-auto max-w-[44rem] px-4 py-10 sm:px-6 sm:py-14">
      {inProgress && <ResumeCard status={inProgress} />}

      <Question>Enter the address of the site to check</Question>
      <p className="mb-8 max-w-prose text-ink-soft">
        The site is scanned and a test plan is written for you to review. Nothing is tested until you approve the plan.
      </p>

      {ai && !keyReady && (
        <section aria-labelledby="key-title" className="mb-8 rounded-lg border-2 border-stamp bg-surface p-5">
          <h2 id="key-title" className="mb-1 text-xl font-bold">
            First, connect the AI
          </h2>
          <p className="mb-4 text-sm text-ink-soft">
            The AI writes the test plan. It runs on OpenRouter’s free models, so it costs nothing. You only do this once, and anything
            you type below is kept.
          </p>
          <KeyField
            onSaved={(model) => {
              setKeyJustSaved(true);
              onKeySaved(model);
            }}
          />
        </section>
      )}
      {keyJustSaved && keyReady && (
        <div className="mb-6">
          <Notice tone="pass" title="The AI is connected.">
            You can change the key any time in Settings.
          </Notice>
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (check.state === 'ok') start();
          else setRecheck((n) => n + 1);
        }}
      >
        <label htmlFor="url-input" className="label">
          Site address
        </label>
        <input
          id="url-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          className="field h-14 text-lg"
          placeholder="shop.example.com or localhost:3050"
          value={form.address}
          onChange={(e) => onFormChange((f) => ({ ...f, address: e.target.value }))}
          aria-describedby="url-status"
          aria-invalid={check.state === 'invalid' || check.state === 'unreachable'}
        />
        <div id="url-status" role="status" className="mt-2 min-h-[1.6em] text-sm">
          {check.state === 'checking' && <Spinner label="Checking the address…" />}
          {check.state === 'invalid' && <span className="text-fail">{check.reason}</span>}
          {check.state === 'ok' && kind && (
            <span className="block space-y-0.5">
              <span className="block text-ink-soft">
                <span className="font-bold text-pass">✓ Found</span> <span className="break-all font-mono text-ink">{check.url}</span>
              </span>
              <span className="block font-bold text-ink">
                {kind.isTestCopy && form.owner
                  ? 'Test copy: forms can be filled in and sent.'
                  : kind.isTestCopy
                    ? 'Only looked at, nothing is sent or changed. Tick “I own this site” below to test it fully.'
                    : 'Live site: only looked at, nothing is sent or changed.'}
              </span>
            </span>
          )}
        </div>
        {check.state === 'unreachable' && (
          <ErrorMessage>
            <span className="block font-bold">{check.reason}</span>
            {check.suggestion && <span className="block text-ink">{check.suggestion}</span>}
            <button type="button" className="btn-link mt-1 text-sm" onClick={() => setRecheck((n) => n + 1)}>
              Check again
            </button>
          </ErrorMessage>
        )}

        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">What the check-up may do</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-edge bg-surface p-4 hover:border-stamp">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-[#6C9BF2]"
              checked={form.owner}
              onChange={(e) => setChoice({ owner: e.target.checked })}
              aria-describedby="owner-hint"
            />
            <span>
              <span className="block font-bold">I own this site, or I’m allowed to test it</span>
              <span id="owner-hint" className="block text-sm text-ink-soft">
                Forms are only filled in and sent on a test copy you own. Any other site is only looked at.
              </span>
            </span>
          </label>
          {kind?.showMark && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-edge bg-surface p-4 hover:border-stamp">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-[#6C9BF2]"
                checked={form.markedTestCopy}
                onChange={(e) => setChoice({ markedTestCopy: e.target.checked })}
                aria-describedby="test-copy-hint"
              />
              <span>
                <span className="block font-bold">This is a test copy</span>
                <span id="test-copy-hint" className="block text-sm text-ink-soft">
                  A copy of your site that’s safe to fill in and send forms on, such as a staging site. Leave it unticked for the real
                  site.
                </span>
              </span>
            </label>
          )}
        </fieldset>

        <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <label htmlFor="max-pages">Explore up to</label>
          <input
            id="max-pages"
            type="number"
            min={1}
            max={1000}
            className="field w-24 py-1.5 text-sm"
            value={form.maxPages}
            onChange={(e) => onFormChange((f) => ({ ...f, maxPages: Math.min(1000, Math.max(1, Number(e.target.value) || DEFAULT_MAX_PAGES)) }))}
            aria-describedby="max-pages-hint"
          />
          <span>pages</span>
          <span id="max-pages-hint" className="basis-full text-ink-soft">
            Pages that share a layout are tested through a few samples, so big sites stay quick.
          </span>
        </div>

        <details className="mt-6 rounded-lg border-2 border-edge bg-surface" open={added > 0 || undefined}>
          <summary className="flex min-h-[48px] cursor-pointer flex-wrap items-center gap-x-2 px-4 py-3 font-bold">
            Add specs, design notes or journeys
            <span className="font-normal text-ink-soft">(optional)</span>
            {added > 0 && <span className="rounded border border-pass px-1.5 text-xs text-pass">Added</span>}
          </summary>
          <div className="space-y-5 border-t border-rule p-4">
            <p className="text-sm text-ink-soft">The AI plans with these, so the plan tests what the site is meant to do.</p>
            <MaterialField
              id="specs"
              label="Specs"
              hint="Requirements, user stories or acceptance criteria."
              placeholder={'For example:\n- Only managers can see reports\n- A new invoice needs a client name and an amount above zero'}
              value={form.specs}
              onChange={(value) => onFormChange((f) => ({ ...f, specs: value }))}
            />
            <MaterialField
              id="design-notes"
              label="Design notes"
              hint="Colours, type and layout rules the site should follow."
              placeholder={'For example:\n- The main colour is #2E6BFF\n- Nothing scrolls sideways on a phone'}
              value={form.designNotes}
              onChange={(value) => onFormChange((f) => ({ ...f, designNotes: value }))}
            />
            <MaterialField
              id="journeys"
              label="Journeys to test"
              hint="Things people do across pages that matter most."
              placeholder={'For example:\nSign in as a manager, open Reports and check the open invoices are listed.'}
              value={form.journeys}
              onChange={(value) => onFormChange((f) => ({ ...f, journeys: value }))}
            />
          </div>
        </details>

        {startError && <ErrorMessage>{startError}</ErrorMessage>}

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" className="btn-primary px-8" disabled={!canStart} aria-describedby="start-hint">
            {starting ? <Spinner label="Starting…" /> : 'Scan the site'}
          </button>
          <p id="start-hint" className="text-sm text-ink-soft">
            {ai && !keyReady ? 'Connect the AI above first.' : 'Nothing is tested until you approve the plan.'}
          </p>
        </div>
      </form>

      {recent && recent.length > 0 && (
        <section aria-labelledby="recent-title" className="mt-14">
          <h2 id="recent-title" className="mb-3 text-lg font-bold">
            Recent check-ups
          </h2>
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface/60">
            {recent.slice(0, 5).map((run) => (
              <li key={run.runId}>
                <Link
                  to={PATHS.report(run.runId)}
                  className="flex min-h-[48px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 hover:bg-surface"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{run.host}</span>
                    <span className="block text-sm text-ink-soft">{formatWhen(run.timestamp)}</span>
                  </span>
                  <span className={`text-sm font-bold ${run.ready ? 'text-pass' : 'text-fail'}`}>{run.stamp}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to={PATHS.reports} className="btn-link mt-2 text-sm">
            See all past check-ups
          </Link>
        </section>
      )}
    </div>
  );
}

/** "Your check-up of shop.example.com is waiting for your review → Open the plan". */
function ResumeCard({ status }: { status: RunnerStatus }) {
  const host = status.targetUrl ? hostOf(status.targetUrl) : 'your site';
  const card =
    status.phase === 'scanning'
      ? { text: `Your check-up of ${host} is scanning the site.`, to: PATHS.scan, action: 'Watch the scan' }
      : status.phase === 'awaiting-review'
        ? { text: `Your check-up of ${host} is waiting for your review.`, to: PATHS.plan, action: 'Open the plan' }
        : status.phase === 'testing'
          ? { text: `Your check-up of ${host} is being tested.`, to: PATHS.testing, action: 'Watch the testing' }
          : null;
  if (!card) return null;
  return (
    <aside aria-label="Check-up in progress" className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-stamp bg-stamp-tint px-5 py-4">
      <p className="font-bold text-ink">{card.text}</p>
      <Link to={card.to} className="btn-primary">
        {card.action} <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}

/** A text box for reference material, with a file to add to it. */
function MaterialField({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [fileError, setFileError] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        <label className="cursor-pointer text-sm font-bold text-stamp underline underline-offset-4 hover:text-stamp-dark focus-within:outline focus-within:outline-2 focus-within:outline-stamp">
          Add a file
          <input
            type="file"
            accept=".md,.markdown,.txt"
            className="sr-only"
            aria-label={`Add a file to ${label}`}
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              input.value = '';
              if (!file) return;
              const reason = rejectReason(file.name, file.size);
              if (reason) {
                setFileError(reason);
                return;
              }
              setFileError(null);
              const text = await file.text();
              onChange(value.trim() ? `${value.trim()}\n\n${text}` : text);
            }}
          />
        </label>
      </div>
      <p id={`${id}-hint`} className="mb-2 text-sm text-ink-soft">
        {hint}
      </p>
      <textarea
        id={id}
        rows={4}
        className="field text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      {fileError && (
        <p role="alert" className="mt-1 text-sm text-fail">
          {fileError}
        </p>
      )}
    </div>
  );
}
