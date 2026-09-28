// Hand-authored CSS replacing the cdn.tailwindcss.com runtime script (Tailwind's own
// CDN build warns against production use). Only implements the utility classes actually
// used by ui.ts's server-rendered pages, so existing markup needs no class renaming.
export const DASHBOARD_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-x: hidden; }

  /* Layout */
  .flex { display: flex; }
  .grid { display: grid; }
  .flex-col { flex-direction: column; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-between { justify-content: space-between; }
  .justify-center { justify-content: center; }
  .flex-wrap { flex-wrap: wrap; }
  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-4 { gap: 1rem; }
  .gap-6 { gap: 1.5rem; }
  .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .space-y-1\\.5 > * + * { margin-top: 0.375rem; }
  .space-y-2 > * + * { margin-top: 0.5rem; }
  .space-y-4 > * + * { margin-top: 1rem; }
  .space-y-8 > * + * { margin-top: 2rem; }
  .divide-y > * + * { border-top-width: 1px; border-top-style: solid; }
  .divide-slate-800 > * + * { border-color: #1e293b; }
  .min-h-screen { min-height: 100vh; }
  .max-w-7xl { max-width: 80rem; }
  .mx-auto { margin-left: auto; margin-right: auto; }
  .overflow-hidden { overflow: hidden; }
  .sticky { position: sticky; }
  .top-0 { top: 0; }
  .z-50 { z-index: 50; }
  .backdrop-blur { backdrop-filter: blur(8px); }
  .transition { transition: background-color 0.15s ease, color 0.15s ease; }

  /* Spacing */
  .p-2 { padding: 0.5rem; } .p-2\\.5 { padding: 0.625rem; } .p-3 { padding: 0.75rem; }
  .p-4 { padding: 1rem; } .p-5 { padding: 1.25rem; } .p-6 { padding: 1.5rem; } .p-12 { padding: 3rem; }
  .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
  .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
  .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
  .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
  .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
  .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
  .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
  .mt-1 { margin-top: 0.25rem; } .mt-2 { margin-top: 0.5rem; } .mb-2 { margin-bottom: 0.5rem; }
  .pt-1 { padding-top: 0.25rem; } .pt-2 { padding-top: 0.5rem; }

  /* Typography */
  .text-xs { font-size: 0.75rem; line-height: 1.2; }
  .text-sm { font-size: 0.875rem; line-height: 1.35; }
  .text-base { font-size: 1rem; line-height: 1.5; }
  .text-lg { font-size: 1.125rem; line-height: 1.5; }
  .text-xl { font-size: 1.25rem; line-height: 1.4; }
  .text-2xl { font-size: 1.5rem; line-height: 1.3; }
  .text-3xl { font-size: 1.875rem; line-height: 1.25; }
  .font-medium { font-weight: 500; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .font-extrabold { font-weight: 800; }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .uppercase { text-transform: uppercase; }
  .tracking-tight { letter-spacing: -0.015em; }
  .tracking-wider { letter-spacing: 0.05em; }
  .leading-relaxed { line-height: 1.6; }
  .text-center { text-align: center; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  /* Borders / radius */
  .border { border: 1px solid; }
  .border-t { border-top: 1px solid; }
  .border-b { border-bottom: 1px solid; }
  .rounded { border-radius: 0.25rem; }
  .rounded-lg { border-radius: 0.5rem; }
  .rounded-xl { border-radius: 0.75rem; }
  .rounded-full { border-radius: 9999px; }

  /* Slate palette */
  .bg-slate-900 { background: #0f172a; } .bg-slate-950\\/80 { background: rgba(2,6,23,0.8); }
  .bg-slate-950\\/60 { background: rgba(2,6,23,0.6); }
  .bg-slate-900\\/60 { background: rgba(15,23,42,0.6); } .bg-slate-900\\/70 { background: rgba(15,23,42,0.7); }
  .bg-slate-800 { background: #1e293b; } .bg-slate-800\\/40 { background: rgba(30,41,59,0.4); }
  .bg-slate-800\\/60 { background: rgba(30,41,59,0.6); } .bg-slate-800\\/30 { background: rgba(30,41,59,0.3); }
  .bg-slate-700 { background: #334155; }
  .text-slate-100 { color: #f1f5f9; } .text-slate-200 { color: #e2e8f0; }
  .text-slate-300 { color: #cbd5e1; } .text-slate-400 { color: #94a3b8; } .text-slate-500 { color: #64748b; }
  .text-white { color: #fff; }
  .border-slate-700 { border-color: #334155; } .border-slate-700\\/60 { border-color: rgba(51,65,85,0.6); }
  .border-slate-800 { border-color: #1e293b; } .border-slate-800\\/80 { border-color: rgba(30,41,59,0.8); }
  .hover\\:bg-slate-600:hover { background: #475569; }
  .hover\\:bg-slate-700:hover { background: #334155; }
  .hover\\:bg-slate-800\\/30:hover { background: rgba(30,41,59,0.3); }

  /* Indigo */
  .bg-indigo-600 { background: #4f46e5; }
  .bg-indigo-900\\/40 { background: rgba(49,46,129,0.4); } .bg-indigo-900\\/50 { background: rgba(49,46,129,0.5); }
  .bg-indigo-500\\/20 { background: rgba(99,102,241,0.2); }
  .text-indigo-300 { color: #a5b4fc; } .text-indigo-400 { color: #818cf8; }
  .border-indigo-700\\/50 { border-color: rgba(67,56,202,0.5); } .border-indigo-700\\/60 { border-color: rgba(67,56,202,0.6); }
  .border-indigo-500\\/30 { border-color: rgba(99,102,241,0.3); }

  /* Rose */
  .bg-rose-950\\/30 { background: rgba(76,5,25,0.3); } .bg-rose-900\\/50 { background: rgba(136,19,55,0.5); }
  .bg-rose-500\\/20 { background: rgba(244,63,94,0.2); }
  .text-rose-300 { color: #fda4af; } .text-rose-400 { color: #fb7185; }
  .border-rose-900\\/40 { border-color: rgba(136,19,55,0.4); } .border-rose-500\\/30 { border-color: rgba(244,63,94,0.3); }
  .hover\\:bg-rose-800:hover { background: #9f1239; }

  /* Emerald */
  .bg-emerald-950\\/30 { background: rgba(2,44,34,0.3); } .bg-emerald-900\\/40 { background: rgba(6,78,59,0.4); }
  .bg-emerald-900\\/50 { background: rgba(6,78,59,0.5); } .bg-emerald-500\\/20 { background: rgba(16,185,129,0.2); }
  .text-emerald-300 { color: #6ee7b7; } .text-emerald-400 { color: #34d399; }
  .border-emerald-900\\/40 { border-color: rgba(6,78,59,0.4); } .border-emerald-700\\/50 { border-color: rgba(4,120,87,0.5); }
  .border-emerald-500\\/30 { border-color: rgba(16,185,129,0.3); }
  .hover\\:bg-emerald-800:hover { background: #065f46; }

  /* Amber */
  .bg-amber-950\\/30 { background: rgba(69,26,3,0.3); } .bg-amber-500\\/20 { background: rgba(245,158,11,0.2); }
  .text-amber-300 { color: #fcd34d; } .text-amber-400 { color: #fbbf24; }
  .border-amber-900\\/40 { border-color: rgba(120,53,15,0.4); } .border-amber-500\\/30 { border-color: rgba(245,158,11,0.3); }

  /* Blue */
  .bg-blue-950\\/30 { background: rgba(23,37,84,0.3); } .bg-blue-500\\/20 { background: rgba(59,130,246,0.2); }
  .text-blue-300 { color: #93c5fd; } .text-blue-400 { color: #60a5fa; }
  .border-blue-900\\/40 { border-color: rgba(30,58,138,0.4); } .border-blue-500\\/30 { border-color: rgba(59,130,246,0.3); }

  /* Responsive */
  @media (min-width: 768px) {
    .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .md\\:grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .md\\:flex-row { flex-direction: row; }
    .md\\:items-center { align-items: center; }
  }
  @media (min-width: 1024px) {
    .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }

  /* Below the smallest Tailwind breakpoint (< 768px, i.e. the un-prefixed rules already
     apply): make sure rows that used to rely on the CDN's implicit wrapping actually wrap
     instead of clipping inside their overflow-hidden ancestor or squeezing into a
     letter-per-line column. This is the fix for the no-mobile-breakpoint finding. */
  @media (max-width: 640px) {
    header .flex.items-center.justify-between { flex-wrap: wrap; row-gap: 0.75rem; }
    .finding-row { flex-wrap: wrap; }
    .finding-row .flex.items-center.gap-3,
    .finding-row .flex.items-center.gap-4 { flex-wrap: wrap; row-gap: 0.375rem; }
    main.max-w-7xl { padding-left: 1rem; padding-right: 1rem; }
  }
`;
