# Phase 1 — Performance and stability

Goal: Kiwi feels instant and light. Meet the budgets in `docs/PERFORMANCE_BUDGETS.md` for startup, idle, mascot and UI.

## Do
Work through `docs/audit/AUDIT.md` in ranked order. Fix root causes, not symptoms. Typical items:

1. **Mascot rendering.** The overlay is a small fixed-size transparent window. Replace expensive live filters (glow, blur, drop-shadow on SVG) with a cheap approach: pre-rendered glow layer or a single static `box-shadow`/`drop-shadow` on a small element. Animate only `transform` and `opacity`. Stop all animation when the window is hidden or the screen is idle. Cap idle animation to 30 fps or less. Use `prefers-reduced-motion`.
2. **Process model.** Heavy work (audio, speech models, LLM streaming, file scans, web fetches) off the renderer main thread, in the main process asynchronously or a `utilityProcess`. No synchronous IPC. IPC payloads small and batched; stream tokens as small events.
3. **Startup.** Create the mascot window first and paint immediately; load everything else lazily; show a "waking up" animation while warming up. Warm models in the background (one tiny request) without blocking the UI. Lazy-load the settings and gallery screens.
4. **Model calls.** Keep connections open, stream responses, trim context (system prompt plus last N turns plus a memory summary), cache static prompt parts, and use the fast path router for simple commands so the model is not involved.
5. **Timers and polling.** Replace `setInterval` polling with events. Throttle logging. Make sure hidden windows do not burn CPU, but audio and timers still work (check `backgroundThrottling` settings deliberately).
6. **Memory.** Find leaks (event listeners not removed, growing message arrays, stale audio buffers). Cap chat history in memory and virtualize long lists.
7. **Duplicates.** Remove duplicate servers, double-registered listeners, and dev-only code paths in production builds.
8. **Regression guard.** `pnpm bench` prints the metrics table; add a CI-friendly script that fails when a budget regresses by more than 20%.

## Out of scope
New features, voice engine replacement (phase 2).

## Acceptance checks
- [ ] Budgets for startup, idle CPU, idle memory, mascot frame rate, input latency met on the demo machine; any miss is explained in an ADR.
- [ ] 10 minutes idle: no memory growth beyond 10%.
- [ ] Before/after table for every audit item fixed.
- [ ] The mascot looks identical or better, with the glow preserved visually.
- [ ] `pnpm bench` exists, runs and is documented.

## Refactor gate
Remove every workaround added during debugging; split files over about 200 lines; one tracer, one logger, one config loader.

## Suggested commit
`perf: fix audited bottlenecks, add bench script and meet startup, idle and mascot budgets`
