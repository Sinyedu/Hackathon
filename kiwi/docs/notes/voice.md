# Voice notes

- Transformers.js 4.3 (`@huggingface/transformers`): `pipeline('automatic-speech-recognition', model, { dtype: 'q8', device: 'wasm' })`, call it with a 16 kHz `Float32Array`; output `{ text }`. `env.allowLocalModels = false` in the browser. The model files come from huggingface.co on first use.
- Chromium test flags used for the verification runs: `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=<wav>`.
- `AudioContext({ sampleRate: 16000 })` resamples the microphone for us; an AudioWorklet posts 40 ms frames.
- `speechSynthesis.getVoices()` can be empty on Linux without speech-dispatcher; the app then reports it and keeps replies on screen.
- Global shortcuts have no key-up event, so the global hotkey is tap-to-talk (ends on 0.8 s of silence). Hold-to-talk is the mic button in the panel.
