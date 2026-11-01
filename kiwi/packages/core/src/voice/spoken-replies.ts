import type { AgentEvent, VoiceEvent } from '@kiwi/shared';
import type { TextToSpeechPort } from './ports';
import { splitSentences } from './sentences';

export interface SpokenRepliesDeps {
  tts: TextToSpeechPort;
  emit: (event: VoiceEvent) => void;
  now: () => number;
  enabled: () => boolean;
}

/** Speaks replies sentence by sentence, only for runs that started by voice. */
export class SpokenReplies {
  private readonly text = new Map<string, string>();
  private queue: string[] = [];
  private speaking = false;
  private active = false;
  private modelRun = false;
  private submittedAt = 0;
  private firstReplyReported = false;

  constructor(private readonly deps: SpokenRepliesDeps) {}

  /** Marks the next agent run as started by voice so its reply is spoken. */
  expectReply(): void {
    this.active = true;
    this.modelRun = false;
    this.firstReplyReported = false;
    this.submittedAt = this.deps.now();
  }

  onAgentEvent(event: AgentEvent): void {
    if (!this.active) return;
    switch (event.type) {
      case 'thinking':
        this.modelRun = true;
        break;
      case 'assistantDelta':
        this.text.set(event.id, (this.text.get(event.id) ?? '') + event.text);
        break;
      case 'assistantDone':
        this.reportAgentLatency();
        this.say(this.text.get(event.id) ?? '');
        this.text.delete(event.id);
        break;
      case 'receipt':
        if (event.status === 'DONE' || event.status === 'FAILED') {
          this.reportAgentLatency();
          if (!this.modelRun) this.say(event.text);
        }
        break;
      case 'runFinished':
        this.active = false;
        break;
      default:
        break;
    }
  }

  /** Speaks a line right away, outside any agent run (used by the voice test button). */
  speakNow(text: string): void {
    this.active = true;
    this.submittedAt = this.deps.now();
    this.say(text, true);
    this.active = false;
  }

  cancel(): void {
    this.queue = [];
    this.text.clear();
    this.active = false;
    this.deps.tts.cancel();
    if (this.speaking) this.finish();
  }

  private say(reply: string, force = false): void {
    if (!this.active || !(force || this.deps.enabled()) || !this.deps.tts.isAvailable()) return;
    this.queue.push(...splitSentences(reply));
    if (!this.speaking) this.next();
  }

  private next(): void {
    const sentence = this.queue.shift();
    if (sentence === undefined) {
      if (this.speaking) this.finish();
      return;
    }
    const startedAt = this.deps.now();
    if (!this.speaking) {
      this.speaking = true;
      this.deps.emit({ type: 'speakStart' });
      this.deps.emit({
        type: 'latency',
        stage: 'transcriptToSpeech',
        ms: startedAt - this.submittedAt,
      });
    }
    let firstBoundary = true;
    this.deps.tts.speak(sentence, {
      onBoundary: () => {
        if (firstBoundary)
          this.deps.emit({
            type: 'latency',
            stage: 'textToSpeech',
            ms: this.deps.now() - startedAt,
          });
        firstBoundary = false;
        this.deps.emit({ type: 'mouth', value: 0.9 });
      },
      onEnd: () => this.next(),
    });
  }

  private finish(): void {
    this.speaking = false;
    this.deps.emit({ type: 'speakEnd' });
    this.deps.emit({ type: 'mouth', value: 0 });
  }

  private reportAgentLatency(): void {
    if (this.firstReplyReported) return;
    this.firstReplyReported = true;
    this.deps.emit({ type: 'latency', stage: 'agent', ms: this.deps.now() - this.submittedAt });
  }
}
