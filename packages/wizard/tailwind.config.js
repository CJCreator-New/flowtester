/**
 * Check-up wizard palette. Every text pairing is checked against WCAG AA in
 * tests/contrast.test.ts; see DESIGN.md for the reasoning behind each choice.
 */
export const palette = {
  paper: '#F3F6FB', // page background: cool, like a fresh form
  surface: '#FFFFFF', // the sheet being filled in
  ink: '#1B2440', // body text
  'ink-soft': '#4B5675', // secondary text
  rule: '#D5DCEA', // decorative dividers only (never the only cue)
  edge: '#6E7A96', // form-control borders (3:1 against paper and surface)
  stamp: '#5132C4', // stamp-pad violet: actions, focus, the verdict stamp
  'stamp-dark': '#3D2399',
  'stamp-tint': '#ECE8FB',
  pass: '#1D6B45',
  'pass-tint': '#E3F2EA',
  fail: '#B42318',
  'fail-tint': '#FBE9E7',
  warn: '#8A5300',
  'warn-tint': '#FBF0DC',
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
