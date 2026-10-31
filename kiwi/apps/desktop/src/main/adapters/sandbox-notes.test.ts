import { existsSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { trashSandboxNote, writeSandboxNote } from './sandbox-notes';

const makeRoot = (): string => mkdtempSync(join(tmpdir(), 'kiwi-sandbox-'));
const now = new Date('2026-01-01T09:05:07Z');

describe('sandbox notes', () => {
  it('writes inside notes/ and trashes into .trash', async () => {
    const root = makeRoot();
    const notePath = await writeSandboxNote(root, 'buy milk', now);
    expect(notePath).toContain(join(root, 'notes'));
    expect(readFileSync(notePath, 'utf8')).toBe('buy milk\n');
    await trashSandboxNote(root, notePath);
    expect(existsSync(notePath)).toBe(false);
    expect(existsSync(join(root, '.trash'))).toBe(true);
  });

  it('refuses to trash a file outside the sandbox', async () => {
    const root = makeRoot();
    const outside = join(makeRoot(), 'secret.txt');
    await writeSandboxNote(root, 'x', now);
    await expect(trashSandboxNote(root, outside)).rejects.toThrow();
  });

  it('refuses when notes/ is a symlink pointing outside', async () => {
    const root = makeRoot();
    const outside = makeRoot();
    symlinkSync(outside, join(root, 'notes'));
    await expect(writeSandboxNote(root, 'x', now)).rejects.toThrow('outside the Kiwi sandbox');
  });
});
