const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const backend = path.resolve(__dirname, '../../backend')
const exe = path.join(backend, '.venv/Scripts/python.exe')
if (!fs.existsSync(exe)) throw new Error('Build environment missing: run python scripts/dev.py setup, then install PyInstaller into backend/.venv.')
const result = spawnSync(exe, ['-m', 'PyInstaller', '--noconfirm', '--onedir', '--name', 'kiwi-voice', '--collect-all', 'faster_whisper', '--collect-all', 'ctranslate2', '--collect-all', 'onnxruntime', '--copy-metadata', 'huggingface-hub', 'desktop_voice.py'], { cwd: backend, stdio: 'inherit', windowsHide: true })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
