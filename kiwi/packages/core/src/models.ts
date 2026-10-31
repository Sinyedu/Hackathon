export interface ModelRecommendation {
  fast: string;
  planning: string;
  vision: string;
}

/** Suggests Ollama models from installed memory so small machines are not asked for too much. */
export function recommendModels(ramGb: number): ModelRecommendation {
  if (ramGb >= 16) return { fast: 'qwen3:4b', planning: 'qwen3:8b', vision: 'gemma3:4b' };
  if (ramGb >= 8) return { fast: 'qwen3:1.7b', planning: 'qwen3:4b', vision: 'gemma3:4b' };
  return { fast: 'qwen3:1.7b', planning: 'qwen3:1.7b', vision: 'gemma3:4b' };
}
