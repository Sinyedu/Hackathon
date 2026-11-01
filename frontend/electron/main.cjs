const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, session } = require('electron')
const path = require('node:path')
const settings = require('./settings.cjs')
const provider = require('./provider.cjs')
const voice = require('./voice.cjs')
const listener = require('./listener.cjs')
const actions = require('./actions.cjs')
const { intentOf } = require('./intent.cjs')
let window, tray, cursorTimer, current, quitting = false
const started = performance.now()
const events = []
let listeningShot = false
app.setName('Kiwi')
const voiceSmoke = process.argv.includes('--voice-smoke') && !!process.env.KIWI_SMOKE_WAV
if (voiceSmoke) {
  const directory = path.join(app.getPath('temp'), 'KiwiVoiceQA')
  require('node:fs').mkdirSync(directory, { recursive: true })
  app.setPath('userData', directory)
}
app.setAppUserModelId('com.kiwi.companion')
const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()
function publish(type, data = {}) {
  if (voiceSmoke && (type.startsWith('voice-') || ['delta', 'done', 'error'].includes(type))) events.push({ type, ...data })
  if (window && !window.isDestroyed()) window.webContents.send('kiwi:event', { type, ...data })
  if (voiceSmoke && type === 'voice-wake' && !listeningShot && process.env.KIWI_SMOKE_REPORT) {
    listeningShot = true
    setTimeout(async () => {
      const state = await window.webContents.executeJavaScript(`({ speaker: getComputedStyle(document.querySelector('.kiwi-speaker')).display, smile: getComputedStyle(document.querySelector('.kiwi-mouth')).display, caption: document.querySelector('.companion-live-caption')?.textContent })`)
      events.push({ mark: 'wake-ui', ...state })
      await require('node:fs/promises').writeFile(process.env.KIWI_SMOKE_REPORT + '.listening.png', (await window.webContents.capturePage()).toPNG())
    }, 250)
  }
}
function stop(notify = true) { current?.abort(); current = null; if (notify) { listener.cancel(); publish('voice-reset'); publish('stop') } }
function bounds(expanded, caption = false) {
  const area = screen.getDisplayMatching(window?.getBounds() || screen.getPrimaryDisplay().workArea).workArea
  const width = expanded ? Math.min(420, area.width) : caption ? Math.min(360, area.width) : 160
  const height = expanded ? Math.min(670, area.height) : caption ? 275 : 190
  window.setBounds({ x: area.x + area.width - width - 12, y: area.y + area.height - height - 12, width, height })
}
function reveal() { if (window && !window.isDestroyed()) { bounds(true); window.show(); publish('expand', { expanded: true }); window.focus() } }
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted desktop request.')
}
async function respond(text, id) {
  const controller = new AbortController(); current = controller
  const intent = intentOf(text)
  const timeout = setTimeout(() => controller.abort(), intent.type === 'build' ? 180000 : 60000)
  try {
    if (intent.type !== 'chat') {
      if (intent.type === 'stop') { stop(); return }
      try {
        const answer = intent.type === 'build' ? await require('./coding.cjs').build(intent.description, controller.signal) : await actions.execute(intent)
        await actions.audit(intent.type, true)
        if (!controller.signal.aborted) publish('delta', { id, text: answer })
      } catch (error) { await actions.audit(intent.type, false); throw error }
    } else if (intent.type === 'unsupported') {
      throw new Error('I only execute desktop commands. Try “open Firefox”, “open a new tab in Firefox”, “search for…”, or “volume down”.')
    }
    if (!controller.signal.aborted) publish('done', { id })
  } catch (error) { if (!controller.signal.aborted) publish('error', { id, message: error.message }); else publish('cancelled', { id }) }
  finally { clearTimeout(timeout); if (current === controller) current = null }
}
function registerIpc() {
  ipcMain.handle('kiwi:listen', (event, enabled) => {
    trusted(event)
    if (!enabled) { listener.shutdown(); return { status: 'off' } }
    return listener.start((type, data) => { if (type === 'voice-stop') stop(); publish(type, data) })
  })
  ipcMain.on('kiwi:listen-mode', (event, value) => { trusted(event); if (['armed', 'busy', 'paused'].includes(value)) listener.mode(value) })
  ipcMain.on('kiwi:caption', (event, visible) => { trusted(event); if (window.getBounds().width < 420) bounds(false, !!visible) })
  ipcMain.handle('kiwi:settings', (event) => { trusted(event); return settings.publicSettings() })
  ipcMain.handle('kiwi:save', async (event, input) => { trusted(event); const saved = await settings.save(input || {}); publish('settings', { settings: saved }); return saved })
  ipcMain.handle('kiwi:health', async (event) => { trusted(event); return provider.health() })
  ipcMain.handle('kiwi:transcribe', (event, data) => { trusted(event); return voice.transcribe(data) })
  ipcMain.handle('kiwi:download-speech', (event) => { trusted(event); return voice.download() })
  ipcMain.handle('kiwi:send', (event, input) => {
    trusted(event)
    if (typeof input?.text !== 'string' || !input.text.trim() || input.text.length > 2000 || !/^[\w-]{1,80}$/.test(input.id)) throw new Error('Message is empty or too long.')
    stop(false); void respond(input.text.trim(), input.id); return true
  })
  ipcMain.on('kiwi:stop', (event) => { trusted(event); stop() })
  ipcMain.on('kiwi:expand', (event, expanded) => { trusted(event); bounds(!!expanded) })
  ipcMain.on('kiwi:hide', (event) => { trusted(event); stop(); window.hide(); publish('pause') })
  ipcMain.on('kiwi:quit', (event) => { trusted(event); app.quit() })
}
async function createWindow() {
  window = new BrowserWindow({ width: 160, height: 190, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, maximizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } })
  bounds(false)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.once('ready-to-show', () => { window.showInactive(); events.push({ mark: 'mascot-ready', durationMs: performance.now() - started }) })
  window.on('close', (event) => { if (!quitting) { event.preventDefault(); stop(); publish('pause'); window.hide() } })
  await window.loadFile(path.join(__dirname, '../dist/index.html'), { query: { companion: '1' } })
  if (voiceSmoke) await window.webContents.executeJavaScript(`{ const originalSpeak = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = (utterance) => { utterance.addEventListener('start', () => { window.__kiwiSpeechStarted = true; }); originalSpeak(utterance); }; true; }`)
  const icon = nativeImage.createFromPath(path.join(__dirname, '../build/kiwi.png')).resize({ width: 24, height: 24 })
  tray = new Tray(icon)
  tray.setToolTip('Kiwi - your desktop companion')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Talk to Kiwi', click: reveal }, { label: 'Stop / cancel (Ctrl+Shift+.)', click: stop },
    { label: 'Pause microphone', click: () => publish('pause') },
    { label: 'Hide Kiwi', click: () => { publish('pause'); window.hide() } },
    { type: 'separator' }, { label: 'Quit Kiwi', click: () => app.quit() },
  ]))
  tray.on('double-click', reveal)
  let previous = ''
  cursorTimer = setInterval(() => {
    if (window.isDestroyed() || !window.isVisible()) return
    const point = screen.getCursorScreenPoint(), rect = window.getBounds()
    const value = `${point.x},${point.y}`
    if (value !== previous) { publish('cursor', { x: point.x - rect.x, y: point.y - rect.y }); previous = value }
  }, 50)
  globalShortcut.register('CommandOrControl+Shift+Space', () => { reveal(); publish('mic') })
  globalShortcut.register('CommandOrControl+Shift+.', stop)
  if (voiceSmoke) setTimeout(async () => {
    const fs = require('node:fs/promises')
    const ui = await window.webContents.executeJavaScript(`({ caption: document.querySelector('.companion-live-caption')?.textContent, badge: document.querySelector('.companion-pet__status')?.textContent, speaker: !!document.querySelector('.kiwi-speaker'), desktop: !!window.kiwiDesktop, voiceOutputStarted: !!window.__kiwiSpeechStarted })`)
    const report = { fixture: 'Synthetic Windows speech, actual native wake, Whisper verification and application command pipeline', events, ui, bounds: window.getBounds() }
    if (process.env.KIWI_SMOKE_REPORT) {
      await fs.writeFile(process.env.KIWI_SMOKE_REPORT, JSON.stringify(report, null, 2))
      await fs.writeFile(`${process.env.KIWI_SMOKE_REPORT}.png`, (await window.webContents.capturePage()).toPNG())
    }
    app.quit()
  }, 13000)
  if (process.argv.includes('--smoke')) setTimeout(async () => {
    const fs = require('node:fs/promises')
    const report = { events, bounds: window.getBounds(), alwaysOnTop: window.isAlwaysOnTop(), provider: await provider.health(), renderer: await window.webContents.executeJavaScript('({ mascot: !!document.querySelector("#kiwi"), eyes: document.querySelectorAll(".kiwi-eyes").length, desktop: !!window.kiwiDesktop, bodyTransparent: getComputedStyle(document.body).backgroundColor })'), processes: app.getAppMetrics() }
    bounds(true); publish('expand', { expanded: true })
    await new Promise((resolve) => setTimeout(resolve, 300))
    report.chat = await window.webContents.executeJavaScript(`new Promise(async (resolve) => {
      const id = 'smoke-local-chat'; let answer = ''; const started = performance.now();
      const timeout = setTimeout(() => { off(); resolve({ error: 'timeout' }) }, 45000);
      const off = window.kiwiDesktop.onEvent(e => { if (e.id !== id) return; if (e.type === 'delta') answer += e.text; if (e.type === 'done' || e.type === 'error') { clearTimeout(timeout); off(); resolve({ answer, error: e.message, elapsedMs: performance.now() - started }); } });
      try { await window.kiwiDesktop.send({ id, text: 'Introduce yourself in one sentence.', history: [] }); } catch(e) { clearTimeout(timeout); off(); resolve({ error: e.message }); }
    })`)
    report.audio = await window.webContents.executeJavaScript(`(async () => {
      const result = { voices: speechSynthesis.getVoices().length, secureContext: isSecureContext };
      try { const stream = await navigator.mediaDevices.getUserMedia({audio:true}); result.capture = true; result.sampleRate = stream.getAudioTracks()[0].getSettings().sampleRate; stream.getTracks().forEach(t=>t.stop()); } catch(e) { result.captureError = e.name; }
      return result;
    })()`)
    if (process.env.KIWI_SMOKE_WAV) {
      const before = performance.now()
      try { report.speech = { text: await voice.transcribe(new Uint8Array(await fs.readFile(process.env.KIWI_SMOKE_WAV))), elapsedMs: performance.now() - before } }
      catch (error) { report.speech = { error: error.message } }
    }
    publish('cursor', { x: -900, y: -900 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    report.eyeMovement = await window.webContents.executeJavaScript('({ x: document.querySelector(".living-kiwi").style.getPropertyValue("--gaze-x"), y: document.querySelector(".living-kiwi").style.getPropertyValue("--gaze-y") })')
    if (process.env.KIWI_SMOKE_REPORT) {
      await fs.writeFile(`${process.env.KIWI_SMOKE_REPORT}.png`, (await window.webContents.capturePage()).toPNG())
      await fs.writeFile(process.env.KIWI_SMOKE_REPORT, JSON.stringify(report, null, 2))
    }
    app.quit()
  }, 4000)
}
if (lock) {
  app.on('second-instance', reveal)
  app.whenReady().then(async () => {
    await settings.load()
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(contents === window?.webContents && permission === 'media'))
    session.defaultSession.setPermissionCheckHandler((contents, permission) => contents === window?.webContents && permission === 'media')
    registerIpc(); provider.startOllama(); await createWindow()
  }).catch(async (error) => {
    const fs = require('node:fs/promises'), directory = path.join(app.getPath('userData'), 'logs')
    await fs.mkdir(directory, { recursive: true }).then(() => fs.appendFile(path.join(directory, 'startup.log'), `${new Date().toISOString()} ${error.stack || error.message}\n`)).catch(() => {})
    require('electron').dialog.showErrorBox('Kiwi could not start', error.message); app.quit()
  })
}
app.on('before-quit', () => { quitting = true; stop(); clearInterval(cursorTimer); globalShortcut.unregisterAll(); listener.shutdown(); actions.shutdown(); voice.shutdown(); provider.shutdown(); tray?.destroy() })
app.on('window-all-closed', () => { if (quitting) app.quit() })
