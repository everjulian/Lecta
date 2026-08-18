import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./preload/index.ts', import.meta.url)),
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    target: 'node22',
    outDir: fileURLToPath(new URL('../../dist/electron/preload', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: { external: ['electron'] },
  },
});
