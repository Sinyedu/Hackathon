# 0002 — Voice

Status: accepted (engines partly verified, see Results)

## Choices

| Port           | Engine                                                                                                   | Why                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Audio input    | `getUserMedia` + `AudioWorklet` at 16 kHz in a hidden voice window                                       | No native module; audio stays in memory                                                                            |
| Speech to text | Whisper tiny.en (`onnx-community/whisper-tiny.en`, q8) via Transformers.js in a worker, WebAssembly      | Runs in the renderer with no sidecar; model downloaded once from huggingface.co                                    |
| Wake word      | Energy VAD cuts utterances, the same Whisper model transcribes them, fuzzy match on kiwi / kivi / keewee | The documented fallback; Vosk grammar mode was not tried (30 minute spike spent on the Whisper path, which worked) |
| Text to speech | OS `speechSynthesis`                                                                                     | Kokoro was not attempted; the port allows swapping it in later                                                     |

Global shortcuts have no key-up event, so the global hotkey is tap-to-talk (ends after 0.8 s of silence) and hold-to-talk is the mic button in the panel.

## Results (this machine: Linux, CPU only, synthetic speech)

Tested by feeding speech synthesized with espeak-ng to Chromium's fake microphone, wake word on:

- "Hey Kiwi, what time is it" was heard as "what's time is it" and "what time is it"; both ran the agent and returned the time. The pipeline from microphone to receipt works.
- Speech to text for a 3 second utterance took about 1.4 to 1.8 s (first call included). Wake detection adds no extra model call.
- **Not measured:** the 17 of 20 wake rate with a real voice, false triggers over 5 minutes of ordinary speech, and spoken reply latency (this machine has no system voice, so the app reported text to speech as unavailable). These need a person with a microphone.
- Esc and "Kiwi stop" are covered by unit tests against fakes; not timed on real audio.

## Known issues

- The Cache API is unavailable on `file://`, so the model files are probably re-downloaded each launch (a cache warning was logged). Fix: serve the renderer from a custom secure protocol. Logged in `docs/BACKLOG.md`.
- The echo of Kiwi's own speech reaches the microphone while it talks; wake parsing ignores it, but an acoustic echo test was not done.

## Privacy

A mic indicator shows on the mascot whenever audio is being captured. Audio is never written to disk. Only the transcript is sent to the agent.

## Fallbacks

Mic denied or missing: a message appears in the panel and text chat works. No system voice: replies stay on screen. Speech model fails to load: the panel says so and push-to-talk is unavailable until it loads, text chat still works.
