# Phase 4 — Kiwi as a friend: personality, memory and the blip voice

Goal: talking to Kiwi feels like talking to a small, warm, funny character that remembers you. Implement `docs/PERSONA_AND_VOICE.md` exactly.

## Do
1. **Persona module.** Versioned system prompt from the skeleton, built from settings (name, tone slider: calm to playful), the memory summary and the tool list. Keep it under about 400 tokens. Unit test the prompt builder.
2. **Local memory.** A human-readable `memory.md` (or JSON with a Markdown view) in `userData`. Kiwi can save facts the user states ("my name is…", "I like lo-fi"), announces it ("Got it, I'll remember that"), and the user can open, edit and delete entries in Settings → Memory. Never store secrets, payment data, or sensitive personal categories. Summarize into at most about 300 tokens for the prompt.
3. **Blip voice engine** (WebAudio), per the spec: per-letter blips, pitch table plus jitter, punctuation pauses, emotion-to-pitch mapping, 25 to 35 characters per second. Original synthesis only. Typewriter text and mascot mouth driven by the same clock; tapping skips to the full text.
4. **Voice modes.** Blips, Natural (TTS from phase 2), Smart. Volume, speed, pitch sliders, mute, and a preview button. Emotions come from the reducer: `happy`, `neutral`, `error`, `thinking`.
5. **Conversation feel.** Streamed replies appear as they are generated; the first blip plays within 300 ms of the first token. Short acknowledgements for slow actions ("On it!") before tools finish. Honest failure messages in character.
6. **Proactivity (optional, off by default).** At most one suggestion per hour, dismissable, based only on the local context the user allowed (for example "You have a timer finishing soon").
7. **Boundaries.** Include tests or a checklist confirming Kiwi never guilt-trips, never claims to have done things it has not, and never stores secrets.

## Out of scope
New system-control tools, coding mode.

## Acceptance checks
- [ ] Blip voice sounds consistent across words, stays in sync with text and mouth, and has no clicks or overlaps at 35 characters per second.
- [ ] First blip within 300 ms of the first streamed token (tracer evidence).
- [ ] Memory add, view, edit, delete all work and persist across restarts; the summary is in the prompt.
- [ ] Persona stays in character across 20 scripted exchanges including failures and refusals.
- [ ] CPU while speaking stays within budget; no audio glitches while the model streams.

## Suggested commit
`feat(persona): add Kiwi personality, local memory and original blip voice with synced mascot animation`
