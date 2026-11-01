# AGENTS addendum — rules for the existing Kiwi codebase

These rules sit on top of `AGENTS.md`. If they conflict, this addendum wins for existing code.

## Mission
Kiwi is a desktop assistant that behaves like a trusted friend: it listens, talks back, and operates the computer for the user, including coding when asked. It runs on local models or on the user's own API key. It installs like a normal application.

## Ground rules
1. **No rewrite from scratch.** Audit first. Migrate in slices behind ports/interfaces. The app must build and launch after every commit.
2. **Measure before and after.** Every performance or voice change reports numbers against `docs/PERFORMANCE_BUDGETS.md`. No number, no claim.
3. **Nothing slow on the UI thread.** Heavy work (audio, speech models, LLM calls, file scans) runs in a utility process, worker or the main process asynchronously, never in the renderer's main thread.
4. **One way to do each thing.** When you find two implementations of the same capability, keep one and delete the other in the same slice.
5. **Everything risky sits behind a trust level and a confirmation** (`docs/SECURITY_AND_TRUST.md`). "Do everything" means broad capability with visible, undoable, permissioned actions, not silent autonomy.
6. **Never fake it.** If a capability is unavailable on this OS or this provider, say so in one clear sentence. No pretend success. Simulated or replayed behavior is labelled.
7. **Secrets:** API keys live only in the main process, encrypted with Electron `safeStorage`. Never in the renderer, never in logs, never in config files in plain text.
8. **Cross-platform honesty.** Every OS-specific capability has an adapter per platform with a capability check. Unsupported platforms return a typed "not supported" result.
9. **Tests:** pure logic gets unit tests; adapters get fakes; voice gets WAV-fixture tests that run offline; each phase ends with a manual checklist on the demo OS.
10. **Docs stay true.** Update `docs/ARCHITECTURE.md` and add an ADR in `docs/decisions/` for every decision that changes structure.

## Definition of done for a phase
- All acceptance checks in the phase file are run and reported pass/fail.
- Budgets in `docs/PERFORMANCE_BUDGETS.md` are re-measured and the numbers are in the phase notes.
- The refactor gate is done: diff re-read, duplication removed, files split, dead code deleted.
- The app builds, launches and passes the check command from a clean install.

## Reporting format at the end of a phase
1. What changed (5 bullets max).
2. Measurements table: metric, before, after, budget.
3. Acceptance checks: pass/fail with evidence (command output or file path).
4. Known issues and risks, honestly.
5. Suggested commit message.
