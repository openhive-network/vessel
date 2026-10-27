import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * electron-vite build (main / preload / renderer). Phase 5 removed the last @flow file and the last
 * legacy `.js` source, so the Flow-strip / JSX-in-`.js` babel pre-pass and the `.js: jsx` dep-scan loader
 * are gone — all renderer source is now `.tsx`/`.ts` handled by @vitejs/plugin-react + esbuild.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'app/main.dev.ts') },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve(__dirname, 'app/preload.ts') },
    },
  },
  renderer: {
    root: resolve(__dirname, 'app'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: resolve(__dirname, 'app/index.html'),
      },
    },
    plugins: [
      react({ include: /\.[jt]sx$/ }),
      // No node polyfills: hive-tx is pure @noble, keyEnvelope is @noble, mnemonics are @scure/bip39
      // (Uint8Array) — nothing in the renderer needs crypto/stream/buffer/process shims post-swap.
    ],
  },
});
