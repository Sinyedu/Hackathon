const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { findFiles, isOpenable, queryWords } = require('./files.cjs')

let base, docs, pics
const touch = (file, age = 0) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, 'x')
  const when = new Date(Date.now() - age * 1000)
  fs.utimesSync(file, when, when)
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-files-'))
  docs = path.join(base, 'Documents'); pics = path.join(base, 'Pictures')
  touch(path.join(docs, 'tax return 2024.pdf'), 500)
  touch(path.join(docs, 'work', 'Tax-Return-2025.pdf'), 10)
  touch(path.join(docs, 'budget.xlsx'))
  touch(path.join(docs, 'node_modules', 'pkg', 'tax return.pdf'))
  touch(path.join(docs, '.hidden', 'tax return secret.pdf'))
  touch(path.join(docs, 'a', 'b', 'c', 'd', 'e', 'f', 'tax return too deep.pdf'))
  touch(path.join(pics, 'holiday tax photo.png'))
})
after(() => fs.rmSync(base, { recursive: true, force: true }))

const roots = () => [['Documents', docs], ['Pictures', pics]]

test('finds files by every word in the name, newest first, case-insensitively', async () => {
  const { results } = await findFiles('Tax Return', roots())
  assert.deepEqual(results.map((file) => file.name), ['Tax-Return-2025.pdf', 'tax return 2024.pdf'])
  assert.ok(results[0].modified > results[1].modified)
})

test('hyphens in names still match spaced queries only when the words are present', async () => {
  const { results } = await findFiles('tax 2025', roots())
  assert.deepEqual(results.map((file) => file.name), ['Tax-Return-2025.pdf'])
})

test('labels results by folder name, not full disk path', async () => {
  const { results } = await findFiles('budget', roots())
  assert.equal(results[0].label, path.join('Documents', 'budget.xlsx'))
})

test('skips hidden folders, node_modules and anything deeper than the depth limit', async () => {
  const { results } = await findFiles('tax return', roots(), { limit: 50 })
  const names = results.map((file) => file.path)
  assert.ok(!names.some((file) => file.includes('node_modules')), 'node_modules')
  assert.ok(!names.some((file) => file.includes('.hidden')), 'hidden')
  assert.ok(!names.some((file) => file.includes('too deep')), 'too deep')
})

test('only searches the roots it is given', async () => {
  const { results } = await findFiles('tax', [['Pictures', pics]])
  assert.deepEqual(results.map((file) => file.name), ['holiday tax photo.png'])
})

test('respects the result limit and reports when the scan was cut short', async () => {
  assert.equal((await findFiles('tax', roots(), { limit: 1 })).results.length, 1)
  const cut = await findFiles('tax', roots(), { maxScanned: 1 })
  assert.equal(cut.truncated, true)
})

test('an empty or filler-only query finds nothing', async () => {
  for (const query of ['', '   ', 'my the file', '!!!']) assert.deepEqual(await findFiles(query, roots()), { results: [], truncated: false }, query)
})

test('a query cannot reach outside the roots: path characters are just ignored', async () => {
  assert.deepEqual(queryWords('..\\..\\Windows/System32'), ['windows', 'system32'])
  const { results } = await findFiles('../../etc/passwd', roots())
  assert.deepEqual(results, [])
})

test('does not follow symlinks out of a root', async (t) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-outside-'))
  touch(path.join(outside, 'tax return outside.pdf'))
  try { fs.symlinkSync(outside, path.join(docs, 'link'), 'junction') } catch { t.skip('cannot create a link on this system'); return }
  const { results } = await findFiles('outside', roots())
  fs.rmSync(outside, { recursive: true, force: true })
  assert.deepEqual(results, [])
})

test('missing roots are skipped instead of failing', async () => {
  const { results } = await findFiles('budget', [['Nowhere', path.join(base, 'does-not-exist')], ['Documents', docs]])
  assert.equal(results.length, 1)
})

test('only documents, images and media are openable, never programs or scripts', () => {
  for (const file of ['a.pdf', 'b.DOCX', 'c.png', 'd.mp3', 'e.mp4', 'f.txt']) assert.equal(isOpenable(file), true, file)
  for (const file of ['a.exe', 'b.bat', 'c.cmd', 'd.ps1', 'e.vbs', 'f.js', 'g.lnk', 'h.msi', 'i.scr', 'j.jar', 'k.docm', 'l.xlsm', 'm.svg', 'n.reg', 'o.hta', 'noextension', 'report.pdf.exe']) assert.equal(isOpenable(file), false, file)
})

test('plural and singular match, and "screenshots" finds localized screenshot names', async () => {
  touch(path.join(pics, 'Skærmbilleder', 'Skærmbillede 2026-10-31 171356.png'), 5)
  touch(path.join(pics, 'Screenshot 2026-11-01.png'), 50)
  touch(path.join(docs, 'invoice-march.pdf'))
  assert.deepEqual((await findFiles('screenshots', roots())).results.map((file) => file.name), ['Skærmbillede 2026-10-31 171356.png', 'Screenshot 2026-11-01.png'])
  assert.deepEqual((await findFiles('invoices', roots())).results.map((file) => file.name), ['invoice-march.pdf'])
  assert.deepEqual((await findFiles('screenshot 2026-11', roots())).results.map((file) => file.name), ['Screenshot 2026-11-01.png'])
})
test('singular matching does not make unrelated words match', async () => {
  assert.deepEqual((await findFiles('budgets', roots())).results.map((file) => file.name), ['budget.xlsx'])
  assert.deepEqual((await findFiles('glass', roots())).results, [])
})
