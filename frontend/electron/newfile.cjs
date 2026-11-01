// Creates a NEW empty file for "make a Word file in my documents". Bounded on purpose: fixed kinds, a sanitised name,
// and the 'wx' flag so an existing file is never overwritten.
const fs = require('node:fs/promises')
const path = require('node:path')
const zlib = require('node:zlib')

const KINDS = { word: '.docx', text: '.txt', markdown: '.md' }

const safeName = (name) => (name || '').normalize('NFKC').replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

function crc32(buffer) { return zlib.crc32 ? zlib.crc32(buffer) : slowCrc(buffer) }
function slowCrc(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) }
  return (crc ^ 0xffffffff) >>> 0
}

/** A zip archive that stores its entries uncompressed: enough for the three parts of a blank .docx. */
function zip(entries) {
  const locals = []; const centrals = []; let offset = 0
  for (const [name, text] of entries) {
    const nameBuf = Buffer.from(name); const data = Buffer.from(text); const crc = crc32(data)
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26)
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42)
    locals.push(local, nameBuf, data); centrals.push(central, nameBuf)
    offset += local.length + nameBuf.length + data.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

const BLANK_DOCX = () => zip([
  ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
  ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
  ['word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>'],
])

/** Creates the file and returns its path. A taken name gets " (2)", " (3)", … instead of being overwritten. */
async function createFile({ dir, kind, name }) {
  const extension = KINDS[kind]
  if (!extension) throw new Error('I can create Word, text or markdown files.')
  const base = safeName(name) || `New ${kind === 'word' ? 'document' : kind === 'text' ? 'text file' : 'note'} ${new Date().toISOString().slice(0, 10)}`
  const content = kind === 'word' ? BLANK_DOCX() : ''
  for (let n = 1; n <= 50; n++) {
    const file = path.join(dir, `${base}${n > 1 ? ` (${n})` : ''}${extension}`)
    try { await fs.writeFile(file, content, { flag: 'wx' }); return file } catch (error) { if (error.code !== 'EEXIST') throw error }
  }
  throw new Error('Too many files with that name already exist. Pick another name.')
}

module.exports = { createFile, safeName, KINDS }
