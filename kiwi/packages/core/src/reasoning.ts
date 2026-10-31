/**
 * Removes a model's visible reasoning from its reply. Some models still emit `<think>…</think>`
 * even when thinking is switched off, and some drop the opening tag so only `</think>` appears.
 * Reasoning is never shown or spoken; the user only sees the answer.
 */
export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*<\/think>/i, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();
}
