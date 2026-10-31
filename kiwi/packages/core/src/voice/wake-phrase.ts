export type WakeParse = { kind: 'wake'; command: string } | { kind: 'stop' } | { kind: 'none' };

const WAKE_WORD = 'kiwi';
const GREETINGS = new Set(['hey', 'hi', 'ok', 'okay', 'hay', 'a', 'oh']);
const STOP_WORDS = new Set(['stop', 'cancel', 'quiet', 'enough']);

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j] ?? 0;
      row[j] = Math.min(
        current + 1,
        (row[j - 1] ?? 0) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

/** Whisper writes "kiwi" many ways: kivi, keewee, key we, ki-wi. Fuzzy match on the sound shape. */
export function isWakeWord(word: string): boolean {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  if (lower.length < 3 || lower.length > 7) return false;
  return (
    distance(lower, WAKE_WORD) <= 1 ||
    /^k[ei]+y?[vw]+[eiy]+$/.test(lower) ||
    /^k[ei]+w[ei]+e?$/.test(lower)
  );
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token !== '');

/** Finds "hey kiwi ..." / "kiwi ..." at the start of a transcript and returns the rest as the command. */
export function parseWakeUtterance(transcript: string): WakeParse {
  let tokens = tokenize(transcript);
  const first = tokens[0];
  if (first !== undefined && GREETINGS.has(first)) tokens = tokens.slice(1);
  if (
    tokens.length >= 2 &&
    isWakeWord(`${tokens[0] ?? ''}${tokens[1] ?? ''}`) &&
    !isWakeWord(tokens[0] ?? '')
  ) {
    tokens = tokens.slice(2);
  } else if (tokens[0] !== undefined && isWakeWord(tokens[0])) {
    tokens = tokens.slice(1);
  } else {
    return { kind: 'none' };
  }
  const command = tokens.join(' ');
  if (tokens.length === 1 && STOP_WORDS.has(tokens[0] ?? '')) return { kind: 'stop' };
  return { kind: 'wake', command };
}
