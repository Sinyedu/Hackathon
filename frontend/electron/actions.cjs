const { matchStartApp, loadStartApps, launchStartApp } = require('./installed-apps.cjs')
const { createFile } = require('./newfile.cjs')
const { app, shell, Notification, dialog, clipboard } = require('electron')
const { execFile, spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const { existsSync } = require('node:fs')
const { desktopApps, localApps, processes, labelOf } = require('./apps.cjs')
const { findFiles, isOpenable } = require('./files.cjs')
const timers = new Set()
function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 8000 }, (error) => error ? reject(new Error('Windows could not complete that action.')) : resolve())
  })
}
async function execute(intent) {
  switch (intent.type) {
    case 'time': return `It's ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    case 'help': return 'I execute approved desktop commands: open and close apps, find and open your files, open websites or Firefox tabs, search the web, find music, change Windows theme, control volume and media, set timers, and draft a single-page website with approval.'
    case 'url': await shell.openExternal(intent.url); return `Opened ${intent.label}.`
    case 'urls': for (const url of intent.urls) await shell.openExternal(url); return `Opened ${intent.label}.`
    case 'firefox-tab': {
      if (process.platform !== 'win32') throw new Error('Firefox tab control is available on Windows in this build.')
      await launchFirefox(intent.url)
      return intent.url === 'about:blank' ? 'Opened a new Firefox tab.' : `Opened ${intent.label} in a new Firefox tab.`
    }
    case 'timer': {
      if (!Number.isInteger(intent.seconds) || intent.seconds < 1 || intent.seconds > 86400) throw new Error('Choose a timer between one second and 24 hours.')
      const timer = setTimeout(() => { timers.delete(timer); new Notification({ title: 'Kiwi timer', body: 'Time is up. You did it!' }).show() }, intent.seconds * 1000)
      timers.add(timer)
      return `Timer set for ${intent.seconds % 60 === 0 ? `${intent.seconds / 60} minutes` : `${intent.seconds} seconds`}. Keep Kiwi running for the notification.`
    }
    case 'find-files': {
      const { results, truncated } = await findFiles(intent.query, searchRoots())
      lastFound = results
      if (!results.length) return `I did not find a file matching “${intent.query}” in Desktop, Documents, Downloads, Pictures, Videos or Music.`
      const list = results.map((file, index) => `${index + 1}. ${file.label}`).join('\n')
      return `Found ${results.length}${truncated ? ' (the search was cut short)' : ''}:\n${list}\nSay “open the first one” to open it.`
    }
    case 'open-found': {
      const file = lastFound[intent.index - 1]
      if (!file) throw new Error(lastFound.length ? `There are only ${lastFound.length} results. Say “open the first one”.` : 'I have no search results yet. Say “find” and a file name first.')
      return openFile(file)
    }
    case 'open-file': {
      const { results } = await findFiles(intent.query, searchRoots(), { limit: 1 })
      lastFound = results
      if (!results.length) throw new Error(`I did not find a file matching “${intent.query}”.`)
      return openFile(results[0])
    }
    case 'folder': {
      const error = await shell.openPath(intent.name === 'screenshots' ? screenshotsFolder() : app.getPath(intent.name))
      if (error) throw new Error('Windows could not open that folder.')
      return `Opened your ${intent.name} folder.`
    }
    case 'close-app': {
      if (process.platform !== 'win32') throw new Error('Closing apps is available on Windows in this build.')
      const label = labelOf(intent.app)
      const answer = await dialog.showMessageBox({ type: 'question', buttons: [`Close ${label}`, 'Cancel'], defaultId: 1, cancelId: 1, message: `Close ${label}?`, detail: 'Kiwi asks it to close, like the window’s X button. The app may ask about unsaved work.' })
      if (answer.response !== 0) return `Left ${label} open.`
      const result = await closeProcess(processes[intent.app])
      if (result === 'not-running') return `${label} is not running.`
      if (result === 'failed') throw new Error(`${label} could not be asked to close.`)
      return `Asked ${label} to close. Some apps keep running in the tray.`
    }
    case 'weather': {
      if (intent.place) { await shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(`weather ${intent.place}`)}`); return `Opened a weather search for ${intent.place}.` }
      if (process.platform === 'win32' && await protocolRegistered('msnweather')) { await shell.openExternal('msnweather:'); return 'Opened the Weather app.' }
      await shell.openExternal('https://www.google.com/search?q=weather')
      return 'Opened a weather search.'
    }
    case 'new-file': {
      const file = await createFile({ dir: app.getPath(intent.folder), kind: intent.kind, name: intent.name })
      const error = await shell.openPath(file)
      return `Created ${path.basename(file)} in your ${intent.folder} folder${error ? `, but could not open it: ${error}` : ' and opened it'}.`
    }
    case 'refused': case 'clarify': return intent.message
    case 'open-named': {
      const apps = await loadStartApps()
      const opened = []; const missing = []
      for (const name of intent.names) {
        const match = matchStartApp(name, apps)
        if (match) { await launchStartApp(match); opened.push(match.Name) } else missing.push(name)
      }
      const said = []
      if (opened.length) said.push(`Opened ${opened.join(', ')}.`)
      if (missing.length) said.push(`I could not find an installed app called ${missing.map((n) => `“${n}”`).join(', ')}. Check the spelling, or say “open <site>.com” for a website.`)
      return said.join(' ')
    }
    case 'draft-message': {
      const who = intent.to || 'your friend'
      const where = await openDesktopApp(intent.app)
      if (!intent.text) { pendingDraft = { to: intent.to, app: intent.app, at: Date.now() }; return `${where} What should the message to ${who} say? Tell me the words, or say “cancel”. I never send it myself.` }
      pendingDraft = null
      clipboard.writeText(intent.text)
      return `${where} Message for ${who}: “${intent.text}”. It is copied to the clipboard. Open the chat with ${who}, paste with Ctrl+V and press Enter to send. I never send messages.`
    }
    case 'launch': {
      if (process.platform !== 'win32') throw new Error('App launching is available on Windows in this build.')
      const notes = []
      for (const target of intent.targets) {
        if (target.kind === 'url') { await shell.openExternal(target.url); continue }
        const desktop = desktopApps[target.key]
        if (await protocolRegistered(desktop.scheme)) await shell.openExternal(desktop.uri)
        else { await shell.openExternal(desktop.web); notes.push(`${desktop.label} is not installed, so I opened its website`) }
      }
      return notes.length ? `Opened ${intent.label}. ${notes.join('. ')}.` : `Opened ${intent.label}.`
    }
    case 'app': {
      if (process.platform !== 'win32') throw new Error('App launching is available on Windows in this build.')
      const entry = localApps[intent.app]
      if (!entry) throw new Error('I cannot open that app yet.')
      if (intent.app === 'files') { const error = await shell.openPath(app.getPath('documents')); if (error) throw new Error(error) }
      else if (intent.app === 'vs code') {
        const exe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe')
        try { await fs.access(exe) } catch { throw new Error('VS Code is not installed in its default user location.') }
        await launch(exe)
      } else if (intent.app === 'firefox') await launchFirefox()
      else if (entry.uri) await shell.openExternal(entry.uri)
      else if (entry.paths) {
        const exe = entry.paths.map(([variable, rest]) => path.join(process.env[variable] || '', ...rest.split('/'))).find((candidate) => existsSync(candidate))
        if (!exe) throw new Error(`${entry.label} is not installed in its usual location.`)
        await launch(exe)
      } else await launch(entry.exe)
      return `Opened ${entry.label}.`
    }
    case 'theme':
      if (process.platform !== 'win32') throw new Error('System theme control is only available on Windows in this build.')
      await powershell(`$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'; Set-ItemProperty -LiteralPath $p -Name AppsUseLightTheme -Value ${intent.dark ? 0 : 1}; Set-ItemProperty -LiteralPath $p -Name SystemUsesLightTheme -Value ${intent.dark ? 0 : 1}`)
      return `Windows is set to ${intent.dark ? 'dark' : 'light'} mode.`
    case 'media': {
      if (process.platform !== 'win32') throw new Error('Media control is only available on Windows in this build.')
      const key = { up: 175, down: 174, mute: 173, playpause: 179, next: 176, previous: 177 }[intent.command]
      if (!key) throw new Error('Unsupported media command.')
      await powershell(`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KiwiKeys { [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra); }'; [KiwiKeys]::keybd_event(${key},0,0,[UIntPtr]::Zero); [KiwiKeys]::keybd_event(${key},0,2,[UIntPtr]::Zero)`)
      return intent.command === 'playpause' ? 'Sent play/pause to your media app.' : `Sent ${intent.command} to Windows.`
    }
    default: throw new Error('I cannot perform that desktop action yet.')
  }
}
// Last search results, in memory only, so "open the second one" refers to what Kiwi just listed.
// After "write a message to X" Kiwi waits (two minutes) for the words; the next command is taken as the message text.
let pendingDraft = null
function takePendingDraft() {
  const draft = pendingDraft && Date.now() - pendingDraft.at < 120000 ? pendingDraft : null
  pendingDraft = null
  return draft
}
let lastFound = []
function searchRoots() {
  return [['Desktop', 'desktop'], ['Documents', 'documents'], ['Downloads', 'downloads'], ['Pictures', 'pictures'], ['Videos', 'videos'], ['Music', 'music']]
    .map(([label, name]) => [label, app.getPath(name)])
}
/** Windows keeps screenshots in Pictures, under a name that depends on the display language. */
function screenshotsFolder() {
  const pictures = app.getPath('pictures')
  return ['Screenshots', 'Skærmbilleder', 'Bildschirmfotos', 'Capturas de pantalla', 'Captures d’écran'].map((name) => path.join(pictures, name)).find((folder) => existsSync(folder)) || pictures
}
async function openFile(file) {
  if (!isOpenable(file.path)) throw new Error(`I only open documents, images and media, not ${path.extname(file.name) || 'this kind of'} files.`)
  const error = await shell.openPath(file.path)
  if (error) throw new Error('Windows could not open that file.')
  return `Opened ${file.name}.`
}
/** Graceful close, like the window's X button. Never /F: that would discard unsaved work without asking. */
function closeProcess(image) {
  return new Promise((resolve) => {
    execFile('taskkill.exe', ['/IM', image], { windowsHide: true, timeout: 8000 }, (error) => resolve(!error ? 'closed' : error.code === 128 ? 'not-running' : 'failed'))
  })
}
/** Opens a desktop app that has a web twin; falls back to its website. Returns one sentence saying what happened. */
async function openDesktopApp(key) {
  const desktop = desktopApps[key]
  if (process.platform === 'win32' && await protocolRegistered(desktop.scheme)) { await shell.openExternal(desktop.uri); return `Opened ${desktop.label}.` }
  await shell.openExternal(desktop.web)
  return `${desktop.label} is not installed, so I opened its website.`
}
/** True when Windows has a handler registered for the URL scheme (the app is installed), e.g. "discord". */
function protocolRegistered(scheme) {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', `HKEY_CLASSES_ROOT\\${scheme}`, '/v', 'URL Protocol'], { windowsHide: true, timeout: 4000 }, (error) => resolve(!error))
  })
}
async function launchFirefox(url) {
  const locations = [
    path.join(process.env.ProgramFiles || '', 'Mozilla Firefox', 'firefox.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Mozilla Firefox', 'firefox.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Mozilla Firefox', 'firefox.exe'),
  ]
  const exe = locations.find((candidate) => candidate && require('node:fs').existsSync(candidate)) || 'firefox.exe'
  await launch(exe, url ? ['-new-tab', url] : [])
}
function launch(exe, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: false })
    child.once('error', () => reject(new Error('That app could not be opened.')))
    child.once('spawn', () => { child.unref(); resolve() })
  })
}
async function audit(type, ok) {
  const dir = path.join(app.getPath('userData'), 'logs'); await fs.mkdir(dir, { recursive: true })
  // No user utterances, URLs, API keys or prompts in the default action log.
  await fs.appendFile(path.join(dir, 'actions.jsonl'), JSON.stringify({ ts: new Date().toISOString(), action: type, ok }) + '\n')
}
module.exports = { execute, takePendingDraft, audit, shutdown: () => { for (const timer of timers) clearTimeout(timer) } }
