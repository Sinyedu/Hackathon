const OPENERS = new Set(['hey', 'hay', 'hi', 'hello', 'ok', 'okay', 'a', 'ay', 'yo'])

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

/** Whisper writes "agent" many ways ("a gent", "Asian", "ajent"); accept close spellings. */
const isAgent = (word: string) => word === 'kiwi' || distance(word, 'agent') <= 2 && word.length >= 4 || word === 'asian'

/**
 * "Hey agent, what is missing?" -> "what is missing?"; a bare "Hey agent" -> ""; "Agent, ..." also counts;
 * anything not addressed to the agent -> null.
 */
export function parseWake(transcript: string): string | null {
  const words = transcript.trim().split(/\s+/)
  const clean = (w: string | undefined) => (w ?? '').toLowerCase().replace(/[^a-z]/g, '')
  let used = 0
  if (OPENERS.has(clean(words[0])) && isAgent(clean(words[1]))) used = 2
  else if (clean(words[0]) === 'a' && clean(words[1]) === 'gent') used = 2
  else if (clean(words[0]) === 'kiwi' || isAgent(clean(words[0])) && clean(words[0]).length >= 5) used = 1
  else return null
  return words.slice(used).join(' ').replace(/^[\s,.!?:;-]+/, '').trim()
}
