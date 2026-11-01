# Design system

Source of truth: `apps/desktop/src/renderer/styles/tokens.css`. No color is defined anywhere else (enforced by a test).

- **Color:** light and dark sets via `prefers-color-scheme`. Brand greens, cream, orange and one blue accent; text/surface pairs are tested at ≥ 4.5:1.
- **Type:** Nunito with system fallbacks. Scale `--text-xs` 12, `-sm` 14, `-md` 16, `-lg` 20 px; line heights 1.25 / 1.5.
- **Spacing:** 4, 8, 12, 16 px (`--space-1..4`). **Radius:** 8, 14, 20 px and full.
- **Elevation:** `--elevation-panel`, `--elevation-bubble`; flat otherwise.
- **Motion:** 120 / 240 / 600 ms, `--ease-out`, `--ease-bounce` for hops. `prefers-reduced-motion` removes loops and hops; poses and marks still show state.
- **Components:** status chips always pair a symbol with a word; focus ring is 3 px `--focus-ring`; buttons and inputs use `--radius-md`.
