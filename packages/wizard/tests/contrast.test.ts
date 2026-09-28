import { describe, it, expect } from 'vitest';
import { palette } from '../tailwind.config.js';

/** WCAG 2.1 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Token = keyof typeof palette;

/** Every foreground/background pairing the wizard actually uses for text. */
const TEXT_PAIRS: Array<[Token, Token]> = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink', 'stamp-tint'],
  ['ink-soft', 'paper'],
  ['ink-soft', 'surface'],
  ['stamp', 'paper'],
  ['stamp', 'surface'],
  ['stamp-dark', 'paper'],
  ['surface', 'stamp'],
  ['surface', 'stamp-dark'],
  ['pass', 'paper'],
  ['pass', 'surface'],
  ['fail', 'paper'],
  ['fail', 'fail-tint'],
  ['warn', 'paper'],
  ['warn', 'warn-tint'],
];

/** Boundaries people must see to use a control (WCAG 1.4.11: 3:1). */
const NON_TEXT_PAIRS: Array<[Token, Token]> = [
  ['edge', 'paper'],
  ['edge', 'surface'],
  ['stamp', 'paper'], // focus ring
  ['stamp', 'stamp-tint'], // progress bar fill on its track
];

describe('wizard palette meets WCAG 2.1 AA', () => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('control %s against %s is at least 3:1', (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(3);
  });
});
