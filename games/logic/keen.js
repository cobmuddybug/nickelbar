.pragma library

// Keen (KenKen), after Simon Tatham's. Fill the grid with 1..n, each once
// per row and column, so every outlined cage makes its target with its
// operation: + and × over all its cells, − and ÷ between its two.
//
// Puzzles come prebuilt with unique answers (dev/tools/tatham/keen.js):
// { n, cage: cage id per cell, cages: [{ op, target }] }. Solving is checked
// by the rules. Same cursor / pencil-mark handling as towers.js.

function makeState(p, size, idx) {
  var cells = p.n * p.n, vals = [], marks = []
  for (var i = 0; i < cells; ++i) { vals.push(0); marks.push(0) }
  return { p: p, size: size, idx: idx, vals: vals, marks: marks, cursor: { x: 0, y: 0 }, markMode: false,
           history: [], solved: false, note: "" }
}

function copy(s) {
  return { p: s.p, size: s.size, idx: s.idx, vals: s.vals, marks: s.marks, cursor: s.cursor, markMode: s.markMode,
           history: s.history, solved: s.solved, note: "" }
}

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

function members(p, k) {
  var out = []
  for (var i = 0; i < p.cage.length; ++i) if (p.cage[i] === k) out.push(i)
  return out
}

function cageOk(c, vals) {
  if (c.op === "=") return vals[0] === c.target
  if (c.op === "+") return vals.reduce(function(a, b) { return a + b }, 0) === c.target
  if (c.op === "*") return vals.reduce(function(a, b) { return a * b }, 1) === c.target
  var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals)
  return c.op === "-" ? hi - lo === c.target : hi === lo * c.target
}

// Per cage: 0 not full yet, 1 right, -1 wrong.
function cageState(s) {
  var out = []
  for (var k = 0; k < s.p.cages.length; ++k) {
    var m = members(s.p, k), vals = []
    for (var i = 0; i < m.length; ++i) vals.push(s.vals[m[i]])
    out.push(vals.indexOf(0) >= 0 ? 0 : cageOk(s.p.cages[k], vals) ? 1 : -1)
  }
  return out
}

// The cell a cage's label goes in: its top-left one.
function labelCell(p, k) { return members(p, k)[0] }

function isSolved(s) {
  if (s.vals.indexOf(0) >= 0) return false
  if (Object.keys(clashes(s)).length) return false
  var cs = cageState(s)
  for (var k = 0; k < cs.length; ++k) if (cs[k] !== 1) return false
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
