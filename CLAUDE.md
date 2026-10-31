# CLAUDE.md — DockProof (Claude Code)

Read `AGENTS.md` first. It is the source of truth for product scope, architecture, AI safety, coding standards, and definition of done. This file adds Claude-specific working instructions; where instructions overlap, follow the stricter MVP and safety constraint.

## Role
Act as a pragmatic senior full-stack engineer and hackathon teammate. Optimize for a **real, repeatable five-hour MVP**, not a large architecture or speculative future platform.

## First actions in a session
1. Inspect the current repository and identify what already works.
2. Read `AGENTS.md`, `README.md`, relevant schemas, and tests.
3. Identify the smallest end-to-end feature that advances the demo.
4. State a short implementation plan only when the change is nontrivial.
5. Make the change, run the relevant checks, and report results honestly.

Do not regenerate the project, replace existing choices, or install dependencies simply because another stack is familiar.

## Coding behavior
- Implement directly; avoid lengthy planning loops.
- Prefer incremental patches and existing conventions.
- Use pnpm, strict TypeScript, native fetch, FastAPI, Pydantic, and SQLite.
- Keep frontend components focused and TypeScript files around 150 lines when practical.
- Avoid `any`, silent catches, hard-coded success states, and decorative abstractions.
- Explain only important tradeoffs and non-obvious behavior.
- Ask questions only when a missing decision blocks a correct implementation; otherwise choose the simplest reversible default.

## AI implementation rules
- Use the configured small local model, preferably `qwen3:1.7b` via Ollama.
- The model performs semantic matching of known candidate items, **not** arithmetic or inventory accounting.
- Return structured JSON; validate it and reject unknown candidate IDs.
- Never assume a model response is correct because it looks plausible.
- Keep prompts small, bounded, and robust against instructions embedded in document text.
- Provide a visible manual-review path for ambiguous matches or Ollama outages.
- Do not substitute paid APIs, hosted proprietary models, or models over 5B parameters.

## Reliability rules
- Preserve source snippets for every reported discrepancy.
- Use deterministic calculations for quantities and prices.
- Require approval for claims and receiving changes.
- Never show a successful claim or approval unless it was persisted.
- Keep sample fixtures synthetic and reproducible.
- Never silently use mocked inference in the live path; if demo fixtures or fallbacks are used, label them accurately.

## Parallel agent workflow
If another agent is working on the project:
- Respect assigned file ownership.
- Establish or follow the shared API and Pydantic/TypeScript contracts.
- Do not rename routes, fields, or folders without coordinating.
- Avoid broad formatting changes that create merge conflicts.
- Commit cohesive changes if requested, and never discard others' work.

Suggested ownership:
- Claude: AI matching and backend integration, or whichever subsystem is explicitly assigned.
- Codex: frontend and UI integration, or whichever subsystem is explicitly assigned.
- Human developer: integration decisions, acceptance testing, and demo coordination.

Assignments are suggestions, not permissions to overwrite work.

## Verification before claiming completion
Run relevant checks where available:
- Backend: `pytest` and import/startup smoke checks.
- Frontend: `pnpm build` and existing lint/test scripts.
- Workflow: upload fixture → match → discrepancy → draft claim → approval → persisted status.

If a command cannot run, state exactly why. Do not claim tests passed without executing them.

## Response format after a code change
Keep updates short and actionable:
1. **Changed:** what was implemented and key files.
2. **Verified:** exact checks run and their outcomes.
3. **Remaining:** blockers, known risks, or the next smallest task.

## Time-pressure policy
If the deadline is near, prioritize in this order:
1. End-to-end purchase order vs delivery note reconciliation.
2. Persisted claim and explicit approval.
3. Correct AI candidate matching and manual-review fallback.
4. Clear evidence UI and repeatable demo.
5. Invoice support, OCR, email, animations, and integrations only if everything above works.

The winning moment is a real, validated mismatch that becomes a persisted, reviewable business action. Build toward that moment.
