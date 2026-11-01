# Kiwi desktop architecture

```text
Kiwi.exe
  Electron main: window/tray, shortcuts, cursor, settings, provider, commands
    -> context-isolated preload with fixed IPC names
    -> React Companion, local file assets, SVG eye/mouth animation
    -> Ollama localhost:11434 / qwen3:1.7b
    -> optional HTTPS compatible provider; safeStorage key stays in main
    -> lazy packaged kiwi-voice.exe, random loopback port + per-launch token
        faster-whisper small.en, CPU int8, 2 threads, cached model
    -> fixed Windows app/media/theme commands, timers/notifications
    -> confirmed single-page builder inside Documents/KiwiProjects
```

The document-reconciliation app remains a separate development workflow: React LiveWorkspace -> FastAPI :8000 -> OCR/matching/reconciliation. Its dictionaries are not durable storage. It is not launched by the companion or shipped as a receiving/claims product.

See ADR `decisions/0005-desktop-companion.md`, the historical `kiwi-continue/docs/audit/ARCHITECTURE-AS-IS.md`, and `QA_CHECKLIST.md`. The historical phase-0 measurements describe the old desktop shell, not the current companion.
