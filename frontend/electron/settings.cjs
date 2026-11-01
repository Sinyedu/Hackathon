const { app, safeStorage } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const defaults = { provider: 'ollama', model: 'qwen3:1.7b', baseUrl: 'https://api.openai.com/v1', muted: false, wake: false, voice: 'natural' }
let settings = { ...defaults }
const filename = () => path.join(app.getPath('userData'), 'preferences.json')
async function load() {
  try { settings = { ...defaults, ...JSON.parse(await fs.readFile(filename(), 'utf8')) } } catch { /* first launch */ }
  return publicSettings()
}
function publicSettings() { const { encryptedKey, ...rest } = settings; return { ...rest, hasKey: !!encryptedKey } }
function apiKey() {
  if (!settings.encryptedKey) return ''
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows key encryption is unavailable.')
  return safeStorage.decryptString(Buffer.from(settings.encryptedKey, 'base64'))
}
async function save(input) {
  const next = { ...settings }
  if (input.provider !== undefined) {
    if (!['ollama', 'compatible'].includes(input.provider)) throw new Error('Choose a supported provider.')
    next.provider = input.provider
  }
  if (input.model !== undefined) {
    if (typeof input.model !== 'string' || !/^[\w.:/-]{1,120}$/.test(input.model)) throw new Error('Invalid model name.')
    next.model = input.model
  }
  if (input.baseUrl !== undefined) {
    const url = new URL(input.baseUrl)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Cloud endpoints must use HTTPS without credentials in the URL.')
    next.baseUrl = url.href.replace(/\/$/, '')
  }
  for (const name of ['wake', 'muted']) if (typeof input[name] === 'boolean') next[name] = input[name]
  if (['natural', 'blips'].includes(input.voice)) next.voice = input.voice
  if (input.forgetKey) delete next.encryptedKey
  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows key encryption is unavailable. Key was not saved.')
    next.encryptedKey = safeStorage.encryptString(input.apiKey.trim()).toString('base64')
  }
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(filename(), JSON.stringify(next, null, 2))
  settings = next
  return publicSettings()
}
module.exports = { load, save, publicSettings, apiKey }
