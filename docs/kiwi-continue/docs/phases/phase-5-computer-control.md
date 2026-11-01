# Phase 5 — Computer control

Goal: Kiwi operates the machine like a capable assistant: apps, windows, tabs, theme, music, volume, notifications, screenshots, clipboard. Everything permissioned, logged and, where possible, undoable.

## Do
1. **`SystemControl` port** with one implementation per OS (`win32`, `darwin`, `linux`) selected at startup, each reporting a capability map. Unsupported actions return a typed "not supported on this OS" result that Kiwi says in one sentence.
2. **Capabilities** (each is a tool with a schema, risk tier and undo where meaningful):
   - **Apps:** open an allowlisted app (editable `apps.json`, plus an "add app" flow), focus, quit with confirmation.
   - **Windows:** list windows, focus, minimize, maximize, snap left/right, move to another monitor, close with confirmation. Windows: use a small, well-maintained native helper or PowerShell with the Win32 API; macOS: AppleScript via `osascript` (needs Accessibility permission); Linux: `wmctrl` or `xdotool` on X11, with a clear "limited on Wayland" message.
   - **Browser tabs:** open URLs and searches in the default browser, open several at once. Reading or closing tabs is out of scope unless a browser extension is added later.
   - **Theme:** toggle or set dark/light. Windows: registry values for apps and system theme; macOS: `osascript` appearance preference; Linux: `gsettings` for GNOME or the desktop's equivalent.
   - **Volume and media:** set, mute, media keys (play/pause/next/previous).
   - **Music:** "play X": open the Spotify app via its URI scheme and search, or open YouTube Music/YouTube search in the browser; media keys to control playback. A real Spotify Web API integration (OAuth, Premium needed) is a later add-on.
   - **Screen:** screenshot, "what's on my screen" (vision model, cloud only with explicit opt-in), clipboard read/write.
   - **Utilities:** timers, reminders (`.ics`), notes (sandbox), Do Not Disturb if the OS exposes it.
3. **Permissions flows.** Guided prompts for macOS Accessibility and Screen Recording, Windows privacy settings where relevant, with a "check permissions" screen. Kiwi explains what is missing and offers to open the right settings page.
4. **Trust and undo.** Every tool declares a risk tier (see `docs/SECURITY_AND_TRUST.md`); levels decide confirmation. Reversible actions (theme, volume, window moves) record their inverse and "undo that" works.
5. **Scenarios** (end-to-end tests with fakes plus a manual checklist on the demo OS): "switch to dark mode", "open Spotify and play lo-fi", "snap this window to the left", "open GitHub, YouTube and my docs in tabs", "turn the volume down", "take a screenshot and describe it", "set a 25 minute timer".
6. **Reliability.** Each adapter has timeouts, clear errors, and never blocks the UI. Detect when an app is not installed and offer the browser alternative.

## Out of scope
Coding mode, packaging.

## Acceptance checks
- [ ] Every scenario above works on the demo OS and degrades with a clear message on the others.
- [ ] Dark/light toggle and window snapping work within 1 s and can be undone.
- [ ] Permission-missing states produce helpful guidance, not silent failure.
- [ ] No tool runs arbitrary shell strings from the model; all commands are fixed templates with validated parameters (test included).
- [ ] The action log shows every call and its result.

## Suggested commit
`feat(system): add cross-platform system control for apps, windows, theme, music, volume and screen with permissions and undo`
