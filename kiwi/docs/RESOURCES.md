# Resources for agents

How to use this file: before touching an API you have not verified in this repo, fetch the relevant page below and read the part you need. Save short notes to `docs/notes/<topic>.md` (3–10 lines: version, the call you used, a gotcha). If a link is dead, search for the current page and replace it here. Prefer official docs over blog posts. Check each project's license before adding a dependency.

Optional: install the Context7 MCP server in your coding tool so the agent can pull current library docs on demand.

## Desktop app

- Electron docs: https://www.electronjs.org/docs/latest
  - Transparent / frameless windows, `setIgnoreMouseEvents`, always-on-top, global shortcuts, tray, IPC, security checklist (https://www.electronjs.org/docs/latest/tutorial/security)
- electron-vite: https://electron-vite.org
- electron-builder: https://www.electron.build
- React: https://react.dev
- Vitest: https://vitest.dev
- zod: https://zod.dev

## Models and agents

- Ollama API (chat, streaming, tool calling, model pull): https://github.com/ollama/ollama/blob/main/docs/api.md and https://docs.ollama.com
- Qwen3.5 small models (Apache 2.0, vision + tools): model cards on https://huggingface.co/Qwen
- Gemma 4 (Apache 2.0): https://ai.google.dev/gemma and https://opensource.googleblog.com
- Claude Code headless mode / Agent SDK (for step 5 coding delegation): https://docs.claude.com/en/docs/claude-code/overview — verify flags with `claude --help`

## Voice

- Vosk (offline speech recognition, grammar-restricted mode for a wake word): https://alphacephei.com/vosk
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- Whisper large-v3-turbo model card: https://huggingface.co/openai/whisper-large-v3-turbo
- Kokoro TTS (Apache 2.0, 82M): https://huggingface.co/hexgrad/Kokoro-82M and the `kokoro-js` package on npm
- Silero VAD: https://github.com/snakers4/silero-vad
- Web Speech API fallback (speechSynthesis): https://developer.mozilla.org/docs/Web/API/SpeechSynthesis

## Tools and data

- Playwright (browser automation, optional): https://playwright.dev
- Open-Meteo weather API (no key): https://open-meteo.com/en/docs
- DuckDuckGo HTML search (for URLs only; respect terms of use) or a self-hosted SearXNG: https://docs.searxng.org
- Git worktrees: https://git-scm.com/docs/git-worktree
- iCalendar (.ics) format: https://datatracker.ietf.org/doc/html/rfc5545

## Design

- Impeccable skill: https://impeccable.style and https://github.com/pbakaus/impeccable
- Anthropic frontend-design skill (base): search "anthropic frontend-design skill"
- WCAG contrast: https://www.w3.org/WAI/WCAG22/quickref/
- SVG animation: https://developer.mozilla.org/docs/Web/SVG ; CSS animations and `prefers-reduced-motion`: https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion
- Optional animation runtimes: Rive https://rive.app , Lottie https://airbnb.io/lottie

## Mood references for the mascot (principles only, never copy)

Desktop-pet and virtual-companion genres: Tamagotchi-style pets, early desktop assistants, friendly learning-app mascots, small chibi characters. Study proportions (big head, small body), simple facial features, readable silhouettes, and expressive motion timing. Use the images in `docs/design/references/` as the source of truth for taste.
