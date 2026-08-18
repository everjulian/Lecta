import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export default defineConfig({
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
      '@lecta/transcription': fileURLToPath(
        new URL('../../packages/transcription/src/index.ts', import.meta.url),
      ),
      '@lecta/ai': fileURLToPath(new URL('../../packages/ai/src/index.ts', import.meta.url)),
    },
  },
  build: {
    ssr: fileURLToPath(new URL('./main/index.ts', import.meta.url)),
    target: 'node22',
    outDir: fileURLToPath(new URL('../../dist/electron/main', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: { external: ['electron'], output: { entryFileNames: 'index.js' } },
  },
  plugins: [
    {
      name: 'copy-transcription-worker',
      closeBundle() {
        const output = fileURLToPath(new URL('../../dist/transcription-worker', import.meta.url));
        mkdirSync(output, { recursive: true });
        copyFileSync(
          fileURLToPath(
            new URL('../../workers/transcription-worker/python/worker.py', import.meta.url),
          ),
          path.join(output, 'worker.py'),
        );
      },
    },
  ],
});
