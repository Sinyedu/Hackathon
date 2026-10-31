import { ipcMain } from 'electron';
import {
  chatConfirmSchema,
  chatSendSchema,
  dragMoveSchema,
  ipcChannels,
  pingRequestSchema,
  setInteractiveSchema,
  type PingResponse,
} from '@kiwi/shared';
import type { AgentHost } from './agent-host';
import type { MascotController } from './mascot-controller';

export function registerIpc(controller: MascotController, host: AgentHost): void {
  const onTrusted = (channel: string, handle: (payload: unknown) => void): void => {
    ipcMain.on(channel, (event, payload: unknown) => {
      if (controller.isOwnWebContents(event.sender.id)) handle(payload);
    });
  };

  ipcMain.handle(ipcChannels.ping, (event, payload: unknown): PingResponse => {
    if (!controller.isOwnWebContents(event.sender.id)) throw new Error('Untrusted sender');
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
