import { describe, expect, it } from 'vitest';
import { stripReasoning } from './reasoning';

describe('stripReasoning', () => {
  it('leaves a plain answer alone', () => {
    expect(stripReasoning('Opened GitHub for you.')).toBe('Opened GitHub for you.');
  });

  it('removes a think block before the answer', () => {
    expect(stripReasoning('<think>The user wants GitHub.</think>Opened GitHub.')).toBe(
      'Opened GitHub.',
    );
  });

  it('removes multi-line and repeated think blocks, case-insensitively', () => {
    const text = '<THINK>step one\nstep two</THINK>\n\nDone.<think>again</think>';
    expect(stripReasoning(text)).toBe('Done.');
  });

  it('removes reasoning when only the closing tag is present', () => {
    expect(stripReasoning('I should open the browser first.\n</think>\nOpened it.')).toBe(
      'Opened it.',
    );
  });

  it('hides everything after an unfinished think block', () => {
    expect(stripReasoning('Sure. <think>let me think about')).toBe('Sure.');
  });

  it('returns an empty string when the reply was only reasoning', () => {
    expect(stripReasoning('<think>nothing to say</think>')).toBe('');
  });

  it('keeps ordinary angle brackets', () => {
    expect(stripReasoning('Use a < b and <b>bold</b>.')).toBe('Use a < b and <b>bold</b>.');
  });
});
