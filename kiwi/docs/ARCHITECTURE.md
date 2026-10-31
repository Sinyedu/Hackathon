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

## Agent (step 3)

```
user text -> Agent.run
               |-- "undo"            -> journal inverse (no confirmation)
               |-- router (JSON)     -> one tool call           (fast path, no model)
               '-- model loop (<=5)  -> Ollama tool calls       (LlmClient port)
                          each call: zod validate -> confirm if write -> execute -> journal -> receipt
```

- `packages/core` holds the agent, router, tools (`tools/*.ts`, one registry), safety policy and reducers. It only knows ports: `LlmClient`, `ConfirmationPort`, `PlatformPort`, `ActionJournal`.
- `apps/desktop/src/main/adapters/` implements them: Ollama HTTP client, Electron platform (launcher, volume, sandbox notes, timers, clipboard), confirmation bridge.
- The agent emits `AgentEvent`s only (`packages/shared`). Main broadcasts them to both windows; `reduceChat` builds the chat list and `mascotEventsFor` + `reduceMascot` drive the mascot.
- Config files in `userData`: `settings.json`, `apps.json`, `sites.json`, `commands.json`. Created from defaults, validated with zod; an invalid file falls back to defaults and says so in the chat.
- Safety: allowlisted apps only, http/https only, notes only inside `~/KiwiSandbox` (symlinks resolved, "delete" = `.trash`), write tools need Yes, tool results are fenced as untrusted data.

## Voice (step 4)

A hidden `voice` window owns the microphone, Whisper (worker) and speech synthesis. `VoiceSession` in core ties them together through ports (`AudioInputPort`, `SpeechToTextPort`, `TextToSpeechPort`); it contains the endpointing, VAD segmenter, wake-phrase parser and spoken-reply logic, all unit-tested with fakes. The window sends commands to the agent with `chat.send`, reports `VoiceEvent`s that main relays to the overlay (mic badge, listening ring, beak) and panel (settings, engine notes, latency debug line in dev), and receives `VoiceCommand`s from main (push-to-talk, hotkey, stop, configure). `stopAll` cancels the agent, pending confirmations and audio together.
