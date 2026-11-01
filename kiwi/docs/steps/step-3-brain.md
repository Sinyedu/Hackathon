# Step 3 — Brain: agent core, router, tools and safety

Goal: typing to Kiwi works. Simple commands run instantly through a rule-based fast path; complex requests go to a local model with tool calling. All actions are validated, confirmed when risky, journaled and undoable.

## Do

1. **Core types** (`packages/core`): `AgentEvent`, `ToolDefinition` (name, zod args schema, risk level: read | write | sensitive), `ToolResult`, `ActionJournalEntry` with optional inverse.
2. **Fast-path router**: deterministic matcher driven by `commands.json` (patterns, synonyms, slots): open `<app>`, go to `<site>`, search `<q>`, search YouTube `<q>`, timer `<n> <unit>`, note `<text>`, volume up/down/mute, what time is it. Returns a tool call or `null`. Tests with at least 40 phrases including noisy variants ("hey can you please open spotify").
3. **Agent loop**: `Agent.run(userText)` — fast path first; otherwise call `LlmClient` with the tool schemas, max 5 tool steps, per-step validation of arguments with zod, one retry on invalid output, then a friendly failure. Emits `AgentEvent`s only; no UI knowledge.
4. **Safety policy** (pure, tested): app allowlist, URL scheme allowlist (http/https), sandbox path guard (reject `..`, symlink escapes, paths outside `~/KiwiSandbox`), confirmation required for write/sensitive tools, instruction-like text in tool results is ignored (results are passed back as clearly delimited data).
5. **Confirmation flow**: `ConfirmationPort` shows the plan as PLANNED receipt lines with Yes / No in the chat; "yes" typed or clicked proceeds; timeout cancels.
6. **Tools** (adapters in `apps/desktop/src/main/adapters/`): `open_app`, `open_url`, `web_search`, `set_timer` (notification + mascot done state), `write_note` (sandbox), `clipboard_read/write`, `set_volume` (implement for the demo OS), `list_apps_allowed`. Each tool has a fake for tests.
7. **Ollama adapter**: `LlmClient` over the Ollama HTTP API with streaming, tool calling, health check and model list. Settings: `fastModel`, `planningModel` (defaults documented in README by hardware tier). Graceful behavior when Ollama is not running: fast path still works; the model path says exactly what to do.
8. **Config files** in `userData`: `apps.json`, `sites.json`, `commands.json`, `settings.json`, all zod-validated with helpful error messages and defaults.
9. **Wire to UI**: user message → agent → events → reducer → chat list and mascot states (thinking while the model runs, working while a tool runs, done/error at the end). Receipt lines appear for every tool call with status chips.
10. **Undo**: "undo" (typed or button) reverts the last journaled action when an inverse exists, otherwise says so honestly.

## Out of scope

Voice, screenshots, research, file sorting, coding delegation.

## Acceptance checks

- [ ] Typing `open github`, `search electron docs`, `timer 1 minute`, `note buy milk`, `volume down` works without any model, in under one second.
- [ ] With Ollama running: "open github and search for electron ipc docs" completes via the model path with visible receipt lines.
- [ ] With Ollama stopped: fast path works; the model path shows a clear, actionable message; no crash.
- [ ] Non-allowlisted app or path outside the sandbox is rejected with a tested error.
- [ ] A prompt-injection string inside a tool result does not trigger any tool (test).
- [ ] Core coverage report included; all tests green; `pnpm check` passes.

## Refactor gate

Tools are small modules registered in one registry; no giant switch statements; the agent loop is under ~150 lines; adapters hold all side effects.

## Suggested commit

`feat(core): add agent loop, fast-path router, safety policy, Ollama client and first tools`
