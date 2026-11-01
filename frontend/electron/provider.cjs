const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const settings = require('./settings.cjs')
let ollamaChild
function startOllama() {
  if (ollamaChild) return
  const exe = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe') : 'ollama'
  if (process.platform === 'win32' && !fs.existsSync(exe)) return
  ollamaChild = spawn(exe, ['serve'], { windowsHide: true, stdio: 'ignore' })
  ollamaChild.on('error', () => { ollamaChild = null })
  ollamaChild.on('exit', () => { ollamaChild = null })
}
async function health() {
  const config = settings.publicSettings()
  try {
    if (config.provider === 'compatible') return { ok: config.hasKey, message: config.hasKey ? 'Cloud key saved; send a message to test it.' : 'Add a personal API key in settings.', models: [] }
    startOllama()
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(4000) })
    if (!response.ok) throw new Error()
    const data = await response.json()
    const models = data.models.map((m) => m.name)
    const found = models.includes(config.model)
    return { ok: found, message: found ? `${config.model} is ready on this computer.` : `Install ${config.model} using Ollama first.`, models }
  } catch { return { ok: false, message: 'Ollama is not running. Install or start Ollama, then test again.', models: [] } }
}
async function* chat(messages, signal, maxTokens = 384) {
  const config = settings.publicSettings()
  const local = config.provider === 'ollama'
  const key = local ? '' : settings.apiKey()
  if (!local && !key) throw new Error('Save your personal API key in settings first.')
  const response = await fetch(local ? 'http://127.0.0.1:11434/api/chat' : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', ...(local ? {} : { Authorization: `Bearer ${key}` }) },
    body: JSON.stringify(local ? { model: config.model, messages, stream: true, think: false, keep_alive: '5m', options: { temperature: 0.4, num_ctx: 4096, num_predict: maxTokens, num_thread: 4 } } : { model: config.model, messages, stream: true }),
  })
  if (!response.ok || !response.body) throw new Error(response.status === 401 ? 'Your API key was rejected.' : `Model connection failed (${response.status}). Check settings and your model.`)
  let buffer = ''
  const decoder = new TextDecoder()
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n'); buffer = lines.pop() || ''
    for (const line of lines) {
      const raw = local ? line.trim() : line.startsWith('data:') ? line.slice(5).trim() : ''
      if (!raw || raw === '[DONE]') continue
      const data = JSON.parse(raw)
      if (data.error) throw new Error('The model reported an error. Check the selected model.')
      const text = local ? data.message?.content : data.choices?.[0]?.delta?.content
      if (text) yield text
    }
  }
  if (local && buffer.trim()) { const text = JSON.parse(buffer).message?.content; if (text) yield text }
}
module.exports = { chat, health, startOllama, shutdown: () => ollamaChild?.kill() }
