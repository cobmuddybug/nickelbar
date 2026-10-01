#!/usr/bin/env node
// Builds games/data/klotski.json: sliding-block puzzles on the 4x5 board,
// goal to bring the 2x2 block to the bottom middle. Random layouts are
// solved exactly by breadth-first search (a move = one piece, one square),
// and kept with their shortest solution length; the classic Huarong Dao
// layout goes in too. Levels are sorted easiest first.
//
//   node dev/tools/klotski.js
const fs = require('fs'), path = require('path')
const W = 4, H = 5, GOAL = { x: 1, y: 3 }

// Layout: 20 chars, a letter per piece (same letter = same piece), "." empty.
function pieces(layout) {
  const out = {}
  for (let i = 0; i < W * H; i++) {
    const c = layout[i]
    if (c === '.') continue
    const x = i % W, y = Math.floor(i / W)
    if (!out[c]) out[c] = { x, y, w: 1, h: 1 }
    const p = out[c]
    p.w = Math.max(p.w, x - p.x + 1); p.h = Math.max(p.h, y - p.y + 1)
  }
  return out
}

// Shape code per cell, so identical pieces are interchangeable in the search.
function shapeKey(layout) {
  const ps = pieces(layout)
  let s = ''
  for (let i = 0; i < W * H; i++) {
    const c = layout[i]
    s += c === '.' ? '.' : String(ps[c].w) + ps[c].h
  }
  return s
}

function moves(layout) {
  const ps = pieces(layout), out = []
  for (const id in ps) {
    const p = ps[id]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = p.x + dx, ny = p.y + dy
      if (nx < 0 || ny < 0 || nx + p.w > W || ny + p.h > H) continue
      let ok = true
      for (let y = ny; y < ny + p.h && ok; y++) for (let x = nx; x < nx + p.w && ok; x++) {
        const c = layout[y * W + x]
        if (c !== '.' && c !== id) ok = false
      }
      if (!ok) continue
      const a = layout.split('')
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) a[y * W + x] = '.'
      for (let y = ny; y < ny + p.h; y++) for (let x = nx; x < nx + p.w; x++) a[y * W + x] = id
      out.push(a.join(''))
    }
  }
  return out
}

function solved(layout) {
  const ps = pieces(layout)
  for (const id in ps) if (ps[id].w === 2 && ps[id].h === 2) return ps[id].x === GOAL.x && ps[id].y === GOAL.y
  return false
}

function shortest(layout) {
  const seen = new Set([shapeKey(layout)])
  let frontier = [layout], depth = 0
  while (frontier.length) {
    const next = []
    for (const l of frontier) {
      if (solved(l)) return depth
      for (const m of moves(l)) {
        const k = shapeKey(m)
        if (seen.has(k)) continue
        seen.add(k)
        next.push(m)
      }
    }
    frontier = next
    depth++
    if (seen.size > 200000) return -1
  }
  return -1
}

function randomLayout(rand) {
  for (;;) {
    const a = Array(W * H).fill(''), letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let li = 0
    const bx = Math.floor(rand() * 3), by = Math.floor(rand() * 2)
    for (let y = by; y < by + 2; y++) for (let x = bx; x < bx + 2; x++) a[y * W + x] = letters[li]
    li++
    const order = Array.from({ length: W * H }, (_, i) => i).sort(() => rand() - 0.5)
    let empties = 0
    for (const i of order) {
      if (a[i]) continue
      const x = i % W, y = Math.floor(i / W), r = rand()
      if (empties < 2 && r < 0.12) { a[i] = '.'; empties++; continue }
      if (r < 0.45 && y + 1 < H && !a[i + W]) { a[i] = a[i + W] = letters[li++]; continue }
      if (r < 0.7 && x + 1 < W && !a[i + 1]) { a[i] = a[i + 1] = letters[li++]; continue }
      a[i] = letters[li++]
    }
    const e = a.filter(c => c === '.').length
    if (e !== 2) continue
    const l = a.join('')
    if (solved(l)) continue
    return l
  }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const rand = mulberry32(20260929)
const CLASSIC = 'ABBCABBCDEEFDGHFI..J'
const levels = [{ layout: CLASSIC, min: shortest(CLASSIC), name: 'Huarong Dao' }]
const seen = new Set([shapeKey(CLASSIC)])
let tries = 0
while (levels.length < 60 && tries < 20000) {
  tries++
  const l = randomLayout(rand), k = shapeKey(l)
  if (seen.has(k)) continue
  seen.add(k)
  const m = shortest(l)
  if (m >= 18) levels.push({ layout: l, min: m })
}
levels.sort((a, b) => a.min - b.min)
fs.writeFileSync(path.join(__dirname, '..', '..', 'games', 'data', 'klotski.json'), JSON.stringify({ levels }) + '\n')
console.log(levels.length, 'levels from', tries, 'tries; shortest', levels[0].min, 'longest', levels[levels.length - 1].min,
  '; Huarong Dao', levels.find(l => l.name).min)
