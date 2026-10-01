Now I have a complete understanding of the codebase. Let me provide comprehensive, actionable recommendations.

---

# UI/UX Improvements, Logic Flow Enhancements & Product Optimization Opportunities

Based on thorough analysis of the codebase (packages/wizard, packages/types, packages/hub, packages/runner, CONTEXT.md domain model, PRODUCT_REVIEW.md), here are concrete recommendations organized by category:

---

## 1. Visual Design Consistency

### 1.1 Unify Card Elevation System
**Problem**: The app uses inconsistent card elevations — `bg-surface`, `bg-surface/60`, `bg-canvas/60`, `bg-panel`, `bg-panel/80` — without a systematic elevation scale.

**Recommendation**: Define a 4-level elevation system in `tailwind.config.js`:
```javascript
// Add to theme.extend
boxShadow: {
  'level-1': '0 1px 2px 0 rgb(0 0 0 / 0.3)',      // Subtle (inline elements)
  'level-2': '0 4px 6px -1px rgb(0 0 0 / 0.4)',    // Default cards
  'level-3': '0 10px 15px -3px rgb(0 0 0 / 0.4)',  // Floating panels (SiteMap, side panel)
  'level-4': '0 20px 25px -5px rgb(0 0 0 / 0.5)',  // Modals, dropdowns
}
```
Apply consistently: `PlanDocument` sections → `level-2`, `SiteMap` cards → `level-3`, modals → `level-4`.

### 1.2 Standardize Interactive State Styling
**Problem**: Focus/hover/active states vary across components (some use `ring-2 ring-stamp`, others `border-stamp`, others `bg-stamp/10`).

**Recommendation**: Create a `.interactive` utility class in `index.css`:
```css
@layer components {
  .interactive {
    @apply transition-colors duration-150 
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp focus-visible:ring-offset-2 focus-visible:ring-offset-paper
           hover:border-stamp hover:bg-stamp/5
           active:bg-stamp/10;
  }
}
```
Apply to all clickable elements (buttons, cards, table rows, navigation items).

### 1.3 Consistent Border Radius Scale
**Problem**: Radii used: `rounded` (4px), `rounded-md` (6px), `rounded-lg` (8px), `rounded-full` (9999px), `rounded-[44px]` (custom).

**Recommendation**: Define semantic radius tokens:
```javascript
// tailwind.config.js
borderRadius: {
  'control': '6px',      // Buttons, inputs, selects
  'card': '8px',         // Cards, sections
  'panel': '12px',       // Side panels, modals
  'pill': '9999px',      // Badges, tags
}
```
Update all components to use `rounded-control`, `rounded-card`, `rounded-panel`.

---

## 2. User Navigation Efficiency

### 2.1 Keyboard Navigation for Plan Review (Critical)
**Problem**: The plan review is a single massive document (24,897px for 60 pages). No keyboard shortcuts exist for:
- Jumping between sections
- Toggling items
- Searching within the plan

**Recommendation**: Add global keyboard shortcuts (via `useEffect` in `App.tsx`):
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Focus plan search |
| `Cmd/Ctrl + Shift + K` | Toggle "Only what needs me" |
| `j` / `k` | Next/previous focusable item in plan |
| `Space` | Toggle focused checkbox |
| `Enter` on journey | Expand/collapse |
| `g` then `s` | Jump to Summary |
| `g` then `p` | Jump to Pages |
| `g` then `n` | Jump to Navigation |
| `g` then `j` | Jump to Journeys |

Add a `?` key overlay showing shortcuts (like GitHub).

### 2.2 Breadcrumb Navigation on Deep Screens
**Problem**: On Report → Problem Details → Developer Details, there's no breadcrumb to navigate back.

**Recommendation**: Add a persistent breadcrumb bar under the TopBar on Report screen:
```tsx
<nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 py-2 text-sm">
  <ol className="flex flex-wrap items-center gap-1 text-ink-soft">
    <li><Link to={PATHS.reports}>Past check-ups</Link></li>
    <li aria-hidden="true">/</li>
    <li><Link to={PATHS.report(report.runId)}>{host}</Link></li>
    <li aria-hidden="true">/</li>
    <li className="text-ink">Problems</li>
    {selectedProblem && (
      <>
        <li aria-hidden="true">/</li>
        <li className="text-ink truncate max-w-[200px]">{selectedProblem.title}</li>
      </>
    )}
  </ol>
</nav>
```

### 2.3 Deep Linking to Specific Plan Items
**Problem**: Can't share a link to a specific page, navigation check, or journey in the plan.

**Recommendation**: Add URL hash support:
- `#page:/products/123` → scroll to and highlight that page row
- `#nav:home-link` → scroll to that navigation check
- `#journey:create-invoice` → scroll to that journey
- `#question:Q-001` → scroll to that question

Implement in `PlanDocument.tsx` with `useEffect` watching `window.location.hash`.

---

## 3. Information Hierarchy & Content Organization

### 3.1 Progressive Disclosure for Plan Sections
**Problem**: All plan sections render fully, causing 3,151 DOM nodes for 60 pages.

**Recommendation**: Implement virtualized rendering for long lists:
```tsx
// In PagesSection, NavigationSection, JourneysSection
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120,
  overscan: 5,
});

// Render only visible items
{virtualizer.getVirtualItems().map((virtualRow) => (
  <Item key={items[virtualRow.index].id} {...items[virtualRow.index]} />
))}
```
This reduces initial DOM from 3,151 to ~50 nodes.

### 3.2 Collapsible Problem Groups by Default on Large Reports
**Problem**: Report shows all problems expanded, causing scroll fatigue.

**Recommendation**: Auto-collapse when `problems.length > 15`:
```tsx
const autoCollapse = problems.length > 15;
const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

// In render:
<details open={!autoCollapse || openGroups[group.key]}>
  <summary onClick={() => setOpenGroups(o => ({ ...o, [group.key]: !o[group.key] }))}>
    {group.title} ({group.count})
  </summary>
  {/* content */}
</details>
```

### 3.3 Summary Cards Before Detailed Lists
**Problem**: Report jumps straight to problem list without executive summary.

**Recommendation**: Add a "Problem Landscape" section at top of Problems:
```tsx
<section aria-labelledby="landscape-title" className="mb-8">
  <h2 id="landscape-title" className="mb-4 text-xl font-bold">Problem landscape</h2>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <MetricCard label="Total problems" value={total} tone="neutral" />
    <MetricCard label="Must fix" value={mustFix} tone="fail" />
    <MetricCard label="Should fix" value={shouldFix} tone="warn" />
    <MetricCard label="Suggestions" value={suggestions} tone="stamp" />
    <MetricCard label="Pages affected" value={uniquePages} tone="neutral" />
    <MetricCard label="Blockers" value={blockers} tone="fail" />
    <MetricCard label="Areas impacted" value={affectedAspects.length} tone="neutral" />
    <MetricCard label="New since last run" value={newCount} tone="warn" />
  </div>
</section>
```

---

## 4. Interaction Patterns

### 4.1 Drag-to-Reorder for Journeys & Pages
**Problem**: Journeys and custom-added pages can't be reordered; order matters for test execution.

**Recommendation**: Add `@dnd-kit/core` for drag-and-drop:
```tsx
// In JourneysSection
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={flowIds} strategy={verticalListSortingStrategy}>
    {flows.map(flow => <SortableJourneyItem key={flow.id} flow={flow} />)}
  </SortableContext>
</DndContext>
```

### 4.2 Inline Editing for Plan Item Names
**Problem**: To rename a test or journey, user must use "Re-plan with AI" — overkill for simple renames.

**Recommendation**: Add inline edit on click:
```tsx
// In TestRow, NavRow, Journey item
const [editing, setEditing] = useState(false);
const [name, setName] = useState(item.name);

return editing ? (
  <input 
    value={name} 
    onChange={e => setName(e.target.value)}
    onBlur={() => { actions.rename(item.id, name); setEditing(false); }}
    onKeyDown={e => e.key === 'Enter' && actions.rename(item.id, name)}
    autoFocus
    className="field py-1 text-base"
  />
) : (
  <span onClick={() => setEditing(true)} className="cursor-text hover:underline">
    {item.name}
  </span>
);
```

### 4.3 Bulk Actions with Keyboard Selection
**Problem**: "Switch all on/off" buttons exist but no Shift+Click or Cmd+Click multi-select.

**Recommendation**: Add multi-select mode:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// In each row:
<div 
  onClick={e => {
    if (e.shiftKey && lastSelected) {
      // Select range
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle single
    } else {
      // Single select
    }
  }}
  className={selectedIds.has(id) ? 'ring-2 ring-stamp' : ''}
>
  <Checkbox checked={selectedIds.has(id)} onChange={...} />
  {/* content */}
</div>

// Floating bulk action bar when selection > 0:
{selectedIds.size > 0 && (
  <div className="fixed bottom-4 right-4 z-50 flex gap-2">
    <button onClick={() => actions.setSkippedMany([...selectedIds], true)}>Disable {selectedIds.size}</button>
    <button onClick={() => actions.setSkippedMany([...selectedIds], false)}>Enable {selectedIds.size}</button>
    <button onClick={() => actions.replanMany([...selectedIds])}>Re-plan {selectedIds.size}</button>
  </div>
)}
```

---

## 5. Performance Optimization

### 5.1 Plan Response Payload Reduction (Already partially addressed in P1)
**Current**: 1.8 MB for 60 pages (81% is raw `elements` inventory never shown).

**Further optimization**: Implement cursor-based pagination for plan fetching:
```typescript
// API: GET /api/runner/plan?cursor=&limit=20&section=pages
// Returns: { items: PlanPage[], nextCursor: string | null, total: number }

// Client: Use infinite query (TanStack Query)
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['plan', runId, 'pages'],
  queryFn: ({ pageParam }) => fetchPlan({ cursor: pageParam, limit: 20 }),
  getNextPageParam: lastPage => lastPage.nextCursor,
});
```
Only load sections as user scrolls/expands them.

### 5.2 Memoize Expensive Computations in Report
**Problem**: `groupProblems`, `pageResults`, `summarizeReport` re-run on every render.

**Recommendation**: Move to Web Worker or memoize with `useMemo` + proper deps:
```tsx
// In ReportScreen.tsx
const { problems, pages, statuses } = useMemo(() => {
  // Heavy computation
  return {
    problems: groupProblems(report.findings),
    pages: pageResults(report),
    statuses: computeStatuses(report),
  };
}, [report.findings, report.pages, report.siteMap?.journeys]); // Stable refs
```

### 5.3 Lazy-Load Heavy Components
**Problem**: `SiteMap` (SVG drawing), `DeveloperDetails` (large evidence), `PlanDocument` all load upfront.

**Recommendation**: Code-split with `React.lazy` + `Suspense`:
```tsx
const SiteMap = React.lazy(() => import('./components/SiteMap'));
const DeveloperDetails = React.lazy(() => import('./components/DeveloperDetails'));

// In ReportScreen:
<Suspense fallback={<MapSkeleton />}>
  <SiteMap ... />
</Suspense>

// In ProblemItem (only when expanded):
<Suspense fallback={<DetailsSkeleton />}>
  <DeveloperDetails ... />
</Suspense>
```

### 5.4 Debounce Plan Updates
**Problem**: Every checkbox toggle sends `PATCH /api/runner/plan` immediately.

**Recommendation**: Batch updates with 300ms debounce:
```tsx
// In PlanReviewScreen.tsx
const pendingChanges = useRef<PlanDelta>({});

const debouncedSave = useMemo(
  () => debounce((delta: PlanDelta) => {
    patchPlan(delta).then(onPlanUpdated);
  }, 300),
  []
);

const setSkipped = (id: string, skipped: boolean) => {
  setSwitched(s => ({ ...s, [id]: skipped }));
  pendingChanges.current = { ...pendingChanges.current, items: [...(pendingChanges.current.items||[]), { id, skipped }] };
  debouncedSave(pendingChanges.current);
};
```

---

## 6. Feature Prioritization & Product Gaps

### 6.1 Missing: Test Copy Validation Before Scan
**Problem**: User enters a URL, but there's no pre-scan validation that it's actually a test copy (safe to submit forms).

**Recommendation**: Add a "Verify test copy" step before scan starts:
```tsx
// In NewCheckupScreen, after address check passes:
const [verified, setVerified] = useState<'unknown' | 'checking' | 'yes' | 'no'>('unknown');

useEffect(() => {
  if (kind?.isTestCopy && form.owner) {
    setVerified('checking');
    checkTestCopy(check.url).then(result => setVerified(result.safe ? 'yes' : 'no'));
  }
}, [check.url, kind, form.owner]);

{verified === 'checking' && <Spinner label="Verifying test copy…" />}
{verified === 'no' && (
  <Notice tone="warn" title="This may not be a safe test copy">
    The site responded like a production site. Forms won't be submitted unless you confirm.
    <button onClick={() => setVerified('yes')}>I confirm it's safe</button>
  </Notice>
)}
```
Backend: `HEAD /` + check for `X-Test-Copy` header or known staging patterns.

### 6.2 Missing: Visual Regression Baseline Management UI
**Problem**: Visual baselines are managed via CLI (`qa-test figma sync`, `--update-baselines`). No UI to approve/reject diffs.

**Recommendation**: Add "Visual Baselines" tab in Settings or Report:
```tsx
// New screen: VisualBaselinesScreen.tsx
function VisualBaselinesScreen() {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  
  return (
    <div className="space-y-4">
      <h2>Visual baselines</h2>
      {baselines.map(b => (
        <div key={b.id} className="grid grid-cols-3 gap-4 p-4 border rounded">
          <img src={b.current} alt="Current" className="col-span-1" />
          <img src={b.baseline} alt="Baseline" className="col-span-1" />
          <div className="col-span-1 space-y-2">
            <p className="font-bold">{b.page}</p>
            <p className="text-sm text-ink-soft">{b.diff}% difference</p>
            {b.status === 'changed' && (
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => approveBaseline(b.id)}>Accept new</button>
                <button className="btn-quiet" onClick={() => rejectBaseline(b.id)}>Keep old</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 6.3 Missing: Competitive Benchmarking UI
**Problem**: `qa-test compare` exists in CLI but no Wizard UI for it.

**Recommendation**: Add "Benchmark" entry in TopBar (when Hub connected) → new screen:
```tsx
// BenchmarkScreen.tsx
function BenchmarkScreen() {
  const [targetUrl, setTargetUrl] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [flowName, setFlowName] = useState('');
  const [result, setResult] = useState<CompetitiveBenchmark | null>(null);
  
  return (
    <form onSubmit={runBenchmark} className="space-y-6 max-w-2xl">
      <section>
        <label className="label">Your flow URL</label>
        <input className="field" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://yoursite.com/checkout" />
      </section>
      <section>
        <label className="label">Competitor/reference URL</label>
        <input className="field" value={referenceUrl} onChange={e => setReferenceUrl(e.target.value)} placeholder="https://competitor.com/checkout" />
      </section>
      <section>
        <label className="label">Flow name</label>
        <input className="field" value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Checkout" />
      </section>
      <button type="submit" className="btn-primary">Run benchmark</button>
      
      {result && (
        <BenchmarkResults result={result} />
      )}
    </form>
  );
}
```

### 6.4 Missing: Release Readiness Gate Configuration
**Problem**: "Ready to release" / "Not ready yet" verdict uses fixed logic. Teams need customizable gates.

**Recommendation**: Add "Release Gates" in Settings:
```tsx
// Settings → Release Gates section
const defaultGates = [
  { id: 'blockers', name: 'No Blocker findings', required: true, configurable: false },
  { id: 'major', name: 'No Major findings', required: true, configurable: true },
  { id: 'accessibility', name: 'Accessible grade ≥ B', required: true, configurable: true },
  { id: 'performance', name: 'Fast and mobile grade ≥ C', required: false, configurable: true },
  { id: 'visual', name: 'Looks and reads well grade ≥ C', required: false, configurable: true },
  { id: 'coverage', name: 'Test coverage ≥ 80%', required: true, configurable: true },
];

// In Report verdict calculation:
const verdict = gates.every(g => g.required ? passes(g) : true) 
  ? 'Ready to release' 
  : 'Not ready yet';
```

### 6.5 Missing: Scheduled/Recurring Check-ups
**Problem**: No way to schedule automatic check-ups (e.g., nightly, on deploy).

**Recommendation**: Add "Schedule" tab in Past Check-ups:
```tsx
// ScheduleScreen.tsx
function ScheduleScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  
  return (
    <div className="space-y-4">
      <h2>Scheduled check-ups</h2>
      <form onSubmit={createSchedule} className="grid gap-4 sm:grid-cols-4">
        <input name="site" placeholder="Site (from past check-ups)" className="field" list="sites" />
        <datalist id="sites">{recent.map(r => <option key={r.runId} value={r.targetUrl} />)}</datalist>
        <select name="cron" className="field">
          <option value="0 2 * * *">Daily at 2 AM</option>
          <option value="0 2 * * 1">Weekly Monday 2 AM</option>
          <option value="0 2 1 * *">Monthly 1st at 2 AM</option>
          <option value="custom">Custom cron</option>
        </select>
        <select name="preset" className="field">
          <option value="full">Full check-up</option>
          <option value="quick">Quick check (desktop only)</option>
        </select>
        <button type="submit" className="btn-primary">Schedule</button>
      </form>
      
      <ul className="divide-y divide-rule">
        {schedules.map(s => (
          <li key={s.id} className="py-3 flex items-center justify-between">
            <div>
              <p className="font-bold">{s.site}</p>
              <p className="text-sm text-ink-soft">{s.cron} · {s.preset} · Next: {formatWhen(s.nextRun)}</p>
            </div>
            <button className="btn-quiet" onClick={() => deleteSchedule(s.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```
Backend: Use `node-cron` in runner or separate scheduler service.

---

## 7. User Journey Mapping Improvements

### 7.1 Onboarding Flow for First-Time Users
**Problem**: New users land on empty NewCheckupScreen with no guidance.

**Recommendation**: Add a 3-step onboarding overlay (stored in localStorage):
```tsx
// In App.tsx, show on first visit to '/'
const [onboardingStep, setOnboardingStep] = useState<number | null>(() => {
  if (typeof window !== 'undefined' && !localStorage.getItem('qa-onboarded')) return 1;
  return null;
});

{onboardingStep && (
  <OnboardingOverlay step={onboardingStep} onNext={n => setOnboardingStep(n > 3 ? null : n)} onSkip={() => {
    localStorage.setItem('qa-onboarded', '1');
    setOnboardingStep(null);
  }}>
    {1: (
      <>Welcome to Release check-up. Enter a site address, click "Scan the site", review the plan, and approve it to test.</>
    )}
    {2: (
      <>The plan shows every page, link, and journey that will be tested. Switch off what you don't need. Click "Approve" to start.</>
    )}
    {3: (
      <>The report grades 6 areas A–F. "Ready to release" means no Blockers. Problems show "Why it matters" and "How to fix" — share with your team.</>
    )}
  </OnboardingOverlay>
)}
```

### 7.2 Contextual Help System
**Problem**: No in-app help; users must read README or docs.

**Recommendation**: Add `?` help buttons on complex screens linking to contextual docs:
```tsx
// In PlanReviewScreen header:
<Link to="https://docs.qa-tool.dev/plan-review" target="_blank" rel="noopener" className="btn-link min-h-[44px] px-3" aria-label="Plan review help">
  <HelpIcon className="h-5 w-5" />
  <span className="hidden sm:inline">Help</span>
</Link>

// HelpIcon component:
function HelpIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
```

### 7.3 Empty States with Actionable Guidance
**Problem**: Empty states (no past check-ups, no problems found, no sites in Settings) are minimal.

**Recommendation**: Rich empty states with primary action:
```tsx
// PastCheckupsScreen empty state:
<EmptyState
  icon={<ClipboardIcon />}
  title="No check-ups yet"
  description="Run your first check-up to see reports here. Enter a site address on the New check-up screen."
  action={<Link to={PATHS.new} className="btn-primary">Start a check-up</Link>}
/>

// Report "No problems found":
<EmptyState
  icon={<CheckCircleIcon className="text-pass" />}
  title="No problems found"
  description="Everything tested clean. This check-up is ready to release."
  action={<button className="btn-primary" onClick={onTestAgain}>Test again</button>}
/>

// Settings Sites empty:
<EmptyState
  icon={<GlobeIcon />}
  title="No sites remembered yet"
  description="Sites you check will appear here. You can configure per-site defaults for search checks and saved sign-ins."
  action={<Link to={PATHS.new} className="btn-primary">Run a check-up</Link>}
/>
```

---

## 8. Accessibility Enhancements

### 8.1 Live Region for Scan/Testing Progress
**Problem**: Screen readers don't announce live progress updates.

**Recommendation**: Add `aria-live` regions:
```tsx
// In ScanningScreen:
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {progress?.stage === 'crawling' && `Exploring page ${progress.urlPath}`}
  {progress?.stage === 'planning' && progress.asking && `Asking AI about ${progress.what}`}
  {progress?.stage === 'planning' && !progress.asking && `Planned ${progress.done} of ${progress.total}`}
</div>

// In TestingScreen:
<div aria-live="assertive" aria-atomic="true" className="sr-only">
  {feed.current}
  {feed.test && `Test ${feed.test.index + 1} of ${feed.test.total}: ${feed.test.name}`}
</div>
```

### 8.2 Skip Links for Main Content Areas
**Problem**: Only one skip link ("Skip to content"). Plan review, report problems, and testing panel need their own.

**Recommendation**: Add contextual skip links:
```tsx
// In PlanReviewScreen:
<a href="#plan-pages" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:inline-flex focus:min-h-[44px] focus:items-center rounded bg-stamp px-4 py-2 font-bold text-surface">
  Skip to pages list
</a>
<a href="#plan-questions" className="...">Skip to questions</a>

// In ReportScreen:
<a href="#problems-title" className="...">Skip to problems</a>
<a href="#map-title" className="...">Skip to map</a>
```

### 8.3 High Contrast Mode Support
**Problem**: Only dark theme exists; no high contrast variant for low vision.

**Recommendation**: Add `prefers-contrast: more` media query in `tailwind.config.js`:
```css
@media (prefers-contrast: more) {
  :root {
    --c-edge: #FFFFFF;    /* Pure white borders */
    --c-rule: #FFFFFF;
    --c-stamp: #FFFFFF;   /* Pure white accent */
    --c-pass: #00FF00;    /* Pure green */
    --c-fail: #FF0000;    /* Pure red */
    --c-warn: #FFFF00;    /* Pure yellow */
  }
  .btn-primary { @apply border-2 border-current; }
  .field { @apply border-2 border-current; }
}
```

---

## 9. Logic Flow & Data Integrity

### 9.1 Idempotent Plan Approval
**Problem**: Rapid double-click on "Approve" could trigger two test runs.

**Recommendation**: Add client-side guard + server-side idempotency key:
```tsx
// In PlanReviewScreen:
const approve = async () => {
  if (approving) return; // Client guard
  setApproving(true);
  try {
    await approvePlan({ idempotencyKey: `approve-${plan.runId}-${Date.now()}` });
  } finally {
    setApproving(false);
  }
};

// Server (server.ts):
app.post('/api/runner/approve', async (req, res) => {
  const key = req.headers['idempotency-key'];
  if (await redis.exists(key)) return res.status(409).json({ error: 'Already approved' });
  await redis.setex(key, 3600, '1');
  // ... proceed with approval
});
```

### 9.2 Optimistic UI with Rollback for Plan Edits
**Problem**: Toggling items shows immediate feedback but no rollback on failure.

**Recommendation**: Implement proper optimistic update pattern:
```tsx
// In PlanReviewScreen.tsx
const switchItems = (ids: string[], skipped: boolean) => {
  // 1. Optimistic update
  setSwitched(s => ({ ...s, ...Object.fromEntries(ids.map(id => [id, skipped])) }));
  
  // 2. Server request with rollback on failure
  edit(() => patchPlan({ items: ids.map(id => ({ id, skipped })) }))
    .catch(err => {
      // Rollback
      setSwitched(s => {
        const next = { ...s };
        ids.forEach(id => delete next[id]);
        return next;
      });
      setError('Failed to save. Your changes were reverted.');
    });
};
```

### 9.3 Consistent URL Path Normalization
**Problem**: L3 in PRODUCT_REVIEW shows `/dashboard` and `http://localhost:3050/dashboard` counted as separate pages.

**Recommendation**: Centralize normalization in one place (`packages/types/src/url.ts`):
```typescript
// Single source of truth
export function normalizeUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    // Handle relative paths
    return url.startsWith('/') ? url : `/${url}`;
  }
}

// Use everywhere: findings, plan pages, navigation checks, site map
```

### 9.4 Deduplication Key for Findings
**Problem**: L4 shows same issue (missing title) reported by two checkers as separate findings.

**Recommendation**: Enforce `issueKey` generation at finding creation:
```typescript
// In checkers or orchestrator when creating Finding:
function generateIssueKey(finding: Omit<Finding, 'issueKey'>): string {
  const parts = [
    finding.checker,
    finding.where.urlPath,
    finding.categoryTag || '',
    // Normalize selector to stable form
    finding.where.cssSelector?.replace(/:[^:]+$/, '') || '',
    finding.where.dataTestId || '',
  ];
  return parts.filter(Boolean).join('|').toLowerCase();
}

// In summary.ts groupProblems():
// Group by issueKey first, then by title similarity
```

---

## 10. Developer Experience (For QA Tool Contributors)

### 10.1 Component Storybook
**Problem**: No component documentation or visual testing.

**Recommendation**: Add Storybook:
```bash
pnpm dlx storybook@latest init --builder vite
```
Stories for: `Button`, `Field`, `Card`, `Badge`, `SiteMap`, `PlanDocument`, `ProblemItem`, `StepBar`, `TopBar`.

### 10.2 Visual Regression Testing for UI
**Problem**: CSS changes can break layout silently.

**Recommendation**: Add Playwright visual tests for key screens:
```typescript
// tests/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

const screens = ['new', 'scan', 'plan', 'testing', 'report', 'settings', 'past'];

for (const screen of screens) {
  test(`${screen} screen matches baseline`, async ({ page }) => {
    await page.goto(`http://localhost:3001/${screen}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`${screen}-desktop.png`);
    
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot(`${screen}-mobile.png`);
  });
}
```

### 10.3 Type-Safe API Client
**Problem**: `api.ts` uses `fetch` with manual typing; no compile-time safety.

**Recommendation**: Use `@tanstack/react-query` + `openapi-fetch` or `tRPC`:
```typescript
// Generate from OpenAPI spec (if added to runner)
// Or use zod schemas shared with runner:
import { z } from 'zod';

export const PlanSchema = z.object({
  runId: z.string(),
  targetUrl: z.string().url(),
  pages: z.array(PageInventoryItemSchema),
  // ...
});

export type ReviewPlan = z.infer<typeof PlanSchema>;

// In api.ts:
export async function getPlan(): Promise<ReviewPlan> {
  const res = await fetch('/api/runner/plan');
  return PlanSchema.parse(await res.json());
}
```

---

## 11. Data & Analytics Opportunities

### 11.1 Usage Telemetry (Privacy-Respecting)
**Problem**: No insight into which features are used, where users struggle.

**Recommendation**: Add optional anonymous telemetry (opt-in):
```typescript
// In App.tsx
const [telemetryEnabled, setTelemetryEnabled] = useState(() => 
  localStorage.getItem('qa-telemetry') === 'true'
);

function track(event: string, props: Record<string, unknown>) {
  if (!telemetryEnabled) return;
  navigator.sendBeacon('/api/telemetry', JSON.stringify({
    event,
    props,
    timestamp: Date.now(),
    version: import.meta.env.VITE_APP_VERSION,
  }));
}

// Usage:
track('checkup_started', { hasAI: !!ai, pageLimit: form.maxPages, roles: form.signIns.length });
track('plan_approved', { tests: plan.summary?.tests, minutes: plan.summary?.minutes });
track('report_viewed', { stamp: report.ready ? 'ready' : 'not-ready', problemCount: report.findings.length });
track('finding_triaged', { status: 'intended' | 'false-positive', aspect: finding.aspect });
```

### 11.2 AI Model Performance Dashboard
**Problem**: Settings shows "Test this model" but no historical success rate.

**Recommendation**: Track and display model performance:
```tsx
// In ModelChoice component:
const [modelStats, setModelStats] = useState<Record<string, { success: number; total: number; avgMs: number }>>({});

// Show in model dropdown:
<option key={m.id} value={m.id}>
  {describe(m)}
  {modelStats[m.id] && (
    <>
      {' '}
      <span className="text-ink-soft">
        ({Math.round(modelStats[m.id].success / modelStats[m.id].total * 100)}% success, {(modelStats[m.id].avgMs / 1000).toFixed(1)}s avg)
      </span>
    </>
  )}
</option>
```

---

## 12. Quick Wins (Low Effort, High Impact)

| # | Improvement | Effort | Location |
|---|-------------|--------|----------|
| 1 | Add `title` tooltips to all icon-only buttons | 30 min | All screens |
| 2 | Show "Copy run ID" button in Report developer details | 15 min | `ReportScreen.tsx` |
| 3 | Add "Copy as Markdown" for individual problems | 1 hr | `ProblemItem.tsx` |
| 4 | Persist Plan Review tab selection (plan/map) in sessionStorage | 30 min | `PlanReviewScreen.tsx` |
| 5 | Add "Expand all" / "Collapse all" for plan sections | 1 hr | `PlanDocument.tsx` |
| 6 | Show estimated time remaining in TestingScreen header | 30 min | `TestingScreen.tsx` |
| 7 | Add "Open in new tab" for external links in report | 15 min | `ReportScreen.tsx` |
| 8 | Keyboard shortcut `?` for help overlay | 1 hr | `App.tsx` |
| 9 | Auto-focus first input on NewCheckupScreen mount | 15 min | `NewCheckupScreen.tsx` |
| 10 | Add "Copy bug report" button to each problem (already exists in PRODUCT_REVIEW but verify) | 30 min | `ProblemItem.tsx` |

---

## Priority Matrix

| Priority | Items |
|----------|-------|
| **P0 (Do Now)** | 2.1 Keyboard navigation, 9.1 Idempotent approval, 9.3 URL normalization, 8.1 Live regions |
| **P1 (Next Sprint)** | 1.1 Elevation system, 3.1 Virtualized plan, 4.1 Drag-to-reorder, 6.1 Test copy verification, 7.1 Onboarding |
| **P2 (Next Quarter)** | 5.1 Pagination, 6.2 Visual baseline UI, 6.3 Benchmark UI, 6.4 Release gates, 10.1 Storybook |
| **P3 (Future)** | 6.5 Scheduled check-ups, 11.1 Telemetry, 10.3 Type-safe API |

---

These recommendations are grounded in the actual codebase structure, existing patterns, and the domain model defined in CONTEXT.md. They prioritize changes that improve reliability, accessibility, and user efficiency while leveraging the existing well-architected foundation.