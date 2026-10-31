# Architecture

```
            packages/shared  (zod schemas, IPC channel names, layout constants)
                 ^      ^
                 |      |
 packages/core --+      +-- apps/desktop
 (pure logic:               main/     Electron main process, adapters, window wiring
  computeDockPosition)      preload/  typed bridge: window.kiwi
                            renderer/ overlay/ (mascot) and panel/ (chat), React
```

`core` never imports Electron or anything from `apps/`.

## Window model

- **overlay**: 200×200, transparent, frameless, always on top, no taskbar entry. Only the mascot circle takes mouse input: on macOS/Windows via `setIgnoreMouseEvents(true, { forward: true })` toggled on hover, on Linux via `setShape`.
- **panel**: 380×520, frameless, hidden by default. Toggled by clicking the mascot or `Ctrl/Cmd+Shift+K`; `Esc` hides it. Position is `computeDockPosition(overlayBounds, PANEL_SIZE, workArea)` and is recomputed while the overlay is dragged.
- `mascot-controller.ts` owns the relationship between the two; `ipc.ts` only validates and forwards.

## IPC model

Channel names and payload schemas live in `packages/shared/src/ipc.ts` only. The preload exposes `window.kiwi` (`KiwiApi`). Main validates every payload with zod and ignores messages from webContents that are not its own windows. Window flags: `contextIsolation`, `sandbox`, no node integration, CSP per page, `window.open` denied, navigation blocked.

## Persistence

`settings.json` in `userData`, validated by `settingsSchema` (currently the overlay position). Invalid files fall back to defaults with a console warning.
