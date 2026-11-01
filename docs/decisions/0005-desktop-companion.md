# ADR 0005: a standalone desktop companion with a speech sidecar

The user explicitly requested an implemented, committed desktop product after the phase-0 audit. This authorizes work beyond the audit-only starting prompt. The full original phase pack remains a roadmap, not a claim that every acceptance criterion is met.

The existing React document workflow remains available in development. A lazy-loaded companion route uses file-based assets in a frameless transparent Electron window. It does not start the FastAPI/OCR engine. Electron main owns local model calls, encrypted provider keys, fixed-template Windows actions, timers, cancellation and the tray. The preload exposes named IPC methods and verifies requests originate in the owned main frame. Remote navigation and new renderer windows are blocked.

Keep faster-whisper for this test release because its offline English decoder was already installed and could be validated using a frozen executable. PyInstaller packages only the speech service with a random loopback port and per-launch token. Models are cached separately and loaded on demand with two CPU threads. This replaces the old desktop launch dependency on system Python and a fixed-port full backend. The sherpa-onnx utility-process migration, streaming ASR and barge-in remain future work; the release does not claim their latency budgets.

The original SVG is imported directly from fixtures into an inline component. Its three eye layers share cursor translation and blinking; a mouth path animates during replies. Cursor coordinates come from Electron screen, limited to changed positions at 20 Hz. The window is 160×190 collapsed and up to 420×670 expanded. It stays visible above ordinary windows and outside the taskbar, with tray controls and global shortcuts.

Only known commands become actions. Ordinary model text is never executed as a tool or shell command. The bounded website builder requests confirmation, caps output, adds a restrictive preview CSP, and writes only a newly-created project folder. Arbitrary coding-agent execution, file editing outside that folder, screen/clipboard collection, persistent personal memory and unrestricted system automation are not part of this release.

Targets are unsigned Windows x64 NSIS and portable builds. No macOS/Linux installer or clean-machine certification is claimed. Runtime modules, assets and the frozen speech helper are packaged explicitly; release files stay outside Git.
