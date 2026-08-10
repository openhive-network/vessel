import { resolve } from 'path';
import { transformSync } from '@babel/core';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * Phase 2 · MR-A — electron-vite build (main / preload / renderer), ADDED alongside the still-working
 * webpack path (the escape hatch) until an electron-vite release ships (then MR-B deletes webpack).
 *
 * The ~60 legacy renderer files are plain `.js` carrying BOTH Flow annotations AND JSX (class
 * components). Vite/esbuild routes `.js` past @vitejs/plugin-react's JSX handling, so a dedicated
 * `enforce:'pre'` babel pass strips Flow + compiles JSX to plain JS BEFORE esbuild/rollup/node-polyfills
 * ever parse it. @vitejs/plugin-react then handles the `.tsx` entry files. This survives until Phase 5
 * removes the last `@flow`/class component.
 */
function flowJsxJs() {
  return {
    name: 'vessel-flow-jsx-js',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?')[0];
      if (!file.endsWith('.js') || file.includes('node_modules') || !file.includes('/app/')) {
        return null;
      }
      const result = transformSync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        plugins: ['@babel/plugin-transform-flow-strip-types'],
        sourceMaps: true,
      });
      if (!result || result.code == null) return null;
      return { code: result.code, map: result.map };
    },
  };
}

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
      flowJsxJs(),
      react({ include: /\.[jt]sx$/ }), // the .tsx/.jsx entry + modern files
      nodePolyfills({
        include: ['crypto', 'stream', 'buffer', 'util', 'events'],
        globals: { Buffer: true, process: true },
      }),
    ],
    optimizeDeps: {
      esbuildOptions: {
        // the dep pre-bundle scan must treat JSX-in-.js as jsx or it chokes
        loader: { '.js': 'jsx' },
      },
    },
  },
});
