import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'";
// The dev server needs inline scripts and a websocket for hot reload.
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:";

function contentSecurityPolicy(): Plugin {
  return {
    name: 'kiwi-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const policy = context.server ? DEV_CSP : STRICT_CSP;
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
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          panel: resolve(__dirname, 'src/renderer/panel/index.html'),
        },
      },
    },
  },
});
