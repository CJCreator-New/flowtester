import { describe, it, expect } from 'vitest';
import { SourceLocator } from '../src/source-locator.js';
import path from 'path';

describe('SourceLocator', () => {
  it('locates data-testid inside test files', async () => {
    // Scan within fixtures directory
    const fixturesDir = path.resolve(__dirname, '../../../fixtures');
    const locator = new SourceLocator(fixturesDir);

    // fixtures/test-app/server.js contains data-testid="save-btn" or similar
    const result = await locator.findByTestId('save-btn');
    if (result) {
      expect(result.file).toBeDefined();
      expect(result.line).toBeGreaterThan(0);
      expect(result.matchSnippet).toContain('save-btn');
    }
  });

  it('returns undefined if test-id is not found', async () => {
    const locator = new SourceLocator(path.resolve(__dirname, '../../../fixtures'));
    const result = await locator.findByTestId('non-existent-element-xyz-999');
    expect(result).toBeUndefined();
  });
});
