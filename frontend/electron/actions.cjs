const { app, shell, Notification } = require('electron')
const { execFile, spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const timers = new Set()
function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 8000 }, (error) => error ? reject(new Error('Windows could not complete that action.')) : resolve())
  })
}
async function execute(intent) {
  switch (intent.type) {
    case 'time': return `It's ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    case 'help': return 'I execute approved desktop commands: open apps, open websites or Firefox tabs, search the web, find music, change Windows theme, control volume and media, set timers, and draft a single-page website with approval.'
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
    case 'app': {
      if (process.platform !== 'win32') throw new Error('App launching is available on Windows in this build.')
      if (['files', 'file explorer'].includes(intent.app)) { const error = await shell.openPath(app.getPath('documents')); if (error) throw new Error(error) }
      else if (['vs code', 'vscode', 'visual studio code'].includes(intent.app)) {
        const exe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe')
        try { await fs.access(exe) } catch { throw new Error('VS Code is not installed in its default user location.') }
        await launch(exe)
      } else if (intent.app === 'firefox') await launchFirefox()
      else await launch(intent.app === 'calculator' ? 'calc.exe' : 'notepad.exe')
      return `Opened ${intent.app}.`
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
module.exports = { execute, audit, shutdown: () => { for (const timer of timers) clearTimeout(timer) } }
