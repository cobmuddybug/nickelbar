.pragma library
.import "../../engine/Rng.js" as Rng

// Pipeline (after Pipe Mania). Lay pipe from the queue anywhere on the
// grid before the water starts, and keep ahead of it once it does. Each
// length it runs through scores; a cross run through both ways pays a
// bonus. The flow ends at the first gap or open end: if it covered the
// level's quota you go on (with a bonus for extra), otherwise it's over.
// Laying over a dry pipe swaps it out but costs a little. F lets the water
// rip once you're happy.
//
// Pieces are bitmasks of their openings: N 1, E 2, S 4, W 8. A cross (15)
// carries water straight through, once each way.

var COLS = 10
var ROWS = 7
var N = 1, E = 2, S = 4, W = 8
var PIECES = [10, 5, 3, 6, 12, 9, 15]
var WEIGHTS = [5, 5, 4, 4, 4, 4, 2]
var QUEUE = 5
var DIRS = [{ bit: N, dc: 0, dr: -1 }, { bit: E, dc: 1, dr: 0 }, { bit: S, dc: 0, dr: 1 }, { bit: W, dc: -1, dr: 0 }]

function opposite(b) { return b === N ? S : b === S ? N : b === E ? W : E }
function dirOf(b) { for (var i = 0; i < 4; ++i) if (DIRS[i].bit === b) return DIRS[i]; return null }
function idx(c, r) { return r * COLS + c }

function randomPiece() {
  var t = 0, i
  for (i = 0; i < WEIGHTS.length; ++i) t += WEIGHTS[i]
  var x = Rng.random() * t
  for (i = 0; i < WEIGHTS.length; ++i) { x -= WEIGHTS[i]; if (x < 0) return PIECES[i] }
  return PIECES[0]
}

function quota(level) { return 10 + level * 2 }
function countdown(level) { return Math.max(8, 20 - level * 1.5) }
function fillTime(level) { return Math.max(1.0, 2.3 - level * 0.12) }

function makeLevel(s) {
  var cells = []
  for (var i = 0; i < COLS * ROWS; ++i) cells.push({ p: 0, wet: 0, fixed: false })
  // The source: away from the edges, pointing somewhere with room.
  var sc = 2 + Math.floor(Rng.random() * (COLS - 4)), sr = 1 + Math.floor(Rng.random() * (ROWS - 2))
  var out = DIRS[Math.floor(Rng.random() * 4)].bit
  cells[idx(sc, sr)] = { p: out, wet: 0, fixed: true, source: true }
  // Later levels have walls in the way.
  var walls = Math.min(8, Math.floor((s.level - 1) * 1.5))
  for (var w = 0; w < walls; ++w) {
    var c = Math.floor(Rng.random() * COLS), r = Math.floor(Rng.random() * ROWS)
    var d = dirOf(out)
    if (cells[idx(c, r)].fixed || (c === sc + d.dc && r === sr + d.dr)) continue
    cells[idx(c, r)] = { p: 0, wet: 0, fixed: true, wall: true }
  }
  s.cells = cells
  s.source = { c: sc, r: sr }
  s.flow = null
  s.wait = countdown(s.level)
  s.filled = 0
  s.fast = false
  s.phase = "play"
  s.cursor = { c: sc + (sc < COLS / 2 ? 1 : -1), r: sr }
  s.msg = "LEVEL " + s.level + " · run " + quota(s.level) + " pipes"; s.msgT = 2
}

function makeState() {
  var s = { level: 1, score: 0, queue: [], t: 0, dead: false, msg: "", msgT: 0, pops: [] }
  for (var i = 0; i < QUEUE; ++i) s.queue.push(randomPiece())
  makeLevel(s)
  return s
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

function moveCursor(state, dx, dy) {
  var s = shallow(state)
  s.cursor = { c: Math.max(0, Math.min(COLS - 1, s.cursor.c + dx)), r: Math.max(0, Math.min(ROWS - 1, s.cursor.r + dy)) }
  return s
}

function setCursor(state, c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return state
  var s = shallow(state)
  s.cursor = { c: c, r: r }
  return s
}

// Lay the next queued piece at the cursor.
function place(state) {
  if (state.phase !== "play") return state
  var c = state.cursor.c, r = state.cursor.r, cell = state.cells[idx(c, r)]
  if (cell.fixed || cell.wet || (state.flow && state.flow.c === c && state.flow.r === r)) return state
  var s = shallow(state)
  s.cells = s.cells.slice()
  if (cell.p) { s.score = Math.max(0, s.score - 25); s.pops = s.pops.concat([{ c: c, r: r, text: "-25", t: 0.8 }]) }
  s.cells[idx(c, r)] = { p: s.queue[0], wet: 0, fixed: false }
  s.queue = s.queue.slice(1).concat([randomPiece()])
  return s
}

function hurry(state) {
  if (state.phase !== "play") return state
  var s = shallow(state)
  s.fast = true
  s.wait = Math.min(s.wait, 0.3)
  return s
}

function endLevel(s) {
  var q = quota(s.level)
  if (s.filled >= q) {
    var bonus = (s.filled - q) * 100 + s.level * 250
    s.score += bonus
    s.msg = "LEVEL CLEAR  +" + bonus; s.msgT = 2
    s.phase = "clear"; s.clearT = 2
  } else {
    s.msg = "SPILLED: " + s.filled + " of " + q; s.msgT = 3
    s.phase = "over"; s.dead = true
  }
}

// Enter cell (c, r) from direction `from` (the side water comes in by).
function enter(s, c, r, from) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false
  var cell = s.cells[idx(c, r)]
  if (!cell.p || cell.wall || cell.source || !(cell.p & from)) return false
  var cross = cell.p === 15
  var axis = from === N || from === S ? 1 : 2
  if (cell.wet & axis) return false
  if (!cross && cell.wet) return false
  var out = cross ? opposite(from) : (cell.p & ~from)
  s.flow = { c: c, r: r, from: from, out: out, t: 0 }
  return true
}

function step(state, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.pops = s.pops.map(function(o) { return { c: o.c, r: o.r - dt, text: o.text, t: o.t - dt } }).filter(function(o) { return o.t > 0 })

  if (s.phase === "clear") {
    s.clearT -= dt
    if (s.clearT <= 0) { s.level++; makeLevel(s) }
    return s
  }
  if (s.phase !== "play") return s

  var speed = s.fast ? 10 : 1
  if (s.wait > 0) {
    s.wait -= dt * speed
    if (s.wait <= 0) {
      // Water leaves the source.
      var src = s.cells[idx(s.source.c, s.source.r)], d = dirOf(src.p)
      s.cells = s.cells.slice()
      s.cells[idx(s.source.c, s.source.r)] = { p: src.p, wet: 3, fixed: true, source: true }
      if (!enter(s, s.source.c + d.dc, s.source.r + d.dr, opposite(src.p))) { endLevel(s); return s }
    }
    return s
  }

  var f = shallow(s.flow)
  f.t += dt * speed / fillTime(s.level)
  s.flow = f
  if (f.t >= 1) {
    // This length is full: mark it, score it, move on.
    s.cells = s.cells.slice()
    var cell = s.cells[idx(f.c, f.r)], axis = f.from === N || f.from === S ? 1 : 2
    var wet = cell.wet | (cell.p === 15 ? axis : 3)
    s.cells[idx(f.c, f.r)] = { p: cell.p, wet: wet, fixed: false }
    s.filled++
    var pts = 50
    if (cell.p === 15 && wet === 3) { pts += 500; s.pops = s.pops.concat([{ c: f.c, r: f.r, text: "CROSS +500", t: 1.2 }]) }
    s.score += pts * (s.fast ? 2 : 1)
    var od = dirOf(f.out)
    if (!enter(s, f.c + od.dc, f.r + od.dr, opposite(f.out))) { s.flow = null; endLevel(s) }
  }
  return s
}

// Openings of a piece as a list of direction records (for drawing).
function openings(p) { return DIRS.filter(function(d) { return p & d.bit }) }
