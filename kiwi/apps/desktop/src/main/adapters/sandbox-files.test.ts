import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSandboxFiles, seedDemoDownloads } from './sandbox-files';

const makeRoot = (): string => mkdtempSync(join(tmpdir(), 'kiwi-files-'));

describe('sandbox files', () => {
  it('lists, moves into new folders and never overwrites', async () => {
    const root = makeRoot();
    mkdirSync(join(root, 'Downloads'));
    writeFileSync(join(root, 'Downloads', 'a.png'), 'x');
    writeFileSync(join(root, 'Downloads', 'b.png'), 'y');
    const files = createSandboxFiles(() => root);
    expect(await files.list('Downloads')).toEqual(expect.arrayContaining(['a.png', 'b.png']));
    await files.move('Downloads/a.png', 'Downloads/Images/a.png');
    expect(existsSync(join(root, 'Downloads/Images/a.png'))).toBe(true);
    await expect(files.move('Downloads/b.png', 'Downloads/Images/a.png')).rejects.toThrow(
      'already exists',
    );
    expect(existsSync(join(root, 'Downloads/b.png'))).toBe(true);
  });

  it('rejects paths that leave the sandbox', async () => {
    const root = makeRoot();
    const files = createSandboxFiles(() => root);
    await expect(files.list('../')).rejects.toThrow();
    await expect(files.move('a', '../escape')).rejects.toThrow();
  });

  it('rejects a symlink that points outside', async () => {
    const root = makeRoot();
    const outside = makeRoot();
    symlinkSync(outside, join(root, 'Downloads'));
    await expect(createSandboxFiles(() => root).list('Downloads')).rejects.toThrow('outside');
  });

  it('seeds demo downloads once', async () => {
    const root = makeRoot();
    await seedDemoDownloads(root);
    const files = createSandboxFiles(() => root);
    const first = await files.list('Downloads');
    expect(first.length).toBeGreaterThan(10);
    await files.move('Downloads/untitled', 'Downloads/Other/untitled');
    await seedDemoDownloads(root);
    expect(await files.list('Downloads')).toHaveLength(first.length - 1);
  });
});
