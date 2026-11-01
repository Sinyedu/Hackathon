const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const backend = path.resolve(__dirname, '../../backend')
const exe = path.join(backend, '.venv/Scripts/python.exe')
if (!fs.existsSync(exe)) throw new Error('Build environment missing: run python scripts/dev.py setup, then install PyInstaller into backend/.venv.')
if (spawnSync(exe, ['-c', 'import PyInstaller'], { windowsHide: true }).status !== 0) throw new Error('PyInstaller is not installed in backend/.venv. Run: backend/.venv/Scripts/python.exe -m pip install pyinstaller, then run pnpm dist again.')
const needed = "import importlib.metadata as m; [m.distribution(n) for n in ('faster-whisper', 'huggingface-hub', 'ctranslate2', 'onnxruntime')]"
if (spawnSync(exe, ['-c', needed], { windowsHide: true }).status !== 0) throw new Error('backend/.venv is missing packages (an earlier install was probably interrupted). Run: backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt, then run pnpm dist again.')
const result = spawnSync(exe, ['-m', 'PyInstaller', '--noconfirm', '--onedir', '--name', 'kiwi-voice', '--collect-all', 'faster_whisper', '--collect-all', 'ctranslate2', '--collect-all', 'onnxruntime', '--copy-metadata', 'huggingface-hub', 'desktop_voice.py'], { cwd: backend, stdio: 'inherit', windowsHide: true })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
