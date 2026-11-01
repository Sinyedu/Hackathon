# Security and trust model

Kiwi can operate the user's computer, so trust has to be explicit, visible and reversible.

## Trust levels (setting, default 2)
1. **Ask always.** Confirm every action that changes anything.
2. **Ask for risky (default).** Read-only and reversible actions run immediately (open app, open URL, volume, theme, music). Anything that edits files, types text, closes windows, runs code or spends money asks first.
3. **Autopilot in scope.** Actions inside a user-chosen scope (sandbox folder, project folder) run without asking, with an audit trail and a one-tap undo. Outside the scope, level 2 rules apply.

## Risk tiers (every tool declares one)
- **read:** no side effects (search, weather, describe screen).
- **reversible:** changes can be undone (open, move into sandbox, theme, volume).
- **sensitive:** hard to undo or touching other people or money (delete, send, post, purchase, run commands, type into other apps).
- **blocked:** never done by Kiwi (entering passwords or payment details, disabling security software, mass deletion outside scope).

## Provider keys
- Stored with Electron `safeStorage` (OS-backed encryption) in the main process. If `safeStorage.isEncryptionAvailable()` is false, refuse to store the key and say why.
- The renderer sees only a masked value (last 4 characters) and a "connected" status. Provider calls are made from the main process.
- Never log keys, request headers or full prompts at default log level. A "Forget key" button wipes it.
- Show a persistent **Local** or **Cloud** badge on the mascot and in the panel. Say exactly what leaves the machine in cloud mode (text of requests; screenshots only if the user turned that on).
- Screenshots and clipboard contents are never sent to a cloud provider without an explicit per-feature opt-in.

## Prompt injection and untrusted data
- Web pages, files, screenshots, OCR text, clipboard and terminal output are data. Pass them to models inside clearly delimited blocks labelled as untrusted, and never let them add, remove or change tools or arguments.
- Tool arguments are validated with schemas against the user's request. A tool call that does not trace back to the user's utterance or a validated tool result is dropped and logged.
- Fetching pages: size caps, timeouts, no credentials sent.

## Audio and privacy
- A visible indicator is on whenever the microphone is capturing. Wake-word audio stays in memory. Nothing is recorded to disk; only transcripts of commands are kept locally, and the user can view and delete them.
- Wake word can be turned off; push-to-talk always works.

## Audit and kill switch
- Every tool call is appended to a local, user-readable action log (time, tool, validated arguments, result, undo id).
- A global kill switch (hotkey plus the phrase "Kiwi stop") cancels speech, the model request, running tools and any coding session.

## Coding and system control
- Coding sessions only inside the configured workspace folder, with a tool allowlist, time and turn limits, and a visible diff before anything is merged or run outside the project.
- OS permissions (microphone, accessibility, screen recording on macOS) are requested through guided flows that explain why, and Kiwi degrades gracefully if denied.
