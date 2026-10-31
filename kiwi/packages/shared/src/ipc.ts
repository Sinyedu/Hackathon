import { z } from 'zod';
import { voiceSettingsSchema } from './settings';
import type { AgentEvent } from './agent-events';
import type { VoiceCommand, VoiceEvent } from './voice';
import type { VoiceSettings } from './settings';

/** Every IPC channel name lives here and nowhere else. */
export const ipcChannels = {
  ping: 'kiwi:ping',
  overlaySetInteractive: 'kiwi:overlay:set-interactive',
  overlayDragStart: 'kiwi:overlay:drag-start',
  overlayDragMove: 'kiwi:overlay:drag-move',
  overlayDragEnd: 'kiwi:overlay:drag-end',
  panelToggle: 'kiwi:panel:toggle',
  panelHide: 'kiwi:panel:hide',
  chatSend: 'kiwi:chat:send',
  chatUndo: 'kiwi:chat:undo',
  chatConfirm: 'kiwi:chat:confirm',
  chatCancel: 'kiwi:chat:cancel',
  agentEvent: 'kiwi:agent:event',
  voiceReport: 'kiwi:voice:report',
  voiceEvent: 'kiwi:voice:event',
  voiceCommand: 'kiwi:voice:command',
  voicePushStart: 'kiwi:voice:push-start',
  voicePushEnd: 'kiwi:voice:push-end',
  stopAll: 'kiwi:stop-all',
  settingsGet: 'kiwi:settings:get',
  settingsUpdate: 'kiwi:settings:update',
} as const;

export const pingRequestSchema = z.object({ message: z.string().max(200) });
export const pingResponseSchema = z.object({ reply: z.string(), receivedAt: z.number() });
export const setInteractiveSchema = z.object({ interactive: z.boolean() });
export const dragMoveSchema = z.object({ dx: z.number(), dy: z.number() });

export const chatSendSchema = z.object({ text: z.string().trim().min(1).max(2000) });
export const chatConfirmSchema = z.object({ id: z.string(), accepted: z.boolean() });

export const voiceSettingsPatchSchema = voiceSettingsSchema.partial();

export type PingRequest = z.infer<typeof pingRequestSchema>;
export type PingResponse = z.infer<typeof pingResponseSchema>;
export type SetInteractive = z.infer<typeof setInteractiveSchema>;
export type DragMove = z.infer<typeof dragMoveSchema>;

/** The typed surface the preload script exposes as `window.kiwi`. */
export interface KiwiApi {
  ping(request: PingRequest): Promise<PingResponse>;
  overlay: {
    setInteractive(interactive: boolean): void;
    dragStart(): void;
    dragMove(delta: DragMove): void;
    dragEnd(): void;
  };
  panel: {
    toggle(): void;
    hide(): void;
  };
  chat: {
    send(text: string): void;
    undo(): void;
    confirm(id: string, accepted: boolean): void;
    cancel(): void;
  };
  voice: {
    /** Called by the voice window to report what it is doing. */
    report(event: VoiceEvent): void;
    onEvent(handler: (event: VoiceEvent) => void): () => void;
    onCommand(handler: (command: VoiceCommand) => void): () => void;
    pushStart(): void;
    pushEnd(): void;
  };
  settings: {
    get(): Promise<VoiceSettings>;
    update(change: Partial<VoiceSettings>): void;
  };
  /** Cancel audio, the agent run and any pending confirmation at once. */
  stopAll(): void;
  /** Subscribe to agent events; returns an unsubscribe function. */
  onAgentEvent(handler: (event: AgentEvent) => void): () => void;
}
