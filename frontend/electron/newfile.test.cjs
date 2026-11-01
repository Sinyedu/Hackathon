const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createFile, safeName } = require('./newfile.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-new-'))

test('creates an empty text file and never overwrites an existing one', async () => {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'precious')
  const made = await createFile({ dir, kind: 'text', name: 'notes' })
  assert.equal(path.basename(made), 'notes (2).txt')
  assert.equal(fs.readFileSync(path.join(dir, 'notes.txt'), 'utf8'), 'precious')
  assert.equal(fs.readFileSync(made, 'utf8'), '')
})
test('a blank Word file is a real zip with the three required parts', async () => {
  const dir = tmp()
  const file = await createFile({ dir, kind: 'word', name: 'report' })
  const bytes = fs.readFileSync(file)
  assert.equal(bytes.readUInt32LE(0), 0x04034b50)
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50)
  assert.equal(bytes.readUInt16LE(bytes.length - 22 + 10), 3)
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) assert.ok(bytes.includes(Buffer.from(part)), part)
})
test('names cannot escape the folder or smuggle in an extension', () => {
  assert.equal(safeName('../../Windows/evil.exe'), 'Windows evil exe')
  assert.equal(safeName('a/b\\c:d*?"<>|'), 'a b c d')
  assert.equal(safeName(''), '')
})
test('unknown kinds are rejected', async () => {
  await assert.rejects(createFile({ dir: tmp(), kind: 'exe', name: 'x' }), /Word, text or markdown/)
})
