# Step 2 — Design system, Kiwi mascot and chat UI

Goal: Kiwi looks and feels alive. A designed mascot with all states, a speech bubble, and a polished chat panel — running on static fake data in a dev "state gallery". No AI yet.

## Before you start (human)

- Put 3–8 reference images in `docs/design/references/` with `captions.md`.
- If you have no references, the agent uses the default direction below.

## Do

1. **Analyze references** → `docs/design/ANALYSIS.md`: shape language, proportions, palette mood, face design, motion timing, panel layout, what to avoid. Principles only; never copy or trace an existing character.
2. **Shape the UX** with `/impeccable shape` (or `$impeccable shape`): mascot placement, panel behavior, states, empty/error/loading states, microcopy voice. Save the result in `docs/design/UX.md`.
3. **Write `DESIGN.md`** (via Impeccable): color tokens (light and dark), type scale and font pairing, spacing, radius, elevation, motion durations and easings, component rules. Implement as CSS variables in `apps/desktop/src/renderer/styles/tokens.css`. No hard-coded colors elsewhere.
4. **Kiwi mascot** as a layered SVG React component with named parts (body, belly ring and seeds, eyes, beak, feet, optional leaf/antenna). Original character only.
   - Default direction if no references: a round, soft kiwi bird/fruit hybrid; lime-green body, cream inner ring with a few dark seeds, big simple eyes, small beak, stubby feet; flat colors, no gradients or glow; readable at 96–160 px.
   - States: `sleeping`, `waking`, `listening`, `thinking`, `working`, `speaking`, `done`, `error`.
   - Idle behaviors: blink, glance around, breathing, occasional small hop.
   - Props: `state`, `micLevel` (0–1, drives the listening ring), `mouthOpen` (0–1, drives the beak), `reducedMotion`.
5. **Mascot state machine**: pure reducer in `packages/core` (`MascotState` + `MascotEvent` → next state) with tests for every transition and for timeouts (done → idle, idle → sleeping).
6. **Speech bubble**: max two lines, fades after ~3 s, can show live transcript or an action label.
7. **Chat panel**: header (name, state, mic dot), message list (user, assistant, tool receipt line with status chip DONE / PLANNED / FAILED / UNDONE), composer, quick-action chips, streaming-text placeholder, empty state. Fully keyboard accessible with visible focus.
8. **State Gallery** (dev only): one page showing every mascot state, bubble variants and a scripted fake conversation. This is also the visual test bench for Impeccable.
9. **Review**: run `/impeccable critique`, fix the findings, run `/impeccable polish` and `/impeccable audit`. Record findings and fixes in `docs/design/REVIEW.md`.

## Out of scope

Ollama, voice, real tool execution.

## Acceptance checks

- [ ] Gallery shows all 8 states with distinct, readable silhouettes at 96 px.
- [ ] Panel docks under the mascot and flips above it near the bottom of the screen; both windows share tokens.
- [ ] `prefers-reduced-motion` removes hops and loops but keeps state changes readable.
- [ ] Contrast at least 4.5:1 for all text; focus rings visible; everything reachable by keyboard.
- [ ] No hard-coded colors outside `tokens.css`; reducer fully tested.
- [ ] Impeccable critique/audit findings fixed or logged in `REVIEW.md`.

## Refactor gate

Mascot parts split into small components; no 300-line SVG blob in one file; shared styles extracted.

## Suggested commit

`feat(ui): add Kiwi mascot, design tokens, speech bubble, chat panel and state gallery`
