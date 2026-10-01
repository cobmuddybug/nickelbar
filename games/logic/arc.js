.pragma library
.import "../../engine/Rng.js" as Rng

// ARC: the Abstraction and Reasoning Corpus (ARC-AGI-1, François Chollet,
// Apache 2.0; bundled in data/arc1.json). Each puzzle shows a few
// input -> output examples; work out the rule and paint the output for the
// test input. Colours are the ten ARC colours, 0-9.
//
// Grids in the data file are strings, rows joined by "|", one digit a
// cell. In play a grid is { w, h, cells } with cells row-major.
//
// The puzzle list itself lives on the QML side (it's big); these functions
// take the one puzzle they need.

var MAX = 30
var UNDO_LIMIT = 200

function decode(str) {
  var rows = str.split("|")
  var h = rows.length, w = rows[0].length
  var cells = []
  for (var y = 0; y < h; ++y)
    for (var x = 0; x < w; ++x) cells.push(rows[y].charCodeAt(x) - 48)
  return { w: w, h: h, cells: cells }
}

function encode(g) {
  var rows = []
  for (var y = 0; y < g.h; ++y) rows.push(g.cells.slice(y * g.w, (y + 1) * g.w).join(""))
  return rows.join("|")
}

function blank(w, h, colour) {
  var cells = []
  for (var i = 0; i < w * h; ++i) cells.push(colour || 0)
  return { w: w, h: h, cells: cells }
}

function sameGrid(a, b) {
  if (a.w !== b.w || a.h !== b.h) return false
  for (var i = 0; i < a.cells.length; ++i) if (a.cells[i] !== b.cells[i]) return false
  return true
}

// A fresh attempt at `puzzle`: the output starts empty at the test input's
// size (resize with Z if the answer is a different shape).
function start(puzzle, idx) {
  var input = decode(puzzle.test[0])
  return { idx: idx, id: puzzle.id, example: 0, out: blank(input.w, input.h, 0),
    cursor: { x: 0, y: 0 }, brush: 1, tries: 0, history: [], resizing: false, solved: false, note: "" }
}

function copy(s) {
  return { idx: s.idx, id: s.id, example: s.example, out: s.out, cursor: s.cursor, brush: s.brush,
    tries: s.tries, history: s.history, resizing: s.resizing, solved: s.solved, note: "" }
}

function withEdit(state, out) {
  var s = copy(state)
  var h = state.history.concat([state.out])
  s.history = h.length > UNDO_LIMIT ? h.slice(h.length - UNDO_LIMIT) : h
  s.out = out
  return s
}

function moveCursor(state, dx, dy) {
  if (state.resizing) return resize(state, dx, dy)
  var s = copy(state)
  s.cursor = { x: Math.max(0, Math.min(state.out.w - 1, state.cursor.x + dx)),
    y: Math.max(0, Math.min(state.out.h - 1, state.cursor.y + dy)) }
  return s
}

function paint(state, colour) {
  var c = colour === undefined ? state.brush : colour
  var i = state.cursor.y * state.out.w + state.cursor.x
  var s
  if (state.out.cells[i] === c) { s = copy(state) }
  else {
    var cells = state.out.cells.slice()
    cells[i] = c
    s = withEdit(state, { w: state.out.w, h: state.out.h, cells: cells })
  }
  s.brush = c
  return s
}

// Pick the brush colour without painting (for the mouse's palette).
function setBrush(state, colour) {
  var s = copy(state)
  s.brush = colour
  return s
}

// Flood fill the region under the cursor (4-connected) with the brush.
function fill(state) {
  var g = state.out, start = state.cursor.y * g.w + state.cursor.x
  var from = g.cells[start], to = state.brush
  if (from === to) return state
  var cells = g.cells.slice()
  var stack = [start]
  while (stack.length) {
    var i = stack.pop()
    if (cells[i] !== from) continue
    cells[i] = to
    var x = i % g.w, y = Math.floor(i / g.w)
    if (x > 0) stack.push(i - 1)
    if (x < g.w - 1) stack.push(i + 1)
    if (y > 0) stack.push(i - g.w)
    if (y < g.h - 1) stack.push(i + g.w)
  }
  return withEdit(state, { w: g.w, h: g.h, cells: cells })
}

function copyInput(state, puzzle) {
  var s = withEdit(state, decode(puzzle.test[0]))
  s.cursor = { x: Math.min(state.cursor.x, s.out.w - 1), y: Math.min(state.cursor.y, s.out.h - 1) }
  s.note = "copied the input"
  return s
}

function clear(state) {
  return withEdit(state, blank(state.out.w, state.out.h, 0))
}

// Grow or shrink the output from the bottom-right, keeping what's painted.
function resize(state, dw, dh) {
  var g = state.out
  var w = Math.max(1, Math.min(MAX, g.w + dw)), h = Math.max(1, Math.min(MAX, g.h + dh))
  if (w === g.w && h === g.h) return state
  var next = blank(w, h, 0)
  for (var y = 0; y < Math.min(h, g.h); ++y)
    for (var x = 0; x < Math.min(w, g.w); ++x) next.cells[y * w + x] = g.cells[y * g.w + x]
  var s = withEdit(state, next)
  s.resizing = true
  s.cursor = { x: Math.min(state.cursor.x, w - 1), y: Math.min(state.cursor.y, h - 1) }
  return s
}

function toggleResize(state) {
  var s = copy(state)
  s.resizing = !state.resizing
  return s
}

function setExample(state, puzzle, delta) {
  var n = puzzle.train.length
  var s = copy(state)
  s.example = (state.example + delta + n) % n
  return s
}

function undo(state) {
  if (!state.history.length) return state
  var s = copy(state)
  s.out = state.history[state.history.length - 1]
  s.history = state.history.slice(0, -1)
  s.cursor = { x: Math.min(state.cursor.x, s.out.w - 1), y: Math.min(state.cursor.y, s.out.h - 1) }
  return s
}

function submit(state, puzzle) {
  var answer = decode(puzzle.test[1])
  var s = copy(state)
  s.tries = state.tries + 1
  if (sameGrid(state.out, answer)) {
    s.solved = true
    s.resizing = false
    return s
  }
  if (state.out.w !== answer.w || state.out.h !== answer.h) s.note = "not quite · the size is wrong too"
  else {
    var wrong = 0
    for (var i = 0; i < answer.cells.length; ++i) if (answer.cells[i] !== state.out.cells[i]) wrong++
    s.note = "not quite · " + wrong + " cell" + (wrong === 1 ? "" : "s") + " off"
  }
  return s
}

// Next puzzle index (wrapping) that isn't in `solved`, stepping `dir`.
function nextUnsolved(puzzles, from, solved, dir) {
  var n = puzzles.length
  for (var k = 1; k <= n; ++k) {
    var i = ((from + k * (dir || 1)) % n + n) % n
    if (!solved[puzzles[i].id]) return i
  }
  return from
}

function randomUnsolved(puzzles, solved) {
  var open = []
  for (var i = 0; i < puzzles.length; ++i) if (!solved[puzzles[i].id]) open.push(i)
  if (!open.length) return Math.floor(Rng.random() * puzzles.length)
  return open[Math.floor(Rng.random() * open.length)]
}

function serialize(s) {
  return { idx: s.idx, id: s.id, out: encode(s.out), brush: s.brush, tries: s.tries, solved: s.solved }
}

function deserialize(o, puzzle) {
  if (!o || !puzzle || o.id !== puzzle.id) return null
  var s = start(puzzle, o.idx)
  if (o.out) s.out = decode(o.out)
  s.brush = typeof o.brush === "number" ? o.brush : 1
  s.tries = o.tries || 0
  s.solved = !!o.solved
  return s
}
