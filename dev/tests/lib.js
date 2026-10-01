// Shared helpers for the tests: load a games/logic/*.js (or engine/*.js)
// file written for QML's `.pragma library` into a plain Node context.
const fs = require('fs'), path = require('path'), vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')

// Every file is loaded once and shared, like QML's library singletons: seeding the one
// Rng module, say, reaches every game that imports it.
const cache = new Map()

function resolve(rel) {
  return rel.includes('/') ? path.join(ROOT, rel) : path.join(ROOT, 'games', 'logic', rel + '.js')
}

function loadFile(file) {
  if (cache.has(file)) return cache.get(file)
  const raw = fs.readFileSync(file, 'utf8')
  // `.import "path" as Name` lines become a Name variable holding that module.
  const ctx = { Math, JSON, console, Qt: {} }
  cache.set(file, ctx)
  for (const m of raw.matchAll(/^\.import "([^"]+)" as (\w+)/mg)) ctx[m[2]] = loadFile(path.resolve(path.dirname(file), m[1]))
  const src = raw.replace(/^\.pragma library/m, '').replace(/^\.import .*$/mg, '')
  vm.createContext(ctx)
  vm.runInContext(src, ctx, { filename: file })
  return ctx
}

// Games that load fresh state per test (their own module-level variables, e.g. a difficulty)
// can ask for a fresh copy of just that module.
function load(rel) { return loadFile(resolve(rel)) }

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }

// Tests register themselves: test('name', () => { ... }).
const tests = []
function test(name, fn) { tests.push({ name, fn }) }

module.exports = { ROOT, load, assert, test, tests }
