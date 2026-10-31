import { resolve } from 'node:path';
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
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; worker-src 'self' blob:; style-src 'self'; img-src 'self' data:; connect-src 'self' blob: https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net";
const DEV_VOICE_CSP = `${VOICE_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")}; connect-src 'self' ws: blob: https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net`;

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

export default defineConfig({
  main: {},
  preload: {
    build: { externalizeDeps: false },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), contentSecurityPolicy()],
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
