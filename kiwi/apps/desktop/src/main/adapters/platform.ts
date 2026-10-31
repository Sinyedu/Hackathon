import { randomUUID } from 'node:crypto';
import { clipboard, Notification, shell } from 'electron';
import type { PlatformPort } from '@kiwi/core';
import type { AppsConfig } from '@kiwi/shared';
import { launchAllowlistedApp } from './launcher';
import { trashSandboxNote, writeSandboxNote } from './sandbox-notes';
import { adjustSystemVolume } from './volume';

export interface PlatformOptions {
  apps: AppsConfig;
  sandboxRoot: () => string;
  onTimerFinished: (label: string) => void;
}

export function createElectronPlatform({
  apps,
  sandboxRoot,
  onTimerFinished,
}: PlatformOptions): PlatformPort {
  const timers = new Map<string, NodeJS.Timeout>();

  return {
    launchApp: (appId) => launchAllowlistedApp(apps, appId),
    openUrl: (url) => shell.openExternal(url),
    startTimer(seconds, label) {
      const timerId = randomUUID();
      timers.set(
        timerId,
        setTimeout(() => {
          timers.delete(timerId);
          new Notification({ title: 'Kiwi', body: `${label} is done` }).show();
          onTimerFinished(label);
        }, seconds * 1000),
      );
      return timerId;
    },
    cancelTimer(timerId) {
      const timer = timers.get(timerId);
      if (!timer) return false;
      clearTimeout(timer);
      timers.delete(timerId);
      return true;
    },
    writeNote: (text) => writeSandboxNote(sandboxRoot(), text, new Date()),
    trashNote: (notePath) => trashSandboxNote(sandboxRoot(), notePath),
    readClipboard: () => Promise.resolve(clipboard.readText()),
    writeClipboard: (text) => Promise.resolve(clipboard.writeText(text)),
    adjustVolume: adjustSystemVolume,
    now: () => new Date(),
  };
}
