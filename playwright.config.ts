import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  outputDir: 'test-results/e2e',
});
