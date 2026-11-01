# Step 1 — Foundation and skeleton

Goal: a clean monorepo with a working Electron app skeleton (two windows, typed IPC, tray, hotkey) and a packaging pipeline that produces an installer. No mascot art, no AI yet.

## Before you start (human)

- `npx impeccable install` at repo root, reload the harness.
- Tell the agent the demo OS (Windows, macOS or Linux).

## Do

1. **Monorepo scaffold**: pnpm workspaces with `apps/desktop`, `packages/core`, `packages/shared`. TypeScript strict everywhere, shared `tsconfig.base.json`, ESLint + Prettier, Vitest. Root scripts: `dev`, `build`, `dist`, `check` (typecheck + lint + format check + test).
2. **Electron app** with electron-vite: `src/main`, `src/preload`, `src/renderer`. Security: `contextIsolation`, `sandbox`, no node integration, strict CSP, deny `window.open` and navigation.
3. **Typed IPC** in `packages/shared`: channel names plus zod schemas. Preload exposes a small typed `window.kiwi` API. One example round trip (ping) with a test.
4. **Two windows**
   - `overlay`: transparent, frameless, always on top, no taskbar entry, ~200×200, draggable by a placeholder circle, click-through everywhere except the placeholder (`setIgnoreMouseEvents(true, { forward: true })` toggled on hover).
   - `panel`: frameless, hidden by default, ~380×520, shown/hidden by clicking the placeholder or the global shortcut Ctrl/Cmd+Shift+K, closes on Esc.
5. **Docking**: pure function `computeDockPosition(mascotBounds, panelSize, workArea)` in `packages/core` — panel sits centered under the mascot, flips above it near the bottom edge, clamps inside the work area. Unit tests for all edges and multi-monitor offsets. The panel follows when the overlay is dragged.
6. **App lifecycle**: single-instance lock, tray icon with Show/Hide and Quit, remember overlay position in `userData` (zod-validated settings file), quit cleanly.
7. **Packaging**: electron-builder config; `pnpm dist` produces an installer for the current OS. App name "Kiwi", placeholder icon, `appId`, no auto-update yet.
8. **Docs**: `README.md` (quickstart, scripts, unsigned-installer warning), `docs/ARCHITECTURE.md` (diagram in text, window model, IPC model), `docs/decisions/0001-stack.md`.
9. **Impeccable**: run `init` and commit `PRODUCT.md` from the product description in `AGENTS.md`. Leave `DESIGN.md` for step 2.

## Out of scope

Mascot art, chat UI beyond an empty panel, Ollama, voice, tools.

## Acceptance checks

- [ ] `pnpm install && pnpm check` passes on a clean clone.
- [ ] `pnpm dev` shows the placeholder overlay on the screen edge; hover enables dragging, elsewhere clicks pass through to windows behind.
- [ ] Clicking the placeholder or the hotkey toggles the panel docked below (or above near the screen bottom); dragging the overlay moves the panel.
- [ ] Tray Quit exits; a second launch focuses the existing instance; position persists across restarts.
- [ ] `pnpm dist` creates an installer that installs and launches.
- [ ] No file over ~200 lines; no `any`.

## Refactor gate

Re-read the diff; confirm core has zero Electron imports; confirm channel names appear only in `packages/shared`.

## Suggested commit

`feat: scaffold Kiwi desktop app with overlay and panel windows, typed IPC and installer pipeline`
