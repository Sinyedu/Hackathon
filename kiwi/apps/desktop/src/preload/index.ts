import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels, pingResponseSchema, type KiwiApi } from '@kiwi/shared';

const api: KiwiApi = {
  async ping(request) {
    return pingResponseSchema.parse(await ipcRenderer.invoke(ipcChannels.ping, request));
  },
  overlay: {
    setInteractive: (interactive) =>
      ipcRenderer.send(ipcChannels.overlaySetInteractive, { interactive }),
    dragStart: () => ipcRenderer.send(ipcChannels.overlayDragStart),
    dragMove: (delta) => ipcRenderer.send(ipcChannels.overlayDragMove, delta),
    dragEnd: () => ipcRenderer.send(ipcChannels.overlayDragEnd),
  },
  panel: {
    toggle: () => ipcRenderer.send(ipcChannels.panelToggle),
    hide: () => ipcRenderer.send(ipcChannels.panelHide),
  },
};

contextBridge.exposeInMainWorld('kiwi', api);
