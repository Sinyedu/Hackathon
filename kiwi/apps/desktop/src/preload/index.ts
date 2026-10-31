import { contextBridge, ipcRenderer } from 'electron';
import {
  agentEventSchema,
  ipcChannels,
  pingResponseSchema,
  pullProgressSchema,
  setupStatusSchema,
  voiceCommandSchema,
  voiceEventSchema,
  editableSettingsSchema,
  type KiwiApi,
} from '@kiwi/shared';
import type { ZodType } from 'zod';

function subscribe<T>(
  channel: string,
  schema: ZodType<T>,
  handler: (value: T) => void,
): () => void {
  const listener = (_event: unknown, payload: unknown): void => {
    const parsed = schema.safeParse(payload);
    if (parsed.success) handler(parsed.data);
    else console.error(`Ignored malformed message on ${channel}`, parsed.error.message);
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

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
  onAgentEvent: (handler) => subscribe(ipcChannels.agentEvent, agentEventSchema, handler),
  voice: {
    report: (event) => ipcRenderer.send(ipcChannels.voiceReport, event),
    onEvent: (handler) => subscribe(ipcChannels.voiceEvent, voiceEventSchema, handler),
    onCommand: (handler) => subscribe(ipcChannels.voiceCommand, voiceCommandSchema, handler),
    pushStart: () => ipcRenderer.send(ipcChannels.voicePushStart),
    pushEnd: () => ipcRenderer.send(ipcChannels.voicePushEnd),
    speak: async (text) => {
      await ipcRenderer.invoke(ipcChannels.voiceSpeak, { text });
    },
    cancelSpeech: () => ipcRenderer.send(ipcChannels.voiceSpeakCancel),
    speechAvailable: async () =>
      (await ipcRenderer.invoke(ipcChannels.voiceSpeechAvailable)) === true,
    test: () => ipcRenderer.send(ipcChannels.voiceTest),
  },
  settings: {
    get: async () =>
      editableSettingsSchema.parse(await ipcRenderer.invoke(ipcChannels.settingsGet)),
    update: (change) => ipcRenderer.send(ipcChannels.settingsUpdate, change),
  },
  setup: {
    status: async () => setupStatusSchema.parse(await ipcRenderer.invoke(ipcChannels.setupStatus)),
    pull: (model) => ipcRenderer.send(ipcChannels.setupPull, { model }),
    onProgress: (handler) => subscribe(ipcChannels.setupProgress, pullProgressSchema, handler),
  },
  stopAll: () => ipcRenderer.send(ipcChannels.stopAll),
};

contextBridge.exposeInMainWorld('kiwi', api);
