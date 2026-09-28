import type { ConsolidatedReleaseReport, CanonicalFinding, CompetitiveBenchmark } from '@qa/types';
import { DASHBOARD_STYLES } from './styles.js';

const FAVICON_LINK =
  `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%94%8D%3C/text%3E%3C/svg%3E">`;


export function renderHubDashboardHtml(report?: ConsolidatedReleaseReport | null): string {
  const summary = report?.summary || {
    totalFindings: 0,
    open: 0,
    verifiedFixed: 0,
    regressed: 0,
    acceptedRisk: 0,
    flakyFlowsCount: 0,
  };

  const findings: CanonicalFinding[] = report?.canonicalFindings || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Report Hub — Multi-Release Consolidation</title>
  ${FAVICON_LINK}
  <style>${DASHBOARD_STYLES}</style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="p-2 bg-indigo-600 rounded-lg text-white font-bold text-lg">HUB</span>
        <div>
          <h1 class="text-xl font-bold tracking-tight">QA Report Hub</h1>
          <p class="text-xs text-slate-400">Multi-Developer Pre-Release Consolidation</p>
        </div>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <div class="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded px-3 py-1.5">
          <span class="text-slate-400">Product:</span>
          <span class="font-semibold text-indigo-400" id="current-product">${report?.productId || 'all-products'}</span>
        </div>
        <div class="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded px-3 py-1.5">
          <span class="text-slate-400">Release:</span>
          <span class="font-semibold text-emerald-400" id="current-release">${report?.releaseTarget || 'latest'}</span>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8 space-y-8">
    <!-- Metric Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <div class="text-xs uppercase font-medium text-slate-400">Total Canonical</div>
        <div class="text-3xl font-extrabold text-white mt-1">${summary.totalFindings}</div>
      </div>
      <div class="bg-rose-950/30 border border-rose-900/40 rounded-xl p-5">
        <div class="text-xs uppercase font-medium text-rose-400">Open Blockers</div>
        <div class="text-3xl font-extrabold text-rose-400 mt-1">${summary.open}</div>
      </div>
      <div class="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-5">
        <div class="text-xs uppercase font-medium text-emerald-400">Verified Fixed</div>
        <div class="text-3xl font-extrabold text-emerald-400 mt-1">${summary.verifiedFixed}</div>
      </div>
      <div class="bg-amber-950/30 border border-amber-900/40 rounded-xl p-5">
        <div class="text-xs uppercase font-medium text-amber-400">Regressed</div>
        <div class="text-3xl font-extrabold text-amber-400 mt-1">${summary.regressed}</div>
      </div>
      <div class="bg-blue-950/30 border border-blue-900/40 rounded-xl p-5">
        <div class="text-xs uppercase font-medium text-blue-400">Accepted Risk</div>
        <div class="text-3xl font-extrabold text-blue-400 mt-1">${summary.acceptedRisk}</div>
      </div>
    </div>

    <!-- Findings Section -->
    <div class="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Deduplicated Findings</h2>
          <p class="text-xs text-slate-400">Consolidated across runs via deterministic structural fingerprints</p>
        </div>
        <div class="flex gap-2">
          <button onclick="filterStatus('ALL')" class="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600">All</button>
          <button onclick="filterStatus('OPEN')" class="text-xs px-3 py-1.5 rounded bg-rose-900/50 hover:bg-rose-800 text-rose-300">Open</button>
          <button onclick="filterStatus('VERIFIED_FIXED')" class="text-xs px-3 py-1.5 rounded bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300">Fixed</button>
        </div>
      </div>

      <div class="divide-y divide-slate-800" id="findings-container">
        ${
          findings.length === 0
            ? `<div class="p-12 text-center text-slate-500">No findings ingested yet for this release. Runs uploaded will appear here.</div>`
            : findings
                .map(
                  (f) => `
          <div class="p-6 hover:bg-slate-800/30 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 finding-row" data-status="${f.status}">
            <div class="space-y-1.5">
              <div class="flex items-center gap-3">
                <span class="px-2 py-0.5 rounded text-xs font-semibold ${
                  f.status === 'OPEN'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : f.status === 'VERIFIED_FIXED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : f.status === 'REGRESSED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }">${f.status}</span>
                <span class="text-xs font-mono text-slate-400">${f.fingerprint}</span>
                <span class="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">${f.checker}</span>
                <span class="text-xs text-indigo-400 font-medium">${f.occurrenceCount} occurrences</span>
              </div>
              <h3 class="text-base font-medium text-slate-100">${f.title}</h3>
              <div class="text-xs text-slate-400 flex items-center gap-4">
                <span>Route: <code class="text-slate-300 font-mono">${f.route}</code></span>
                ${f.selector ? `<span>Selector: <code class="text-slate-300 font-mono">${f.selector}</code></span>` : ''}
                <span>Last Seen: ${new Date(f.lastSeenAt).toLocaleTimeString()}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button onclick="triageFinding('${f.id}', 'ACCEPTED_RISK')" class="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300">Accept Risk</button>
              <button onclick="triageFinding('${f.id}', 'OPEN')" class="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300">Reopen</button>
            </div>
          </div>
        `
                )
                .join('')
        }
      </div>
    </div>
  </main>

  <script>
    function filterStatus(status) {
      const rows = document.querySelectorAll('.finding-row');
      rows.forEach(r => {
        if (status === 'ALL' || r.getAttribute('data-status') === status) {
          r.style.display = 'flex';
        } else {
          r.style.display = 'none';
        }
      });
    }

    async function triageFinding(id, status) {
      const res = await fetch('/api/v1/findings/' + id + '/triage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to update status');
      }
    }
  </script>
</body>
</html>`;
}

export function renderBenchmarkHtml(benchmark?: CompetitiveBenchmark | null): string {
  if (!benchmark) {
    return `<!DOCTYPE html>
<html>
<head><title>Benchmark Not Found</title>${FAVICON_LINK}<style>${DASHBOARD_STYLES}</style></head>
<body class="bg-slate-900 text-slate-100 flex items-center justify-center min-h-screen">
  <div class="text-center">
    <h1 class="text-2xl font-bold mb-2">Benchmark Not Found</h1>
    <p class="text-slate-400">Run <code>qa-test compare --target &lt;url&gt; --reference &lt;url&gt; --hub &lt;hub-url&gt;</code> to upload benchmarks.</p>
  </div>
</body>
</html>`;
  }

  const our = benchmark.ourProduct;
  const ref = benchmark.referenceProduct;
  const delta = benchmark.delta;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Competitive Flow Benchmark — ${benchmark.flowId}</title>
  ${FAVICON_LINK}
  <style>${DASHBOARD_STYLES}</style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="p-2 bg-indigo-600 rounded-lg text-white font-bold text-lg">COMPARE</span>
        <div>
          <h1 class="text-xl font-bold tracking-tight">Competitive Flow Benchmark</h1>
          <p class="text-xs text-slate-400">Flow: ${benchmark.flowId} | ${new Date(benchmark.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
      <a href="/hub" class="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">← Back to Releases</a>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8 space-y-8">
    <!-- Comparison Scorecard Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Our Product -->
      <div class="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-indigo-400">Our Internal Product</span>
          <span class="text-xs bg-indigo-900/40 border border-indigo-700/50 text-indigo-300 px-2.5 py-0.5 rounded-full font-mono">${our.scorecard.frictionIndex} Friction</span>
        </div>
        <h2 class="text-xl font-bold text-white">${our.name}</h2>
        <div class="text-xs text-slate-400 font-mono">${our.url}</div>

        <div class="grid grid-cols-3 gap-3 pt-2">
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
            <div class="text-xs text-slate-400">Steps</div>
            <div class="text-2xl font-bold text-white mt-1">${our.scorecard.totalSteps}</div>
          </div>
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
            <div class="text-xs text-slate-400">Required Inputs</div>
            <div class="text-2xl font-bold text-white mt-1">${our.scorecard.requiredFieldsCount}</div>
          </div>
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
            <div class="text-xs text-slate-400">WCAG Score</div>
            <div class="text-2xl font-bold text-emerald-400 mt-1">${our.a11yScore}</div>
          </div>
        </div>
      </div>

      <!-- Competitor Reference -->
      <div class="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">External Market Reference</span>
          <span class="text-xs bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 px-2.5 py-0.5 rounded-full font-mono">${ref.scorecard.frictionIndex} Friction</span>
        </div>
        <h2 class="text-xl font-bold text-white">${ref.name}</h2>
        <div class="text-xs text-slate-400 font-mono">${ref.url}</div>

        <div class="grid grid-cols-3 gap-3 pt-2">
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
            <div class="text-xs text-slate-400">Steps</div>
            <div class="text-2xl font-bold text-white mt-1">${ref.scorecard.totalSteps}</div>
          </div>
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
            <div class="text-xs text-slate-400">Required Inputs</div>
            <div class="text-2xl font-bold text-white mt-1">${ref.scorecard.requiredFieldsCount}</div>
          </div>
          <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
            <div class="text-xs text-slate-400">WCAG Score</div>
            <div class="text-2xl font-bold text-emerald-400 mt-1">${ref.a11yScore}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pattern Parity Section -->
    <div class="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 space-y-4">
      <h3 class="text-base font-bold text-white">Interactive Pattern Parity</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        ${benchmark.patterns
          .map(
            (p) => `
          <div class="bg-slate-900/60 border border-slate-800 p-4 rounded-lg space-y-2">
            <div class="text-sm font-semibold text-slate-200">${p.pattern}</div>
            <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
              <span class="text-slate-400">Our App:</span>
              <span class="font-bold ${p.ourProduct ? 'text-emerald-400' : 'text-rose-400'}">${p.ourProduct ? 'YES' : 'NO'}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Competitor:</span>
              <span class="font-bold ${p.referenceProduct ? 'text-emerald-400' : 'text-rose-400'}">${p.referenceProduct ? 'YES' : 'NO'}</span>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- AI UX Recommendations -->
    <div class="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white">Prioritized UX Gap Analysis</h3>
          <p class="text-xs text-slate-400">AI-synthesized design improvements ranked by effort vs impact</p>
        </div>
        <span class="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-700/60 px-2.5 py-1 rounded-full">${benchmark.recommendations.length} Recommendations</span>
      </div>

      <div class="p-6 space-y-4">
        ${benchmark.recommendations
          .map(
            (r, i) => `
          <div class="bg-slate-900/70 border border-slate-800 rounded-lg p-5 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 rounded font-semibold ${
                  r.category === 'Quick Win'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : r.category === 'Strategic Investment'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }">${r.category}</span>
                <h4 class="text-base font-semibold text-slate-100">${i + 1}. ${r.title}</h4>
              </div>
              <div class="text-xs font-mono text-slate-400">
                <span class="text-emerald-400 font-semibold">${r.impact} Impact</span> | <span>${r.effort} Effort</span>
              </div>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${r.rationale}</p>
            <div class="text-xs bg-slate-950/60 border border-slate-800/80 p-2.5 rounded font-mono text-slate-300 mt-2">
              <span class="text-indigo-400 font-semibold">Action:</span> ${r.suggestedAction}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  </main>
</body>
</html>`;
}

