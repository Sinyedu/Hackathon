const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('kiwiDesktop', {
  isDesktop: true, platform: process.platform,
  settings: () => ipcRenderer.invoke('kiwi:settings'),
  save: (input) => ipcRenderer.invoke('kiwi:save', input),
  health: () => ipcRenderer.invoke('kiwi:health'),
  send: (input) => ipcRenderer.invoke('kiwi:send', input),
  transcribe: (bytes) => ipcRenderer.invoke('kiwi:transcribe', bytes),
  downloadSpeech: () => ipcRenderer.invoke('kiwi:download-speech'),
  expand: (expanded) => ipcRenderer.send('kiwi:expand', expanded),
  stop: () => ipcRenderer.send('kiwi:stop'),
  hide: () => ipcRenderer.send('kiwi:hide'), quit: () => ipcRenderer.send('kiwi:quit'),
  onEvent: (callback) => { const listener = (_event, value) => callback(value); ipcRenderer.on('kiwi:event', listener); return () => ipcRenderer.removeListener('kiwi:event', listener) },
})
