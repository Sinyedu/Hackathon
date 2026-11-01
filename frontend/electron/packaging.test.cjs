const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const packaged = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
  .split(/\r?\n/).map((line) => /^\s+- (electron\/[\w.-]+\.cjs)\s*$/.exec(line)?.[1]).filter(Boolean)

test('every local module the packaged app requires is listed in electron-builder.yml', () => {
  const missing = []
  for (const file of packaged) {
    for (const [, name] of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/require\('\.\/([\w.-]+\.cjs)'\)/g)) {
      if (!packaged.includes(`electron/${name}`)) missing.push(`${file} requires ${name}`)
    }
  }
  assert.deepEqual(missing, [], 'add these to "files" in electron-builder.yml or the installed app fails to start')
})

test('the packaged main entry and preload exist', () => {
  for (const file of ['electron/main.cjs', 'electron/preload.cjs']) assert.ok(packaged.includes(file), file)
  for (const file of packaged) assert.ok(fs.existsSync(path.join(root, file)), `${file} is listed but missing`)
})
