.pragma library

// Tents, after Simon Tatham's. Every tree gets a tent in a square next to
// it (not diagonally), each tent belongs to one tree, no two tents touch
// even at a corner, and the numbers give how many tents each row and
// column holds.
//
// Puzzles are prebuilt with one answer (dev/tools/tatham/tents.js):
// { w, h, trees: "0"/"1" per cell, rows, cols }. Marks per cell: 0 blank,
// 1 tent, 2 grass (you've ruled a tent out).

var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function makeState(p, size, idx) {
  var marks = []
  for (var i = 0; i < p.w * p.h; ++i) marks.push(0)
  return { p: p, size: size, idx: idx, marks: marks, cursor: { x: 0, y: 0 }, history: [], solved: false }
}

function copy(s) {
  return { p: s.p, size: s.size, idx: s.idx, marks: s.marks, cursor: s.cursor, history: s.history, solved: s.solved }
}

function isTree(p, i) { return p.trees[i] === "1" }

function orth(p, i) {
  var x = i % p.w, y = Math.floor(i / p.w), out = []
  for (var d = 0; d < 4; ++d) {
    var a = x + ORTH[d][0], b = y + ORTH[d][1]
    if (a >= 0 && b >= 0 && a < p.w && b < p.h) out.push(b * p.w + a)
  }
  return out
}

function counts(s) {
  var p = s.p, rows = [], cols = []
  for (var y = 0; y < p.h; ++y) rows.push(0)
  for (var x = 0; x < p.w; ++x) cols.push(0)
  for (var i = 0; i < p.w * p.h; ++i) if (s.marks[i] === 1) { rows[Math.floor(i / p.w)]++; cols[i % p.w]++ }
  return { rows: rows, cols: cols }
}

// Tents that touch another tent, or have no tree beside them.
function badTents(s) {
  var p = s.p, bad = {}
  for (var i = 0; i < p.w * p.h; ++i) {
    if (s.marks[i] !== 1) continue
    var x = i % p.w, y = Math.floor(i / p.w)
    for (var dy = -1; dy <= 1; ++dy) for (var dx = -1; dx <= 1; ++dx) {
      var a = x + dx, b = y + dy
      if ((dx || dy) && a >= 0 && b >= 0 && a < p.w && b < p.h && s.marks[b * p.w + a] === 1) bad[i] = true
    }
    var nb = orth(p, i), tree = false
    for (var k = 0; k < nb.length; ++k) if (isTree(p, nb[k])) tree = true
    if (!tree) bad[i] = true
  }
  return bad
}

// Can every tree be paired with its own neighbouring tent? (Bipartite
// matching by augmenting paths; boards are small.)
function paired(s) {
  var p = s.p, match = {}, trees = [], tents = 0
  for (var i = 0; i < p.w * p.h; ++i) { if (isTree(p, i)) trees.push(i); if (s.marks[i] === 1) tents++ }
  if (tents !== trees.length) return false
  function augment(t, seen) {
    var nb = orth(p, t)
    for (var k = 0; k < nb.length; ++k) {
      var u = nb[k]
      if (s.marks[u] !== 1 || seen[u]) continue
      seen[u] = true
      if (match[u] === undefined || augment(match[u], seen)) { match[u] = t; return true }
    }
    return false
  }
  for (var j = 0; j < trees.length; ++j) if (!augment(trees[j], {})) return false
  return true
}

function isSolved(s) {
  var c = counts(s), p = s.p
  for (var y = 0; y < p.h; ++y) if (c.rows[y] !== p.rows[y]) return false
  for (var x = 0; x < p.w; ++x) if (c.cols[x] !== p.cols[x]) return false
  if (Object.keys(badTents(s)).length) return false
  return paired(s)
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.cursor = { x: (s.cursor.x + dx + s.p.w) % s.p.w, y: (s.cursor.y + dy + s.p.h) % s.p.h }
  return n
}

function mark(s, m) {
  var i = s.cursor.y * s.p.w + s.cursor.x
  if (s.solved || isTree(s.p, i)) return s
  var n = copy(s)
  n.history = s.history.concat([s.marks]).slice(-300)
  n.marks = s.marks.slice()
  n.marks[i] = s.marks[i] === m ? 0 : m
  n.solved = isSolved(n)
  return n
}

// Fill every blank square in the cursor's row or column with grass.
function grassLine(s, horizontal) {
  if (s.solved) return s
  var p = s.p, n = copy(s)
  n.history = s.history.concat([s.marks]).slice(-300)
  n.marks = s.marks.slice()
  for (var k = 0; k < (horizontal ? p.w : p.h); ++k) {
    var i = horizontal ? s.cursor.y * p.w + k : k * p.w + s.cursor.x
    if (!isTree(p, i) && n.marks[i] === 0) n.marks[i] = 2
  }
  return n
}

function undo(s) {
  if (!s.history.length || s.solved) return s
  var n = copy(s)
  n.marks = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  return n
}

function serialize(s) { return { size: s.size, idx: s.idx, marks: s.marks } }

function deserialize(o, p) {
  if (!o || !o.marks || o.marks.length !== p.w * p.h) return null
  var s = makeState(p, o.size, o.idx)
  s.marks = o.marks
  s.solved = isSolved(s)
  return s
}
