import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseWake } from '../frontend/src/lib/wake.ts'
import { intentOf } from '../frontend/electron/intent.cjs'
const executable = fileURLToPath(new URL('../backend/dist/kiwi-voice/kiwi-voice.exe', import.meta.url))
const audio = await readFile(new URL('../fixtures/voice/hey-kiwi-open-github.wav', import.meta.url))
const token = crypto.randomUUID()
const child = spawn(executable, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, KIWI_VOICE_TOKEN: token, HF_HUB_OFFLINE: '1' } })
try {
  const port = await new Promise((resolve, reject) => {
    let data = ''
    const timeout = setTimeout(() => reject(new Error('Sidecar startup timeout')), 20000)
    child.stdout.on('data', (chunk) => { data += chunk.toString(); if (data.includes('\n')) { clearTimeout(timeout); try { resolve(JSON.parse(data.split('\n')[0]).port) } catch (error) { reject(error) } } })
    child.on('error', reject)
    child.on('exit', (code) => reject(new Error(`Sidecar exited (${code})`)))
  })
  const url = `http://127.0.0.1:${port}/`
  const unauthorized = await fetch(url, { method: 'POST', body: audio })
  if (unauthorized.status !== 401) throw new Error('Unauthenticated request was not rejected')
  const start = performance.now()
  const response = await fetch(url, { method: 'POST', body: audio, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45000) })
  const body = await response.json()
  const report = { fixture: 'Synthetic Windows SAPI voice, not human recording', frozenExecutable: executable, offline: true, status: response.status, authorizationGuard: unauthorized.status, elapsedMs: performance.now() - start, transcript: body.text, wakeCommand: body.text ? parseWake(body.text) : null, error: body.error }
  await writeFile(new URL('../docs/kiwi-continue/docs/audit/evidence/desktop-voice.json', import.meta.url), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!response.ok || intentOf(report.wakeCommand || '').type !== 'urls') throw new Error('Spoken fixture did not become the expected wake command')
} finally { child.kill() }
