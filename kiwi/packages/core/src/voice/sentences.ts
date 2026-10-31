/** Splits a reply into sentences so speech can start early and be interrupted between them. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => /[\p{L}\p{N}]/u.test(sentence));
}
