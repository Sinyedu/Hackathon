# Install Kiwi on Windows

This is the normal Windows installation path for the Kiwi desktop companion.

## Install

1. Double-click the newest `frontend/release/Kiwi-Setup-*.exe`.
2. If SmartScreen appears, select **More info** and then **Run anyway**. This local build is unsigned; the warning is about publisher verification.
3. Choose where Kiwi should be installed, then select **Install**.
4. Leave **Launch Kiwi** selected on the final page. Kiwi starts as soon as setup finishes.

The installer is per-user and self-contained. After installation, Kiwi does not need Node.js, pnpm, Python, the repository, a browser dev server or a separate backend process. The installer creates:

- a **Kiwi** entry in the Windows Start menu;
- a desktop shortcut;
- an uninstaller in **Windows Settings → Apps → Installed apps**.

## Start, hide and quit

- Start Kiwi from **Start → Kiwi**, the desktop shortcut, or a taskbar shortcut.
- To pin it to the bottom taskbar, open Start, right-click **Kiwi**, and choose **Pin to taskbar**. Windows controls taskbar pinning, so the installer does not force a pin.
- Kiwi normally stays as a small mascot near the bottom-right corner. Click the mascot to open the command panel.
- The `X` in the panel hides the panel and leaves the mascot running.
- To fully close Kiwi, right-click the Kiwi icon in the Windows notification area/system tray and choose **Quit Kiwi**. The tray menu also provides **Talk to Kiwi**, **Stop / cancel**, and **Pause microphone**.

## First run

1. Allow microphone access if Windows asks. If hands-free commands do not work, check **Settings → Privacy & security → Microphone** and allow desktop apps to use the microphone.
2. Wait for the status to show **Hey Kiwi · mic on**.
3. Say **Hey Kiwi**, pause briefly, then speak a short command. You can also click the mascot and type a command.
4. If Kiwi says the speech model is missing, open Settings and use **Download speech model**. That model is stored in your user data and is not bundled into the installer.

Direct commands such as opening a known site or app work without Ollama. Optional model-backed features need Ollama with `qwen3:1.7b`, or a compatible provider configured in Kiwi Settings.

## Uninstall and updates

Uninstall Kiwi from **Settings → Apps → Installed apps → Kiwi → Uninstall**. Close Kiwi from the tray first if Windows says the app is still running. Removing the app removes the installed program and shortcuts; user settings and downloaded models are kept so a later reinstall can reuse them.

To update, close Kiwi, run the newer `Kiwi-Setup-*.exe`, and choose the same install location. The installer keeps the existing per-user settings.

## Build the installer from the repository

From PowerShell at the repository root:

```powershell
cd frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd dist:installer
```

The installer is written to `frontend/release/Kiwi-Setup-<version>.exe`. `pnpm.cmd dist` builds both the installer and the portable fallback.

The current release targets Windows x64 and is unsigned. A production release should be code-signed before distribution so Windows can verify the publisher.
