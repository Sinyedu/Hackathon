import { mkdir, realpath, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { isInsideSandbox } from '@kiwi/core';

export const sandboxRoot = (): string => join(homedir(), 'KiwiSandbox');

/** Resolves symlinks and confirms the real path still lies inside the sandbox. */
async function assertRealPathInside(root: string, target: string): Promise<void> {
  const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
  if (!isInsideSandbox(realRoot, realTarget))
    throw new Error('That path is outside the Kiwi sandbox folder.');
}

const stamp = (date: Date): string => date.toISOString().replaceAll(':', '-').replace(/\..+$/, '');

export async function writeSandboxNote(root: string, text: string, now: Date): Promise<string> {
  const notesDir = join(root, 'notes');
  await mkdir(notesDir, { recursive: true });
  await assertRealPathInside(root, notesDir);
  const notePath = join(notesDir, `${stamp(now)}.md`);
  await writeFile(notePath, `${text}\n`, { flag: 'wx' });
  return notePath;
}

/** "Delete" always means move to .trash inside the sandbox. */
export async function trashSandboxNote(root: string, notePath: string): Promise<void> {
  await assertRealPathInside(root, notePath);
  const trashDir = join(root, '.trash');
  await mkdir(trashDir, { recursive: true });
  await rename(notePath, join(trashDir, `${Date.now()}-${basename(notePath)}`));
}
