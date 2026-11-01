const { app, dialog } = require('electron')
const { spawn } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const path = require('node:path')
let child, starting, port
const token = randomUUID()
function command() {
  return app.isPackaged
    ? { exe: path.join(process.resourcesPath, 'voice', 'kiwi-voice.exe'), args: [] }
    : { exe: path.resolve(__dirname, '../../backend/.venv/Scripts/python.exe'), args: [path.resolve(__dirname, '../../backend/desktop_voice.py')] }
}
function start() {
  if (port) return Promise.resolve(port)
  if (starting) return starting
  starting = new Promise((resolve, reject) => {
    const config = command()
    child = spawn(config.exe, config.args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, KIWI_VOICE_TOKEN: token, OMP_NUM_THREADS: '2' } })
    const timer = setTimeout(() => { child?.kill(); reject(new Error('Speech service took too long to start. Please try again.')) }, 20000)
    let buffer = ''
    child.stdout.on('data', (data) => {
      buffer += data.toString()
      if (!buffer.includes('\n')) return
      try { const value = JSON.parse(buffer.split('\n')[0]); if (Number.isInteger(value.port)) { port = value.port; clearTimeout(timer); resolve(port) } } catch { /* await startup */ }
    })
    child.once('error', () => { clearTimeout(timer); reject(new Error('Speech service is missing. Reinstall Kiwi or use text input.')) })
    child.once('exit', () => { clearTimeout(timer); port = null; starting = null; reject(new Error('Speech service stopped. Try your microphone again.')) })
  }).catch((error) => { starting = null; throw error })
  return starting
}
async function transcribe(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > 5 * 1024 * 1024) throw new Error('Recording is empty or too long.')
  const address = await start()
  const response = await fetch(`http://127.0.0.1:${address}/`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: bytes, signal: AbortSignal.timeout(45000) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Speech could not be transcribed.')
  return result.text
}
async function download() {
  const answer = await dialog.showMessageBox({ type: 'question', buttons: ['Download', 'Cancel'], cancelId: 1, message: 'Download the English speech model?', detail: 'About 480 MB from Hugging Face. It stays on this computer and is used for offline speech recognition.' })
  if (answer.response !== 0) return 'Download cancelled.'
  const config = command()
  return new Promise((resolve, reject) => {
    const worker = spawn(config.exe, [...config.args, '--download'], { windowsHide: true, stdio: 'ignore' })
    worker.once('error', () => reject(new Error('Could not start speech model download.')))
    worker.once('exit', (code) => code === 0 ? resolve('Speech model ready. Try the microphone.') : reject(new Error('Speech download failed. Check your connection and retry.')))
  })
}
module.exports = { transcribe, download, shutdown: () => child?.kill() }
