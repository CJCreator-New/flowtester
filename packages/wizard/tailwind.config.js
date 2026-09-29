/**
 * Blueprint palette (Phase 1 direction B): a deep navy drawing board with light "drawings" on it.
 * Every text pairing is checked against WCAG AA in tests/contrast.test.ts; see DESIGN.md for the
 * reasoning behind each choice.
 */
export const palette = {
  paper: '#111827', // page background
  canvas: '#0D1322', // the map's drawing board
  surface: '#1E2A3B', // cards and fields
  panel: '#1A2438', // sidebars and the side panel
  ink: '#E8EDF5', // body text
  'ink-soft': '#A7B3C7', // secondary text
  rule: '#2A3A52', // decorative dividers only (never the only cue)
  edge: '#74859F', // control borders (3:1 against paper, panel and surface)
  stamp: '#6C9BF2', // accent: actions, focus ring, progress
  'stamp-dark': '#9DBDF7', // accent on hover (lighter on a dark board)
  'stamp-tint': '#1C2C4C',
  pass: '#4ADE9A',
  'pass-tint': '#12302A',
  fail: '#FA9191',
  'fail-tint': '#3A1C20',
  warn: '#FBC54A',
  'warn-tint': '#3A2F14',
  // One colour per journey on the map, like an architect's mark-up lines.
  j1: '#B69CFB',
  j2: '#6FB0FA',
  j3: '#4ADE9A',
  j4: '#F59AC6',
  j5: '#FBA35C',
};

/** @type {import('tailwindcss').Config} */
export default {
  // relative: globs resolve from this file, so the dev server works from any working directory
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      colors: palette,
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next Variable"', 'system-ui', 'sans-serif'],
        stamp: ['"Big Shoulders Stencil Display"', 'Impact', 'sans-serif'],
        // Reference labels on the map (pg-01 · /cart): a system monospace, nothing to download.
        mono: ['ui-monospace', '"Cascadia Mono"', 'Consolas', '"SF Mono"', 'monospace'],
      },
      fontSize: {
        // 18px base: this audience reads, it does not scan
        base: ['1.125rem', { lineHeight: '1.6' }],
        question: ['clamp(1.875rem, 1.4rem + 2vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
      },
      maxWidth: {
        prose: '38rem',
      },
    },
  },
  plugins: [],
};
