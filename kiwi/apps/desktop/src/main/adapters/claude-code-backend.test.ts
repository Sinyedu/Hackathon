import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClaudeCodeBackend } from './claude-code-backend';

const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs');
if (process.env.FAKE_NO_CHANGE !== '1') fs.writeFileSync('hello.txt', 'hello from the agent\\n');
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }] } }));
console.log(JSON.stringify({ type: 'result', result: 'Added hello.txt.' }));
`;

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'kiwi-code-'));
  const project = join(base, 'project');
  execFileSync('git', ['init', '-q', '-b', 'main', project]);
  writeFileSync(join(project, 'readme.md'), '# demo\n');
  execFileSync('git', ['-C', project, 'add', '-A']);
  execFileSync('git', [
    '-C',
    project,
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@t',
    'commit',
    '-qm',
    'init',
  ]);
  const script = join(base, 'fake-claude');
  writeFileSync(script, FAKE_CLAUDE);
  chmodSync(script, 0o755);
  const backend = new ClaudeCodeBackend({
    worktreeRoot: join(base, 'worktrees'),
    testCommand: 'node --version',
    claudeCommand: script,
    timeoutMs: 20_000,
  });
  return { project, backend };
}

describe('ClaudeCodeBackend', () => {
  it('works in an isolated worktree and leaves the main copy untouched', async () => {
    const { project, backend } = setup();
    const progress: string[] = [];
    const result = await backend.run('add a hello file', project, (e) => progress.push(e.text));
    expect(result).toMatchObject({ ok: true, summary: 'Added hello.txt.', testResult: 'passed' });
    expect(progress).toEqual(['Using Edit']);
    expect(existsSync(join(project, 'hello.txt'))).toBe(false);
    expect(await backend.diff()).toContain('+hello from the agent');
    expect(backend.hasPending()).toBe(true);
    await backend.discard();
  });

  it('discard removes the worktree and the branch', async () => {
    const { project, backend } = setup();
    await backend.run('add a hello file', project, () => undefined);
    await backend.discard();
    expect(backend.hasPending()).toBe(false);
    const branches = execFileSync('git', ['-C', project, 'branch', '--list', 'kiwi/*']).toString();
    expect(branches.trim()).toBe('');
    expect(
      execFileSync('git', ['-C', project, 'worktree', 'list']).toString().trim().split('\n'),
    ).toHaveLength(1);
  });

  it('keep merges the branch into the project', async () => {
    const { project, backend } = setup();
    await backend.run('add a hello file', project, () => undefined);
    expect(await backend.keep()).toMatchObject({ ok: true });
    expect(readFileSync(join(project, 'hello.txt'), 'utf8')).toBe('hello from the agent\n');
    expect(backend.hasPending()).toBe(false);
  });

  it('reports a missing claude command', async () => {
    const { project } = setup();
    const backend = new ClaudeCodeBackend({
      worktreeRoot: join(project, '..', 'wt'),
      testCommand: 'node --version',
      claudeCommand: '/nonexistent/claude',
    });
    expect(await backend.run('do something', project, () => undefined)).toMatchObject({
      ok: false,
      message: expect.stringContaining('Could not start Claude Code') as string,
    });
    expect(backend.hasPending()).toBe(false);
  });

  it('refuses a folder that is not a git repository', async () => {
    const { backend } = setup();
    const plain = mkdtempSync(join(tmpdir(), 'kiwi-plain-'));
    expect(await backend.run('do something', plain, () => undefined)).toMatchObject({ ok: false });
  });
});
