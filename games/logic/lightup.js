.pragma library

// Light Up (Akari), after Simon Tatham's. Put lights on white cells so
// every white cell is lit; a light shines along its row and column until a
// black cell stops it. No light may shine on another, and a numbered black
// cell has exactly that many lights next to it.
//
// Puzzles are prebuilt with unique answers (dev/tools/tatham/lightup.js):
// { w, h, cells } with "." white, "#" black, "0"-"4" numbered black.
// Marks per cell: 0 nothing, 1 light, 2 dot (you've ruled a light out).

function makeState(p, size, idx) {
  var marks = []
  for (var i = 0; i < p.w * p.h; ++i) marks.push(0)
  return { p: p, size: size, idx: idx, marks: marks, cursor: { x: 0, y: 0 }, history: [], solved: false }
}

function copy(s) {
  return { p: s.p, size: s.size, idx: s.idx, marks: s.marks, cursor: s.cursor, history: s.history, solved: s.solved }
}

function isBlack(p, i) { return p.cells[i] !== "." }
function number(p, i) { var c = p.cells[i]; return c >= "0" && c <= "4" ? c.charCodeAt(0) - 48 : -1 }

var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// lit[i]: how many lights shine on white cell i (a light counts itself).
// clash[i]: a light that another light shines on.
function analyse(s) {
  var p = s.p, N = p.w * p.h, lit = [], clash = {}
  for (var i = 0; i < N; ++i) lit.push(0)
  for (var j = 0; j < N; ++j) {
    if (s.marks[j] !== 1) continue
    lit[j]++
    var x0 = j % p.w, y0 = Math.floor(j / p.w)
    for (var d = 0; d < 4; ++d) {
      var x = x0 + DIRS[d][0], y = y0 + DIRS[d][1]
      while (x >= 0 && y >= 0 && x < p.w && y < p.h && !isBlack(p, y * p.w + x)) {
        var k = y * p.w + x
        lit[k]++
        if (s.marks[k] === 1) { clash[j] = true; clash[k] = true }
        x += DIRS[d][0]; y += DIRS[d][1]
      }
    }
  }
  return { lit: lit, clash: clash }
}

// Per numbered cell: lights around it now.
function around(s, i) {
  var p = s.p, x = i % p.w, y = Math.floor(i / p.w), n = 0
  for (var d = 0; d < 4; ++d) {
    var nx = x + DIRS[d][0], ny = y + DIRS[d][1]
    if (nx >= 0 && ny >= 0 && nx < p.w && ny < p.h && s.marks[ny * p.w + nx] === 1) n++
  }
  return n
}

function isSolved(s) {
  var a = analyse(s), p = s.p
  if (Object.keys(a.clash).length) return false
  for (var i = 0; i < p.w * p.h; ++i) {
    if (!isBlack(p, i)) { if (!a.lit[i]) return false; continue }
    var n = number(p, i)
    if (n >= 0 && around(s, i) !== n) return false
  }
  return true
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.cursor = { x: (s.cursor.x + dx + s.p.w) % s.p.w, y: (s.cursor.y + dy + s.p.h) % s.p.h }
  return n
}

// Set the cursor cell's mark; asking for the mark it already has clears it.
function mark(s, m) {
  var i = s.cursor.y * s.p.w + s.cursor.x
  if (s.solved || isBlack(s.p, i)) return s
  var n = copy(s)
  n.history = s.history.concat([s.marks]).slice(-300)
  n.marks = s.marks.slice()
  n.marks[i] = s.marks[i] === m ? 0 : m
  n.solved = isSolved(n)
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
