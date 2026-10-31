const WAKE = /^\W*(?:hey|hi|hello|ok(?:ay)?)[\s,.!]+(?:agent|a gent|asian|ajent)\b[\s,.!?:-]*(.*)$/is

/** "Hey agent, what is missing?" -> "what is missing?"; "Hey agent" -> ""; anything else -> null. */
export function parseWake(transcript: string): string | null {
  const match = WAKE.exec(transcript.trim())
  return match ? match[1].trim() : null
}
