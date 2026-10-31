import { existsSync } from 'node:fs';
import { mkdir, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { checkSandboxRelative, isInsideSandbox, type SandboxFilesPort } from '@kiwi/core';

async function resolveInside(root: string, relative: string): Promise<string> {
  const checked = checkSandboxRelative(relative);
  if (!checked.ok) throw new Error(checked.message);
  const target = join(root, checked.value);
  await mkdir(root, { recursive: true });
  const [realRoot, realParent] = await Promise.all([
    realpath(root),
    realpath(existingAncestor(target)),
  ]);
  if (!isInsideSandbox(realRoot, realParent))
    throw new Error('That path is outside the Kiwi sandbox folder.');
  return target;
}

function existingAncestor(path: string): string {
  let current = path;
  while (!existsSync(current)) current = dirname(current);
  return current;
}

export function createSandboxFiles(root: () => string): SandboxFilesPort {
  return {
    async list(folder) {
      const dir = await resolveInside(root(), folder);
      const entries = await readdir(dir, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    },
    async move(fromRelative, toRelative) {
      const from = await resolveInside(root(), fromRelative);
      const to = await resolveInside(root(), toRelative);
      if (existsSync(to))
        throw new Error(`${toRelative} already exists, so nothing was overwritten.`);
      await mkdir(dirname(to), { recursive: true });
      await rename(from, to);
    },
  };
}

const DEMO_FILES = [
  'holiday-photo.png',
  'screenshot-2026-01-03.png',
  'logo.svg',
  'invoice-march.pdf',
  'resume-draft.docx',
  'meeting-notes.txt',
  'budget.xlsx',
  'backup.zip',
  'project-export.tar.gz',
  'setup-installer.exe',
  'song-demo.mp3',
  'script.py',
  'untitled',
];

/** Seeds fake, empty files so "clean up my downloads" has something to do. Labelled as demo data. */
export async function seedDemoDownloads(root: string): Promise<void> {
  const dir = join(root, 'Downloads');
  if (existsSync(dir)) return;
  await mkdir(dir, { recursive: true });
  await Promise.all(
    DEMO_FILES.map((name) => writeFile(join(dir, name), `Kiwi demo file: ${name}\n`)),
  );
}
