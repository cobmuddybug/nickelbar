.pragma library

// Towers (skyscrapers), after Simon Tatham's. Fill the grid with 1..n so
// every row and column holds each once; read the digits as tower heights,
// and each clue round the edge is how many towers you'd see looking in
// from there (taller ones hide shorter ones behind them).
//
// Puzzles come prebuilt with unique answers (dev/tools/tatham/towers.js):
// { n, clues: [top, bottom, left, right], givens }. Solving is checked by
// the rules, not against a stored answer.

function makeState(p, size, idx) {
  var cells = p.n * p.n, vals = [], marks = []
  for (var i = 0; i < cells; ++i) { vals.push(p.givens[i] || 0); marks.push(0) }
  return { p: p, size: size, idx: idx, vals: vals, marks: marks, cursor: { x: 0, y: 0 }, markMode: false,
           history: [], solved: false, note: "" }
}

function copy(s) {
  return { p: s.p, size: s.size, idx: s.idx, vals: s.vals, marks: s.marks, cursor: s.cursor, markMode: s.markMode,
           history: s.history, solved: s.solved, note: "" }
}

function seen(line) {
  var max = 0, k = 0
  for (var i = 0; i < line.length; ++i) if (line[i] > max) { max = line[i]; k++ }
  return k
}

function row(s, r) { var n = s.p.n; return s.vals.slice(r * n, r * n + n) }
function col(s, c) { var n = s.p.n, out = []; for (var r = 0; r < n; ++r) out.push(s.vals[r * n + c]); return out }

// Cells that clash with another in their row or column.
function clashes(s) {
  var n = s.p.n, bad = {}
  for (var i = 0; i < n * n; ++i) {
    var v = s.vals[i]
    if (!v) continue
    var r = Math.floor(i / n), c = i % n
    for (var k = 0; k < n; ++k) {
      if (k !== c && s.vals[r * n + k] === v) bad[i] = true
      if (k !== r && s.vals[k * n + c] === v) bad[i] = true
    }
  }
  return bad
}

// Per clue: 0 no clue / not checkable yet, 1 satisfied, -1 broken.
// Only lines that are full get judged.
function clueState(s) {
  var n = s.p.n, out = [[], [], [], []]
  for (var i = 0; i < n; ++i) {
    var lines = [col(s, i), col(s, i).reverse(), row(s, i), row(s, i).reverse()]
    for (var side = 0; side < 4; ++side) {
      var clue = s.p.clues[side][i], line = lines[side]
      if (!clue || line.indexOf(0) >= 0) { out[side].push(0); continue }
      out[side].push(seen(line) === clue ? 1 : -1)
    }
  }
  return out
}

function isSolved(s) {
  if (s.vals.indexOf(0) >= 0) return false
  if (Object.keys(clashes(s)).length) return false
  var cs = clueState(s)
  for (var side = 0; side < 4; ++side) for (var i = 0; i < s.p.n; ++i) if (cs[side][i] === -1) return false
  return true
}

function moveCursor(s, dx, dy) {
  var n = copy(s), N = s.p.n
  n.cursor = { x: (s.cursor.x + dx + N) % N, y: (s.cursor.y + dy + N) % N }
  return n
}

function setDigit(s, v) {
  if (s.solved) return s
  var N = s.p.n, i = s.cursor.y * N + s.cursor.x
  if (s.p.givens[i]) { var g = copy(s); g.note = "that one's given"; return g }
  if (v > N) return s
  var n = copy(s)
  n.history = s.history.concat([{ vals: s.vals, marks: s.marks }]).slice(-200)
  if (s.markMode && v > 0) {
    n.marks = s.marks.slice()
    n.marks[i] = s.marks[i] ^ (1 << v)
    return n
  }
  n.vals = s.vals.slice()
  n.vals[i] = v === s.vals[i] ? 0 : v
  if (v === 0) { n.marks = s.marks.slice(); n.marks[i] = 0 }
  n.solved = isSolved(n)
  return n
}

function toggleMarks(s) { var n = copy(s); n.markMode = !s.markMode; return n }

function undo(s) {
  if (!s.history.length || s.solved) return s
  var n = copy(s), h = s.history[s.history.length - 1]
  n.vals = h.vals; n.marks = h.marks
  n.history = s.history.slice(0, -1)
  return n
}

function serialize(s) { return { size: s.size, idx: s.idx, vals: s.vals, marks: s.marks, solved: s.solved } }

function deserialize(o, p) {
  if (!o || !p || !o.vals || o.vals.length !== p.n * p.n) return null
  var s = makeState(p, o.size, o.idx)
  s.vals = o.vals; s.marks = o.marks || s.marks
  s.solved = isSolved(s)
  return s
}
