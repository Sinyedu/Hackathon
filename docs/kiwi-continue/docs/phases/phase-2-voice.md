# Phase 2 — Voice that actually responds

Goal: say "Hey Kiwi" and it reacts fast, understands, acts, and talks back. Rebuild the voice pipeline on a single, packageable engine and prove it with offline tests.

## Engine decision
Use **sherpa-onnx** through its Node addon (`sherpa-onnx-node`, Apache-2.0) as the default engine. It provides keyword spotting (wake word), VAD (Silero), streaming speech recognition, and text-to-speech including Kokoro models, all offline, and it has Electron examples. This removes Python from the voice path and makes packaging simpler. Verify current APIs and model names on the official docs before coding (see `docs/RESOURCES.md`; add https://k2-fsa.github.io/sherpa/onnx/ and https://github.com/k2-fsa/sherpa-onnx). Keep everything behind the existing ports so an engine can be swapped (for example Vosk, faster-whisper, or a cloud STT/TTS when the user supplies a key).

## Do
1. **Spike (max 45 minutes).** Prove in a throwaway branch: keyword spotting for "hey kiwi" using an open-vocabulary keyword list (the keyword is given as text, not trained), streaming ASR on a WAV, and TTS speaking a sentence, all inside an Electron `utilityProcess`. Record accuracy and latency in `docs/decisions/0004-voice-engine.md`. If something is blocked (native module packaging, model quality), record it and choose the fallback.
2. **Architecture.**
   - **Capture:** `AudioWorklet` in the renderer (not `ScriptProcessorNode`), resampled to 16 kHz mono float32, chunked (for example 100 ms), sent to the voice utility process through a `MessagePort` (no per-chunk JSON, use transferable buffers).
   - **Voice utility process:** owns KWS, VAD, ASR and TTS; emits typed events: `wake`, `speech_start`, `partial`, `final`, `speech_end`, `tts_audio`, `error`, `status`.
   - **Main process:** supervises the utility process (health check, restart on crash with backoff), routes final transcripts to the agent, forwards TTS audio to playback.
3. **State machine** (pure, tested): `idle → wake → listening → transcribing → thinking → speaking → idle` plus `cancel` from any state. Endpointing by VAD with silence thresholds, minimum and maximum length. Barge-in: if the user speaks while Kiwi is talking, stop speaking and listen.
4. **Wake word.** "Hey Kiwi" and "Kiwi" with a cooldown, a sensitivity setting, and a user-visible wake indicator (mascot ears-up plus a soft chime). Provide push-to-talk (hold a hotkey, plus a mic button) that always works regardless of the wake word.
5. **Permissions and packaging gotchas.** Request microphone access explicitly (macOS: `systemPreferences.askForMediaAccess('microphone')`, `NSMicrophoneUsageDescription` and the audio-input entitlement in the build config; Windows: handle the privacy toggle being off with a clear message). Handle device changes and the case of no microphone.
6. **Output.** TTS speaks through the persona rules (`docs/PERSONA_AND_VOICE.md`); the blip voice itself is phase 4, but the TTS port must already stream audio sentence by sentence and report amplitude for the mascot's mouth.
7. **Kill switch.** "Kiwi stop" and Esc stop audio, the model request and tools instantly.
8. **Diagnostics.** The voice diagnostic from phase 0 becomes a Settings → Voice panel: mic level meter, wake indicator, last transcript, per-stage latency from the tracer, and a "test my microphone" button with plain-language results.
9. **Offline tests.** A fixtures folder with recorded WAVs (wake phrase, commands, noise, near-miss words). A test harness feeds them through the pipeline and asserts: wake detected or not, transcript within an edit-distance threshold, no false wake in noise clips. Run via `pnpm test:voice`.

## Out of scope
Blip voice, personas, system control beyond what the fast path already does.

## Acceptance checks
- [ ] Wake hit rate at least 17 of 20 in a quiet room; at most 1 false trigger in 5 minutes of normal talk (record method and results).
- [ ] Phrase end to final transcript under 800 ms; fast command ("open github") done within 1 s of the end of speech; numbers from the tracer.
- [ ] Push-to-talk works when the wake word is off or fails.
- [ ] "Kiwi stop" and Esc halt everything within 300 ms.
- [ ] Killing the voice process restarts it automatically and Kiwi says what happened.
- [ ] `pnpm test:voice` runs offline and passes.
- [ ] A packaged build (even unsigned, `pnpm dist`) can capture the microphone on the demo OS.

## Refactor gate
One audio capture path, one voice process, ports and fakes for tests, no leftover experimental engines in production code.

## Suggested commit
`feat(voice): rebuild voice pipeline on sherpa-onnx with wake word, streaming ASR, TTS, barge-in and offline tests`
