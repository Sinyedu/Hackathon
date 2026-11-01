# Phase 3 — Model providers and "bring your own key"

Goal: Kiwi works with local models or with the user's own API key, switchable in settings, with safe key storage and honest privacy labels.

## Do
1. **Provider port** in core: `LlmProvider` with `id`, `capabilities` (`streaming`, `tools`, `vision`, `maxContext`), `listModels()`, `chat(request) → AsyncIterable<LlmEvent>` (text deltas, tool calls, usage, errors), `healthCheck()`. Normalize tool calling so the agent loop never knows which provider it talks to.
2. **Adapters** (main process only):
   - `OllamaProvider` (local).
   - `OpenAiCompatibleProvider` (base URL + key + model; covers OpenAI and many hosted open-weight services and local servers).
   - `AnthropicProvider` (Messages API with tool use).
   - Add others only behind the same port. Verify each API against its official docs before coding (see `docs/RESOURCES.md`).
3. **Key storage.** Follow `docs/SECURITY_AND_TRUST.md`: `safeStorage` encryption in the main process, masked in the renderer, never logged, "Forget key" button, refuse to store if encryption is unavailable.
4. **Settings UI.** Provider picker, API key field (write-only), model dropdown filled from `listModels()`, "Test connection" with a clear result, separate model choice for **fast** (simple replies) and **planning** (complex tasks), optional fallback chain (for example cloud, then local if offline).
5. **Router integration.** The fast path stays model-free. The agent uses the planning model; simple chat uses the fast model. Streaming everywhere. Context trimming and prompt caching where the provider supports it.
6. **Privacy label.** Mascot and panel show **Local** or **Cloud**. A first-use notice for cloud mode lists what is sent. Screenshots and clipboard to cloud need an explicit opt-in toggle each.
7. **Guards.** Rate limiting with backoff, request timeouts, cancel support, a soft monthly spend/usage counter (tokens in and out) with a warning threshold, and friendly errors ("Your key was rejected", "No internet, switched to local").
8. **Tests.** Fake provider for the agent loop; contract tests that run the same tool-calling script against each adapter with recorded fixtures; key storage tests with a fake `safeStorage`.

## Out of scope
Persona memory, voice, system control.

## Acceptance checks
- [ ] Same user request works end to end on Ollama and on one cloud provider with a real key.
- [ ] Key is not present in any log, config file or renderer-accessible state (grep test included).
- [ ] Switching provider needs no restart; the badge updates immediately.
- [ ] Unplugging the network with a fallback chain set switches to local with a spoken/visible notice.
- [ ] Tool-calling contract tests pass for all adapters.

## Suggested commit
`feat(providers): add provider port with Ollama, OpenAI-compatible and Anthropic adapters and encrypted key storage`
