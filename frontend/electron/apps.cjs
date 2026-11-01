// Desktop apps Kiwi may launch. Names map to fixed launch targets; nothing here is built from user text.
// Pure data (no Electron import) so intent.cjs and its plain-node tests can share it.

/** Apps with a web twin: open the installed app when its protocol is registered, otherwise the website. */
const desktopApps = {
  discord: { label: 'Discord', scheme: 'discord', uri: 'discord://-/channels/@me', web: 'https://discord.com/app' },
  spotify: { label: 'Spotify', scheme: 'spotify', uri: 'spotify:', web: 'https://open.spotify.com' },
  steam: { label: 'Steam', scheme: 'steam', uri: 'steam://open/main', web: 'https://store.steampowered.com' },
}

/** Apps launched from a fixed executable or Windows URI. */
const localApps = {
  notepad: { label: 'Notepad', exe: 'notepad.exe' },
  calculator: { label: 'Calculator', exe: 'calc.exe' },
  paint: { label: 'Paint', exe: 'mspaint.exe' },
  'task manager': { label: 'Task Manager', exe: 'taskmgr.exe' },
  settings: { label: 'Settings', uri: 'ms-settings:' },
  files: { label: 'Files' },
  'vs code': { label: 'VS Code' },
  firefox: { label: 'Firefox' },
  chrome: { label: 'Chrome', paths: [['ProgramFiles', 'Google/Chrome/Application/chrome.exe'], ['ProgramFiles(x86)', 'Google/Chrome/Application/chrome.exe'], ['LOCALAPPDATA', 'Google/Chrome/Application/chrome.exe']] },
  edge: { label: 'Edge', paths: [['ProgramFiles(x86)', 'Microsoft/Edge/Application/msedge.exe'], ['ProgramFiles', 'Microsoft/Edge/Application/msedge.exe']] },
  opera: { label: 'Opera', paths: [['LOCALAPPDATA', 'Programs/Opera GX/opera.exe'], ['LOCALAPPDATA', 'Programs/Opera/opera.exe']] },
}

const aliases = {
  'file explorer': 'files', vscode: 'vs code', 'visual studio code': 'vs code', 'google chrome': 'chrome',
  'microsoft edge': 'edge', 'opera gx': 'opera', 'windows settings': 'settings', 'task-manager': 'task manager', calc: 'calculator',
}

/** "Google Chrome" -> "chrome"; null when the name is not a launchable local app. */
function localAppName(name) {
  const key = aliases[name] || name
  return key in localApps ? key : null
}

/** Programs Kiwi may ask to close, by the fixed process name. Kiwi itself, Explorer and system apps are not here. */
const processes = {
  notepad: 'notepad.exe', calculator: 'CalculatorApp.exe', paint: 'mspaint.exe', discord: 'Discord.exe', spotify: 'Spotify.exe',
  steam: 'steam.exe', firefox: 'firefox.exe', chrome: 'chrome.exe', edge: 'msedge.exe', opera: 'opera.exe', 'vs code': 'Code.exe',
}

/** "Google Chrome" -> "chrome"; null when Kiwi is not allowed to close it. */
function closableName(name) {
  const key = aliases[name] || name
  return key in processes ? key : null
}

const labelOf = (key) => localApps[key]?.label || desktopApps[key]?.label || key

const siteLabels = { github: 'GitHub', youtube: 'YouTube', google: 'Google', gmail: 'Gmail', discord: 'Discord', spotify: 'Spotify', steam: 'Steam' }
/** How a name is shown back to the user: "github" -> "GitHub". */
const displayName = (name) => siteLabels[name] || name.charAt(0).toUpperCase() + name.slice(1)

module.exports = { desktopApps, localApps, localAppName, closableName, processes, labelOf, displayName }
