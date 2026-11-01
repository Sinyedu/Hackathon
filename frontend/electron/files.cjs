// Read-only file lookup for "find my tax pdf" and "open the second one".
// Pure Node (no Electron) so it can be tested with a temporary folder. It never writes, moves or deletes.
const fs = require('node:fs/promises')
const path = require('node:path')

const SKIP_DIRS = new Set(['node_modules', '.git', '$recycle.bin', 'appdata', 'system volume information'])
const FILLER = new Set(['file', 'files', 'document', 'documents', 'my', 'the', 'a', 'an', 'named', 'called', 'please'])
// Only documents, images and media open from a search result. Programs, scripts, shortcuts, installers and
// macro-enabled Office files are never opened, whatever the name says.
const OPENABLE = new Set([
  '.pdf', '.txt', '.md', '.rtf', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.mp3', '.wav', '.flac', '.m4a', '.mp4', '.mkv', '.mov', '.webm', '.avi',
])

function queryWords(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !FILLER.has(word))
}

// Other names a word may appear under in file names: Windows names screenshots in the display language.
const SYNONYMS = { screenshot: ['screenshot', 'screen shot', 'skærmbillede', 'skaermbillede', 'bildschirmfoto', 'captura de pantalla', 'capture d’écran'] }
const singular = (word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)
/** "screenshots" also matches "screenshot" and "Skærmbillede"; "invoices" matches "invoice". */
function alternatives(word) {
  const base = singular(word)
  return [...new Set([word, base, ...(SYNONYMS[base] || [])])]
}

function isOpenable(file) {
  return OPENABLE.has(path.extname(file).toLowerCase())
}

/**
 * Looks for files whose name contains every word of the query, inside the given roots only.
 * Bounded by depth, number of files scanned and time, so a huge folder cannot hang Kiwi.
 * Symlinks and junctions are not followed, so a search cannot leave the roots.
 */
async function findFiles(query, roots, { limit = 8, maxDepth = 5, maxScanned = 30000, timeMs = 2500 } = {}) {
  const words = queryWords(query)
  if (!words.length) return { results: [], truncated: false }
  const deadline = Date.now() + timeMs
  const results = []
  let scanned = 0
  let truncated = false
  for (const [label, root] of roots) {
    const queue = [[root, 0]]
    while (queue.length) {
      if (scanned > maxScanned || Date.now() > deadline) { truncated = true; break }
      const [dir, depth] = queue.shift()
      let entries
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { continue }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
        if (entry.isDirectory()) {
          if (depth < maxDepth && !SKIP_DIRS.has(entry.name.toLowerCase())) queue.push([path.join(dir, entry.name), depth + 1])
          continue
        }
        if (!entry.isFile()) continue
        scanned++
        const lower = entry.name.toLowerCase()
        if (!words.every((word) => alternatives(word).some((alt) => lower.includes(alt)))) continue
        const full = path.join(dir, entry.name)
        let modified = 0
        try { modified = (await fs.stat(full)).mtimeMs } catch { /* keep the match, sort it last */ }
        results.push({ name: entry.name, path: full, label: path.join(label, path.relative(root, full)), modified })
      }
    }
  }
  results.sort((a, b) => b.modified - a.modified)
  return { results: results.slice(0, limit), truncated }
}

module.exports = { findFiles, isOpenable, queryWords }
