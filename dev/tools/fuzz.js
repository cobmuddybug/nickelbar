#!/usr/bin/env node
// Feeds every game (or the ones named) a random sequence of keys, clicks and drags in the
// real QML harness, round-trips its save now and then, and fails on any QML error.
//   node dev/tools/fuzz.js                  # every game, 120 random steps each
//   node dev/tools/fuzz.js snake klondike   # just these
//   SEED=7 STEPS=300 node dev/tools/fuzz.js # another run; a failure prints the script to replay
// Replay one: dev/tools/harness-run.sh GAME "<script>"
const { execFileSync } = require('child_process'), path = require('path')
const { load, ROOT } = require('../tests/lib')

const seed0 = Number(process.env.SEED || Date.now() % 100000), steps = Number(process.env.STEPS || 120)
function rng(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

const KEYS = ['h', 'j', 'k', 'l', 'a', 'a', 'w', 'w', 'u', 'p', 'p', 't', 'n', '1', '2', '3', '5', '9', '0', 'x', 'f', 'c', 'd', 's', 'r', 'b', 'q', 'A', 'L', 'H', 'J', 'K']
function script(r) {
  const out = []
  for (let i = 0; i < steps; ++i) {
    const k = r()
    if (k < 0.62) out.push(KEYS[Math.floor(r() * KEYS.length)])
    else if (k < 0.78) out.push('@' + r().toFixed(2) + ':' + r().toFixed(2))
    else if (k < 0.84) out.push('@' + r().toFixed(2) + ':' + r().toFixed(2) + ':r')
    else if (k < 0.9) out.push('>' + r().toFixed(2) + ':' + r().toFixed(2) + ':' + r().toFixed(2) + ':' + r().toFixed(2))
    else if (k < 0.97) out.push('w')
    else out.push('R')
  }
  return out.join(',')
}

const games = process.argv.slice(2).length ? process.argv.slice(2) : load('engine/GamesCatalog.js').GAMES.map(g => g.id)
let failed = 0
games.forEach((id, n) => {
  const s = script(rng(seed0 + n * 977))
  let out = ''
  try { out = execFileSync(path.join(ROOT, 'dev/tools/harness-run.sh'), [id, s], { encoding: 'utf8', timeout: 120000 }) } catch (e) { out = (e.stdout || '') + (e.stderr || '') + ' [harness failed]' }
  const bad = out.split('\n').filter(l => l.trim() && !l.includes('NICKELBAR_STATUS'))
  if (bad.length || !out.includes('NICKELBAR_STATUS')) {
    failed++
    console.log(`  FAIL  ${id}\n        ${(bad.join(' | ') || 'no status line').slice(0, 400)}\n        replay: dev/tools/harness-run.sh ${id} "${s}"`)
  } else console.log(`  ok    ${id}`)
})
console.log(`\n${games.length} games, seed ${seed0}, ${failed} failed`)
process.exit(failed ? 1 : 0)
