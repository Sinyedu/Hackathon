import { spawn, type ChildProcess } from 'node:child_process';

type Spawner = (command: string, args: string[], env?: NodeJS.ProcessEnv) => ChildProcess;

const defaultSpawn: Spawner = (command, args, env) =>
  spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'], env: { ...process.env, ...env } });

export interface SystemSpeech {
  available(): Promise<boolean>;
  /** Speaks one sentence and resolves when it has finished or been cancelled. */
  speak(text: string): Promise<void>;
  cancel(): void;
}

interface Command {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  /** The sentence is sent on stdin, or through an environment variable on Windows. */
  stdin: boolean;
}

/** The operating system's own speech command. The text is never part of a shell string. */
function commandsFor(text: string): Command[] {
  if (process.platform === 'darwin') return [{ command: 'say', args: ['-f', '-'], stdin: true }];
  if (process.platform === 'win32') {
    const script =
      'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak($env:KIWI_SAY)';
    return [
      {
        command: 'powershell',
        args: ['-NoProfile', '-NonInteractive', '-Command', script],
        env: { KIWI_SAY: text },
        stdin: false,
      },
    ];
  }
  return [
    { command: 'espeak-ng', args: ['-s', '160', '--stdin'], stdin: true },
    { command: 'spd-say', args: ['-w', '--', text], stdin: false },
  ];
}

export function createSystemSpeech(spawnImpl: Spawner = defaultSpawn): SystemSpeech {
  let current: ChildProcess | null = null;

  const run = (option: Command, text: string): Promise<'done' | 'missing'> =>
    new Promise((resolve) => {
      const child = spawnImpl(option.command, option.args, option.env);
      current = child;
      child.once('error', () => resolve('missing'));
      child.once('close', () => resolve('done'));
      if (option.stdin) child.stdin?.end(text);
    });

  /** True when the command can be started at all (probed with --version, no sound). */
  const exists = (command: string): Promise<boolean> =>
    new Promise((resolve) => {
      const child = spawnImpl(command, ['--version']);
      child.once('error', () => resolve(false));
      child.once('close', () => resolve(true));
    });

  return {
    async available() {
      if (process.platform === 'darwin' || process.platform === 'win32') return true;
      return (await exists('espeak-ng')) || (await exists('spd-say'));
    },
    async speak(text) {
      for (const option of commandsFor(text)) {
        if ((await run(option, text)) === 'done') return;
      }
    },
    cancel() {
      current?.kill();
      current = null;
    },
  };
}
