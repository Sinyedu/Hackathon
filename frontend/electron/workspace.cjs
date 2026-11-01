// Retained development-only delivery workspace. The desktop companion has its own entrypoint.
const { app, BrowserWindow, dialog } = require('electron')
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const FRONTEND = path.resolve(__dirname, '..')
const BACKEND = path.join(ROOT, 'backend')
const DEV = process.argv.includes('--dev')
const BACKEND_URL = 'http://127.0.0.1:8000'
const FRONTEND_URL = 'http://127.0.0.1:5173'
const children = []

// Phase 0 diagnostics are opt-in and do not affect normal launches.
if (process.argv.includes('--audit')) {
  process.env.KIWI_AUDIT = '1'
  require('../../docs/kiwi-continue/tools/electron-audit.cjs')()
}

function pythonProcess() {
  const local = process.platform === 'win32'
    ? path.join(BACKEND, '.venv', 'Scripts', 'python.exe')
    : path.join(BACKEND, '.venv', 'bin', 'python')
  if (fs.existsSync(local)) return { command: local, args: [] }
  const command = process.platform === 'win32' ? 'py' : 'python3'
  const args = process.platform === 'win32' ? ['-3'] : []
  const probe = spawnSync(command, [...args, '--version'], { encoding: 'utf8', windowsHide: true })
  if (probe.error || probe.status !== 0) throw new Error('Python 3.11+ was not found on this machine')
  return { command, args }
}

function startBackend() {
  const python = pythonProcess()
  const child = spawn(python.command, [...python.args, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: BACKEND,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: 'pipe',
    windowsHide: true,
  })
  child.stdout.on('data', (data) => process.stdout.write(`[backend] ${data}`))
  child.stderr.on('data', (data) => process.stderr.write(`[backend] ${data}`))
  children.push(child)
  return child
}

function startFrontend() {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const child = spawn(command, ['dev', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    cwd: FRONTEND,
    env: { ...process.env, BROWSER: 'none' },
    stdio: 'pipe',
    windowsHide: true,
  })
  child.stdout.on('data', (data) => process.stdout.write(`[frontend] ${data}`))
  child.stderr.on('data', (data) => process.stderr.write(`[frontend] ${data}`))
  children.push(child)
  return child
}

function waitFor(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) return resolve()
        retry()
      })
      request.setTimeout(800, () => request.destroy())
      request.on('error', retry)
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`))
      setTimeout(attempt, 250)
    }
    attempt()
  })
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: 'Kiwi · DockProof',
    backgroundColor: '#f6f7f9',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  const backend = startBackend()
  backend.on('error', (error) => console.error(`[backend] ${error.message}`))
  await waitFor(`${BACKEND_URL}/api/health`)
  if (DEV) {
    startFrontend()
    await waitFor(`${FRONTEND_URL}/`)
    await window.loadURL(FRONTEND_URL)
  } else {
    await window.loadURL(BACKEND_URL)
  }
  window.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`Kiwi window failed to load: ${code} ${description}`)
  })
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

app.whenReady().then(async () => {
  try {
    await createWindow()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await dialog.showMessageBox({
      type: 'error',
      title: 'Kiwi needs local setup',
      message: 'Kiwi could not start its local backend.',
      detail: `${detail}\n\nInstall Python 3.11+, run "python scripts/dev.py setup", then try again. Ollama is optional for the deterministic workflow and required for local AI chat.`,
    })
    app.quit()
  }
})

app.on('before-quit', stopChildren)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
