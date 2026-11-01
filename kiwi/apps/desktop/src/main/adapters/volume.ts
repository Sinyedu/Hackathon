import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { VolumeAction } from '@kiwi/core';

const run = promisify(execFile);
const STEP_PERCENT = 10;

const windowsKey = { up: 175, down: 174, mute: 173 } as const;

/** Fixed commands only; nothing from the user or the model is interpolated. */
async function adjustWindows(action: VolumeAction): Promise<void> {
  const presses = action === 'mute' ? 1 : STEP_PERCENT / 2;
  const script = `$s = New-Object -ComObject WScript.Shell; 1..${presses} | ForEach-Object { $s.SendKeys([char]${windowsKey[action]}) }`;
  await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

async function adjustMac(action: VolumeAction): Promise<void> {
  const scripts = {
    up: `set volume output volume ((output volume of (get volume settings)) + ${STEP_PERCENT})`,
    down: `set volume output volume ((output volume of (get volume settings)) - ${STEP_PERCENT})`,
    mute: 'set volume output muted (not (output muted of (get volume settings)))',
  };
  await run('osascript', ['-e', scripts[action]]);
}

async function adjustLinux(action: VolumeAction): Promise<void> {
  const args = {
    up: ['set-sink-volume', '@DEFAULT_SINK@', `+${STEP_PERCENT}%`],
    down: ['set-sink-volume', '@DEFAULT_SINK@', `-${STEP_PERCENT}%`],
    mute: ['set-sink-mute', '@DEFAULT_SINK@', 'toggle'],
  };
  await run('pactl', args[action]);
}

export async function adjustSystemVolume(action: VolumeAction): Promise<void> {
  try {
    if (process.platform === 'win32') await adjustWindows(action);
    else if (process.platform === 'darwin') await adjustMac(action);
    else await adjustLinux(action);
  } catch {
    throw new Error('Could not change the volume on this system.');
  }
}
