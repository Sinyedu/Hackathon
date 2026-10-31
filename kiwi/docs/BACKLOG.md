# Backlog

- Windows and macOS verification of app launch, volume, tray and click-through.
- Impeccable `critique`, `polish` and `audit` runs (step 2 review was manual).
- Reload config files without restarting the app.
- Serve the renderer from a custom secure protocol so the Cache API works and the speech model is cached between launches.
- Measure wake word accuracy (17/20) and false triggers with a real microphone; try Vosk grammar mode if the Whisper path is too slow.
- Kokoro text to speech and amplitude-driven beak movement (currently driven by word boundaries).
- Spoken yes/no for confirmations.
- Verify screen description with a vision model, and screen capture on Wayland and macOS.
- Run the Claude Code backend against the real CLI on a throwaway project.
- Verify model file hashes (only the commit is pinned today).
- Test the installer and first-run wizard on a clean Windows and macOS machine.
- Spoken confirmations; sandbox location picker dialog.
