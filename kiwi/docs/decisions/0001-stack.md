# 0001 — Stack

Status: accepted

- pnpm workspaces: `apps/desktop`, `packages/core`, `packages/shared`.
- Electron + electron-vite + React for the app; strict TypeScript everywhere.
- zod validates every boundary (IPC payloads, settings file, later tool arguments and model output).
- Vitest for tests; ESLint (typescript-eslint strict) + Prettier; electron-builder for installers.
- TypeScript is pinned to 6.0 because typescript-eslint does not yet support 7.
- Workspace packages are consumed as TypeScript source and bundled by electron-vite (main, preload and renderer); the preload is fully bundled so it works under `sandbox: true`.
- On Linux the app forces `ozone-platform=x11`, see README known issues.
