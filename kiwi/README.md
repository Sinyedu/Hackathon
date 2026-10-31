# Kiwi

A local-first research and note-taking assistant for your desktop: an animated mascot in a corner of the screen with a chat panel docked below it. See [AGENTS.md](AGENTS.md) for product rules and [docs/steps](docs/steps) for the build plan. Current status: **step 5**: mascot, chat panel, fast-path commands, a local model with tool calling, voice, research, screen description, sandbox file sorting, optional code delegation, first-run setup.

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

## What Kiwi can do

Type or say (examples): `open github`, `open a new tab`, `search electron docs`, `search youtube lofi`, `timer 5 minutes`, `note buy milk`, `volume down`, `what time is it`, `research electron ipc best practices`, `what's on my screen`, `explain this error`, `clean up my downloads`, `weather in Sofia`, `convert 5 km to miles`, `calculate 12 * (3 + 4)`, `translate good morning to french`, `define serendipity`, `undo`. You can also chain simple actions, for example `open a new tab and then open github`. Anything else goes to the local model.

Every action shows a receipt line (DONE, PLANNED, FAILED, UNDONE). Changing files, typing text or looking at the screen asks for Yes first. Files only ever change inside `~/KiwiSandbox`; "delete" means `.trash`. On first run the app seeds `~/KiwiSandbox/Downloads` with fake empty demo files.

Screen description needs a vision model: `ollama pull gemma3:4b` (about 3 GB). Code delegation is off by default; turn it on in Settings and read the note about proprietary models first. See `docs/DEMO.md` for the demo script.

## Voice

Hold the **Hold to talk** button in the panel, or press `Ctrl/Cmd+Shift+Space` (tap to talk; it stops after 0.8 s of silence). Turn on "Always listen for Hey Kiwi" under Voice settings in the panel. `Esc` or "Kiwi stop" cancels speech, the current run and any pending confirmation. A "Mic" badge shows on Kiwi whenever the microphone is open; audio is never saved.

The first time voice is used, a small Whisper model (about 40 MB) is downloaded from huggingface.co. This is the only network use outside explicit web tools. See `docs/decisions/0002-voice.md` for what was and was not measured.

## Config files

Created on first run in the app's user data folder: `apps.json` (allowed apps), `sites.json`, `commands.json` (fast-path phrases) and `settings.json`. Notes are saved to `~/KiwiSandbox/notes`; "undo" moves them to `~/KiwiSandbox/.trash`.

## Installing

Download the installer for your system from the release, run it, start Kiwi, and follow the setup wizard (it checks for Ollama and offers to download models). Logs are in the app's user data folder under `logs/kiwi.log` and never contain audio or screenshots.

## Unsigned installers

Installers are not code-signed. Windows SmartScreen ("Windows protected your PC" → More info → Run anyway) and macOS Gatekeeper (right-click → Open) will warn on first launch. The Linux AppImage needs `chmod +x`.

## Known issues

- Linux: the overlay is forced onto X11 (XWayland) because native Wayland ignores window positions. Click-through uses `setShape` on Linux (mouse forwarding is only supported on macOS/Windows) and is experimental.
- Windows and macOS were not tested in step 1; only the Linux build was run.
- Screen description, real Claude Code delegation, the setup wizard and the installer were not exercised on a clean machine. Screen capture on Wayland and on macOS (needs Screen Recording permission) is untested.
- App launch commands for Windows and macOS in `apps.json` and the volume commands (PowerShell media keys, osascript) were written from documentation and not run on those systems.
