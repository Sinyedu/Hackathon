import { ipcMain } from 'electron';
import {
  chatConfirmSchema,
  chatSendSchema,
  dragMoveSchema,
  ipcChannels,
  pingRequestSchema,
  setInteractiveSchema,
  voiceEventSchema,
  voiceSettingsPatchSchema,
  type PingResponse,
} from '@kiwi/shared';
import type { AgentHost } from './agent-host';
import type { MascotController } from './mascot-controller';
import type { VoiceHost } from './voice-host';

type TrustCheck = (webContentsId: number) => boolean;
type OnTrusted = (channel: string, handle: (payload: unknown) => void) => void;

export function registerIpc(controller: MascotController, host: AgentHost, voice: VoiceHost): void {
  const isTrusted: TrustCheck = (id) => controller.isOwnWebContents(id) || voice.isVoiceWindow(id);
  const onTrusted: OnTrusted = (channel, handle) => {
    ipcMain.on(channel, (event, payload: unknown) => {
      if (isTrusted(event.sender.id)) handle(payload);
    });
  };

  registerWindowIpc(controller, isTrusted, onTrusted);
  registerChatIpc(host, onTrusted);
  registerVoiceIpc(host, voice, isTrusted, onTrusted);
}

function registerWindowIpc(
  controller: MascotController,
  isTrusted: TrustCheck,
  onTrusted: OnTrusted,
): void {
  ipcMain.handle(ipcChannels.ping, (event, payload: unknown): PingResponse => {
    if (!isTrusted(event.sender.id)) throw new Error('Untrusted sender');
    const request = pingRequestSchema.parse(payload);
    return { reply: `pong: ${request.message}`, receivedAt: Date.now() };
  });
  onTrusted(ipcChannels.overlaySetInteractive, (payload) => {
    const parsed = setInteractiveSchema.safeParse(payload);
    if (parsed.success) controller.setInteractive(parsed.data.interactive);
  });
  onTrusted(ipcChannels.overlayDragStart, () => controller.dragStart());
  onTrusted(ipcChannels.overlayDragMove, (payload) => {
    const parsed = dragMoveSchema.safeParse(payload);
    if (parsed.success) controller.dragMove(parsed.data);
  });
  onTrusted(ipcChannels.overlayDragEnd, () => controller.dragEnd());
  onTrusted(ipcChannels.panelToggle, () => controller.togglePanel());
  onTrusted(ipcChannels.panelHide, () => controller.hidePanel());
}

function registerChatIpc(host: AgentHost, onTrusted: OnTrusted): void {
  onTrusted(ipcChannels.chatSend, (payload) => {
    const parsed = chatSendSchema.safeParse(payload);
    if (parsed.success) host.send(parsed.data.text);
  });
  onTrusted(ipcChannels.chatUndo, () => host.undo());
  onTrusted(ipcChannels.chatConfirm, (payload) => {
    const parsed = chatConfirmSchema.safeParse(payload);
    if (parsed.success) host.confirm(parsed.data.id, parsed.data.accepted);
  });
  onTrusted(ipcChannels.chatCancel, () => host.cancel());
}

function registerVoiceIpc(
  host: AgentHost,
  voice: VoiceHost,
  isTrusted: TrustCheck,
  onTrusted: OnTrusted,
): void {
  onTrusted(ipcChannels.voiceReport, (payload) => {
    const parsed = voiceEventSchema.safeParse(payload);
    if (parsed.success) voice.relay(parsed.data);
  });
  onTrusted(ipcChannels.voicePushStart, () => voice.command({ type: 'captureStart', via: 'push' }));
  onTrusted(ipcChannels.voicePushEnd, () => voice.command({ type: 'captureEnd' }));
  onTrusted(ipcChannels.stopAll, () => stopAll(host, voice));
  onTrusted(ipcChannels.settingsUpdate, (payload) => {
    const parsed = voiceSettingsPatchSchema.safeParse(payload);
    if (parsed.success) voice.updateSettings(parsed.data);
  });
  ipcMain.handle(ipcChannels.settingsGet, (event) => {
    if (!isTrusted(event.sender.id)) throw new Error('Untrusted sender');
    return voice.voiceSettings();
  });
}

/** The kill switch: audio, the agent run and any pending confirmation stop together. */
export function stopAll(host: AgentHost, voice: VoiceHost): void {
  host.cancel();
  voice.command({ type: 'stopAll' });
}
