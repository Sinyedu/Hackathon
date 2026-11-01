# Phase 7 — Packaging and release: a real installer

Goal: someone with a normal computer downloads one file, double-clicks it, goes through a short first-run, and Kiwi works. No terminal, no dev tools.

## Do
1. **One app, one process tree.** Follow ADR 0003. Preferred: everything in Electron (main process plus `utilityProcess` for voice and heavy work). If a Python backend remains: build it into a single executable with PyInstaller, place it under electron-builder `extraResources`, and start it from the main process on a random loopback port with a per-launch auth token, health checks, restart on crash, and clean shutdown on quit. The renderer never talks to a fixed port or to the network for local features. Remove every dev-server dependency from the production build.
2. **electron-builder config.** Targets: Windows NSIS installer, macOS DMG (plus ZIP), Linux AppImage. `asarUnpack` for native modules (for example `sherpa-onnx-node` and its platform packages) and any binaries; correct `files` and `extraResources`; app id, name, icons, file associations not needed. Verify native modules load from the packaged app on each target.
3. **First run wizard.** Welcome → choose how Kiwi thinks (local or my API key) → provider setup and test → microphone permission and test → hotkey → optional permissions (accessibility, screen recording) → download voice and model files with progress, resume and checksum verification into `userData` → self-test ("Hey Kiwi, open GitHub") → done. Models are never bundled in the installer.
4. **App behavior.** Single instance, tray menu (Show, Mute, Pause wake word, Settings, Quit), optional launch at login, graceful quit, safe upgrades that keep settings, keys and memory. Clean uninstall removes the app and offers to remove user data.
5. **Signing and trust.** Installers are unsigned unless certificates exist. Document the Windows SmartScreen and macOS Gatekeeper warnings and how to proceed. If a certificate is available: Windows code signing, macOS signing and notarization (hardened runtime plus entitlements for audio input and any needed capabilities). Check electron-builder docs for current settings.
6. **Auto-update (optional).** `electron-updater` with a signed feed, behind a setting; skip if signing is not available.
7. **Diagnostics and crashes.** Local logs with rotation, a "Copy diagnostics" button (no keys, no audio, no transcripts unless the user opts in), crash handling that restarts the voice process and the mascot.
8. **Clean-machine test.** On a fresh VM or second computer with no dev tools: install, first run, voice, a cloud-key session, a local-model session, system control scenarios, a coding session, uninstall. Record results in `docs/QA_CHECKLIST.md`, with the machine specs.
9. **Docs.** `README.md` (what Kiwi is, install steps, first run, permissions, privacy, known issues), `docs/DEMO.md` (exact demo script, rehearsal checklist, backup plan), `docs/ARCHITECTURE.md` updated to the final structure, installer size and startup numbers recorded.

## Acceptance checks
- [ ] `pnpm dist` produces installers for the demo OS; a clean machine installs and runs Kiwi without developer tools.
- [ ] Microphone, voice, local model and cloud-key flows all work from the installed app.
- [ ] Startup and idle budgets still met in the packaged build (measured).
- [ ] No fixed ports, dev servers or absolute developer paths in the packaged app (checked with a script).
- [ ] Uninstall is clean; reinstall keeps settings when the user chooses to.
- [ ] `QA_CHECKLIST.md` completed with evidence; known issues listed honestly.

## Suggested commit
`build: package Kiwi as a standalone installer with first-run setup, model download manager and release docs`
