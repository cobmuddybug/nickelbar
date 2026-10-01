.pragma library
.import "../../engine/Rng.js" as Rng

// Mahjong solitaire on the classic 144-tile turtle. A tile is free when
// nothing sits on it and its left or right side is open; two free tiles
// with the same face clear (any flower matches any flower, likewise the
// seasons).
//
// Every deal is solvable: faces are handed out by "playing backwards" on
// the empty layout, repeatedly taking two tiles that are free among those
// still unassigned and giving them a matching pair. That removal order is
// itself a solution. R reshuffles what's left the same way.
//
// Keyboard: the cursor only ever sits on free tiles; arrows jump to the
// nearest free tile in that direction.

// Positions in tile units (x across, y down, z layer). Half-steps put the
// turtle's head, tail and cap between rows.
function turtle() {
  var out = []
  function row(y, x0, x1, z) { for (var x = x0; x <= x1; ++x) out.push({ x: x, y: y, z: z }) }
  row(0, 1, 12, 0); row(1, 3, 10, 0); row(2, 2, 11, 0); row(3, 1, 12, 0)
  row(4, 1, 12, 0); row(5, 2, 11, 0); row(6, 3, 10, 0); row(7, 1, 12, 0)
  out.push({ x: 0, y: 3.5, z: 0 }); out.push({ x: 13, y: 3.5, z: 0 }); out.push({ x: 14, y: 3.5, z: 0 })
  for (var y1 = 1; y1 <= 6; ++y1) row(y1, 4, 9, 1)
  for (var y2 = 2; y2 <= 5; ++y2) row(y2, 5, 8, 2)
  for (var y3 = 3; y3 <= 4; ++y3) row(y3, 6, 7, 3)
  out.push({ x: 6.5, y: 3.5, z: 4 })
  return out
}

var LAYOUT = turtle()
var COLS = 15
var ROWS = 8

// Faces 0-41: dots 0-8, bamboo 9-17, characters 18-26, winds 27-30,
// dragons 31-33, flowers 34-37, seasons 38-41.
function suitOf(f) {
  if (f < 9) return "dots"
  if (f < 18) return "bamboo"
  if (f < 27) return "chars"
  if (f < 31) return "wind"
  if (f < 34) return "dragon"
  if (f < 38) return "flower"
  return "season"
}
function rankOf(f) {
  if (f < 27) return f % 9 + 1
  if (f < 31) return f - 27
  if (f < 34) return f - 31
  if (f < 38) return f - 34 + 1
  return f - 38 + 1
}
function matchKey(f) { return f >= 38 ? "S" : f >= 34 ? "F" : String(f) }
function matches(a, b) { return matchKey(a) === matchKey(b) }

// The 72 pairs a full set makes.
function allPairs() {
  var pairs = []
  for (var f = 0; f < 34; ++f) { pairs.push([f, f]); pairs.push([f, f]) }
  pairs.push([34, 35]); pairs.push([36, 37])
  pairs.push([38, 39]); pairs.push([40, 41])
  return pairs
}

function shuffle(a) {
  var arr = a.slice()
  for (var i = arr.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1))
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t
  }
  return arr
}

// alive: array of bools over LAYOUT.
function isFree(alive, i) {
  var t = LAYOUT[i]
  var left = false, right = false
  for (var j = 0; j < LAYOUT.length; ++j) {
    if (j === i || !alive[j]) continue
    var o = LAYOUT[j]
    var ady = Math.abs(o.y - t.y)
    if (o.z === t.z + 1 && Math.abs(o.x - t.x) < 1 && ady < 1) return false
    if (o.z === t.z && ady < 1) {
      if (Math.abs(o.x - (t.x - 1)) < 0.01) left = true
      else if (Math.abs(o.x - (t.x + 1)) < 0.01) right = true
    }
  }
  return !(left && right)
}

function freeList(alive) {
  var out = []
  for (var i = 0; i < LAYOUT.length; ++i) if (alive[i] && isFree(alive, i)) out.push(i)
  return out
}

// Give `pairs` to the live positions so that the deal can be cleared.
// Returns faces (array over LAYOUT, -1 where dead) or null on a dead end.
function assign(alive, pairs) {
  var live = alive.slice()
  var faces = LAYOUT.map(function() { return -1 })
  var order = shuffle(pairs)
  for (var p = 0; p < order.length; ++p) {
    var free = freeList(live)
    if (free.length < 2) return null
    var a = free[Math.floor(Rng.random() * free.length)]
    var rest = free.filter(function(i) { return i !== a })
    var b = rest[Math.floor(Rng.random() * rest.length)]
    var pair = Rng.random() < 0.5 ? order[p] : [order[p][1], order[p][0]]
    faces[a] = pair[0]; faces[b] = pair[1]
    live[a] = false; live[b] = false
  }
  return faces
}

function deal(alive, pairs) {
  for (var tries = 0; tries < 200; ++tries) {
    var f = assign(alive, pairs)
    if (f) return f
  }
  return null
}

function makeState() {
  var alive = LAYOUT.map(function() { return true })
  var faces = deal(alive, allPairs())
  var s = { faces: faces, alive: alive, cursor: 0, selected: -1, history: [], removed: 0,
    shuffles: 0, hint: null, note: "" }
  s.cursor = pickStart(s)
  return s
}

function copy(s) {
  return { faces: s.faces, alive: s.alive, cursor: s.cursor, selected: s.selected, history: s.history,
    removed: s.removed, shuffles: s.shuffles, hint: null, note: "" }
}

function pickStart(s) {
  var free = freeList(s.alive)
  if (!free.length) return -1
  // Top of the turtle if it's free, else the free tile nearest the middle.
  var best = free[0], bestD = 1e9
  for (var i = 0; i < free.length; ++i) {
    var t = LAYOUT[free[i]]
    var d = Math.abs(t.x - 6.5) + Math.abs(t.y - 3.5) - t.z * 2
    if (d < bestD) { bestD = d; best = free[i] }
  }
  return best
}

function isWon(s) { return s.removed === LAYOUT.length }

function availableMoves(s) {
  var free = freeList(s.alive), n = 0
  var seen = {}
  for (var i = 0; i < free.length; ++i) {
    var k = matchKey(s.faces[free[i]])
    seen[k] = (seen[k] || 0) + 1
  }
  for (var key in seen) n += seen[key] * (seen[key] - 1) / 2
  return n
}

function findPair(s) {
  var free = freeList(s.alive)
  for (var i = 0; i < free.length; ++i)
    for (var j = i + 1; j < free.length; ++j)
      if (matches(s.faces[free[i]], s.faces[free[j]])) return [free[i], free[j]]
  return null
}

function moveCursor(state, dx, dy) {
  var free = freeList(state.alive)
  if (!free.length) return state
  var cur = state.cursor >= 0 && state.alive[state.cursor] ? LAYOUT[state.cursor] : { x: 6.5, y: 3.5, z: 0 }
  var best = -1, bestScore = 1e9
  for (var i = 0; i < free.length; ++i) {
    if (free[i] === state.cursor) continue
    var t = LAYOUT[free[i]]
    // Compare where tiles are drawn, which shifts a little per layer.
    var ex = (t.x - t.z * 0.1) - (cur.x - cur.z * 0.1), ey = (t.y - t.z * 0.1) - (cur.y - cur.z * 0.1)
    var along = dx ? ex * dx : ey * dy
    var across = dx ? Math.abs(ey) : Math.abs(ex)
    if (along < 0.3) continue
    var sc = along + across * 2.5
    if (sc < bestScore) { bestScore = sc; best = free[i] }
  }
  if (best < 0) return state
  var s = copy(state)
  s.cursor = best
  s.selected = state.selected
  return s
}

function remove(state, a, b) {
  var s = copy(state)
  s.alive = state.alive.slice()
  s.alive[a] = false; s.alive[b] = false
  s.removed = state.removed + 2
  s.history = state.history.concat([{ a: a, b: b, fa: state.faces[a], fb: state.faces[b] }])
  s.selected = -1
  if (!isWon(s)) {
    s.cursor = moveCursorTo(s, LAYOUT[a])
    if (!availableMoves(s)) s.note = "no moves left, R to reshuffle"
  }
  return s
}

// Nearest free tile to a point (after a pair clears from under the cursor).
function moveCursorTo(s, p) {
  var free = freeList(s.alive), best = -1, bestD = 1e9
  for (var i = 0; i < free.length; ++i) {
    var t = LAYOUT[free[i]]
    var d = Math.abs(t.x - p.x) + Math.abs(t.y - p.y)
    if (d < bestD) { bestD = d; best = free[i] }
  }
  return best
}

// Put the cursor on tile i, if it's a free one (for the mouse).
function setCursor(state, i) {
  if (i === state.cursor || i < 0 || !state.alive[i] || !isFree(state.alive, i)) return state
  var s = copy(state)
  s.cursor = i
  return s
}

function activate(state) {
  var c = state.cursor
  if (c < 0 || !state.alive[c] || !isFree(state.alive, c)) return state
  var s = copy(state)
  s.selected = state.selected
  if (state.selected < 0) { s.selected = c; return s }
  if (state.selected === c) { s.selected = -1; return s }
  if (matches(state.faces[state.selected], state.faces[c])) return remove(state, state.selected, c)
  s.selected = c
  s.note = "not a match"
  return s
}

function hint(state) {
  var s = copy(state)
  s.selected = state.selected
  var p = findPair(state)
  if (p) s.hint = p
  else s.note = "no moves left, R to reshuffle"
  return s
}

// Re-deal the remaining faces over the remaining tiles, solvably.
function reshuffle(state) {
  var byKey = {}
  for (var i = 0; i < LAYOUT.length; ++i) {
    if (!state.alive[i]) continue
    var k = matchKey(state.faces[i])
    ;(byKey[k] = byKey[k] || []).push(state.faces[i])
  }
  var pairs = []
  for (var key in byKey) {
    var list = byKey[key]
    for (var j = 0; j + 1 < list.length; j += 2) pairs.push([list[j], list[j + 1]])
  }
  var faces = deal(state.alive, pairs)
  var s = copy(state)
  s.selected = -1
  if (!faces) { s.note = "couldn't reshuffle"; return s }
  s.faces = faces
  s.shuffles = state.shuffles + 1
  s.history = []
  s.cursor = pickStart(s)
  return s
}

function undo(state) {
  if (!state.history.length) return state
  var last = state.history[state.history.length - 1]
  var s = copy(state)
  s.alive = state.alive.slice()
  s.faces = state.faces.slice()
  s.alive[last.a] = true; s.alive[last.b] = true
  s.faces[last.a] = last.fa; s.faces[last.b] = last.fb
  s.removed = state.removed - 2
  s.history = state.history.slice(0, -1)
  s.selected = -1
  s.cursor = last.a
  return s
}

// Score: tiles cleared, less 10 per reshuffle.
function score(s) { return Math.max(0, s.removed - s.shuffles * 10) }

function serialize(s) {
  return { faces: s.faces, alive: s.alive, removed: s.removed, shuffles: s.shuffles }
}

function deserialize(o) {
  if (!o || !o.faces || o.faces.length !== LAYOUT.length || !o.alive) return null
  var s = { faces: o.faces, alive: o.alive, cursor: 0, selected: -1, history: [], removed: o.removed || 0,
    shuffles: o.shuffles || 0, hint: null, note: "" }
  if (isWon(s)) return null
  s.cursor = pickStart(s)
  return s
}
