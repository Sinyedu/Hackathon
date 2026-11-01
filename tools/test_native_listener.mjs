import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const exe = fileURLToPath(new URL('../frontend/build/speech/kiwi-listen.exe', import.meta.url))
const wav = process.argv[2] || fileURLToPath(new URL('../fixtures/voice/hey-kiwi-open-github.wav', import.meta.url))
const negative = process.argv.includes('--no-wake')
const child = spawn(exe, ['--wav', wav], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
const events = []; let buffer = ''
const timer = setTimeout(() => { child.kill(); console.error('Native speech test timed out'); process.exitCode = 1 }, 20000)
child.stdout.on('data', (data) => {
  buffer += data.toString()
  const lines = buffer.split('\n'); buffer = lines.pop() || ''
  for (const line of lines) {
    const [kind, value, audio] = line.trim().split('\t')
    if (!kind) continue
    events.push({ kind, text: Buffer.from(value || '', 'base64').toString('utf8'), audioBytes: audio ? Buffer.from(audio, 'base64').length : 0 })
  }
})
child.on('error', (error) => { clearTimeout(timer); console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => {
  clearTimeout(timer)
  console.log(JSON.stringify({ fixture: 'synthetic speech', code, events }, null, 2))
  const activated = events.some((e) => e.kind === 'wake'), completed = events.some((e) => e.kind === 'final')
  if (code !== 0 || (negative ? activated || completed : !activated || !completed)) process.exitCode = 1
})
