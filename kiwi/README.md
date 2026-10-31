# Kiwi

A local-first desktop assistant: an animated mascot in a corner of the screen with a chat panel docked below it. See [AGENTS.md](AGENTS.md) for product rules and [docs/steps](docs/steps) for the build plan. Current status: **step 1 (foundation)** — placeholder mascot, empty panel, typed IPC, packaging.

## Quickstart

Requires Node 22.12+ and pnpm.

```sh
pnpm install   # also downloads the Electron binary
pnpm dev       # overlay + panel with hot reload
pnpm check     # typecheck + lint + format check + tests
pnpm build     # production build into apps/desktop/out
pnpm dist      # installer for the current OS in apps/desktop/release
```

Use: click or drag the green circle; click it or press `Ctrl/Cmd+Shift+K` to toggle the panel; `Esc` closes it; the tray icon has Show/Hide and Quit.

## Unsigned installers

Installers are not code-signed. Windows SmartScreen ("Windows protected your PC" → More info → Run anyway) and macOS Gatekeeper (right-click → Open) will warn on first launch. The Linux AppImage needs `chmod +x`.

## Known issues

- Linux: the overlay is forced onto X11 (XWayland) because native Wayland ignores window positions. Click-through uses `setShape` on Linux (mouse forwarding is only supported on macOS/Windows) and is experimental.
- Windows and macOS were not tested in step 1; only the Linux build was run.
- Placeholder icon and mascot; real art arrives in step 2.
