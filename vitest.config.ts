import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@lecta/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
      '@lecta/application': fileURLToPath(
        new URL('./packages/application/src/index.ts', import.meta.url),
      ),
      '@lecta/infrastructure': fileURLToPath(
        new URL('./packages/infrastructure/src/index.ts', import.meta.url),
      ),
      '@lecta/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@lecta/recording': fileURLToPath(
        new URL('./packages/recording/src/index.ts', import.meta.url),
      ),
      '@lecta/transcription': fileURLToPath(
        new URL('./packages/transcription/src/index.ts', import.meta.url),
      ),
      '@lecta/ai': fileURLToPath(new URL('./packages/ai/src/index.ts', import.meta.url)),
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
