const { app } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const voice = require('./voice.cjs')
const { verifiedVoiceText } = require('./intent.cjs')
let child, emit, generation = 0, pending = 0, buffer = '', state = 'off'
function status(value) { state = value; emit?.('voice-status', { status: value }) }
function mode(value) { if (value === 'paused') pending++; if (child?.stdin.writable) child.stdin.write(value + '\n') }
function shutdown() { generation++; pending++; state = 'off'; child?.kill(); child = null }
// Opt-in diagnostics for "the mic is bad": KIWI_VOICE_DEBUG=1 writes what each stage heard to
// %APPDATA%/Kiwi/logs/voice-debug.jsonl (text only, never audio). Off by default: normal logs hold no utterances.
const debugOn = process.env.KIWI_VOICE_DEBUG === '1'
let lastConfidence = null
function debug(entry) {
  if (!debugOn) return
  try {
    const directory = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(directory, { recursive: true })
    fs.appendFileSync(path.join(directory, 'voice-debug.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
  } catch { /* diagnostics must never break listening */ }
}
async function final(text, audio, run, job) {
  if (state === 'paused' || run !== generation) return
  emit?.('voice-processing', { text })
  const started = Date.now()
  let whisper = null
  try {
    if (!audio) throw new Error('The speech recognizer did not provide audio. Please try again.')
    whisper = await voice.transcribe(new Uint8Array(Buffer.from(audio, 'base64')))
    const value = verifiedVoiceText(text, whisper)
    debug({ stage: 'accepted', native: text, nativeConfidence: lastConfidence, whisper, ms: Date.now() - started })
    if (run === generation && job === pending) emit?.('voice-final', { text: value })
  } catch (error) {
    debug({ stage: 'rejected', native: text, nativeConfidence: lastConfidence, whisper, reason: error.message, ms: Date.now() - started })
    if (run === generation && job === pending) { emit?.('voice-error', { message: error.message }); mode('armed') }
  }
}
function consume(chunk, run) {
  if (run !== generation) return
  buffer += chunk.toString()
  if (buffer.length > 8 * 1024 * 1024) { shutdown(); emit?.('voice-error', { message: 'Speech input exceeded its size limit.' }); return }
  const lines = buffer.split('\n'); buffer = lines.pop() || ''
  for (const line of lines) {
    const [kind, encoded, audio] = line.trim().split('\t')
    const text = Buffer.from(encoded || '', 'base64').toString('utf8')
    if (kind === 'status') status(text)
    else if (kind === 'conf') lastConfidence = Number(text)
    else if (kind === 'wake') emit?.('voice-wake')
    else if (kind === 'partial') emit?.('voice-partial', { text })
    else if (kind === 'level') emit?.('voice-level', { level: Math.max(0, Math.min(1, Number(text) / 100)) })
    else if (kind === 'stop') { pending++; emit?.('voice-stop'); mode('armed') }
    else if (kind === 'timeout') { debug({ stage: 'timeout', message: text }); emit?.('voice-timeout', { text }) }
    else if (kind === 'final') void final(text, audio, generation, ++pending)
    else if (kind === 'error') { status('error'); emit?.('voice-error', { message: text }) }
  }
}
function start(publish) {
  emit = publish
  if (child) { mode('armed'); return { status: state } }
  if (process.platform !== 'win32') return { status: 'unsupported', message: 'Hands-free live speech is available on Windows in this build.' }
  const executable = app.isPackaged ? path.join(process.resourcesPath, 'listen', 'kiwi-listen.exe') : path.join(__dirname, '../build/speech/kiwi-listen.exe')
  const run = ++generation
  buffer = ''; status('starting')
  const args = process.argv.includes('--voice-smoke') && process.env.KIWI_SMOKE_WAV ? ['--wav', process.env.KIWI_SMOKE_WAV] : []
  child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
  child.stdin.on('error', () => { /* The recognizer may close while a mode update is queued. */ })
  child.stdout.on('data', (data) => consume(data, run))
  child.on('error', () => { if (run === generation) { child = null; status('error'); emit?.('voice-error', { message: 'The Windows speech listener could not start. Reinstall Kiwi or check Windows speech language settings.' }) } })
  child.on('exit', () => { if (run === generation) { child = null; status('off') } })
  return { status: 'starting' }
}
module.exports = { start, mode, shutdown, cancel: () => { pending++; mode('armed') } }
