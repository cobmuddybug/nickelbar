#!/usr/bin/env node
// Builds the puzzle packs in games/data/tatham/ for the pen-and-paper
// puzzles after Simon Tatham's collection whose uniqueness check is too
// slow to run live in the shell. Each <game>.js here exports
//   sizes: [{ name, args, count }]
//   generate(args, rand) -> puzzle object (or null to retry)
// and every puzzle it returns has exactly one solution.
//
//   node dev/tools/tatham/build.js            # all of them
//   node dev/tools/tatham/build.js towers     # just one
const fs = require('fs'), path = require('path')

function mulberry32(seed) {
  let a = seed >>> 0
  return function() {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ALL = ['towers', 'keen', 'lightup', 'tents', 'signpost', 'loopy']
const games = process.argv.slice(2).length ? process.argv.slice(2) : ALL
const out = path.join(__dirname, '..', '..', '..', 'games', 'data', 'tatham')
fs.mkdirSync(out, { recursive: true })

for (const game of games) {
  const gen = require('./' + game + '.js')
  const rand = mulberry32(0xC0FFEE ^ game.length * 7919)
  const pack = { sizes: [] }
  for (const size of gen.sizes) {
    const t0 = Date.now(), puzzles = [], seen = new Set()
    let tries = 0
    while (puzzles.length < size.count) {
      tries++
      const p = gen.generate(size.args, rand)
      if (!p) continue
      const key = JSON.stringify(p)
      if (seen.has(key)) continue
      seen.add(key)
      puzzles.push(p)
    }
    pack.sizes.push({ name: size.name, puzzles })
    console.log(`${game} ${size.name}: ${puzzles.length} puzzles (${tries} tries) in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
  fs.writeFileSync(path.join(out, game + '.json'), JSON.stringify(pack) + '\n')
}
