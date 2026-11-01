const { app, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { performance } = require('node:perf_hooks')
const { createTracer } = require('./tracer.cjs')

module.exports = function installAudit() {
  const start = performance.now()
  const output = path.join(__dirname, '..', 'docs', 'audit', 'evidence')
  fs.mkdirSync(output, { recursive: true })
  const tracer = createTracer(path.join(app.getPath('userData'), 'logs'))
  const report = { startedAt: new Date().toISOString(), traceFile: tracer.file, marks: {}, samples: [] }
  const save = () => fs.writeFileSync(path.join(output, 'electron.json'), JSON.stringify(report, null, 2))
  ipcMain.on('kiwi:audit-span', (_event, row) => {
    if (row && ['capture', 'asr', 'wake', 'route', 'llm_first_token', 'tts_first_audio', 'render'].includes(row.span)) {
      tracer.trace(row.span, row.durationMs, row.requestId)
    }
  })
  app.whenReady().then(() => { report.marks.appReadyMs = performance.now() - start; save() })
  app.on('browser-window-created', (_event, window) => {
    report.marks.windowCreatedMs = performance.now() - start
    window.webContents.on('did-finish-load', async () => {
      report.marks.didFinishLoadMs = performance.now() - start
      tracer.trace('render', report.marks.didFinishLoadMs, 'startup')
      try {
        report.page = await window.webContents.executeJavaScript('({ title: document.title, url: location.href, visibility: document.visibilityState, mascotPresent: !!document.querySelector(".kiwi-mascot"), bodyLength: document.body.textContent.length })')
        save()
        const code = fs.readFileSync(path.join(__dirname, 'renderer-audit.js'), 'utf8')
        report.renderer = await Promise.race([
          window.webContents.executeJavaScript(code),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Renderer diagnostic exceeded 20 seconds; capture may require focus')), 20000)),
        ])
      } catch (error) { report.rendererError = error.message }
      save()
    })
    window.webContents.on('render-process-gone', (_event, detail) => { report.rendererExit = detail; save() })
  })
  const timer = setInterval(() => {
    if (!app.isReady()) return
    report.samples.push({ elapsedMs: performance.now() - start, processes: app.getAppMetrics() })
    if (report.samples.length > 120) report.samples.shift()
    save()
  }, 5000)
  app.on('before-quit', () => { clearInterval(timer); save(); void tracer.flush() })
  save()
  if (process.env.KIWI_AUDIT_EXIT_MS) setTimeout(() => app.quit(), Number(process.env.KIWI_AUDIT_EXIT_MS))
}
