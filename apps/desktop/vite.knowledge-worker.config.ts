import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@lecta/ai': fileURLToPath(new URL('../../packages/ai/src/index.ts', import.meta.url)),
      '@lecta/infrastructure': fileURLToPath(
        new URL('../../packages/infrastructure/src/index.ts', import.meta.url),
      ),
      '@lecta/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    ssr: fileURLToPath(new URL('../../workers/knowledge-worker/src/index.ts', import.meta.url)),
    target: 'node22',
    outDir: fileURLToPath(new URL('../../dist/knowledge-worker', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'index.js' } },
  },
});
