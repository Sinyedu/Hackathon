import { contextBridge, ipcRenderer } from 'electron';
import { agentEventSchema, ipcChannels, pingResponseSchema, type KiwiApi } from '@kiwi/shared';

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
  chat: {
    send: (text) => ipcRenderer.send(ipcChannels.chatSend, { text }),
    undo: () => ipcRenderer.send(ipcChannels.chatUndo),
    confirm: (id, accepted) => ipcRenderer.send(ipcChannels.chatConfirm, { id, accepted }),
    cancel: () => ipcRenderer.send(ipcChannels.chatCancel),
  },
  onAgentEvent(handler) {
    const listener = (_event: unknown, payload: unknown): void => {
      const parsed = agentEventSchema.safeParse(payload);
      if (parsed.success) handler(parsed.data);
      else console.error('Ignored malformed agent event', parsed.error.message);
    };
    ipcRenderer.on(ipcChannels.agentEvent, listener);
    return () => ipcRenderer.removeListener(ipcChannels.agentEvent, listener);
  },
};

contextBridge.exposeInMainWorld('kiwi', api);
