import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@qa/types': path.resolve(__dirname, './packages/types/src/index.ts'),
      '@qa/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@qa/checkers': path.resolve(__dirname, './packages/checkers/src/index.ts'),
      '@qa/runner': path.resolve(__dirname, './packages/runner/src/index.ts'),
    },
  },
});
