const fs = require('node:fs')
const path = require('node:path')
const { performance } = require('node:perf_hooks')

// Diagnostic events only: no arbitrary payload, prompt, key, transcript or audio fields.
function createTracer(directory) {
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, 'trace.jsonl')
  let writes = Promise.resolve()
  function trace(span, durationMs, requestId = 'startup') {
    if (!/^[a-z_]{1,40}$/.test(span) || !Number.isFinite(durationMs)) return
    const row = { ts: new Date().toISOString(), span, durationMs, requestId: String(requestId).slice(0, 80) }
    writes = writes.then(() => fs.promises.appendFile(file, JSON.stringify(row) + '\n')).catch(() => {})
  }
  return { trace, start: () => performance.now(), file, flush: () => writes }
}
module.exports = { createTracer }
