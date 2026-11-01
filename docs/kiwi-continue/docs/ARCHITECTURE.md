# Kiwi architecture status

The desktop companion implementation now supersedes this phase-0 snapshot. See [current architecture](../../ARCHITECTURE.md), [ADR 0005](../../decisions/0005-desktop-companion.md), and [release QA](../../QA_CHECKLIST.md). The audit files below remain historical evidence; the full original phase roadmap is not yet complete.

Current measured architecture: [audit/ARCHITECTURE-AS-IS.md](audit/ARCHITECTURE-AS-IS.md).

Proposed packaging boundary: [decisions/0003-backend-packaging.md](decisions/0003-backend-packaging.md). This is a recommendation, not an implemented installer.

Phase 0 adds only opt-in instrumentation and diagnostic scripts. The renderer, FastAPI document engine and local Ollama runtime remain the active implementation. Phases 1 through 7 have not been implemented by this audit. Phase tracking and remaining acceptance evidence are in [audit/AUDIT.md](audit/AUDIT.md).
