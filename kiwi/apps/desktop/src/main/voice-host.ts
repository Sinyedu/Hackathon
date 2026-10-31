import { app, BrowserWindow, session, systemPreferences } from 'electron';
import {
  editableSettingsSchema,
  ipcChannels,
  type EditableSettings,
  type Settings,
  type VoiceCommand,
  type VoiceEvent,
} from '@kiwi/shared';
import { saveSettings } from './settings-store';

export interface VoiceHost {
  command(command: VoiceCommand): void;
  relay(event: VoiceEvent): void;
  editableSettings(): EditableSettings;
  updateSettings(change: Partial<EditableSettings>): void;
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

/** Things that must happen right away when particular settings change. */
function applySideEffects(
  change: Partial<EditableSettings>,
  shortcutsChanged: () => void,
  configure: () => void,
): void {
  if (change.wakeWord && process.platform === 'darwin')
    void systemPreferences.askForMediaAccess('microphone');
  if (change.launchAtLogin !== undefined)
    app.setLoginItemSettings({ openAtLogin: change.launchAtLogin });
  if ('panelShortcut' in change || 'talkShortcut' in change) shortcutsChanged();
  if ('wakeWord' in change || 'speakReplies' in change || 'inputDeviceId' in change) configure();
}

export function createVoiceHost(
  voice: BrowserWindow,
  settings: Settings,
  onSettingsChanged: () => void,
): VoiceHost {
  allowOnlyVoiceMicrophone(voice);

  const command = (next: VoiceCommand): void => {
    if (!voice.isDestroyed()) voice.webContents.send(ipcChannels.voiceCommand, next);
  };
  const editableSettings = (): EditableSettings => editableSettingsSchema.parse(settings);
  const configure = (): void => {
    command({
      type: 'configure',
      wakeWord: settings.wakeWord,
      speakReplies: settings.speakReplies,
      inputDeviceId: settings.inputDeviceId,
    });
  };

  return {
    command,
    editableSettings,
    relay(event) {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(ipcChannels.voiceEvent, event);
      }
    },
    updateSettings(change) {
      Object.assign(settings, change);
      saveSettings(settings);
      applySideEffects(change, onSettingsChanged, configure);
    },
    isVoiceWindow: (id) => id === voice.webContents.id,
    configureWhenReady: () => voice.webContents.once('did-finish-load', configure),
  };
}
