# Kiwi

Kiwi is a tiny local-first desktop companion for Windows. It lives above the taskbar, follows your cursor with its eyes, listens for **“Hey Kiwi”**, and runs a small set of safe, explicit desktop actions.

The important idea: Kiwi is friendly and useful without being unrestricted. It never treats speech or model output as a shell command, and consequential actions stay visible and bounded.

## Install Kiwi on Windows

Use the installer for a normal app installation:

1. Open the newest `frontend/release/Kiwi-Setup-*.exe`.
2. If SmartScreen appears, choose **More info → Run anyway**. These local builds are unsigned.
3. Choose an install folder and finish the wizard.
4. Leave **Launch Kiwi** selected on the last page.

The installer is per-user and self-contained. It creates a Start-menu entry, a desktop shortcut, and an uninstaller under **Settings → Apps → Installed apps**. It does not require Node.js, pnpm, Python, this repository, or a browser dev server after installation.

Want Kiwi on the bottom taskbar? Open Start, right-click **Kiwi**, and choose **Pin to taskbar**. Windows controls taskbar pinning.

For the complete install, update, uninstall, and first-run guide, see [docs/INSTALL.md](docs/INSTALL.md).

## Start and use Kiwi

- Start it from **Start → Kiwi**, the desktop shortcut, or the pinned taskbar icon.
- Click the mascot to open the command panel. Click `X` to hide the panel while leaving Kiwi running.
- Right-click the Kiwi icon in the notification area/system tray for **Talk to Kiwi**, **Stop / cancel**, **Pause microphone**, **Hide Kiwi**, and **Quit Kiwi**.
- `Ctrl+Shift+Space` opens Kiwi and toggles microphone recording.
- `Ctrl+Shift+.` stops speech and cancels the active request. `Esc` also stops a request in the panel.

### Voice

Say **“Hey Kiwi”**, pause for the speaker animation, then speak a short command. You can also say **“Hey Kiwi, open GitHub”** in one sentence or type into the panel.

On first voice use, Windows may ask for microphone permission and Kiwi may need its small English speech model. Open **Settings → Download speech model**. The model is cached in your user data and is not bundled into the installer.

If you prefer not to use the microphone, turn off **Listen for “Hey Kiwi”** in Settings or choose **Pause microphone** from the tray.

## Commands to try

| Say or type | Result |
| --- | --- |
| `open GitHub` | Opens a known, allow-listed HTTPS site. |
| `open GitHub and YouTube` | Opens multiple known sites. |
| `open calculator` | Launches an allow-listed Windows app. |
| `open a new tab in Firefox` | Opens Firefox when it is installed. |
| `search for pizza recipes` | Opens a Google search. |
| `play lo-fi` | Opens a YouTube Music search. |
| `volume down`, `mute`, `pause music` | Sends the matching media action. |
| `switch to dark mode` | Changes the Windows light/dark preference. |
| `set a 5 minute timer` | Creates a local timer notification. Kiwi must stay running. |
| `what time is it` | Shows the local computer time. |
| `build a coffee shop landing page` | Starts the bounded, confirmation-based page builder. |
| `Kiwi stop` | Cancels active work. |

Direct commands work without a model. Optional conversational and page-building features use Ollama with `qwen3:1.7b`, or a compatible provider configured in Settings. Kiwi does not speak replies; completed actions appear in the panel.

## Privacy and safety

- API keys are kept in Electron safe storage and are never returned to the renderer.
- Microphone audio is used for input and is not saved during normal operation.
- Desktop control is limited to named, validated actions. Kiwi does not expose arbitrary PowerShell, password entry, unrestricted file deletion, or autonomous sending/purchasing.
- Cloud mode is only used for the bounded website-drafting feature when you configure a provider. Screenshots, clipboard contents, and microphone audio are not sent to it.

## Troubleshooting

**Kiwi does not appear:** launch it again from Start, then check the notification area. If an old instance is stuck, choose **Quit Kiwi** from its tray menu or end Kiwi from Task Manager.

**The mascot is visible but does not hear you:** allow desktop microphone access in **Windows Settings → Privacy & security → Microphone**, confirm Windows has an English speech component, and make sure the tray is not paused.

**Speech is inaccurate:** say the wake phrase first, pause briefly, and use short commands. Kiwi shows provisional words because Windows speech can revise them; the final command is checked locally before it runs.

**Ollama is unavailable:** direct commands still work. For optional model features, install Ollama and run `ollama pull qwen3:1.7b`, or configure a compatible provider in Settings.

**Windows warns about the publisher:** this is an unsigned local build. Verify that the installer came from this repository, then choose **More info → Run anyway**.

For a startup error log, inspect `%APPDATA%\Kiwi\logs\startup.log`.

## Build the desktop app

From PowerShell at the repository root:

```powershell
cd frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd test
pnpm.cmd test:desktop
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd desktop
```

Build a Windows installer with:

```powershell
cd frontend
pnpm.cmd dist:installer
```

Build both the installer and portable fallback with `pnpm.cmd dist`. Release files are written to `frontend/release/`. The current release target is Windows x64 and is unsigned.

More detail lives in [docs/INSTALL.md](docs/INSTALL.md), [docs/DEMO.md](docs/DEMO.md), and [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md). Product boundaries and security rules are in [AGENTS.md](AGENTS.md).

## DockProof development workspace

This repository also contains the DockProof delivery-reconciliation prototype. It is a separate development workflow and is not included in the standalone Kiwi installer.

```powershell
python scripts/dev.py setup
python scripts/dev.py doctor
python scripts/dev.py
```

The browser workflow runs at `http://localhost:5173` and uses FastAPI on port `8000`. See [AGENTS.md](AGENTS.md) for the MVP contract and [docs/MAP.md](docs/MAP.md) for the current architecture.
