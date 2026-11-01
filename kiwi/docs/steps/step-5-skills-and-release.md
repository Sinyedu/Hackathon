# Step 5 — Power skills, first-run setup and release

Goal: Kiwi does impressive things and anyone can install it and get it working. Final cleanup and demo readiness.

## Do

1. **Research tool**: web search → fetch the top 3 pages → extract main text → summarize in at most 3 sentences with a sources list shown as receipt lines. All fetched text is untrusted data. Timeouts, size caps, clear failure messages.
2. **Screen understanding**: `screenshot_describe` captures the screen, sends it to a local vision-capable model, shows the image as a proof thumbnail and speaks a short description. Optional "explain this error".
3. **Sandbox files**: `sort_folder` creates a PLAN (grouped moves) shown as PLANNED lines; after confirmation `apply_plan` executes; every move is journaled; `undo_last` reverses it. Seed `~/KiwiSandbox/Downloads` with fake messy files for demos. Delete means move to `.trash`.
4. **Info tools**: weather (Open-Meteo), translate and define (via the model), unit conversion and arithmetic by deterministic code.
5. **Code delegation** behind `CodingBackendPort`:
   - `ClaudeCodeBackend`: runs Claude Code headless in a fresh git worktree on branch `kiwi/<slug>` inside an allowlisted project folder; tools restricted to read, edit and a fixed test command; turn limit and timeout; no secrets passed; streams progress events to the receipt tape; never touches the main working copy. Verify exact CLI flags with `claude --help` first.
   - `ReplayBackend`: plays a recorded event stream for rehearsal; clearly labelled "replay" in the UI.
   - Flow: speak the plan → confirm → run → show diff summary and test result → Keep (merge branch) / Show diff / Discard.
   - Off by default; enabled in settings, which has a note that the hackathon rules about proprietary models must be checked. Optional alternative backend using a local Ollama coding model.
6. **First-run wizard**: detect Ollama (guide to install if missing), recommend models by hardware tier (RAM / GPU) and pull them with a progress bar, check microphone permission, pick the hotkey, run a 10-second self-test ("open github"). Settings screen for models, wake word on/off, input device, sandbox location.
7. **Release polish**: final icon and installer branding, optional launch at login, README with install steps and the unsigned-installer warning for the demo OS, `docs/DEMO.md` (exact script, rehearsal checklist, backup plan), crash-safe logging without audio.
8. **Final refactor pass**: delete unused code, split any file over ~200 lines, update `docs/ARCHITECTURE.md` and ADRs, produce a coverage report for `packages/core`.

## Acceptance checks

- [ ] On a clean machine with Ollama installed: install Kiwi → wizard → say "Hey Kiwi, open GitHub" → works.
- [ ] "Research Electron IPC best practices" returns a 3-sentence summary with sources.
- [ ] "Clean up my downloads" shows a plan, applies on "yes", and "undo" restores every file.
- [ ] Code delegation (if enabled) completes a tiny change in a worktree, runs tests, and Discard removes it; ReplayBackend demo works offline.
- [ ] A prompt-injection page used in research does not trigger any tool (test).
- [ ] `pnpm check` and `pnpm dist` pass; README steps verified from scratch; known issues listed honestly in the README.

## Refactor gate

One registry for tools, one place per concern, no leftover debug code, no unexplained constants.

## Suggested commit

`feat: add research, screen understanding, sandbox files, code delegation, first-run setup and release polish`
