export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Pre-Release Readiness Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    code, pre { font-family: 'JetBrains Mono', monospace; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
  <div id="app" class="flex flex-col min-h-screen">
    <!-- Navigation / Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-100">
            QA
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-lg font-bold text-slate-900" id="product-name">Loading QA Run...</h1>
              <span id="release-badge" class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">Checking...</span>
            </div>
            <p class="text-xs text-slate-500 font-mono" id="target-url">Target: --</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="text-right hidden sm:block">
            <p class="text-xs text-slate-500" id="run-time">Duration: --</p>
            <p class="text-xs text-slate-400 font-mono" id="run-timestamp">Timestamp: --</p>
          </div>
          <button onclick="fetchReport()" class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm flex items-center space-x-1.5">
            <span>🔄</span> <span>Refresh</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
      
      <!-- Metrics Overview Cards -->
      <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5" id="stats-cards">
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-medium text-slate-500">Test Points</p>
          <p class="text-2xl font-bold text-slate-900 mt-1" id="stat-total">0</p>
          <p class="text-xs text-emerald-600 mt-0.5" id="stat-completion">100% completed</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-medium text-slate-500">Passed</p>
          <p class="text-2xl font-bold text-emerald-600 mt-1" id="stat-passed">0</p>
          <p class="text-xs text-slate-400 mt-0.5">clean flows</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-red-200 bg-red-50/30 shadow-sm">
          <p class="text-xs font-medium text-red-600">Blockers</p>
          <p class="text-2xl font-bold text-red-600 mt-1" id="stat-blockers">0</p>
          <p class="text-xs text-red-500 mt-0.5">release blocking</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <p class="text-xs font-medium text-amber-600">Major Defects</p>
          <p class="text-2xl font-bold text-amber-600 mt-1" id="stat-majors">0</p>
          <p class="text-xs text-amber-500 mt-0.5">high priority</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-medium text-slate-500">Minor / UX</p>
          <p class="text-2xl font-bold text-slate-700 mt-1" id="stat-minors">0</p>
          <p class="text-xs text-slate-400 mt-0.5">polish & styling</p>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p class="text-xs font-medium text-slate-500">Total Findings</p>
          <p class="text-2xl font-bold text-indigo-600 mt-1" id="stat-findings">0</p>
          <p class="text-xs text-slate-400 mt-0.5">across checkers</p>
        </div>
      </section>

      <!-- Navigation Tabs: Findings vs Flow Steps -->
      <div class="flex items-center justify-between border-b border-slate-200">
        <div class="flex space-x-6">
          <button id="tab-findings-btn" onclick="switchTab('findings')" class="pb-3 border-b-2 border-indigo-600 text-indigo-600 font-semibold text-sm flex items-center space-x-2">
            <span>🐞 Findings & Defects</span>
            <span id="tab-findings-badge" class="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 font-medium">0</span>
          </button>
          <button id="tab-flows-btn" onclick="switchTab('flows')" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center space-x-2">
            <span>🗺️ Flow & Step Explorer</span>
            <span id="tab-flows-badge" class="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">0</span>
          </button>
        </div>
      </div>

      <!-- TAB 1: FINDINGS VIEW -->
      <section id="view-findings" class="space-y-4">
        <!-- Filter and Search Bar -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <!-- Severity Filter -->
            <select id="filter-severity" onchange="renderFindings()" class="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="ALL">All Severities</option>
              <option value="Blocker">Blockers Only</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
              <option value="Suggestion">Suggestions</option>
            </select>

            <!-- Checker Filter -->
            <select id="filter-checker" onchange="renderFindings()" class="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="ALL">All Checkers</option>
              <option value="bug-detection">Bug Detection</option>
              <option value="spec-conformance">Spec Conformance</option>
              <option value="ux-quality">UX Quality (WCAG)</option>
              <option value="permission-matrix">Permission Matrix</option>
              <option value="design-standards">Design Standards</option>
            </select>

            <!-- Triage Status Filter -->
            <select id="filter-triage" onchange="renderFindings()" class="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="ALL">All Triage States</option>
              <option value="Pending">Pending Review</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Intended">Intended Behavior</option>
              <option value="False Positive">False Positive</option>
            </select>
          </div>

          <!-- Search Input -->
          <div class="relative w-full sm:w-72">
            <input type="text" id="search-input" oninput="renderFindings()" placeholder="Search findings, routes, IDs..." class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <span class="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        <!-- Findings List Table/Cards -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="findings-container">
          <div class="p-8 text-center text-slate-500 text-sm">Loading findings...</div>
        </div>
      </section>

      <!-- TAB 2: FLOWS EXPLORER VIEW -->
      <section id="view-flows" class="space-y-4 hidden">
        <div id="flows-container" class="space-y-4">
          <div class="p-8 text-center text-slate-500 text-sm">Loading flows...</div>
        </div>
      </section>

    </main>

    <!-- Finding Detail Modal -->
    <div id="modal-backdrop" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 hidden flex items-center justify-center p-4">
      <div id="modal-content" class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div class="flex items-center space-x-3">
            <span id="modal-severity-badge" class="px-2.5 py-0.5 text-xs font-bold rounded-full">BLOCKER</span>
            <span id="modal-finding-id" class="text-xs font-mono font-semibold text-slate-500">F-001</span>
          </div>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none p-1">✕</button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <div>
            <h2 id="modal-title" class="text-lg font-bold text-slate-900 leading-snug">Finding Title</h2>
            <div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
              <span class="bg-slate-100 px-2.5 py-1 rounded-md font-mono" id="modal-url">Path: /invoices</span>
              <span class="bg-slate-100 px-2.5 py-1 rounded-md" id="modal-role">Role: manager</span>
              <span class="bg-slate-100 px-2.5 py-1 rounded-md" id="modal-breakpoint">Breakpoint: 1440px</span>
              <span class="bg-slate-100 px-2.5 py-1 rounded-md" id="modal-checker">Checker: bug-detection</span>
            </div>
          </div>

          <!-- Source Location Link -->
          <div id="modal-source-container" class="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl flex items-center justify-between hidden">
            <div class="flex items-center space-x-2 text-xs text-indigo-900">
              <span>📍 Source Location:</span>
              <code id="modal-source-text" class="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">Button.tsx:42</code>
            </div>
            <span class="text-xs text-indigo-600">via data-testid</span>
          </div>

          <!-- Expected vs Actual -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-emerald-50/50 border border-emerald-200 p-3.5 rounded-xl">
              <p class="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">Expected Outcome</p>
              <p class="text-xs text-emerald-950 font-mono leading-relaxed" id="modal-expected">Expected text here</p>
            </div>
            <div class="bg-red-50/50 border border-red-200 p-3.5 rounded-xl">
              <p class="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">Actual Result</p>
              <p class="text-xs text-red-950 font-mono leading-relaxed" id="modal-actual">Actual text here</p>
            </div>
          </div>

          <!-- Resolution Guidance -->
          <div class="bg-amber-50/50 border border-amber-200 p-3.5 rounded-xl">
            <p class="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Recommended Resolution</p>
            <p class="text-xs text-amber-950 leading-relaxed" id="modal-resolution">Check routing handler.</p>
          </div>

          <!-- Verify Command -->
          <div class="space-y-1.5">
            <p class="text-xs font-semibold text-slate-700">Single Finding Verification Command:</p>
            <div class="flex items-center justify-between bg-slate-900 text-slate-100 p-2.5 rounded-xl text-xs font-mono">
              <code id="modal-verify-cmd">qa-test verify F-001</code>
              <button onclick="copyVerifyCmd()" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs transition">Copy</button>
            </div>
          </div>

          <!-- Evidence Tabs -->
          <div class="space-y-3">
            <div class="flex space-x-2 border-b border-slate-200">
              <button onclick="switchEvidenceTab('screenshot')" id="btn-ev-screenshot" class="pb-2 text-xs font-semibold text-indigo-600 border-b-2 border-indigo-600">Screenshot</button>
              <button onclick="switchEvidenceTab('repro')" id="btn-ev-repro" class="pb-2 text-xs font-medium text-slate-500 hover:text-slate-700">Playwright Repro Script</button>
              <button onclick="switchEvidenceTab('console')" id="btn-ev-console" class="pb-2 text-xs font-medium text-slate-500 hover:text-slate-700">Console Logs</button>
              <button onclick="switchEvidenceTab('network')" id="btn-ev-network" class="pb-2 text-xs font-medium text-slate-500 hover:text-slate-700">Network Failures</button>
            </div>

            <!-- Evidence Content Panels -->
            <div id="panel-ev-screenshot" class="bg-slate-100 rounded-xl p-3 flex justify-center border border-slate-200 overflow-hidden min-h-[250px]">
              <img id="modal-img-screenshot" src="" alt="Screenshot Evidence" class="max-h-[400px] object-contain rounded-lg shadow-sm">
            </div>

            <div id="panel-ev-repro" class="hidden">
              <pre class="bg-slate-900 text-slate-200 text-xs p-4 rounded-xl overflow-x-auto max-h-[300px] custom-scrollbar"><code id="modal-code-repro">// Reproduction script loading...</code></pre>
            </div>

            <div id="panel-ev-console" class="hidden">
              <div id="modal-console-list" class="space-y-2 text-xs font-mono">
                <p class="text-slate-400">No console errors logged.</p>
              </div>
            </div>

            <div id="panel-ev-network" class="hidden">
              <div id="modal-network-list" class="space-y-2 text-xs font-mono">
                <p class="text-slate-400">No network errors logged.</p>
              </div>
            </div>
          </div>

        </div>

        <!-- Modal Footer (Triage Controls) -->
        <div class="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-medium text-slate-600">Triage Status:</span>
            <span id="modal-triage-label" class="px-2 py-0.5 text-xs font-semibold rounded bg-slate-200 text-slate-700">Pending</span>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="setTriage('Confirmed')" class="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition">
              ✔ Confirm Bug
            </button>
            <button onclick="setTriage('Intended')" class="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition">
              Mark Intended
            </button>
            <button onclick="setTriage('False Positive')" class="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition">
              Mark False Positive
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Client-side script -->
  <script>
    let reportData = null;
    let selectedFinding = null;

    async function fetchReport() {
      try {
        const res = await fetch('/api/report');
        if (!res.ok) throw new Error('Report not found');
        reportData = await res.json();
        updateHeaderAndStats();
        renderFindings();
        renderFlows();
      } catch (err) {
        console.error(err);
        document.getElementById('findings-container').innerHTML = \`
          <div class="p-8 text-center text-red-600 text-sm">
            <p class="font-bold">Failed to load QA report</p>
            <p class="text-xs text-slate-500 mt-1">\${err.message}</p>
          </div>
        \`;
      }
    }

    function updateHeaderAndStats() {
      if (!reportData) return;
      document.getElementById('product-name').textContent = reportData.productId || 'Unknown Product';
      document.getElementById('target-url').textContent = 'Target: ' + (reportData.targetUrl || '--');
      document.getElementById('run-time').textContent = 'Duration: ' + ((reportData.durationMs || 0) / 1000).toFixed(1) + 's';
      document.getElementById('run-timestamp').textContent = 'Date: ' + new Date(reportData.timestamp).toLocaleString();

      const findings = reportData.findings || [];
      const blockers = findings.filter(f => f.severity === 'Blocker');
      const majors = findings.filter(f => f.severity === 'Major');
      const minors = findings.filter(f => f.severity === 'Minor' || f.severity === 'Suggestion');

      const badge = document.getElementById('release-badge');
      if (blockers.length > 0) {
        badge.textContent = '✖ RELEASE BLOCKED';
        badge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800';
      } else if (majors.length > 0) {
        badge.textContent = '⚠ MAJOR DEFECTS';
        badge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800';
      } else {
        badge.textContent = '✔ RELEASE READY';
        badge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800';
      }

      document.getElementById('stat-total').textContent = reportData.coverage?.totalTestPoints || 0;
      document.getElementById('stat-completion').textContent = (reportData.coverage?.completionRate || 100) + '% completed';
      document.getElementById('stat-passed').textContent = reportData.coverage?.passed || 0;
      document.getElementById('stat-blockers').textContent = blockers.length;
      document.getElementById('stat-majors').textContent = majors.length;
      document.getElementById('stat-minors').textContent = minors.length;
      document.getElementById('stat-findings').textContent = findings.length;

      document.getElementById('tab-findings-badge').textContent = findings.length;
      document.getElementById('tab-flows-badge').textContent = (reportData.results || []).length;
    }

    function renderFindings() {
      const container = document.getElementById('findings-container');
      if (!reportData || !reportData.findings) return;

      const severityFilter = document.getElementById('filter-severity').value;
      const checkerFilter = document.getElementById('filter-checker').value;
      const triageFilter = document.getElementById('filter-triage').value;
      const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();

      const filtered = reportData.findings.filter(f => {
        if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
        if (checkerFilter !== 'ALL' && f.checker !== checkerFilter) return false;
        if (triageFilter !== 'ALL' && (f.triageStatus || 'Pending') !== triageFilter) return false;
        if (searchQuery) {
          const text = (f.title + ' ' + f.id + ' ' + f.where.urlPath + ' ' + f.checker + ' ' + (f.where.dataTestId || '')).toLowerCase();
          if (!text.includes(searchQuery)) return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="p-12 text-center text-slate-500">
            <p class="text-3xl mb-2">🎉</p>
            <p class="font-semibold text-slate-800 text-sm">No findings match your filter</p>
            <p class="text-xs text-slate-400 mt-1">Try resetting severity or checker filters</p>
          </div>
        \`;
        return;
      }

      let html = \`
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th class="px-4 py-3">Severity</th>
                <th class="px-4 py-3">ID & Title</th>
                <th class="px-4 py-3">Checker</th>
                <th class="px-4 py-3">Location & Role</th>
                <th class="px-4 py-3">Triage</th>
                <th class="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
      \`;

      filtered.forEach((f, idx) => {
        let badgeBg = 'bg-slate-100 text-slate-700';
        if (f.severity === 'Blocker') badgeBg = 'bg-red-100 text-red-700 border border-red-200';
        if (f.severity === 'Major') badgeBg = 'bg-amber-100 text-amber-800 border border-amber-200';
        if (f.severity === 'Minor') badgeBg = 'bg-blue-100 text-blue-700 border border-blue-200';

        const triageStatus = f.triageStatus || 'Pending';
        let triageColor = 'text-slate-500 bg-slate-100';
        if (triageStatus === 'Confirmed') triageColor = 'text-red-700 bg-red-50 border border-red-200';
        if (triageStatus === 'Intended') triageColor = 'text-emerald-700 bg-emerald-50 border border-emerald-200';
        if (triageStatus === 'False Positive') triageColor = 'text-slate-600 bg-slate-200';

        html += \`
          <tr class="hover:bg-slate-50/80 transition cursor-pointer" onclick="openModal('\${f.id}')">
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="px-2 py-0.5 text-xs font-bold rounded \${badgeBg}">\${f.severity}</span>
            </td>
            <td class="px-4 py-3">
              <div class="font-mono text-xs font-bold text-slate-900">\${f.id}</div>
              <div class="text-xs text-slate-700 font-medium truncate max-w-md">\${f.title}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">\${f.checker}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-slate-600">
              <div class="font-mono font-medium text-slate-900">\${f.where.urlPath}</div>
              <div class="text-[11px] text-slate-400">role: \${f.where.role} | \${f.where.breakpoint}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="px-2 py-0.5 text-[11px] font-semibold rounded \${triageColor}">\${triageStatus}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-right">
              <button onclick="event.stopPropagation(); openModal('\${f.id}')" class="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">
                Inspect →
              </button>
            </td>
          </tr>
        \`;
      });

      html += \`</tbody></table></div>\`;
      container.innerHTML = html;
    }

    function renderFlows() {
      const container = document.getElementById('flows-container');
      if (!reportData || !reportData.results) return;

      if (reportData.results.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-500 text-sm">No flows recorded.</div>';
        return;
      }

      let html = '';
      reportData.results.forEach(res => {
        const isPassed = res.status === 'Passed';
        const statusBadge = isPassed 
          ? '<span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">✔ Passed</span>'
          : '<span class="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800">✖ Failed</span>';

        html += \`
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center space-x-2">
                  <span class="font-mono font-bold text-slate-900 text-sm">\${res.testCaseId}</span>
                  <span class="text-xs text-slate-500">(\${res.flowId})</span>
                  \${statusBadge}
                </div>
                <p class="text-xs text-slate-400 mt-0.5 font-mono">Role: \${res.role} | Execution Time: \${res.durationMs}ms</p>
              </div>
            </div>

            <!-- Steps timeline -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        \`;

        (res.stepEvidence || []).forEach(step => {
          const stepImg = step.screenshotPath ? '/api/evidence/' + step.screenshotPath.replace(/\\\\/g, '/') : null;
          html += \`
            <div class="border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-2">
              <div class="flex items-center justify-between text-[11px]">
                <span class="font-bold text-slate-800">Step \${step.stepIndex}: \${step.stepName}</span>
                <span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">\${step.action}</span>
              </div>
              \${stepImg ? \`
                <a href="\${stepImg}" target="_blank" class="block group relative overflow-hidden rounded border border-slate-200 bg-white">
                  <img src="\${stepImg}" class="w-full h-32 object-cover group-hover:scale-105 transition duration-200" alt="Step Screenshot">
                  <span class="absolute bottom-1 right-1 bg-slate-900/70 text-white text-[10px] px-1.5 py-0.5 rounded">View</span>
                </a>
              \` : '<div class="h-32 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-400">No Screenshot</div>'}
              <div class="text-[10px] text-slate-500 font-mono truncate">\${step.urlAfter}</div>
            </div>
          \`;
        });

        html += \`</div></div>\`;
      });

      container.innerHTML = html;
    }

    function switchTab(tab) {
      const findingsView = document.getElementById('view-findings');
      const flowsView = document.getElementById('view-flows');
      const findingsBtn = document.getElementById('tab-findings-btn');
      const flowsBtn = document.getElementById('tab-flows-btn');

      if (tab === 'findings') {
        findingsView.classList.remove('hidden');
        flowsView.classList.add('hidden');
        findingsBtn.className = 'pb-3 border-b-2 border-indigo-600 text-indigo-600 font-semibold text-sm flex items-center space-x-2';
        flowsBtn.className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center space-x-2';
      } else {
        findingsView.classList.add('hidden');
        flowsView.classList.remove('hidden');
        flowsBtn.className = 'pb-3 border-b-2 border-indigo-600 text-indigo-600 font-semibold text-sm flex items-center space-x-2';
        findingsBtn.className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center space-x-2';
      }
    }

    async function openModal(findingId) {
      if (!reportData) return;
      const finding = reportData.findings.find(f => f.id === findingId);
      if (!finding) return;
      selectedFinding = finding;

      document.getElementById('modal-finding-id').textContent = finding.id;
      document.getElementById('modal-title').textContent = finding.title;
      document.getElementById('modal-url').textContent = 'Path: ' + finding.where.urlPath;
      document.getElementById('modal-role').textContent = 'Role: ' + finding.where.role;
      document.getElementById('modal-breakpoint').textContent = 'Breakpoint: ' + finding.where.breakpoint;
      document.getElementById('modal-checker').textContent = 'Checker: ' + finding.checker;
      document.getElementById('modal-expected').textContent = finding.expectedVsActual.expected;
      document.getElementById('modal-actual').textContent = finding.expectedVsActual.actual;
      document.getElementById('modal-resolution').textContent = finding.resolution;
      document.getElementById('modal-verify-cmd').textContent = finding.verifyCommand;
      document.getElementById('modal-triage-label').textContent = finding.triageStatus || 'Pending';

      const sevBadge = document.getElementById('modal-severity-badge');
      sevBadge.textContent = finding.severity.toUpperCase();
      if (finding.severity === 'Blocker') sevBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800';
      else if (finding.severity === 'Major') sevBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800';
      else sevBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800';

      const sourceContainer = document.getElementById('modal-source-container');
      if (finding.sourceLocation) {
        sourceContainer.classList.remove('hidden');
        document.getElementById('modal-source-text').textContent = \`\${finding.sourceLocation.file}:\${finding.sourceLocation.line || 1}\`;
      } else {
        sourceContainer.classList.add('hidden');
      }

      // Evidence screenshot
      const img = document.getElementById('modal-img-screenshot');
      if (finding.evidence?.screenshotPath) {
        img.src = '/api/evidence/' + finding.evidence.screenshotPath.replace(/\\\\/g, '/');
        img.classList.remove('hidden');
      } else {
        img.classList.add('hidden');
      }

      // Repro script
      const codeElem = document.getElementById('modal-code-repro');
      if (finding.reproScriptPath) {
        try {
          const res = await fetch('/api/evidence/' + finding.reproScriptPath.replace(/\\\\/g, '/'));
          codeElem.textContent = await res.text();
        } catch {
          codeElem.textContent = '// Repro script available at: ' + finding.reproScriptPath;
        }
      } else {
        codeElem.textContent = '// No reproduction script generated for this finding.';
      }

      // Console logs
      const consoleList = document.getElementById('modal-console-list');
      if (finding.evidence?.consoleLogs && finding.evidence.consoleLogs.length > 0) {
        consoleList.innerHTML = finding.evidence.consoleLogs.map(c => \`
          <div class="p-2 bg-red-50 text-red-900 border border-red-200 rounded font-mono text-xs">
            [\${c.type.toUpperCase()}] \${c.text}
          </div>
        \`).join('');
      } else {
        consoleList.innerHTML = '<p class="text-slate-400">No console errors logged.</p>';
      }

      // Network failures
      const networkList = document.getElementById('modal-network-list');
      if (finding.evidence?.networkLogs && finding.evidence.networkLogs.length > 0) {
        networkList.innerHTML = finding.evidence.networkLogs.map(n => \`
          <div class="p-2 bg-slate-900 text-slate-100 rounded font-mono text-xs flex justify-between">
            <span>\${n.method} \${n.url}</span>
            <span class="text-red-400 font-bold">\${n.status}</span>
          </div>
        \`).join('');
      } else {
        networkList.innerHTML = '<p class="text-slate-400">No failed requests logged.</p>';
      }

      switchEvidenceTab('screenshot');
      document.getElementById('modal-backdrop').classList.remove('hidden');
    }

    function closeModal() {
      document.getElementById('modal-backdrop').classList.add('hidden');
      selectedFinding = null;
    }

    function switchEvidenceTab(tab) {
      const tabs = ['screenshot', 'repro', 'console', 'network'];
      tabs.forEach(t => {
        const btn = document.getElementById('btn-ev-' + t);
        const panel = document.getElementById('panel-ev-' + t);
        if (t === tab) {
          btn.className = 'pb-2 text-xs font-semibold text-indigo-600 border-b-2 border-indigo-600';
          panel.classList.remove('hidden');
        } else {
          btn.className = 'pb-2 text-xs font-medium text-slate-500 hover:text-slate-700';
          panel.classList.add('hidden');
        }
      });
    }

    async function setTriage(status) {
      if (!selectedFinding) return;
      try {
        const res = await fetch(\`/api/findings/\${selectedFinding.id}/triage\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ triageStatus: status })
        });
        if (res.ok) {
          selectedFinding.triageStatus = status;
          document.getElementById('modal-triage-label').textContent = status;
          renderFindings();
        }
      } catch (err) {
        console.error(err);
        alert('Failed to update triage status');
      }
    }

    function copyVerifyCmd() {
      const cmd = document.getElementById('modal-verify-cmd').textContent;
      navigator.clipboard.writeText(cmd);
      alert('Verification command copied: ' + cmd);
    }

    // Initial load
    fetchReport();
  </script>
</body>
</html>`;
}

export function renderConfirmHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Discovery Confirmation & Review</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    code, pre { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen pb-24">
  <div class="flex flex-col min-h-screen">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-purple-100">
            AI
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-lg font-bold text-slate-900" id="header-title">AI Discovery & Flow Confirmation</h1>
              <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Review Phase</span>
            </div>
            <p class="text-xs text-slate-500 font-mono" id="header-meta">Loading discovery draft...</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <a href="/" class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">View Run Report</a>
          <button onclick="saveAndConfirm()" class="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-sm transition flex items-center space-x-1.5">
            <span>✔</span> <span>Approve & Generate Spec</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
      <!-- Tabs Navigation -->
      <div class="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button onclick="switchTab('flows')" id="tab-btn-flows" class="pb-3 border-b-2 border-purple-600 text-purple-600">Discovered Flows (<span id="count-flows">0</span>)</button>
        <button onclick="switchTab('questions')" id="tab-btn-questions" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700">Ambiguity Questions (<span id="count-questions">0</span>)</button>
        <button onclick="switchTab('pages')" id="tab-btn-pages" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700">Page Inventory (<span id="count-pages">0</span>)</button>
        <button onclick="switchTab('settings')" id="tab-btn-settings" class="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700">BYOK Settings</button>
      </div>

      <!-- Tab Content: Flows -->
      <section id="tab-flows" class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Review candidate user flows synthesized from the live crawl. Uncheck flows to exclude them from tests.</p>
        </div>
        <div id="flows-list" class="space-y-4"></div>
      </section>

      <!-- Tab Content: Questions -->
      <section id="tab-questions" class="hidden space-y-4">
        <p class="text-sm text-slate-500">The Discovery Agent identified sensitive actions (deletions, payments) and unmapped forms. Choose how to handle each item:</p>
        <div id="questions-list" class="space-y-4"></div>
      </section>

      <!-- Tab Content: Pages -->
      <section id="tab-pages" class="hidden space-y-4">
        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left font-medium text-slate-500">URL Path</th>
                <th class="px-4 py-3 text-left font-medium text-slate-500">Page Title</th>
                <th class="px-4 py-3 text-center font-medium text-slate-500">Elements</th>
                <th class="px-4 py-3 text-center font-medium text-slate-500">Forms</th>
                <th class="px-4 py-3 text-center font-medium text-slate-500">Scope</th>
              </tr>
            </thead>
            <tbody id="pages-table" class="divide-y divide-slate-100 bg-white"></tbody>
          </table>
        </div>
      </section>

      <!-- Tab Content: Settings / BYOK -->
      <section id="tab-settings" class="hidden max-w-2xl bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 class="text-base font-semibold text-slate-900">Bring Your Own Key (BYOK) Configuration</h2>
        <p class="text-xs text-slate-500">Keys are stored in your operating system's keychain (Windows Credential Manager, macOS Keychain, or libsecret) and never written to reports or logs. Select your provider and enter your API credentials.</p>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-700">Provider</label>
            <select id="key-provider" class="mt-1 block w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm focus:border-purple-500 focus:outline-none">
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700">API Key</label>
            <input type="password" id="key-value" placeholder="sk-..." class="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-purple-500 focus:outline-none" />
          </div>
          <button onclick="saveApiKey()" class="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition">Save API Key</button>
        </div>
      </section>
    </main>

    <!-- Sticky Bottom Approval Bar -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg flex items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div>
        <p class="text-xs font-semibold text-slate-900">Ready to execute tests?</p>
        <p class="text-xs text-slate-500" id="approval-summary">Approving will compile the confirmed flows into qa.spec.json.</p>
      </div>
      <button onclick="saveAndConfirm()" class="px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 shadow-md shadow-purple-200 transition">
        Approve & Generate Spec (qa.spec.json)
      </button>
    </div>
  </div>

  <script>
    let currentDraft = null;

    async function loadDraft() {
      try {
        const res = await fetch('/api/discovery/draft');
        if (!res.ok) throw new Error('No draft found');
        currentDraft = await res.json();
        renderDraft();
      } catch (err) {
        document.getElementById('header-meta').textContent = 'Error: ' + err.message;
      }
    }

    function renderDraft() {
      if (!currentDraft) return;
      document.getElementById('header-title').textContent = 'Discovery for ' + currentDraft.productId;
      document.getElementById('header-meta').textContent = 'Target: ' + currentDraft.targetUrl + ' | Discovered at ' + new Date(currentDraft.timestamp).toLocaleTimeString();
      document.getElementById('count-flows').textContent = currentDraft.flows.length;
      document.getElementById('count-questions').textContent = currentDraft.ambiguityQuestions.length;
      document.getElementById('count-pages').textContent = currentDraft.pages.length;

      // Render Flows
      const flowsList = document.getElementById('flows-list');
      flowsList.innerHTML = currentDraft.flows.map((f, idx) => \`
        <div class="bg-white border \${f.outOfScope ? 'border-slate-200 opacity-60' : 'border-purple-200'} rounded-xl p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded">\${f.id}</span>
              <h3 class="text-sm font-bold text-slate-900">\${f.name}</h3>
              <span class="text-xs text-slate-500">(\${f.role})</span>
            </div>
            <label class="flex items-center space-x-2 text-xs font-medium cursor-pointer">
              <input type="checkbox" onchange="toggleFlowScope(\${idx})" \${f.outOfScope ? 'checked' : ''} class="rounded text-purple-600" />
              <span>Exclude from run</span>
            </label>
          </div>
          <p class="text-xs text-slate-600">\${f.description}</p>
          <div class="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
            <p class="font-medium text-slate-700">Steps (\${f.steps.length}):</p>
            <ol class="list-decimal list-inside space-y-0.5 text-slate-600">
              \${f.steps.map(s => '<li><span class="font-mono text-purple-600">[' + s.action + ']</span> ' + s.name + '</li>').join('')}
            </ol>
          </div>
          \${f.inferredRules && f.inferredRules.length ? '<p class="text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-100"><b>Inferred Rules:</b> ' + f.inferredRules.join('; ') + '</p>' : ''}
        </div>
      \`).join('');

      // Render Ambiguity Questions
      const questionsList = document.getElementById('questions-list');
      questionsList.innerHTML = currentDraft.ambiguityQuestions.map((q, idx) => \`
        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">\${q.id}</span>
            <span class="text-xs text-slate-400 font-mono">\${q.urlPath}</span>
          </div>
          <p class="text-sm font-medium text-slate-800">\${q.question}</p>
          <div class="space-y-2">
            \${q.options.map(opt => \`
              <label class="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer">
                <input type="radio" name="q-\${q.id}" onchange="selectAnswer(\${idx}, '\` + opt + \`')" \${q.selectedAnswer === opt ? 'checked' : ''} class="text-purple-600" />
                <span>\` + opt + \`</span>
              </label>
            \`).join('')}
          </div>
        </div>
      \`).join('');

      // Render Pages Table
      const pagesTable = document.getElementById('pages-table');
      pagesTable.innerHTML = currentDraft.pages.map((p, idx) => \`
        <tr class="\${p.outOfScope ? 'opacity-50 bg-slate-50' : ''}">
          <td class="px-4 py-3 font-mono text-xs text-slate-800">\${p.urlPath}</td>
          <td class="px-4 py-3 text-xs text-slate-600">\${p.title}</td>
          <td class="px-4 py-3 text-center text-xs text-slate-600">\${p.interactiveElementsCount}</td>
          <td class="px-4 py-3 text-center text-xs text-slate-600">\${p.formsCount}</td>
          <td class="px-4 py-3 text-center">
            <input type="checkbox" onchange="togglePageScope(\${idx})" \${p.outOfScope ? 'checked' : ''} class="rounded text-purple-600 cursor-pointer" />
          </td>
        </tr>
      \`).join('');
    }

    function toggleFlowScope(idx) {
      currentDraft.flows[idx].outOfScope = !currentDraft.flows[idx].outOfScope;
      renderDraft();
    }

    function togglePageScope(idx) {
      currentDraft.pages[idx].outOfScope = !currentDraft.pages[idx].outOfScope;
      renderDraft();
    }

    function selectAnswer(qIdx, ans) {
      currentDraft.ambiguityQuestions[qIdx].selectedAnswer = ans;
    }

    function switchTab(tab) {
      ['flows', 'questions', 'pages', 'settings'].forEach(t => {
        document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
        const btn = document.getElementById('tab-btn-' + t);
        if (t === tab) {
          btn.className = 'pb-3 border-b-2 border-purple-600 text-purple-600 font-semibold';
        } else {
          btn.className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700';
        }
      });
    }

    async function saveApiKey() {
      const provider = document.getElementById('key-provider').value;
      const apiKey = document.getElementById('key-value').value;
      if (!apiKey) return alert('Enter API key');
      const res = await fetch('/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      });
      if (res.ok) alert('API Key saved successfully.');
    }

    async function saveAndConfirm() {
      const res = await fetch('/api/discovery/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: currentDraft, generateSpec: true })
      });
      if (res.ok) {
        alert('Confirmed! Generated qa.spec.json with ' + currentDraft.flows.filter(f => !f.outOfScope).length + ' flows. You can now execute: pnpm qa-test run -u ' + currentDraft.targetUrl + ' -s qa.spec.json');
        window.location.href = '/';
      } else {
        alert('Failed to save confirmation.');
      }
    }

    loadDraft();
  </script>
</body>
</html>`;
}

