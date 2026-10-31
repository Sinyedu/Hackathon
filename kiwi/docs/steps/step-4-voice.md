# Step 4 — Voice: push-to-talk, wake word, speech in and out

Goal: talk to Kiwi. Push-to-talk first (must be rock solid), then the "Hey Kiwi" wake word, then spoken replies. Everything sits behind ports so engines can be swapped.

## Do

1. **Time-boxed spike (max 30 minutes)**: evaluate options for each port in Electron, then write `docs/decisions/0002-voice.md` with the choice and the reason.
   - Wake word: Vosk with a restricted grammar (["hey kiwi", "kiwi", "[unk]"]) in WASM or a sidecar; fallback Silero VAD plus a tiny Whisper model with fuzzy matching on kiwi / kivi / keewee.
   - Speech to text: faster-whisper (sidecar) or a JS/WASM Whisper; pick what runs in real time on the demo machine.
   - Text to speech: Kokoro (e.g. `kokoro-js`) with the OS `speechSynthesis` as fallback.
   - If a sidecar process is needed, Electron starts and supervises it, with health checks, restart and clean shutdown; document how it ships in the installer.
2. **Ports and fakes** in core: `WakeWordPort`, `SpeechToTextPort`, `TextToSpeechPort`, `AudioInputPort`, with fake implementations for tests.
3. **Push-to-talk**: hold-to-talk hotkey and a mic button in the panel. Records until release (or 0.8 s of silence in tap-to-talk mode), transcribes, shows the transcript in the bubble and chat, sends it to the agent.
4. **Endpointing**: pure function for silence detection with unit tests (thresholds, minimum length, maximum length 12 s).
5. **Wake word**: always-on local detection of "hey kiwi" / "kiwi" with cooldown to avoid retriggers and a setting to turn it off. After detection: chime, mascot `listening`, record the command, same pipeline as push-to-talk.
6. **Spoken replies**: speak assistant replies sentence by sentence (keep replies to 1–2 short sentences), mascot `speaking` with `mouthOpen` driven by audio amplitude, subtitles in the bubble, interruptible.
7. **Kill switch**: "Kiwi stop" and Esc cancel audio, the agent run and any pending tool at once.
8. **Privacy**: visible mic indicator on the mascot whenever audio is being captured; audio is never written to disk; only command transcripts are kept locally. Permission flow for microphone access with a clear message if denied; input device picker in settings.
9. **Debug panel** (dev only): per-stage latency for wake, speech to text, agent, text to speech.

## Out of scope

Research, screenshots, file sorting, coding delegation, first-run wizard.

## Acceptance checks

- [ ] Push-to-talk "open github" opens GitHub; "set a timer for one minute" starts a timer.
- [ ] Wake word triggers at least 17 of 20 times in a quiet room at normal speaking volume, and fewer than 2 false triggers in 5 minutes of ordinary speech; results recorded in `docs/decisions/0002-voice.md`.
- [ ] Spoken reply starts within 3 seconds after the transcript on the model path and within 1 second on the fast path (measured).
- [ ] "Kiwi stop" and Esc stop everything immediately.
- [ ] Mic indicator is always correct; nothing is written to disk except transcripts.
- [ ] If a voice engine is missing or crashes, Kiwi falls back (OS speech, push-to-talk only) and says so; text chat always works.

## Refactor gate

Voice code lives in `voice/` with one file per engine adapter; no engine details leak into core; supervision code is separate from audio code.

## Suggested commit

`feat(voice): add push-to-talk, wake word, speech-to-text and spoken replies behind ports`
