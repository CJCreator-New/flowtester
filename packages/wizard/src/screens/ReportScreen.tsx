import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { AspectType, Finding, ReleaseReport } from '@qa/types';
import { downloadRunFile, getRun, RunnerError } from '../api';
import { DeveloperDetails } from '../components/DeveloperDetails';
import { SiteMap } from '../components/SiteMap';
import { ErrorMessage, FocusHeading, Spinner } from '../components/text';
import { count, formatDay, formatDuration, formatWhen, scrollBehavior } from '../lib/format';
import { gradeClasses } from '../lib/grades';
import { Link, PATHS } from '../lib/router';
import { ASPECTS, BUCKETS, aspectOf, category, groupProblems, pageResults, plainTitle, plainTitleText, summarizeReport, type Bucket, type ProblemGroup } from '../lib/summary';
import { useDocumentTitle } from '../lib/title';
import { looksTechnical } from '../lib/translate';
import { hostOf } from '../lib/url';

/** Reports with more problems than this get filters and a search box. */
const FILTER_ABOVE = 10;

export interface ReportActions {
  onTestAgain: (report: ReleaseReport) => void;
  onGoDeeper: (report: ReleaseReport, signIn: { username: string; password: string }) => void;
  /** A new check-up is being started from here. */
  starting: boolean;
  /** Why starting one failed, in plain words. */
  actionError: string | null;
}

/** One check-up's report, at an address that never changes: /reports/<runId>. */
export function ReportScreen({ runId, actions }: { runId: string; actions: ReportActions }) {
  const [report, setReport] = useState<ReleaseReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    getRun(runId)
      .then((r) => !cancelled && setReport(r))
      .catch((err) => !cancelled && setError(err instanceof RunnerError ? err.message : 'The report couldn’t be opened. Try again.'));
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useDocumentTitle(report ? `Report for ${hostOf(report.targetUrl)}` : 'Report');

  if (error) {
    return (
      <div className="mx-auto max-w-prose px-4 py-12 sm:px-6">
        <FocusHeading className="mb-4 text-3xl font-bold">This report can’t be shown</FocusHeading>
        <ErrorMessage>{error}</ErrorMessage>
        <Link to={PATHS.reports} className="btn-primary mt-6">
          Past check-ups
        </Link>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="mx-auto max-w-prose px-4 py-12 text-ink-soft sm:px-6">
        <Spinner label="Opening the report…" />
      </div>
    );
  }
  return <Report report={report} actions={actions} />;
}

function Report({ report, actions }: { report: ReleaseReport; actions: ReportActions }) {
  const summary = summarizeReport(report);
  const host = hostOf(report.targetUrl);
  const { pages, statuses } = useMemo(() => pageResults(report), [report]);
  const [pageFilter, setPageFilter] = useState<string | null>(null);
  const problemsRef = useRef<HTMLElement>(null);
  const coverage = report.coverage;

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="shrink-0 py-2">
          <FocusHeading
            className={`stamp inline-block rounded-md border-4 px-5 py-2 font-stamp text-4xl uppercase leading-none tracking-wide sm:text-5xl ${
              summary.ready ? 'border-pass text-pass' : 'border-fail text-fail'
            }`}
          >
            {summary.stamp}
          </FocusHeading>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink-soft">
            Check-up of <span className="font-bold text-ink">{host}</span> · {formatWhen(report.timestamp)}
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">{summary.reason}</p>
          <p className="mt-1 text-ink-soft">
            {summary.headline}
            {coverage.totalTestPoints > 0 && ` · ${count(coverage.totalTestPoints, 'test', 'tests')} in ${formatDuration(report.durationMs)}`}
          </p>
          {summary.readOnly && <p className="mt-2 text-sm text-ink">Only looked at: nothing was sent or changed, so forms weren’t tested.</p>}
          {report.testedWithApprovedPlan && <p className="mt-2 text-sm text-ink">Tested with the plan you approved on {formatDay(report.testedWithApprovedPlan)}.</p>}
        </div>
      </header>

      <ReportActionsBar report={report} actions={actions} />

      <AspectGrades report={report} />

      <Improvements report={report} />

      {/* Only once there's an earlier check-up to compare with. */}
      {report.history?.previousTimestamp && <Changes report={report} />}

      <section aria-labelledby="map-title">
        <h2 id="map-title" className="mb-1 text-2xl font-bold">
          Map of results
        </h2>
        <p className="mb-3 text-ink-soft">Every page that was tested, coloured by what was found on it. Choose a page to see its problems.</p>
        <div className="flex h-[30rem] overflow-hidden rounded-lg border border-edge">
          <SiteMap
            pages={pages}
            journeys={report.siteMap?.journeys}
            mode="report"
            maxCards={12}
            selectedPagePath={pageFilter}
            pageStatuses={statuses}
            onSelectPage={(path) => {
              setPageFilter(path);
              problemsRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
            }}
          />
        </div>
      </section>

      <Problems report={report} pageFilter={pageFilter} onPageFilter={setPageFilter} sectionRef={problemsRef} />

      {(report.notes?.length ?? 0) > 0 && (
        <section aria-labelledby="notes-title">
          <h2 id="notes-title" className="mb-3 text-2xl font-bold">
            Good to know
          </h2>
          <ul className="max-w-prose list-disc space-y-1 pl-5 text-ink">
            {report.notes!.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="rounded-md border border-rule bg-canvas/60">
        <summary className="min-h-[44px] cursor-pointer px-4 py-3 font-bold">Details for developers</summary>
        <div className="space-y-3 border-t border-rule p-4 text-sm">
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-quiet min-h-[40px] px-3 text-sm" onClick={() => void downloadRunFile(report.runId, 'report.md')}>
              Download report.md
            </button>
            <button type="button" className="btn-quiet min-h-[40px] px-3 text-sm" onClick={() => void downloadRunFile(report.runId, 'findings.json')}>
              Download findings.json
            </button>
          </div>
          <dl className="grid gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-soft">Run</dt>
            <dd className="break-all text-ink">{report.runId}</dd>
            <dt className="text-ink-soft">Address</dt>
            <dd className="break-all text-ink">{report.targetUrl}</dd>
            <dt className="text-ink-soft">Tests</dt>
            <dd className="text-ink">
              {coverage.passed} passed · {coverage.failed} failed · {coverage.blocked} blocked · {coverage.skipped} skipped · {coverage.couldNotVerify} could not verify
            </dd>
            {report.aiModels?.text && (
              <>
                <dt className="text-ink-soft">AI models</dt>
                <dd className="break-all text-ink">
                  {report.aiModels.text}
                  {report.aiModels.vision ? ` · ${report.aiModels.vision}` : ''}
                </dd>
              </>
            )}
          </dl>
        </div>
      </details>
    </div>
  );
}

function ReportActionsBar({ report, actions }: { report: ReleaseReport; actions: ReportActions }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [deeper, setDeeper] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            setDownloadError(null);
            try {
              await downloadRunFile(report.runId, 'report.html');
            } catch (err) {
              setDownloadError(err instanceof Error ? err.message : 'The report couldn’t be downloaded. Try again.');
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? <Spinner label="Downloading…" /> : 'Download the report'}
        </button>
        <button type="button" className="btn-quiet" disabled={actions.starting} onClick={() => actions.onTestAgain(report)}>
          {actions.starting ? <Spinner label="Starting…" /> : 'Test again'}
        </button>
        <button type="button" className="btn-link" aria-expanded={deeper} onClick={() => setDeeper((d) => !d)}>
          Go deeper: test the signed-in pages
        </button>
      </div>
      {downloadError && <ErrorMessage>{downloadError}</ErrorMessage>}
      {actions.actionError && <ErrorMessage>{actions.actionError}</ErrorMessage>}

      {deeper && (
        <form
          className="mt-4 max-w-xl space-y-4 rounded-lg border-2 border-stamp bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (username.trim() && password) actions.onGoDeeper(report, { username: username.trim(), password });
          }}
        >
          <div>
            <h2 className="text-lg font-bold">Test the pages behind a sign-in</h2>
            <p className="text-sm text-ink-soft">
              A new check-up signs in with this account, then scans and plans the pages it can reach. Use a test account, not a real
              person’s.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="deeper-username" className="label">
                Email or username
              </label>
              <input id="deeper-username" className="field" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label htmlFor="deeper-password" className="label">
                Password
              </label>
              <input id="deeper-password" type="password" className="field" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={actions.starting || !username.trim() || !password}>
            Scan the signed-in pages
          </button>
        </form>
      )}
    </div>
  );
}

function AspectGrades({ report }: { report: ReleaseReport }) {
  if (!report.grades) return null;
  return (
    <section aria-labelledby="aspects-title">
      <h2 id="aspects-title" className="mb-3 text-2xl font-bold">
        How each area did
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ASPECTS.map((aspect) => {
          const data = report.grades!.aspects[aspect];
          const checked = data && data.checked !== false;
          return (
            <li key={aspect} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface p-4">
              <span>
                <span className="block font-bold text-ink">{aspect}</span>
                <span className="block text-sm text-ink-soft">
                  {checked ? count(data.findings.length, 'problem', 'problems') : 'Nothing here was checked this time'}
                </span>
              </span>
              {checked ? (
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 text-2xl font-bold ${gradeClasses(data.grade)}`}>
                  <span className="sr-only">Grade </span>
                  {data.grade}
                </span>
              ) : (
                <span className="shrink-0 rounded-md border-2 border-edge px-2 py-1 text-sm font-bold text-ink-soft">Not checked</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Improvements({ report }: { report: ReleaseReport }) {
  const recommendations = (report.recommendations || []).slice(0, 5);
  if (recommendations.length === 0) return null;
  return (
    <section aria-labelledby="improve-title">
      <h2 id="improve-title" className="mb-3 text-2xl font-bold">
        What to improve first
      </h2>
      <ol className="space-y-3">
        {recommendations.map((rec) => (
          <li key={rec.id} className="rounded-lg border border-edge bg-surface p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded border px-1.5 font-bold ${rec.category === 'quick-win' ? 'border-pass text-pass' : 'border-stamp text-stamp'}`}>
                {rec.category === 'quick-win' ? 'Quick win' : 'Bigger change'}
              </span>
              <span className="text-ink-soft">
                {rec.aspect} · {rec.effort} effort · {rec.impact} impact
                {rec.affectedPages.length > 0 && ` · ${count(rec.affectedPages.length, 'page', 'pages')}`}
              </span>
            </p>
            <h3 className="mt-1 font-bold text-ink">{plainTitleText(rec.title)}</h3>
            {rec.summary && !looksTechnical(rec.summary) && <p className="mt-1 text-sm text-ink-soft">{rec.summary}</p>}
            {rec.suggestedFix && !looksTechnical(rec.suggestedFix) && (
              <p className="mt-1 text-sm text-ink">
                <strong>How to fix: </strong>
                {rec.suggestedFix}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Changes({ report }: { report: ReleaseReport }) {
  const history = report.history!;
  const items = [
    { label: 'Fixed since last time', value: history.fixedFindingFingerprints.length, tone: 'text-pass' },
    { label: 'New', value: history.newFindingFingerprints.length, tone: 'text-fail' },
    { label: 'Still there', value: history.openFindingFingerprints.length, tone: 'text-warn' },
  ];
  return (
    <section aria-labelledby="changes-title">
      <h2 id="changes-title" className="mb-1 text-2xl font-bold">
        Since the last check-up
      </h2>
      {history.previousTimestamp && <p className="mb-3 text-ink-soft">Compared with the check-up on {formatDay(history.previousTimestamp)}.</p>}
      <dl className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse rounded-lg border border-edge bg-surface p-4 text-center">
            <dt className="text-sm text-ink-soft">{item.label}</dt>
            <dd className={`text-3xl font-bold ${item.tone}`}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface Filters {
  search: string;
  bucket: Bucket | 'all';
  aspect: AspectType | 'all';
}

function Problems({
  report,
  pageFilter,
  onPageFilter,
  sectionRef,
}: {
  report: ReleaseReport;
  pageFilter: string | null;
  onPageFilter: (page: string | null) => void;
  sectionRef: RefObject<HTMLElement>;
}) {
  const [filters, setFilters] = useState<Filters>({ search: '', bucket: 'all', aspect: 'all' });
  const withFilters = report.findings.length > FILTER_ABOVE;
  const problemPages = useMemo(() => [...new Set(report.findings.map((f) => f.where.urlPath))].sort(), [report.findings]);

  const shown = useMemo(() => {
    const words = filters.search.trim().toLowerCase();
    const matches = (f: Finding) =>
      (!pageFilter || f.where.urlPath === pageFilter || !!f.seenAt?.pages.includes(pageFilter)) &&
      (filters.aspect === 'all' || aspectOf(f.checker) === filters.aspect) &&
      (!words || [plainTitle(f), category(f), f.where.urlPath].join(' ').toLowerCase().includes(words));
    return groupProblems(report.findings.filter(matches));
  }, [report.findings, pageFilter, filters]);

  const buckets = BUCKETS.filter((b) => (filters.bucket === 'all' || filters.bucket === b.id) && shown[b.id].length > 0);
  const filtered = !!pageFilter || filters.search.trim() !== '' || filters.bucket !== 'all' || filters.aspect !== 'all';

  return (
    <section ref={sectionRef} aria-labelledby="problems-title" className="scroll-mt-20">
      <h2 id="problems-title" className="mb-3 text-2xl font-bold">
        Problems found
      </h2>

      {withFilters && (
        <div role="search" aria-label="Filter the problems" className="mb-4 grid gap-3 rounded-lg border border-rule bg-panel p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="problem-search" className="mb-1 block text-sm font-bold">
              Search
            </label>
            <input
              id="problem-search"
              type="search"
              className="field py-2 text-sm"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="problem-bucket" className="mb-1 block text-sm font-bold">
              How serious
            </label>
            <select
              id="problem-bucket"
              className="field py-2 text-sm"
              value={filters.bucket}
              onChange={(e) => setFilters((f) => ({ ...f, bucket: e.target.value as Filters['bucket'] }))}
            >
              <option value="all">All</option>
              {BUCKETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="problem-page" className="mb-1 block text-sm font-bold">
              Page
            </label>
            <select id="problem-page" className="field py-2 text-sm" value={pageFilter ?? ''} onChange={(e) => onPageFilter(e.target.value || null)}>
              <option value="">All pages</option>
              {problemPages.map((page) => (
                <option key={page} value={page}>
                  {page}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="problem-aspect" className="mb-1 block text-sm font-bold">
              Area
            </label>
            <select
              id="problem-aspect"
              className="field py-2 text-sm"
              value={filters.aspect}
              onChange={(e) => setFilters((f) => ({ ...f, aspect: e.target.value as Filters['aspect'] }))}
            >
              <option value="all">All areas</option>
              {ASPECTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {pageFilter && (
        <p className="mb-4 text-ink">
          Showing the problems on <span className="break-all font-mono">{pageFilter}</span>.{' '}
          <button type="button" className="btn-link min-h-0" onClick={() => onPageFilter(null)}>
            Show every page
          </button>
        </p>
      )}

      {report.findings.length === 0 ? (
        <p className="rounded-lg border border-pass bg-pass-tint p-6 text-center font-bold text-pass">No problems found.</p>
      ) : buckets.length === 0 ? (
        <p className="text-ink-soft">{filtered ? 'No problems match these filters.' : 'No problems count against this check-up.'}</p>
      ) : (
        <div className="space-y-8">
          {buckets.map((bucket) => (
            <section key={bucket.id} aria-labelledby={`bucket-${bucket.id}`}>
              <h3 id={`bucket-${bucket.id}`} className="text-xl font-bold">
                {bucket.title} <span className="font-normal text-ink-soft">({shown[bucket.id].length})</span>
              </h3>
              <p className="mb-3 text-sm text-ink-soft">{bucket.intro}</p>
              <ul className="space-y-2">
                {shown[bucket.id].map((group) => (
                  <ProblemItem key={group.key} group={group} report={report} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

const BUCKET_BORDER: Record<Bucket, string> = {
  'must-fix': 'border-l-fail',
  'should-fix': 'border-l-warn',
  suggestion: 'border-l-stamp',
  'to-confirm': 'border-l-edge',
};

/** One problem: a button that opens where it was found, and the details for developers. */
function ProblemItem({ group, report }: { group: ProblemGroup; report: ReleaseReport }) {
  const [open, setOpen] = useState(false);
  const first = group.findings[0];
  const id = `problem-${group.key.replace(/[^A-Za-z0-9_-]+/g, '_')}`;
  return (
    <li className={`rounded-lg border border-l-4 border-rule bg-surface ${BUCKET_BORDER[group.bucket]}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 rounded-lg p-4 text-left hover:bg-panel"
      >
        <span className="min-w-0">
          <span className="block font-bold text-ink">{group.title}</span>
          <span className="block text-sm text-ink-soft">
            {group.category} · {group.pages.length === 1 ? <span className="break-all font-mono">{group.pages[0]}</span> : count(group.pages.length, 'page', 'pages')}
          </span>
        </span>
        <span aria-hidden="true" className="mt-1 shrink-0 text-ink-soft">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div id={id} className="border-t border-rule px-4 pb-4 pt-3">
          <p className="text-sm text-ink-soft">Found on:</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {group.pages.map((page) => (
              <li key={page} className="break-all rounded border border-rule bg-canvas px-2 py-0.5 font-mono text-xs text-ink">
                {page}
              </li>
            ))}
          </ul>
          <DeveloperDetails finding={first} runId={report.runId} targetUrl={report.targetUrl} />
        </div>
      )}
    </li>
  );
}
