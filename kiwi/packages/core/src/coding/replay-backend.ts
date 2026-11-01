import type { CodingBackendPort, CodingEvent, CodingResult, Fallible } from '../services';

export interface Recording {
  events: CodingEvent[];
  result: CodingResult;
  diff: string;
  testResult: string;
}

/** Plays a recorded run for rehearsal and offline demos. Always labelled "replay". */
export class ReplayBackend implements CodingBackendPort {
  readonly label = 'replay';
  private pending = false;

  constructor(
    private readonly recording: Recording,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly stepDelayMs = 600,
  ) {}

  async run(
    _task: string,
    _project: string,
    onProgress: (event: CodingEvent) => void,
  ): Promise<Fallible<CodingResult>> {
    for (const event of this.recording.events) {
      await this.sleep(this.stepDelayMs);
      onProgress(event);
    }
    this.pending = true;
    return { ok: true, ...this.recording.result };
  }

  diff(): Promise<string> {
    return Promise.resolve(this.recording.diff);
  }

  runTests(): Promise<string> {
    return Promise.resolve(this.recording.testResult);
  }

  keep(): Promise<Fallible<{ message: string }>> {
    this.pending = false;
    return Promise.resolve({ ok: true, message: 'Replay only: nothing was merged.' });
  }

  discard(): Promise<void> {
    this.pending = false;
    return Promise.resolve();
  }

  hasPending(): boolean {
    return this.pending;
  }
}
