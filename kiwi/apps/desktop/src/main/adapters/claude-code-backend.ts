import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CodingBackendPort, CodingEvent, CodingResult, Fallible } from '@kiwi/core';
import { runClaudeProcess, type ClaudeProcessOptions } from './claude-process';

const run = promisify(execFile);

export interface ClaudeBackendOptions extends ClaudeProcessOptions {
  /** Where isolated worktrees are created (outside every project). */
  worktreeRoot: string;
}

interface Pending {
  project: string;
  dir: string;
  branch: string;
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
 * Runs Claude Code headless in a fresh git worktree on branch kiwi/<slug>. The tool list is limited
 * to reading, editing and one fixed test command, and the run is bounded by time, messages and budget.
 * The main working copy is untouched until the user says keep.
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
    } catch (error) {
      return { ok: false, message: `Could not create an isolated branch: ${String(error)}` };
    }
    this.pending = { project, dir, branch };
    const outcome = await runClaudeProcess(task, dir, this.options, onProgress);
    if (!outcome.ok) {
      await this.discard();
      return outcome;
    }
    return this.collectResult(dir, task, outcome.summary);
  }

  async diff(): Promise<string> {
    if (!this.pending) return '';
    return (await git(this.pending.dir, ['diff', 'HEAD~1', 'HEAD'])).stdout;
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

  private async collectResult(
    dir: string,
    task: string,
    summary: string,
  ): Promise<Fallible<CodingResult>> {
    await git(dir, ['add', '-A']);
    const stat = (await git(dir, ['diff', '--cached', '--stat'])).stdout.trim();
    if (stat === '') {
      await this.discard();
      return { ok: false, message: 'The coding agent did not change any files.' };
    }
    await git(dir, [
      '-c',
      'user.name=Kiwi',
      '-c',
      'user.email=kiwi@localhost',
      'commit',
      '-m',
      `kiwi: ${task.slice(0, 60)}`,
    ]);
    const [command, ...args] = this.options.testCommand.split(/\s+/);
    const testResult = await run(command ?? 'true', args, { cwd: dir }).then(
      () => 'passed',
      () => 'failed',
    );
    return { ok: true, summary, diffSummary: stat.split('\n').at(-1)?.trim() ?? stat, testResult };
  }
}
