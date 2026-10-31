# Ollama chat API (verified against docs.ollama.com and a local 0.40 server)

- `POST /api/chat` with `model`, `messages`, `tools: [{ type: "function", function: { name, description, parameters } }]`, `stream: true`; the reply is NDJSON, each line has `message.content` and optionally `message.tool_calls[].function.{name, arguments}`.
- Tool results go back as `{ role: "tool", tool_name, content }`.
- `think: false` turns off qwen3 reasoning so replies are fast.
- `GET /api/tags` lists installed models (used for the health check). An unknown model returns HTTP 404.
- Tool schemas come from `z.toJSONSchema(schema)` (zod 4).
