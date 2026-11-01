import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { devNull } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CodingBackendPort, CodingEvent, CodingResult, Fallible } from '@kiwi/core';
import { runClaudeProcess, type ClaudeProcessOptions } from './claude-process';

const run = promisify(execFile);
const TEST_TIMEOUT_MS = 120_000;

export interface ClaudeBackendOptions extends ClaudeProcessOptions {
  /** Where isolated worktrees are created (outside every project). */
  worktreeRoot: string;
  testCommand: string;
}

interface Pending {
  project: string;
  dir: string;
  branch: string;
  /** The worktree's git directory and the `.git` file as created by git, to detect tampering. */
  gitDir: string;
  gitFile: string;
}

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'task';

const git = (cwd: string, args: string[]): Promise<{ stdout: string }> =>
  run('git', ['-C', cwd, ...args]);

/**
 * Git commands that read what the agent changed. The git directory is given explicitly, hooks,
 * the file-system monitor and external diff or text-conversion programs are switched off, so
 * nothing the agent wrote into the worktree can make git run code.
 */
const safeGit = (pending: Pending, args: string[]): Promise<{ stdout: string }> =>
  run('git', [
    '--git-dir',
    pending.gitDir,
    '--work-tree',
    pending.dir,
    '-c',
    'core.fsmonitor=false',
    '-c',
    `core.hooksPath=${devNull}`,
    '-c',
    'core.attributesFile=' + devNull,
    ...args,
  ]);

/**
 * Runs Claude Code headless in a fresh git worktree on branch kiwi/<slug>. The tool list is limited
 * to reading and editing files (no shell), and the run is bounded by time, messages and budget.
 * The main working copy is untouched until the user says keep. Tests only run after the user agrees.
 */
export class ClaudeCodeBackend implements CodingBackendPort {
  readonly label = 'claude code';
  private pending: Pending | null = null;

  constructor(private readonly options: ClaudeBackendOptions) {}

  hasPending(): boolean {
    return this.pending !== null;
  }

  async run(
    task: string,
    project: string,
    onProgress: (event: CodingEvent) => void,
  ): Promise<Fallible<CodingResult>> {
    const branch = `kiwi/${slugify(task)}-${Date.now().toString(36)}`;
    const dir = join(this.options.worktreeRoot, branch.replace('/', '-'));
    try {
      await git(project, ['worktree', 'add', '-b', branch, dir]);
      const gitDir = (await git(dir, ['rev-parse', '--absolute-git-dir'])).stdout.trim();
      this.pending = {
        project,
        dir,
        branch,
        gitDir,
        gitFile: readFileSync(join(dir, '.git'), 'utf8'),
      };
    } catch (error) {
      return { ok: false, message: `Could not create an isolated branch: ${String(error)}` };
    }
    const outcome = await runClaudeProcess(task, dir, this.options, onProgress);
    if (!outcome.ok) {
      await this.discard();
      return outcome;
    }
    return this.collectResult(task, outcome.summary);
  }

  async diff(): Promise<string> {
    if (!this.pending) return '';
    return (
      await safeGit(this.pending, ['diff', '--no-ext-diff', '--no-textconv', 'HEAD~1', 'HEAD'])
    ).stdout;
  }

  /** Runs the project's test command inside the isolated branch with a minimal environment. */
  async runTests(): Promise<string> {
    const pending = this.pending;
    if (!pending) return 'not run';
    const [command, ...args] = this.options.testCommand.split(/\s+/);
    const env = Object.fromEntries(
      ['PATH', 'LANG'].flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : [])),
    );
    return run(command ?? 'true', args, { cwd: pending.dir, env, timeout: TEST_TIMEOUT_MS }).then(
      () => 'passed',
      () => 'failed',
    );
  }

  async keep(): Promise<Fallible<{ message: string }>> {
    const pending = this.pending;
    if (!pending) return { ok: false, message: 'There is nothing to keep.' };
    try {
      await git(pending.project, [
        'merge',
        '--no-ff',
        '-m',
        `Merge ${pending.branch}`,
        pending.branch,
      ]);
    } catch (error) {
      return {
        ok: false,
        message: `The merge did not apply cleanly, so nothing was changed: ${String(error)}`,
      };
    }
    await this.discard();
    return { ok: true, message: `Merged ${pending.branch} into your project.` };
  }

  async discard(): Promise<void> {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    await git(pending.project, ['worktree', 'remove', '--force', pending.dir]).catch(
      () => undefined,
    );
    await git(pending.project, ['branch', '-D', pending.branch]).catch(() => undefined);
  }

  private async collectResult(task: string, summary: string): Promise<Fallible<CodingResult>> {
    const pending = this.pending;
    if (!pending) return { ok: false, message: 'The coding task was cancelled.' };
    if (readFileSync(join(pending.dir, '.git'), 'utf8') !== pending.gitFile) {
      await this.discard();
      return {
        ok: false,
        message: 'The agent tampered with the git metadata, so the result was thrown away.',
      };
    }
    await safeGit(pending, ['add', '-A']);
    const stat = (
      await safeGit(pending, ['diff', '--cached', '--no-ext-diff', '--stat'])
    ).stdout.trim();
    if (stat === '') {
      await this.discard();
      return { ok: false, message: 'The coding agent did not change any files.' };
    }
    await safeGit(pending, [
      '-c',
      'user.name=Kiwi',
      '-c',
      'user.email=kiwi@localhost',
      'commit',
      '--no-verify',
      '-m',
      `kiwi: ${task.slice(0, 60)}`,
    ]);
    return {
      ok: true,
      summary,
      diffSummary: stat.split('\n').at(-1)?.trim() ?? stat,
    };
  }
}
