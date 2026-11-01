# Kiwi continuation pack — start here

You already have a foundation and a lot of code. This pack does not restart the project. It audits what exists, fixes the performance and voice problems, then adds the missing pieces in a fixed order.

## Order (one commit per phase, never skip ahead)

| Phase | File | Outcome |
|---|---|---|
| 0 | docs/phases/phase-0-audit.md | Measured baseline and a ranked list of what is wrong. No feature work. |
| 1 | docs/phases/phase-1-performance.md | Fast, light, stable app that meets the budgets. |
| 2 | docs/phases/phase-2-voice.md | Voice that responds: wake word, speech in, speech out, kill switch. |
| 3 | docs/phases/phase-3-providers.md | Local models or your own API key, stored safely. |
| 4 | docs/phases/phase-4-persona-voice.md | Kiwi as a friend: personality, memory, blip voice. |
| 5 | docs/phases/phase-5-computer-control.md | Windows, tabs, apps, dark mode, music, volume. |
| 6 | docs/phases/phase-6-coding-mode.md | "Open VS Code and build me this." |
| 7 | docs/phases/phase-7-packaging.md | A real installer anyone can double-click. |

Shared rules: `AGENTS.addendum.md`, `docs/PERFORMANCE_BUDGETS.md`, `docs/SECURITY_AND_TRUST.md`, `docs/PERSONA_AND_VOICE.md`.

## How to use with your coding agent

1. Copy this pack into the repo root. Keep the earlier `AGENTS.md` and `docs/RESOURCES.md` if you have them; the addendum sits on top.
2. Use an agent mode that can run commands, build the app and read logs. Without that it cannot measure, and measuring is the point of phase 0 and 1.
3. Start a fresh session per phase and paste:

```
Read AGENTS.md, AGENTS.addendum.md and docs/phases/phase-N-*.md. This is an existing codebase: do not rewrite from scratch. Write a short plan to docs/plans/phase-N.md first, then implement in small slices. Keep the app runnable after every slice, run the check command after each one, report real measurements against docs/PERFORMANCE_BUDGETS.md, finish with the refactor gate, and report each acceptance check as pass or fail without claiming anything you did not run. Do not commit; give me the commit message.
```

4. Commit only when every acceptance check is green, or when the failures are listed honestly in the phase's notes.

## Phase 0 first message (copy as is)

```
Run phase 0 only. Do not add or change features. Build and run the app, profile it, reproduce "voice does not respond" with a diagnostic, and write docs/audit/AUDIT.md with measured numbers, a ranked list of root causes, a map of the current architecture, and a recommendation (with reasons) for how the backend should be packaged into the installer. Include the exact commands you used so I can repeat every measurement.
```
