/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// Testes residem junto do código que exercitam (ADR-0024 §17).
// Isolamento por schema próprio de processo, com truncate entre testes (ADR-0024 §11, §12).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // Cada processo recebe schema próprio; VITEST_POOL_ID identifica o processo.
    setupFiles: ['./test-setup.ts'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      // Sem limiar: ADR-0024 §21 proíbe meta percentual como critério de aprovação.
      reporter: ['text-summary', 'html'],
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
