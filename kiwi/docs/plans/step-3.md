# Plan — step 3

1. Shared: `AgentEvent` schema, config schemas (apps, sites, commands) with default JSON, IPC channels for chat.
2. Core: ports, tools (one module each) + registry, safety policy, JSON-driven router, agent loop (`model-path.ts`, `run-tool.ts`), journal and undo, chat and mascot reducers, fakes in `testing.ts`.
3. Desktop adapters: config files, Ollama client, Electron platform (launcher, volume, sandbox notes, timers), confirmation bridge, agent host.
4. Renderer: `useChat`, `useMascotState`, confirm bar, undo and stop buttons, bubble in the overlay.
5. Verify end to end against the real app and a local `qwen3:1.7b`.

Risks: Windows and macOS volume and launch commands are untested here; small models may pick the wrong tool, so every call is validated by zod and risky ones need confirmation.
