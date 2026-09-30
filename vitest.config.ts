import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    // Exact names only, so a subpath such as '@qa/types/src/verdict.js' (the wizard imports single
    // modules, keeping Node-only code out of the browser) resolves to its own file.
    alias: [
      { find: /^@qa\/types$/, replacement: path.resolve(__dirname, './packages/types/src/index.ts') },
      { find: /^@qa\/core$/, replacement: path.resolve(__dirname, './packages/core/src/index.ts') },
      { find: /^@qa\/checkers$/, replacement: path.resolve(__dirname, './packages/checkers/src/index.ts') },
      { find: /^@qa\/runner$/, replacement: path.resolve(__dirname, './packages/runner/src/index.ts') },
    ],
  },
});
