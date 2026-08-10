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

/**
 * D9b — RIPEMD-160 for the Electron MAIN process. Electron's main uses BoringSSL, which (unlike Node's
 * OpenSSL and the renderer's browserified crypto) lacks RIPEMD-160. hive-js needs it — via
 * `create-hash`, which in Node is `require('crypto').createHash` — to verify public-key address
 * checksums while encoding/decoding memos; without it hive-js's one-time self-test fails and it
 * PERMANENTLY disables memo encryption for the process ("This environment does not support
 * encryption."). Signing avoids this primitive, which is why it works in main while memo crypto does
 * not.
 *
 * This prelude serves the one missing hash from @noble/hashes (the wallet's crypto backbone in
 * keyEnvelope.ts) and delegates every other algorithm to the native implementation — hive-js's
 * byte-exact memo code is reused unchanged. It is a BANNER (not an importable module) on purpose: it
 * must run before `create-hash` captures `crypto.createHash`, and rollup hoists the external hive-js
 * require above all bundled app code, so only a banner is guaranteed to execute first. It patches only
 * when native rmd160 is genuinely missing, so Node/OpenSSL keeps its native path untouched.
 */
const RIPEMD160_MAIN_BANNER = [
  '(function () {',
  '  try {',
  '    var c = require("crypto");',
  '    try { c.createHash("rmd160"); return; } catch (e) {}',
  '    var R = require("@noble/hashes/legacy.js").ripemd160;', // v2: ripemd160 moved to /legacy (+ .js exports)
  '    var native = c.createHash.bind(c);',
  '    Object.defineProperty(c, "createHash", {',
  '      configurable: true,',
  '      value: function (algo, opts) {',
  '        var a = String(algo).toLowerCase();',
  '        if (a === "rmd160" || a === "ripemd160") {',
  '          var h = R.create();',
  '          return {',
  '            update: function (d, e) { h.update(typeof d === "string" ? Buffer.from(d, e || "utf8") : d); return this; },',
  '            digest: function (enc) { var b = Buffer.from(h.digest()); return enc ? b.toString(enc) : b; },',
  '          };',
  '        }',
  '        return native(algo, opts);',
  '      },',
  '    });',
  '  } catch (err) { console.error("[ripemd160 shim] failed:", err && err.message); }',
  '})();',
].join('\n');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'app/main.dev.ts') },
      rollupOptions: { output: { banner: RIPEMD160_MAIN_BANNER } },
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
