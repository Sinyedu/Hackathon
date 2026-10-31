import type { AgentEvent, VoiceEvent } from '@kiwi/shared';
import { Capture, type CaptureVia } from './capture';
import { rms } from './endpointing';
import { concatFrames } from './audio-buffers';
import type { AudioInputPort, SpeechToTextPort, TextToSpeechPort } from './ports';
import { SpokenReplies } from './spoken-replies';
import { VadSegmenter } from './vad-segmenter';
import { parseWakeUtterance } from './wake-phrase';

export interface VoiceSessionDeps {
  audio: AudioInputPort;
  stt: SpeechToTextPort;
  tts: TextToSpeechPort;
  emit: (event: VoiceEvent) => void;
  /** Sends a recognized command to the agent. */
  submit: (text: string) => void;
  now: () => number;
}

const WAKE_COOLDOWN_MS = 1500;
const STOP_COMMAND = /^(?:kiwi\s+)?(?:stop|cancel)\W*$/i;

/** Ties the microphone, wake word, speech to text and spoken replies together. */
export class VoiceSession {
  private readonly segmenter = new VadSegmenter();
  private readonly replies: SpokenReplies;
  private options = { wakeWord: false, speakReplies: true };
  private micOpen = false;
  private capture: Capture | null = null;
  private wakeBusy = false;
  private ignoreWakeUntil = 0;

  constructor(private readonly deps: VoiceSessionDeps) {
    this.replies = new SpokenReplies({
      tts: deps.tts,
      emit: deps.emit,
      now: deps.now,
      enabled: () => this.options.speakReplies,
    });
  }

  async configure(options: { wakeWord: boolean; speakReplies: boolean }): Promise<void> {
    this.options = options;
    if (!options.wakeWord) {
      this.closeMicIfIdle();
      return;
    }
    this.deps.emit({
      type: 'engine',
      engine: 'wakeWord',
      status: 'loading',
      message: 'Loading the speech model for "Hey Kiwi"…',
    });
    if (await this.openMic()) await this.warmUp();
  }

  startCapture(via: 'push' | 'tap'): Promise<void> {
    return this.beginCapture(via);
  }

  endCapture(): Promise<void> {
    return this.finishCapture(false);
  }

  stopAll(): void {
    this.replies.cancel();
    void this.finishCapture(true);
    this.segmenter.reset();
    this.deps.emit({ type: 'stopped' });
  }

  onAgentEvent(event: AgentEvent): void {
    this.replies.onAgentEvent(event);
  }

  private async warmUp(): Promise<void> {
    try {
      await this.deps.stt.load();
      this.deps.emit({
        type: 'engine',
        engine: 'wakeWord',
        status: 'ready',
        message: 'Say "Hey Kiwi" to talk.',
      });
    } catch (error) {
      this.deps.emit({
        type: 'engine',
        engine: 'wakeWord',
        status: 'unavailable',
        message: `Wake word is off: ${String(error)}`,
      });
    }
  }

  private async openMic(): Promise<boolean> {
    if (this.micOpen) return true;
    const result = await this.deps.audio.start((samples) => this.handleFrame(samples));
    if (!result.ok) {
      this.deps.emit({
        type: 'engine',
        engine: 'microphone',
        status: 'unavailable',
        message: result.message,
      });
      return false;
    }
    this.micOpen = true;
    this.deps.emit({ type: 'micState', on: true });
    return true;
  }

  private closeMicIfIdle(): void {
    if (!this.micOpen || this.options.wakeWord || this.capture) return;
    this.deps.audio.stop();
    this.micOpen = false;
    this.deps.emit({ type: 'micState', on: false });
  }

  private async beginCapture(via: CaptureVia): Promise<void> {
    this.replies.cancel();
    if (!(await this.openMic())) return;
    this.capture = new Capture(via);
    this.segmenter.reset();
    this.deps.emit({ type: 'captureStart', via });
  }

  private async finishCapture(discard: boolean): Promise<void> {
    const finished = this.capture;
    this.capture = null;
    if (!finished) return;
    this.deps.emit({ type: 'captureEnd' });
    this.closeMicIfIdle();
    if (discard) return;
    try {
      const text = await this.transcribe(concatFrames(finished.chunks));
      if (text !== '') this.dispatch(text);
    } catch (error) {
      this.deps.emit({
        type: 'engine',
        engine: 'speechToText',
        status: 'unavailable',
        message: String(error),
      });
    }
  }

  private async transcribe(samples: Float32Array): Promise<string> {
    const startedAt = this.deps.now();
    await this.deps.stt.load();
    const text = (await this.deps.stt.transcribe(samples)).trim();
    this.deps.emit({ type: 'latency', stage: 'speechToText', ms: this.deps.now() - startedAt });
    return text;
  }

  private dispatch(text: string): void {
    if (STOP_COMMAND.test(text)) {
      this.stopAll();
      return;
    }
    this.deps.emit({ type: 'transcript', text });
    this.replies.expectReply();
    this.deps.submit(text);
  }

  private async handleSegment(samples: Float32Array): Promise<void> {
    if (this.wakeBusy || this.deps.now() < this.ignoreWakeUntil) return;
    this.wakeBusy = true;
    const startedAt = this.deps.now();
    try {
      const parsed = parseWakeUtterance(await this.transcribe(samples));
      this.deps.emit({ type: 'latency', stage: 'wake', ms: this.deps.now() - startedAt });
      if (parsed.kind === 'none') return;
      this.ignoreWakeUntil = this.deps.now() + WAKE_COOLDOWN_MS;
      if (parsed.kind === 'stop') this.stopAll();
      else if (parsed.command === '') await this.beginCapture('wake');
      else this.dispatch(parsed.command);
    } catch (error) {
      this.deps.emit({
        type: 'engine',
        engine: 'wakeWord',
        status: 'unavailable',
        message: String(error),
      });
    } finally {
      this.wakeBusy = false;
    }
  }

  private handleFrame(samples: Float32Array): void {
    const level = rms(samples);
    this.deps.emit({ type: 'level', value: Math.min(1, level * 8) });
    if (this.capture) {
      const decision = this.capture.push(samples, level);
      if (decision !== 'continue') void this.finishCapture(decision === 'discard');
      return;
    }
    const segment = this.options.wakeWord ? this.segmenter.push(samples) : null;
    if (segment) void this.handleSegment(segment);
  }
}

export const createVoiceSession = (deps: VoiceSessionDeps): VoiceSession => new VoiceSession(deps);
