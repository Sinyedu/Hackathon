import { describe, expect, it } from 'vitest';
import { splitSentences } from './sentences';

describe('splitSentences', () => {
  it('splits on sentence punctuation', () => {
    expect(splitSentences('Opened GitHub. All set!  Anything else?')).toEqual([
      'Opened GitHub.',
      'All set!',
      'Anything else?',
    ]);
  });

  it('keeps a trailing fragment without punctuation', () => {
    expect(splitSentences('Done. One moment')).toEqual(['Done.', 'One moment']);
  });

  it('does not split inside a domain name', () => {
    expect(splitSentences('Opened github.com. Enjoy!')).toEqual(['Opened github.com.', 'Enjoy!']);
  });

  it('drops empty and punctuation-only pieces', () => {
    expect(splitSentences('  ... ')).toEqual([]);
    expect(splitSentences('')).toEqual([]);
  });
});
