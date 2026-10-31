import { BrowserWindow, session, systemPreferences } from 'electron';
import {
  ipcChannels,
  type Settings,
  type VoiceCommand,
  type VoiceEvent,
  type VoiceSettings,
} from '@kiwi/shared';
import { saveSettings } from './settings-store';

export interface VoiceHost {
  command(command: VoiceCommand): void;
  relay(event: VoiceEvent): void;
  voiceSettings(): VoiceSettings;
  updateSettings(change: Partial<VoiceSettings>): void;
  isVoiceWindow(webContentsId: number): boolean;
  /** Pushes the stored settings to the voice window once its page has loaded. */
  configureWhenReady(): void;
}

function allowOnlyVoiceMicrophone(voice: BrowserWindow): void {
  const isVoiceAudio = (
    id: number | undefined,
    permission: string,
    mediaTypes: readonly string[] = [],
  ): boolean =>
    permission === 'media' &&
    id === voice.webContents.id &&
    mediaTypes.every((type) => type === 'audio');
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(
      isVoiceAudio(contents.id, permission, 'mediaTypes' in details ? details.mediaTypes : []),
    );
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
    isVoiceAudio(
      contents?.id,
      permission,
      'mediaType' in details && details.mediaType ? [details.mediaType] : [],
    ),
  );
}

export function createVoiceHost(voice: BrowserWindow, settings: Settings): VoiceHost {
  allowOnlyVoiceMicrophone(voice);

  const command = (next: VoiceCommand): void => {
    if (!voice.isDestroyed()) voice.webContents.send(ipcChannels.voiceCommand, next);
  };
  const voiceSettings = (): VoiceSettings => ({
    wakeWord: settings.wakeWord,
    speakReplies: settings.speakReplies,
    inputDeviceId: settings.inputDeviceId,
  });
  const configure = (): void => {
    command({ type: 'configure', ...voiceSettings() });
  };

  return {
    command,
    voiceSettings,
    relay(event) {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(ipcChannels.voiceEvent, event);
      }
    },
    updateSettings(change) {
      Object.assign(settings, change);
      saveSettings(settings);
      if (change.wakeWord && process.platform === 'darwin') {
        void systemPreferences.askForMediaAccess('microphone');
      }
      configure();
    },
    isVoiceWindow: (id) => id === voice.webContents.id,
    configureWhenReady: () => voice.webContents.once('did-finish-load', configure),
  };
}
