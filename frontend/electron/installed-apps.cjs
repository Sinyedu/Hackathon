// "Open Obsidian" for any app the user has installed: names are matched against Windows' own Start-menu list
// (classic and Store apps). The launch target is the entry Windows lists, never something built from speech.
const { execFile } = require('node:child_process')

const normalise = (text) => text.toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\b(?:the|app|application|program)\b/g, ' ').replace(/\s+/g, ' ').trim()

// Opening a window is harmless, but Kiwi must not become a voice-driven shell, so these stay unsupported.
const SHELLS = /\b(?:powershell|pwsh|cmd|command prompt|terminal|registry editor|regedit|bash|wsl)\b/
const isShellName = (text) => SHELLS.test(normalise(text))

// Words that mean "something" rather than naming an app ("open this", "open it up").
const VAGUE = new Set(['this', 'that', 'it', 'it up', 'one', 'something', 'anything', 'up', 'something up', 'stuff', 'program', 'an app', 'a program', 'an application'])
const isVagueName = (text) => VAGUE.has(text.toLowerCase().trim()) || normalise(text).length < 2

// Store apps keep an English package id in every language, but their display name is localised
// ("Notepad" is "Notesblok" on a Danish Windows). Common ones are matched by package id instead.
const PACKAGE_ALIASES = {
  notepad: 'Microsoft.WindowsNotepad', calculator: 'Microsoft.WindowsCalculator', photos: 'Microsoft.Windows.Photos', weather: 'Microsoft.BingWeather',
  camera: 'Microsoft.WindowsCamera', clock: 'Microsoft.WindowsAlarms',
  alarms: 'Microsoft.WindowsAlarms', maps: 'Microsoft.WindowsMaps', 'sticky notes': 'Microsoft.MicrosoftStickyNotes', store: 'Microsoft.WindowsStore',
  'microsoft store': 'Microsoft.WindowsStore', 'voice recorder': 'Microsoft.WindowsSoundRecorder', 'snipping tool': 'Microsoft.ScreenSketch',
  'media player': 'Microsoft.ZuneMusic', xbox: 'Microsoft.GamingApp', 'phone link': 'Microsoft.YourPhone', 'to do': 'Microsoft.Todos', clipchamp: 'Clipchamp.Clipchamp',
}

// Start-menu entries that are really web pages or documents (release notes, help files) are not apps.
const isLaunchable = (app) => typeof app?.AppID === 'string' && !/:\/\//.test(app.AppID) && !/\.(?:html?|url|chm|txt|pdf|md|rtf|docx?|lnk)$/i.test(app.AppID)

// Words in a Store package id: "Microsoft.BingWeather_8wekyb3d8bbwe!App" -> bing, weather. The id is English in every
// language, so "weather" finds the app on a Danish, German or French Windows, where its display name is "Vejr", "Wetter", "Météo".
const GENERIC_TOKENS = new Set(['microsoft', 'windows', 'app', 'apps', 'the'])
function packageTokens(appId) {
  const id = String(appId)
  if (!id.includes('!')) return []
  return id.split('!')[0].split('_')[0].split('.').flatMap((part) => part.split(/(?=[A-Z])/)).map((token) => token.toLowerCase()).filter(Boolean)
}

/** The installed app whose name best fits what was said: exact, then prefix, then containing all words. */
function matchStartApp(spoken, apps) {
  const wanted = normalise(spoken)
  if (wanted.length < 2) return null
  const words = wanted.split(' ')
  const packagePrefix = PACKAGE_ALIASES[wanted]?.toLowerCase()
  const byPackage = packagePrefix && apps.find((app) => String(app.AppID).toLowerCase().startsWith(packagePrefix))
  if (byPackage) return byPackage
  const candidates = apps.map((app) => ({ app, name: normalise(app.Name || '') })).filter((entry) => entry.name)
  const tiers = [
    (entry) => entry.name === wanted,
    (entry) => entry.name.startsWith(wanted + ' ') || wanted.startsWith(entry.name + ' '),
    (entry) => words.every((word) => entry.name.split(' ').includes(word)),
  ]
  for (const fits of tiers) {
    const found = candidates.filter(fits).sort((a, b) => a.name.length - b.name.length)
    if (found.length) return found[0].app
  }
  const meaningful = words.filter((word) => !GENERIC_TOKENS.has(word))
  if (meaningful.length) {
    const byTokens = apps.filter((app) => { const tokens = packageTokens(app.AppID); return meaningful.every((word) => tokens.includes(word) || tokens.includes(word.replace(/s$/, ''))) })
    if (byTokens.length) return byTokens.sort((a, b) => String(a.AppID).length - String(b.AppID).length)[0]
  }
  return null
}

let cache = { at: 0, apps: [] }
function loadStartApps() {
  if (Date.now() - cache.at < 10 * 60 * 1000 && cache.apps.length) return Promise.resolve(cache.apps)
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress'],
      { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
        if (error) return reject(new Error('Windows would not list your installed apps.'))
        try {
          const parsed = JSON.parse(stdout)
          cache = { at: Date.now(), apps: (Array.isArray(parsed) ? parsed : [parsed]).filter((app) => app?.Name && isLaunchable(app)) }
          resolve(cache.apps)
        } catch { reject(new Error('Windows returned an app list Kiwi could not read.')) }
      })
  })
}

/** Opens a Start-menu entry by its Windows-supplied id. Explorer reports exit code 1 even on success, so only a spawn failure counts. */
function launchStartApp(app) {
  if (typeof app.AppID !== 'string' || app.AppID.length > 400 || /["<>|]/.test(app.AppID) || [...app.AppID].some((ch) => ch.charCodeAt(0) < 32)) return Promise.reject(new Error('That app entry looks unsafe to open.'))
  return new Promise((resolve, reject) => {
    execFile('explorer.exe', [`shell:AppsFolder\\${app.AppID}`], { windowsHide: false, timeout: 8000 }, () => resolve())
      .once('error', () => reject(new Error('Windows could not open that app.')))
  })
}

module.exports = { isLaunchable, matchStartApp, loadStartApps, launchStartApp, isShellName, isVagueName, normalise }
