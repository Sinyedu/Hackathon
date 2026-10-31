# Kiwi

A local-first desktop assistant: an animated mascot in a corner of the screen with a chat panel docked below it. See [AGENTS.md](AGENTS.md) for product rules and [docs/steps](docs/steps) for the build plan. Current status: **step 4 (voice)**: mascot, chat panel, fast-path commands, a local model with tool calling, and voice.

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

## Models (Ollama)

Fast commands (`open github`, `search electron docs`, `timer 1 minute`, `note buy milk`, `volume down`, `undo`) need no model. Anything else uses a local model through [Ollama](https://ollama.com). Defaults are in `settings.json` (`fastModel`, `planningModel`, `ollamaUrl`):

| Hardware        | Suggested model        |
| --------------- | ---------------------- |
| under 8 GB RAM  | `qwen3:1.7b` (default) |
| 8 to 16 GB RAM  | `qwen3:4b`             |
| 16 GB+ or a GPU | `qwen3:8b`             |

```sh
ollama pull qwen3:1.7b
```

If Ollama is not running, the fast path still works and the model path tells you what to start.

## Voice

Hold the **Hold to talk** button in the panel, or press `Ctrl/Cmd+Shift+Space` (tap to talk; it stops after 0.8 s of silence). Turn on "Always listen for Hey Kiwi" under Voice settings in the panel. `Esc` or "Kiwi stop" cancels speech, the current run and any pending confirmation. A "Mic" badge shows on Kiwi whenever the microphone is open; audio is never saved.

The first time voice is used, a small Whisper model (about 40 MB) is downloaded from huggingface.co. This is the only network use outside explicit web tools. See `docs/decisions/0002-voice.md` for what was and was not measured.

## Config files

Created on first run in the app's user data folder: `apps.json` (allowed apps), `sites.json`, `commands.json` (fast-path phrases) and `settings.json`. Notes are saved to `~/KiwiSandbox/notes`; "undo" moves them to `~/KiwiSandbox/.trash`.

## Unsigned installers

Installers are not code-signed. Windows SmartScreen ("Windows protected your PC" → More info → Run anyway) and macOS Gatekeeper (right-click → Open) will warn on first launch. The Linux AppImage needs `chmod +x`.

## Known issues

- Linux: the overlay is forced onto X11 (XWayland) because native Wayland ignores window positions. Click-through uses `setShape` on Linux (mouse forwarding is only supported on macOS/Windows) and is experimental.
- Windows and macOS were not tested in step 1; only the Linux build was run.
- Placeholder app icon.
- App launch commands for Windows and macOS in `apps.json` and the volume commands (PowerShell media keys, osascript) were written from documentation and not run on those systems.
