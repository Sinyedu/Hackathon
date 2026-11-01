# Plan — step 1

1. Workspace scaffold, shared tsconfig, ESLint/Prettier/Vitest, `pnpm check`.
2. `packages/shared`: IPC channels + schemas, settings schema, layout constants.
3. `packages/core`: `computeDockPosition` with edge and multi-monitor tests.
4. Electron main (windows, controller, IPC, tray, settings, security), preload, two renderer pages.
5. electron-builder config; build an AppImage on this machine.
6. Docs, `PRODUCT.md`.

Risks: transparent windows and click-through on Linux/Wayland (forced X11 + `setShape`); sandboxed preload must be fully bundled; Impeccable `init` not run (PRODUCT.md written by hand).
