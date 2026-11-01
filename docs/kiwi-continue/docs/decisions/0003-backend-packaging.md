# ADR 0003: keep the Python document engine as a packaged sidecar

Status: recommended by phase 0; packaging has not been implemented or verified.

The existing backend is not mostly HTTP glue. RapidOCR/ONNX Runtime/OpenCV implement extraction, PyMuPDF reads PDFs, and reconciliation, source evidence, correction and approval are covered by 152 passing Python tests. Porting this whole engine immediately would expand risk while preserving a working document demo is important. faster-whisper is also Python today, but the phase 2 voice spike may remove it from the voice path.

Choose Option B for the existing document engine: package Python with PyInstaller, place the executable in electron-builder extraResources, bind a random loopback port and require a per-launch token. Electron must start and supervise the executable, retain child ownership, restart with backoff and shut it down. The renderer should use a narrow main-process port rather than choose backend addresses or carry secrets.

Move general provider orchestration, desktop tools and persona logic to TypeScript in later phases. Move audio to a supervised utilityProcess only after the sherpa-onnx spike demonstrates the required APIs and packaging on Windows. Keep deterministic document calculations in Python initially. This selects one implementation per capability, not duplicate Python and Node versions of each subsystem.

Consequences: larger installer and native-library packaging work; no system Python, Node, pnpm or dev server should be required by the installed app. Model files must be downloaded separately into userData with progress/checksums. PyInstaller hooks for OCR, ONNX Runtime and PyMuPDF need actual packaged smoke tests. No installer size or clean-machine success is claimed.

Reconsider a complete TypeScript migration only if the document feature is explicitly retired or an equivalent extraction and reconciliation port passes the existing fixtures. Option A is simpler for new general assistant features; it is not the lowest-risk migration for the current Python ML code.
