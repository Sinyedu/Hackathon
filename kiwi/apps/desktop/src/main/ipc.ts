import { ipcMain } from 'electron';
import {
  chatConfirmSchema,
  chatSendSchema,
  dragMoveSchema,
  ipcChannels,
  pingRequestSchema,
  setInteractiveSchema,
  settingsPatchSchema,
  speakSchema,
  setupPullSchema,
  voiceEventSchema,
  type PingResponse,
} from '@kiwi/shared';
import type { AgentHost } from './agent-host';
import type { MascotController } from './mascot-controller';
import type { SystemSpeech } from './adapters/system-speech';
import type { SetupHost } from './setup-host';
import type { VoiceHost } from './voice-host';

type TrustCheck = (webContentsId: number) => boolean;
type OnTrusted = (channel: string, handle: (payload: unknown) => void) => void;

export function registerIpc(
  controller: MascotController,
  host: AgentHost,
  voice: VoiceHost,
  setup: SetupHost,
  speech: SystemSpeech,
): void {
  const isUi: TrustCheck = (id) => controller.isOwnWebContents(id);
  const isUiOrVoice: TrustCheck = (id) => isUi(id) || voice.isVoiceWindow(id);
  const trusting =
    (check: TrustCheck): OnTrusted =>
    (channel, handle) => {
      ipcMain.on(channel, (event, payload: unknown) => {
        if (check(event.sender.id)) handle(payload);
      });
    };

  // The voice window may only report, submit recognized text and stop. Confirming actions,
  // undo, settings and window control stay with the overlay and panel.
  registerWindowIpc(controller, isUi, trusting(isUi));
  registerChatIpc(host, trusting(isUi), trusting(isUiOrVoice));
  registerVoiceIpc(host, voice, isUi, trusting(isUi), trusting(isUiOrVoice));
  registerSetupIpc(setup, isUi, trusting(isUi));
  registerSpeechIpc(speech, isUiOrVoice, trusting(isUiOrVoice), trusting(isUi), voice);
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

function registerChatIpc(host: AgentHost, onUi: OnTrusted, onUiOrVoice: OnTrusted): void {
  onUiOrVoice(ipcChannels.chatSend, (payload) => {
    const parsed = chatSendSchema.safeParse(payload);
    if (parsed.success) host.send(parsed.data.text);
  });
  onUi(ipcChannels.chatUndo, () => host.undo());
  onUi(ipcChannels.chatConfirm, (payload) => {
    const parsed = chatConfirmSchema.safeParse(payload);
    if (parsed.success) host.confirm(parsed.data.id, parsed.data.accepted);
  });
  onUi(ipcChannels.chatCancel, () => host.cancel());
}

function registerVoiceIpc(
  host: AgentHost,
  voice: VoiceHost,
  isUi: TrustCheck,
  onUi: OnTrusted,
  onUiOrVoice: OnTrusted,
): void {
  onUiOrVoice(ipcChannels.voiceReport, (payload) => {
    const parsed = voiceEventSchema.safeParse(payload);
    if (parsed.success) voice.relay(parsed.data);
  });
  onUi(ipcChannels.voicePushStart, () => voice.command({ type: 'captureStart', via: 'push' }));
  onUi(ipcChannels.voicePushEnd, () => voice.command({ type: 'captureEnd' }));
  onUiOrVoice(ipcChannels.stopAll, () => stopAll(host, voice));
  onUi(ipcChannels.settingsUpdate, (payload) => {
    const parsed = settingsPatchSchema.safeParse(payload);
    if (parsed.success) voice.updateSettings(parsed.data);
  });
  ipcMain.handle(ipcChannels.settingsGet, (event) => {
    if (!isUi(event.sender.id)) throw new Error('Untrusted sender');
    return voice.editableSettings();
  });
}

function registerSpeechIpc(
  speech: SystemSpeech,
  isTrusted: TrustCheck,
  onUiOrVoice: OnTrusted,
  onUi: OnTrusted,
  voice: VoiceHost,
): void {
  ipcMain.handle(ipcChannels.voiceSpeak, async (event, payload: unknown) => {
    if (!isTrusted(event.sender.id)) throw new Error('Untrusted sender');
    await speech.speak(speakSchema.parse(payload).text);
  });
  ipcMain.handle(ipcChannels.voiceSpeechAvailable, (event) => {
    if (!isTrusted(event.sender.id)) throw new Error('Untrusted sender');
    return speech.available();
  });
  onUiOrVoice(ipcChannels.voiceSpeakCancel, () => speech.cancel());
  onUi(ipcChannels.voiceTest, () => voice.command({ type: 'speakTest' }));
}

function registerSetupIpc(setup: SetupHost, isUi: TrustCheck, onUi: OnTrusted): void {
  ipcMain.handle(ipcChannels.setupStatus, (event) => {
    if (!isUi(event.sender.id)) throw new Error('Untrusted sender');
    return setup.status();
  });
  onUi(ipcChannels.setupPull, (payload) => {
    const parsed = setupPullSchema.safeParse(payload);
    if (parsed.success) setup.pull(parsed.data.model);
  });
}

/** The kill switch: audio, the agent run and any pending confirmation stop together. */
export function stopAll(host: AgentHost, voice: VoiceHost, speech?: SystemSpeech): void {
  host.cancel();
  speech?.cancel();
  voice.command({ type: 'stopAll' });
}
