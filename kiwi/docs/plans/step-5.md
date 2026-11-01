# Plan — step 5

1. Core: service ports (web, model, screen, sandbox files, coding backend), tool outcome fields (reply, extra receipts, proof image), tools for research, screenshot, sort_folder, weather, calculate, convert, translate, define, delegate_code and keep/diff/discard. Router phrases through `commands.json` with `slotArgs`.
2. Adapters: DuckDuckGo HTML search and capped page fetch, Ollama model port, desktopCapturer screen port, sandbox files with demo seeding, Claude Code backend in a git worktree, replay recording.
3. UI: settings screen, first-run wizard (Ollama check, model pull with progress, microphone, shortcuts, self-test), screenshot thumbnail receipts.
4. Release: icon, launch at login, local logging, README and DEMO.
5. Security review fixes: split IPC trust, self-host the ONNX runtime, pin the speech model revision.

Risks: screen capture on Wayland; vision model needs about 3 GB; real Claude Code runs were not executed here.
