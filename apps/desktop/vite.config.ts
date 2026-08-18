import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@lecta/domain': fileURLToPath(
        new URL('../../packages/domain/src/index.ts', import.meta.url),
      ),
      '@lecta/application': fileURLToPath(
        new URL('../../packages/application/src/index.ts', import.meta.url),
      ),
      '@lecta/infrastructure': fileURLToPath(
        new URL('../../packages/infrastructure/src/index.ts', import.meta.url),
      ),
      '@lecta/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
      '@lecta/recording': fileURLToPath(
        new URL('../../packages/recording/src/index.ts', import.meta.url),
      ),
    },
  },
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
});
