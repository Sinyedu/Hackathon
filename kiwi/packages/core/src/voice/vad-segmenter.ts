import { concatFrames, totalLength } from './audio-buffers';
import { rms } from './endpointing';
import { SAMPLE_RATE } from './ports';

export interface VadConfig {
  speechThreshold: number;
  /** Speech must stay above the threshold this long to count as an utterance. */
  startMs: number;
  /** Silence this long closes the utterance. */
  endSilenceMs: number;
  maxMs: number;
  /** Audio kept from before speech was detected so the first word is not clipped. */
  preRollMs: number;
}

export const defaultVadConfig: VadConfig = {
  speechThreshold: 0.02,
  startMs: 120,
  endSilenceMs: 500,
  maxMs: 3000,
  preRollMs: 300,
};

const msOf = (samples: number): number => (samples / SAMPLE_RATE) * 1000;
/** Energy-based voice activity detection used to cut the always-on stream into utterances. */
export class VadSegmenter {
  private preRoll: Float32Array[] = [];
  private utterance: Float32Array[] = [];
  private speaking = false;
  private loudMs = 0;
  private silentMs = 0;

  constructor(private readonly config: VadConfig = defaultVadConfig) {}

  reset(): void {
    this.preRoll = [];
    this.utterance = [];
    this.speaking = false;
    this.loudMs = 0;
    this.silentMs = 0;
  }

  /** Feeds one frame; returns a finished utterance when one closes. */
  push(frame: Float32Array): Float32Array | null {
    const loud = rms(frame) >= this.config.speechThreshold;
    const frameMs = msOf(frame.length);
    if (!this.speaking) {
      this.listen(frame, loud, frameMs);
      return null;
    }
    this.utterance.push(frame);
    this.silentMs = loud ? 0 : this.silentMs + frameMs;
    const tooLong = msOf(totalLength(this.utterance)) >= this.config.maxMs;
    if (this.silentMs < this.config.endSilenceMs && !tooLong) return null;
    const result = concatFrames(this.utterance);
    this.reset();
    return result;
  }

  private listen(frame: Float32Array, loud: boolean, frameMs: number): void {
    this.preRoll.push(frame);
    while (this.preRoll.length > 1 && msOf(totalLength(this.preRoll)) > this.config.preRollMs)
      this.preRoll.shift();
    this.loudMs = loud ? this.loudMs + frameMs : 0;
    if (this.loudMs >= this.config.startMs) {
      this.speaking = true;
      this.utterance = [...this.preRoll];
      this.silentMs = 0;
    }
  }
}

export const createVadSegmenter = (config?: VadConfig): VadSegmenter => new VadSegmenter(config);
