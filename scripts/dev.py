#!/usr/bin/env python3
"""Cross-platform dev runner (Windows, Linux, macOS). Standard library only.

    python scripts/dev.py setup      create backend/.venv, install backend and frontend dependencies
    python scripts/dev.py            run backend (8000) and frontend (5173) together; Ctrl+C stops both
    python scripts/dev.py backend    backend only          (add --lan to listen on all interfaces)
    python scripts/dev.py frontend   frontend only         (add --lan to reach it from a phone)
    python scripts/dev.py test       backend tests, frontend lint and build
    python scripts/dev.py doctor     check what is installed (Python, pnpm, Ollama, models, cloudflared)

On Windows use `py scripts/dev.py ...` or `python scripts/dev.py ...` from PowerShell or cmd.
"""

import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
WINDOWS = sys.platform.startswith("win")
VENV_PY = BACKEND / ".venv" / ("Scripts/python.exe" if WINDOWS else "bin/python")


def run(cmd: list[str], cwd: Path) -> None:
    print(f"$ {' '.join(cmd)}   (in {cwd.relative_to(ROOT)})")
    subprocess.run(cmd, cwd=cwd, check=True)


def pnpm() -> str:
    found = shutil.which("pnpm")  # resolves pnpm.cmd on Windows
    if not found:
        sys.exit("pnpm is not installed. Install Node.js 20+ then run: npm install -g pnpm")
    return found


def setup() -> None:
    if not VENV_PY.exists():
        run([sys.executable, "-m", "venv", ".venv"], BACKEND)
    run([str(VENV_PY), "-m", "pip", "install", "--upgrade", "pip"], BACKEND)
    run([str(VENV_PY), "-m", "pip", "install", "-r", "requirements.txt"], BACKEND)
    run([pnpm(), "install"], FRONTEND)
    env = BACKEND / ".env"
    if not env.exists():
        env.write_text((BACKEND / ".env.example").read_text())
        print("Created backend/.env from .env.example")
    print("\nSetup done. Next: `ollama pull qwen3:1.7b` and `ollama pull qwen3:4b-instruct-2507-q4_K_M`, then `python scripts/dev.py`.")


def backend_cmd(lan: bool, reload: bool = True) -> list[str]:
    if not VENV_PY.exists():
        sys.exit("Backend environment missing. Run: python scripts/dev.py setup")
    cmd = [str(VENV_PY), "-m", "uvicorn", "app.main:app", "--port", "8000", "--host", "0.0.0.0" if lan else "127.0.0.1"]
    return cmd + (["--reload"] if reload else [])


def serve(parts: list[tuple[list[str], Path]]) -> None:
    procs = [subprocess.Popen(cmd, cwd=cwd) for cmd, cwd in parts]
    try:
        for proc in procs:
            proc.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for proc in procs:
            if proc.poll() is None:
                proc.terminate()
        for proc in procs:
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()


def test() -> None:
    run([str(VENV_PY), "-m", "pytest", "-q"], BACKEND)
    run([pnpm(), "lint"], FRONTEND)
    run([pnpm(), "build"], FRONTEND)


def doctor() -> None:
    def line(ok: bool, text: str) -> None:
        print(("  ok  " if ok else " MISSING ") + text)

    print(f"Platform: {sys.platform}, Python {sys.version.split()[0]}")
    line(VENV_PY.exists(), "backend/.venv (python scripts/dev.py setup)")
    line(bool(shutil.which("pnpm")), "pnpm")
    line((FRONTEND / "node_modules").exists(), "frontend/node_modules")
    line(bool(shutil.which("cloudflared")), "cloudflared (only needed for a public tunnel)")
    try:
        with urllib.request.urlopen("http://localhost:11434/api/tags", timeout=3) as res:
            names = {m["name"] for m in json.load(res)["models"]}
        line(True, "Ollama is running")
        for model in ("qwen3:1.7b", "qwen3:4b-instruct-2507-q4_K_M"):
            line(model in names, f"model {model}")
    except OSError:
        line(False, "Ollama is not reachable on localhost:11434 (install from ollama.com and start it)")


def main() -> None:
    args = sys.argv[1:]
    lan = "--lan" in args
    what = next((a for a in args if not a.startswith("--")), "all")
    frontend = [pnpm(), "dev"] + (["--host"] if lan else []) if what in ("all", "frontend") else []
    if what == "setup":
        setup()
    elif what == "test":
        test()
    elif what == "doctor":
        doctor()
    elif what == "backend":
        serve([(backend_cmd(lan), BACKEND)])
    elif what == "frontend":
        serve([(frontend, FRONTEND)])
    elif what == "all":
        serve([(backend_cmd(lan), BACKEND), (frontend, FRONTEND)])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
