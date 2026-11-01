import { spawn } from 'node:child_process';
import { shell } from 'electron';
import type { AppsConfig } from '@kiwi/shared';

type Platform = 'win32' | 'darwin' | 'linux';

/** Starts an allowlisted app using only the fixed command or URI from apps.json. */
export async function launchAllowlistedApp(config: AppsConfig, appId: string): Promise<void> {
  const entry = config.apps.find((app) => app.id === appId);
  const launch = entry?.launch[process.platform as Platform];
  if (!entry || !launch)
    throw new Error(`${entry?.name ?? appId} cannot be opened on this system.`);
  if ('uri' in launch) {
    await shell.openExternal(launch.uri);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(launch.command, launch.args, { detached: true, stdio: 'ignore' });
    child.once('error', () => reject(new Error(`Could not start ${entry.name}. Is it installed?`)));
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
