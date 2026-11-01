# Phase 0 — Audit and baseline (no feature work)

Goal: replace guesses with measurements. At the end we know exactly why the app is slow, why voice does not respond, how the pieces fit together, and how to package the backend.

## Do
1. **Inventory.** Map every package, process and entry point: Electron main, preload, renderer(s), any backend server (language, port, how it starts), model runtimes, audio code, native modules, build scripts. Write `docs/audit/ARCHITECTURE-AS-IS.md` with a text diagram and the list of processes that run at startup.
2. **Run it clean.** Fresh clone, install, build, launch. Record every error and warning in the console and logs, every failing script, every dev-only dependency the app needs at runtime (running servers, system Python, global tools).
3. **Baseline measurements** using `docs/PERFORMANCE_BUDGETS.md`: startup marks, idle CPU and memory per process (`app.getAppMetrics()`), mascot frame rate and paint cost (DevTools Performance, 10 s idle and 10 s active), longest main-thread task, bundle sizes. Record the demo OS, CPU, RAM and GPU.
4. **Add the tracer** (small module writing `trace.jsonl`) and wire spans through the voice path with a single `requestId`. This is the only code change allowed besides diagnostics.
5. **Voice diagnostic.** Create a script or dev panel that checks, in order: microphone permission state, device list, audio sample rate and format actually delivered, chunk delivery rate, VAD activity, wake-word engine alive, speech-to-text alive, a recorded WAV round trip (wake then transcript), IPC delivery to the agent, TTS output device. Print the first stage that fails and why.
6. **Root-cause list.** `docs/audit/AUDIT.md`: ranked findings, each with evidence (numbers, logs, file paths), impact, estimated effort, and the phase that fixes it.
7. **Packaging recommendation.** Decide with reasons and write `docs/decisions/0003-backend-packaging.md`:
   - **Option A (preferred):** move backend logic into TypeScript inside Electron (main process plus `utilityProcess` for heavy work). One language, one process tree, simplest installer.
   - **Option B:** keep a Python backend only if it needs Python-only ML libraries; package it as a PyInstaller executable under `extraResources`, started by Electron on a random loopback port with a per-launch token, supervised and restarted on crash.
   - Rule of thumb: if the backend is mostly HTTP glue, tools and model calls, port it. If it depends on heavy Python-only libraries, keep it as a sidecar. Voice does not need Python if it moves to sherpa-onnx (phase 2).

## Out of scope
Fixing anything beyond trivial typos, new features, refactors.

## Acceptance checks
- [ ] A reader can follow `ARCHITECTURE-AS-IS.md` and name every process the app starts.
- [ ] Baseline table filled with real numbers and the machine specs.
- [ ] The voice diagnostic prints a definite first failing stage for the current "no response" bug, or proves each stage works and names the next suspect.
- [ ] `AUDIT.md` has at least the top 10 findings, ranked, with evidence.
- [ ] ADR 0003 written with the decision and the reasons.

## Suggested commit
`chore(audit): add architecture map, performance baseline, tracer, voice diagnostic and packaging decision`
