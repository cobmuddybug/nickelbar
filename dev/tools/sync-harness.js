#!/usr/bin/env node
// Rewrites the id -> file map in dev/harness/shell.qml from
// engine/GamesCatalog.js. The harness can't import the catalog itself (see
// the comment at the top of shell.qml), so this keeps the two in step:
//   node dev/tools/sync-harness.js          # rewrite the map
//   node dev/tools/sync-harness.js --check  # exit 1 if it's out of date
const fs = require('fs'), path = require('path')
const { load, ROOT } = require('../tests/lib')

const catalog = load('engine/GamesCatalog.js')
const file = path.join(ROOT, 'dev', 'harness', 'shell.qml')
const src = fs.readFileSync(file, 'utf8')
const start = src.indexOf('readonly property var files: ({'), end = src.indexOf('})', start)
if (start < 0 || end < 0) { console.error('files map not found in shell.qml'); process.exit(2) }

const entries = catalog.GAMES.filter(g => g.qml).map(g => `    ${/^[a-z_][a-z0-9_]*$/i.test(g.id) ? g.id : JSON.stringify(g.id)}: ${JSON.stringify(g.qml)}`)
const block = 'readonly property var files: ({\n' + entries.join(',\n') + '\n  '
const next = src.slice(0, start) + block + src.slice(end)

if (process.argv.includes('--check')) {
  if (next !== src) { console.error('dev/harness/shell.qml is out of step with the catalog: run `make sync`'); process.exit(1) }
  console.log('harness map matches the catalog')
} else {
  fs.writeFileSync(file, next)
  console.log(`wrote ${entries.length} games to dev/harness/shell.qml`)
}
