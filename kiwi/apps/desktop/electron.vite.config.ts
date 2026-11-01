import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'";
// The dev server needs inline scripts and a websocket for hot reload.
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:";

// The voice window downloads the speech model and its WebAssembly runtime on first use.
const VOICE_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self'; img-src 'self' data:; connect-src 'self' blob: https://huggingface.co https://*.huggingface.co https://*.hf.co";
const DEV_VOICE_CSP = `${VOICE_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")}; connect-src 'self' ws: blob: https://huggingface.co https://*.huggingface.co https://*.hf.co`;

function contentSecurityPolicy(): Plugin {
  return {
    name: 'kiwi-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const isVoice = context.filename.includes('/voice/');
        const policy = isVoice
          ? context.server
            ? DEV_VOICE_CSP
            : VOICE_CSP
          : context.server
            ? DEV_CSP
            : STRICT_CSP;
        return html.replace('__CSP__', policy);
      },
    },
  };
}

const ORT_FILES = [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
];

/** Serves the ONNX runtime from the app itself so no script is loaded from a CDN. */
function selfHostedOnnxRuntime(): Plugin {
  const require = createRequire(import.meta.url);
  const transformersDir = dirname(require.resolve('@huggingface/transformers'));
  const distDir = dirname(require.resolve('onnxruntime-web', { paths: [transformersDir] }));
  const contentType = (name: string): string =>
    name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
  return {
    name: 'kiwi-self-hosted-onnx',
    configureServer(server) {
      server.middlewares.use('/ort', (request, response, next) => {
        const name = (request.url ?? '').replace(/^\//, '').split('?')[0] ?? '';
        if (!ORT_FILES.includes(name)) return next();
        response.setHeader('Content-Type', contentType(name));
        response.end(readFileSync(`${distDir}/${name}`));
      });
    },
    generateBundle() {
      for (const name of ORT_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `ort/${name}`,
          source: readFileSync(`${distDir}/${name}`),
        });
      }
    },
  };
}

export default defineConfig({
  main: {},
  preload: {
    build: { externalizeDeps: false },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), contentSecurityPolicy(), selfHostedOnnxRuntime()],
    build: {
      // The audio worklet must load from a real file; a data: URL is blocked by the CSP.
      assetsInlineLimit: 0,
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          panel: resolve(__dirname, 'src/renderer/panel/index.html'),
          voice: resolve(__dirname, 'src/renderer/voice/index.html'),
        },
      },
    },
  },
});
