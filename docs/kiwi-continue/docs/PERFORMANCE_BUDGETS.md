# Performance budgets

Measure on the demo laptop and on one low-spec machine. Adjust numbers after phase 0 if a budget is unrealistic, but record the reason in an ADR. A budget is only real if there is a command that measures it.

## Targets

| Area | Metric | Budget |
|---|---|---|
| Startup | App launch to mascot visible | under 2 s |
| Startup | Launch to "ready" (wake word armed, provider connected) | under 5 s |
| Idle | CPU with mascot idle and wake word armed | under 5% of one core |
| Idle | Memory, all Kiwi processes together, excluding LLM | under 600 MB |
| Mascot | Frame rate while animating | 60 fps, no dropped frames in 10 s |
| Mascot | Idle animation | paused or at most 30 fps; none when the window is hidden |
| UI | Keystroke to echo in the chat input | under 50 ms |
| UI | Longest main-thread task | under 50 ms |
| Wake word | Phrase end to chime | under 300 ms |
| Speech in | End of speech to final transcript | under 800 ms |
| Fast command | End of speech to action done ("open github") | under 1 s |
| Model reply | End of speech to first spoken blip or word, cloud provider | under 1.5 s |
| Model reply | Same, local small model | under 3 s |
| Voice quality | Wake word hit rate, quiet room, 20 tries | at least 17 |
| Voice quality | False wake triggers in 5 minutes of normal talk | at most 1 |

## How to measure
- **Tracer:** a tiny module that writes JSON lines to `userData/logs/trace.jsonl` with `{ts, span, durationMs, requestId}`. Spans: `wake`, `capture`, `asr`, `route`, `llm_first_token`, `tool`, `tts_first_audio`, `render`. Every voice request carries one `requestId` end to end.
- **Main process:** `app.getAppMetrics()` sampled every 5 s in a dev-only panel (CPU, memory per process).
- **Renderer:** Chrome DevTools Performance recording of 10 s idle and 10 s active; check long tasks and the Layers/paint cost of the mascot.
- **Startup:** log `performance.now()` marks at `app ready`, `windows created`, `mascot painted`, `voice armed`, `provider ready`.
- **Repeatability:** a script `pnpm bench` runs the fast-command and WAV-fixture voice tests and prints the table above.

## Usual suspects to check first
- SVG filters (glow, blur, drop-shadow) on a transparent always-on-top window, especially if animated. Prefer a pre-rendered glow or a cheap `box-shadow`, animate only `transform` and `opacity`, use `will-change` sparingly.
- Animation loops that keep running when the window is hidden, or `setInterval` polling.
- Models loaded per request instead of once; no warm-up; huge prompts; no streaming.
- Heavy work in the renderer; synchronous IPC; chatty IPC with large payloads.
- `ScriptProcessorNode` or audio at the wrong sample rate; main-thread audio processing.
- Background throttling of hidden windows breaking timers and audio.
- Multiple copies of the same backend running; a dev server proxy left in production.
