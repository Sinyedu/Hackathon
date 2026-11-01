import { parseWake } from '../../../frontend/src/lib/wake.ts'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const report = { date: new Date().toISOString(), requestId: randomUUID(), stages: [] }
async function probe(stage, url, init) {
  const start = performance.now()
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) })
    const text = await response.text()
    const result = { stage, status: response.status, durationMs: performance.now() - start }
    report.stages.push(result)
    return { ...result, text }
  } catch (error) { report.stages.push({ stage, error: error.name, durationMs: performance.now() - start }); return null }
}
await probe('backend_health', 'http://127.0.0.1:8000/api/health')
await probe('desktop_html', 'http://127.0.0.1:8000/')
const asset = await probe('mascot_asset', 'http://127.0.0.1:8000/kiwi-mascot.svg')
report.mascotIsSvg = asset?.text.trimStart().startsWith('<svg') ?? false
await probe('ollama_health', 'http://127.0.0.1:11434/api/tags')
await probe('ollama_small_model', 'http://127.0.0.1:11434/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'qwen3:1.7b', messages: [{ role: 'user', content: 'Say ready.' }], stream: false, think: false, options: { num_predict: 16 } }),
})
report.wakeCases = ['Hey Kiwi, open GitHub', 'Kiwi stop', 'Hey agent, what is missing?', 'ordinary conversation'].map((input) => ({ input, parsed: parseWake(input) }))
// Generated silence exercises decoder/ASR availability; it does NOT measure recognition accuracy.
const wav = Buffer.alloc(44 + 16000 * 2)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
const supplied = process.argv.indexOf('--wav')
const audio = supplied >= 0 ? await fs.readFile(process.argv[supplied + 1]) : wav
const form = new FormData()
form.append('audio', new Blob([audio], { type: 'audio/wav' }), 'diagnostic.wav')
const asr = await probe('asr_wav_roundtrip', 'http://127.0.0.1:8000/api/voice/transcribe', {
  method: 'POST', body: form, headers: { 'X-Request-ID': report.requestId },
})
if (asr?.status === 200) {
  const text = JSON.parse(asr.text).text
  report.asr = { fixture: supplied >= 0 ? 'user-supplied WAV' : 'generated 1 second silence', characters: text.length, wakeRecognized: parseWake(text) !== null }
}
report.firstDefiniteFailure = 'Wake parser rejects Hey Kiwi even with a perfect transcript; live capture and recorded spoken WAV remain unverified.'
report.capture = 'Run Electron with --audit for permission/device info. No recorded command WAV is bundled. Silence test does not prove microphone capture or speech recognition.'
const output = fileURLToPath(new URL('../docs/audit/evidence/voice.json', import.meta.url))
await fs.mkdir(new URL('../docs/audit/evidence/', import.meta.url), { recursive: true })
await fs.writeFile(output, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
