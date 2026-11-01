const { app, BrowserWindow } = require('electron')
// Run with Electron, not Node: rasterize the supplied vector in Chromium.
const fs = require('node:fs/promises')
const path = require('node:path')
app.whenReady().then(async () => {
  const source = await fs.readFile(path.join(__dirname, '../fixtures/samples/kiwi-mascot-transparent.svg'))
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
  await window.loadURL('data:text/html,<title>Kiwi icon build</title>')
  const imageUrl = `data:image/svg+xml;base64,${source.toString('base64')}`
  const data = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; canvas.getContext('2d').drawImage(image,0,0,256,256); resolve(canvas.toDataURL('image/png').split(',')[1]); }; image.onerror = reject; image.src = ${JSON.stringify(imageUrl)};
  })`)
  const png = Buffer.from(data, 'base64'), header = Buffer.alloc(22)
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18)
  const out = path.join(__dirname, '../frontend/build'); await fs.mkdir(out, { recursive: true })
  await fs.writeFile(path.join(out, 'kiwi.ico'), Buffer.concat([header, png]))
  await fs.writeFile(path.join(out, 'kiwi.png'), png)
  console.log('Generated Kiwi app and tray icons from the supplied SVG.')
  app.quit()
}).catch((error) => { console.error(error); app.exit(1) })
