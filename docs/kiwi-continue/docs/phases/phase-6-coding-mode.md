# Phase 6 — Coding mode: "open VS Code and build me this"

Goal: the user says what they want built; Kiwi creates a project, opens VS Code, runs a coding agent, narrates progress, runs the result and shows a preview, all under strict limits.

## Do
1. **Workspace.** A configurable workspace root (default `~/KiwiProjects`). Kiwi creates `<root>/<slug>/`, runs `git init`, and never touches anything outside the root.
2. **Open the editor.** Launch VS Code with `code <folder>` when the CLI is available, otherwise the OS-specific fallback; if VS Code is missing, say so and offer the default editor or installation link.
3. **Coding backend port** `CodingBackendPort` with adapters:
   - **CLI agents:** run an installed coding CLI headless inside the project folder (for example Claude Code or Codex CLI) with a restricted tool set, turn and time limits, streaming output parsed into events. Verify the exact flags with the tool's `--help` and official docs first; never guess.
   - **Provider-driven loop:** a minimal read-edit-test agent that uses the active provider from phase 3 (cloud key or a local coding model), with file tools limited to the project folder and a fixed test/build command.
   - **Replay backend** for rehearsals, labelled as a replay.
4. **Flow.** Understand the request → ask at most one clarifying question → speak a short plan → create project and open VS Code → run the agent → stream receipt lines ("Creating index.html", "Running tests") and spoken progress every ~20 s → run tests/dev server → open the preview in the browser → summarize ("Three files, tests pass, preview is open") → offer: keep, tweak ("make the button bigger"), or discard.
5. **Controls.** Stop button and "Kiwi stop" abort immediately. Modes: ask before each edit, or auto within the project folder. A visible diff or file list before anything runs a command that is not in the allowlist (install, build, test, dev server). No network tools except package installs when the user allows them.
6. **Safety.** Project-folder sandbox with path guards; a command allowlist (templates, validated arguments, no arbitrary shell from the model); secrets never passed to the agent; instruction-like text found in files or web pages is data. Per-session time, turn and token limits with a clear stop message.
7. **Iterate in place.** Follow-up voice commands ("add a dark mode toggle", "fix the error in the console") continue in the same project and session; dev-server errors can be summarized and fed back as untrusted data.
8. **Observability.** The coding session appears as one collapsible group in the receipt tape with timing, files changed and test result; a "Show log" link opens the raw output.

## Out of scope
Deploying projects, publishing to remote git hosts, editing existing projects outside the workspace root.

## Acceptance checks
- [ ] "Open VS Code and build me a landing page for a coffee shop" creates a project, opens VS Code, produces working files and opens a preview, narrated throughout.
- [ ] "Make the heading bigger" modifies the same project and the preview updates.
- [ ] Stop aborts within 1 s and leaves the project in a consistent state.
- [ ] Attempts to write outside the workspace or run non-allowlisted commands are blocked and logged (tests).
- [ ] The replay backend demo works offline and is clearly labelled.
- [ ] Missing VS Code, missing CLI agent and missing API key each produce a clear, actionable message.

## Suggested commit
`feat(coding): add voice-driven coding mode with workspace sandbox, VS Code launch, coding backends and live progress`
