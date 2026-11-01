const { test } = require('node:test')
const assert = require('node:assert/strict')
const { matchStartApp, isShellName, isVagueName, isLaunchable } = require('./installed-apps.cjs')

const apps = [
  { Name: 'Obsidian', AppID: 'obsidian' },
  { Name: 'Adobe Photoshop 2025', AppID: 'ps' },
  { Name: 'Adobe Illustrator 2025', AppID: 'ai' },
  { Name: 'Microsoft Edge', AppID: 'edge' },
  { Name: 'Visual Studio Code', AppID: 'code' },
  { Name: 'Visual Studio 2022', AppID: 'vs' },
  { Name: 'Calculator', AppID: 'calc' },
  { Name: 'Windows PowerShell', AppID: 'ps1' },
  { Name: 'Notepad', AppID: 'np' },
  { Name: 'Notepad++', AppID: 'npp' },
]
const name = (spoken) => matchStartApp(spoken, apps)?.Name ?? null

test('finds an installed app by the name people say, however it is cased or punctuated', () => {
  assert.equal(name('obsidian'), 'Obsidian')
  assert.equal(name('Obsidian app'), 'Obsidian')
  assert.equal(name('the Calculator'), 'Calculator')
  assert.equal(name('photoshop'), 'Adobe Photoshop 2025')
  assert.equal(name('Adobe Illustrator'), 'Adobe Illustrator 2025')
  assert.equal(name('edge'), 'Microsoft Edge')
})
test('prefers the exact name over a longer one that merely contains it', () => {
  assert.equal(name('notepad'), 'Notepad')
  assert.equal(name('visual studio code'), 'Visual Studio Code')
})
test('returns nothing instead of guessing when no installed app fits', () => {
  for (const spoken of ['fortnite', 'nonexistent thing', 'x', '', 'a', 'studio code pro max']) assert.equal(name(spoken), null, spoken)
})
test('shells and registry tools are recognised, whatever the name says', () => {
  for (const text of ['PowerShell', 'windows powershell', 'cmd', 'Command Prompt', 'windows terminal', 'registry editor', 'regedit', 'bash']) assert.equal(isShellName(text), true, text)
  for (const text of ['Notepad', 'Obsidian', 'Photoshop', 'Discord', 'Terminal Velocity game'.replace('Terminal ', 'Velocity ')]) assert.equal(isShellName(text), false, text)
})
test('vague words are not app names', () => {
  for (const text of ['this', 'that', 'it', 'it up', 'something', 'up', 'a program', 'x']) assert.equal(isVagueName(text), true, text)
  for (const text of ['obsidian', 'photoshop', 'my game']) assert.equal(isVagueName(text), false, text)
})

test('Store apps are found by package id even when Windows shows a translated name', () => {
  const danish = [{ Name: 'Notesblok', AppID: 'Microsoft.WindowsNotepad_8wekyb3d8bbwe!App' }, { Name: 'Lommeregner', AppID: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' }, { Name: 'Vejr', AppID: 'Microsoft.BingWeather_8wekyb3d8bbwe!App' }]
  assert.equal(matchStartApp('notepad', danish)?.Name, 'Notesblok')
  assert.equal(matchStartApp('the calculator', danish)?.Name, 'Lommeregner')
  assert.equal(matchStartApp('weather', danish)?.Name, 'Vejr')
  assert.equal(matchStartApp('photos', danish), null)
})
test('Start-menu entries that are web pages or documents are not launchable apps', () => {
  for (const AppID of ['http://unity3d.com/whatsnew.html', 'file://C:/Program Files/PostgreSQL/18/doc/installation-notes', '{6D809377-6AF0-444B-8957-A3773F02200E}/Git/ReleaseNotes.html', 'C:/docs/manual.pdf', 'help.chm', 'x.lnk']) assert.equal(isLaunchable({ Name: 'x', AppID }), false, AppID)
  for (const AppID of ['Microsoft.WindowsNotepad_8wekyb3d8bbwe!App', 'Brave', '{6D809377-6AF0-444B-8957-A3773F02200E}/Git/git-bash.exe', 'Microsoft.Office.ONENOTE.EXE.15']) assert.equal(isLaunchable({ Name: 'x', AppID }), true, AppID)
})

test('app names are found on a Windows in any language, through the English package id', () => {
  const store = (names) => names.map(([Name, id]) => ({ Name, AppID: `${id}_8wekyb3d8bbwe!App` }))
  const languages = {
    danish: store([['Vejr', 'Microsoft.BingWeather'], ['Fotos', 'Microsoft.Windows.Photos'], ['Kamera', 'Microsoft.WindowsCamera'], ['Kort', 'Microsoft.WindowsMaps'], ['Sticky Notes', 'Microsoft.MicrosoftStickyNotes']]),
    german: store([['Wetter', 'Microsoft.BingWeather'], ['Fotos', 'Microsoft.Windows.Photos'], ['Kamera', 'Microsoft.WindowsCamera'], ['Karten', 'Microsoft.WindowsMaps']]),
    french: store([['Météo', 'Microsoft.BingWeather'], ['Photos', 'Microsoft.Windows.Photos'], ['Caméra', 'Microsoft.WindowsCamera'], ['Cartes', 'Microsoft.WindowsMaps']]),
  }
  for (const [language, list] of Object.entries(languages)) {
    for (const [said, expected] of [['weather', 'Microsoft.BingWeather'], ['photos', 'Microsoft.Windows.Photos'], ['camera', 'Microsoft.WindowsCamera'], ['maps', 'Microsoft.WindowsMaps']]) {
      assert.ok(matchStartApp(said, list)?.AppID.startsWith(expected), `${language}: ${said}`)
    }
  }
  assert.equal(matchStartApp('sticky notes', languages.danish)?.Name, 'Sticky Notes')
})
test('generic package words alone never pick an app, and unrelated words still find nothing', () => {
  const list = [{ Name: 'Vejr', AppID: 'Microsoft.BingWeather_8wekyb3d8bbwe!App' }, { Name: 'Kamera', AppID: 'Microsoft.WindowsCamera_8wekyb3d8bbwe!App' }]
  for (const said of ['microsoft', 'windows', 'app', 'microsoft windows', 'bing news', 'fortnite']) assert.equal(matchStartApp(said, list), null, said)
})
