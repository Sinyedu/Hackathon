# Phase 0 plan

Work from this continuation folder; preserve the existing root application and uncommitted changes. Do not copy or replace the application. Phase 0 permits diagnostics and tracing only. Do not commit.

1. Inventory the existing Electron, React, Python, model and audio entrypoints.
2. Run existing checks and measure the demo computer, build sizes, services and desktop startup. Retry GUI execution with desktop permission before attributing crashes to Windows.
3. Add opt-in diagnostics and a bounded JSONL tracer; record voice stages using one request ID without prompts, secrets or audio in logs.
4. Run a voice diagnostic and collect actual results. Mark microphone/manual/clean-machine checks unmeasured when unavailable.
5. Write architecture, ranked findings, baseline, repeatable commands and backend packaging ADR in this folder. Re-read the diff and report acceptance checks honestly.
