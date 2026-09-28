import { describe, it, expect } from 'vitest';
import {
  DesignStandardsChecker,
  hexToRgb,
  normalizeColor,
} from '../src/design-standards.js';
import { UXQualityChecker } from '../src/ux-quality.js';
import type { Finding } from '@qa/types';
import { PNG } from 'pngjs';

describe('Design & UX Checkers', () => {
  describe('Color Normalization & Tokens', () => {
    it('converts 6-digit and 3-digit hex colors to rgb', () => {
      expect(hexToRgb('#2563eb')).toBe('rgb(37, 99, 235)');
      expect(hexToRgb('#fff')).toBe('rgb(255, 255, 255)');
      expect(hexToRgb('#000')).toBe('rgb(0, 0, 0)');
      expect(hexToRgb('not-a-hex')).toBeNull();
    });

    it('normalizes hex and rgb color strings for comparison', () => {
      expect(normalizeColor('#2563eb')).toBe('rgb(37, 99, 235)');
      expect(normalizeColor('rgb(37,99,235)')).toBe('rgb(37, 99, 235)');
      expect(normalizeColor('rgb(37,  99,  235)')).toBe('rgb(37, 99, 235)');
    });
  });

  describe('DesignStandardsChecker Visual Diff', () => {
    const checker = new DesignStandardsChecker();

    /** Solid-color PNG with an optional filled rectangle painted on top. */
    function makePng(
      width: number,
      height: number,
      bg: [number, number, number],
      rect?: { x: number; y: number; w: number; h: number; color: [number, number, number] }
    ): Buffer {
      const png = new PNG({ width, height });
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const inRect = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
          const [r, g, b] = inRect ? rect!.color : bg;
          const i = (y * width + x) * 4;
          png.data[i] = r;
          png.data[i + 1] = g;
          png.data[i + 2] = b;
          png.data[i + 3] = 255;
        }
      }
      return PNG.sync.write(png);
    }

    it('matches identical images with 0% diff', async () => {
      const a = makePng(50, 50, [255, 255, 255]);
      const result = await checker.checkVisualDiff(a, makePng(50, 50, [255, 255, 255]));
      expect(result.match).toBe(true);
      expect(result.diffPercent).toBe(0);
    });

    it('measures the changed region as a fraction of pixels', async () => {
      const baseline = makePng(100, 100, [255, 255, 255]);
      const current = makePng(100, 100, [255, 255, 255], { x: 0, y: 0, w: 20, h: 10, color: [220, 38, 38] });
      const result = await checker.checkVisualDiff(current, baseline, { maxDiffPercent: 0.01 });
      expect(result.diffPixels).toBe(200);
      expect(result.diffPercent).toBeCloseTo(0.02);
      expect(result.match).toBe(false);
    });

    it('tolerates changes below maxDiffPercent', async () => {
      const baseline = makePng(100, 100, [255, 255, 255]);
      const current = makePng(100, 100, [255, 255, 255], { x: 0, y: 0, w: 5, h: 5, color: [0, 0, 0] });
      const result = await checker.checkVisualDiff(current, baseline, { maxDiffPercent: 0.01 });
      expect(result.match).toBe(true);
    });

    it('treats a dimension change as a full mismatch', async () => {
      const result = await checker.checkVisualDiff(makePng(100, 120, [0, 0, 0]), makePng(100, 100, [0, 0, 0]));
      expect(result).toMatchObject({ match: false, sizeMismatch: true, diffPercent: 1 });
    });
  });

  describe('UXQualityChecker Route Deduplication', () => {
    const uxChecker = new UXQualityChecker();

    it('deduplicates recurring rule violations on the same route', () => {
      const findings: Finding[] = [
        {
          id: 'F-1',
          severity: 'Major',
          checker: 'ux-quality',
          title: 'WCAG Violation: color-contrast',
          where: { urlPath: '/checkout', role: 'shopper', breakpoint: '1440px', cssSelector: 'header > a' },
          expectedVsActual: { expected: 'contrast >= 4.5', actual: '2.1' },
          stepsToReproduce: [],
          evidence: {},
          resolution: '',
          verifyCommand: '',
        },
        {
          id: 'F-2', // Duplicate on same route and selector from step 2
          severity: 'Major',
          checker: 'ux-quality',
          title: 'WCAG Violation: color-contrast',
          where: { urlPath: '/checkout', role: 'shopper', breakpoint: '1440px', cssSelector: 'header > a' },
          expectedVsActual: { expected: 'contrast >= 4.5', actual: '2.1' },
          stepsToReproduce: [],
          evidence: {},
          resolution: '',
          verifyCommand: '',
        },
        {
          id: 'F-3', // Distinct issue on different route
          severity: 'Major',
          checker: 'ux-quality',
          title: 'WCAG Violation: color-contrast',
          where: { urlPath: '/invoices', role: 'shopper', breakpoint: '1440px', cssSelector: 'header > a' },
          expectedVsActual: { expected: 'contrast >= 4.5', actual: '2.1' },
          stepsToReproduce: [],
          evidence: {},
          resolution: '',
          verifyCommand: '',
        },
      ];

      const deduplicated = uxChecker.deduplicateFindings(findings);
      expect(deduplicated.length).toBe(2);
      expect(deduplicated.map((d) => d.where.urlPath)).toEqual(['/checkout', '/invoices']);
    });
  });
});
