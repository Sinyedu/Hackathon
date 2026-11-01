import type { LlmClient, ModelPort } from '@kiwi/core';

export function createModelPort(
  llm: LlmClient,
  models: { fast: string; vision: string },
): ModelPort {
  return {
    async generate(kind, prompt, images) {
      const model = kind === 'vision' ? models.vision : models.fast;
      const result = await llm.chat({
        model,
        messages: [{ role: 'user', content: prompt, images }],
        tools: [],
      });
      if (result.ok) return { ok: true, text: result.reply.content.trim() };
      if (result.kind === 'model_missing')
        return {
          ok: false,
          message: `The model ${model} is not installed. Run "ollama pull ${model}".`,
        };
      if (result.kind === 'unavailable')
        return { ok: false, message: "I can't reach Ollama. Start it and try again." };
      return { ok: false, message: result.message };
    },
  };
}
