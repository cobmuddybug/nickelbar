#!/usr/bin/env node
// Runs every dev/tests/*.test.js (or just the ones named on the command
// line, e.g. `node dev/tests/run.js rollblock catalog`).
const fs = require('fs'), path = require('path')
const lib = require('./lib')

const only = process.argv.slice(2)
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js'))
  .filter(f => !only.length || only.some(o => f.startsWith(o)))
for (const f of files) {
  const before = lib.tests.length
  require(path.join(__dirname, f))
  for (let i = before; i < lib.tests.length; ++i) lib.tests[i].file = f.replace('.test.js', '')
}

let failed = 0
const t0 = Date.now()
for (const t of lib.tests) {
  const start = Date.now()
  try {
    t.fn()
    console.log(`  ok    ${t.file}: ${t.name} (${Date.now() - start} ms)`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${t.file}: ${t.name}\n        ${e.message}`)
  }
}
console.log(`\n${lib.tests.length - failed}/${lib.tests.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
process.exit(failed ? 1 : 0)
