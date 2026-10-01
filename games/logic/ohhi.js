.pragma library
.import "../../engine/Rng.js" as Rng

// 0h h1 (Takuzu / binary puzzle), after Q42's game. Fill every cell with
// one of two colours (1 or 2) so that:
//   - no three of the same colour sit next to each other in a line
//   - every row and column holds equally many of each colour
//   - no two rows are identical, and no two columns are identical
// Puzzles come from a random full solution with givens removed one by one
// while a line-by-line deduction solver (the reasoning a person does, no
// guessing) can still fill the whole board. Every mutator returns a new
// top-level state (see snake.js).

var SIZES = [4, 6, 8, 10]

function emptyGrid(n) { var g = []; for (var i = 0; i < n * n; ++i) g.push(0); return g }

function shuffled(a) {
  a = a.slice()
  for (var i = a.length - 1; i > 0; --i) { var j = Math.floor(Rng.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t }
  return a
}

// ---- rule checks -----------------------------------------------------------

function line(g, n, idx, isRow) {
  var out = []
  for (var i = 0; i < n; ++i) out.push(isRow ? g[idx * n + i] : g[i * n + idx])
  return out
}

// Can cell i hold value v given the rest of the (partial) grid?
function canPlace(g, n, i, v) {
  var r = Math.floor(i / n), c = i % n
  function at(rr, cc) { return (rr < 0 || cc < 0 || rr >= n || cc >= n) ? -1 : g[rr * n + cc] }
  // triples through (r,c)
  if (at(r, c - 1) === v && at(r, c - 2) === v) return false
  if (at(r, c + 1) === v && at(r, c + 2) === v) return false
  if (at(r, c - 1) === v && at(r, c + 1) === v) return false
  if (at(r - 1, c) === v && at(r - 2, c) === v) return false
  if (at(r + 1, c) === v && at(r + 2, c) === v) return false
  if (at(r - 1, c) === v && at(r + 1, c) === v) return false
  // counts
  var rc = 0, cc2 = 0
  for (var k = 0; k < n; ++k) {
    if (k !== c && g[r * n + k] === v) rc++
    if (k !== r && g[k * n + c] === v) cc2++
  }
  if (rc + 1 > n / 2 || cc2 + 1 > n / 2) return false
  return true
}

function sameLine(a, b) { for (var i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false; return true }
function full(l) { for (var i = 0; i < l.length; ++i) if (!l[i]) return false; return true }

// After placing at i, reject if a now-complete row/column duplicates another.
function uniqueLines(g, n, i) {
  var r = Math.floor(i / n), c = i % n
  var row = line(g, n, r, true)
  if (full(row)) for (var k = 0; k < n; ++k) if (k !== r) { var o = line(g, n, k, true); if (full(o) && sameLine(o, row)) return false }
  var col = line(g, n, c, false)
  if (full(col)) for (k = 0; k < n; ++k) if (k !== c) { var oc = line(g, n, k, false); if (full(oc) && sameLine(oc, col)) return false }
  return true
}

// ---- solving / generating --------------------------------------------------

// Every legal full line of length n: balanced, no three alike in a row.
var patternCache = {}
function patterns(n) {
  if (patternCache[n]) return patternCache[n]
  var out = []
  for (var m = 0; m < (1 << n); ++m) {
    var l = [], ones = 0, ok = true
    for (var k = 0; k < n; ++k) { var v = (m >> k) & 1 ? 1 : 2; l.push(v); if (v === 1) ones++ }
    if (ones * 2 !== n) continue
    for (k = 0; k + 2 < n && ok; ++k) if (l[k] === l[k + 1] && l[k] === l[k + 2]) ok = false
    if (ok) out.push(l)
  }
  patternCache[n] = out
  return out
}

// What every legal completion of line r agrees on: a line of 0/1/2 (0 where
// they differ), or null if nothing fits. A legal completion matches the
// cells already set and isn't a copy of another finished line.
function lineAgree(lines, r, n) {
  var pats = patterns(n), l = lines[r], agree = null
  for (var p = 0; p < pats.length; ++p) {
    var pat = pats[p], fits = true
    for (var k = 0; k < n && fits; ++k) if (l[k] && l[k] !== pat[k]) fits = false
    for (var o = 0; o < n && fits; ++o) if (o !== r && full(lines[o]) && sameLine(lines[o], pat)) fits = false
    if (!fits) continue
    if (!agree) agree = pat.slice()
    else for (k = 0; k < n; ++k) if (agree[k] !== pat[k]) agree[k] = 0
  }
  return agree
}

// Deduction only, one line at a time: any cell every legal completion of
// its row or column agrees on gets filled. That covers the pairs, gaps,
// half-full and duplicate-line rules a person uses, and never guesses.
// Fills `g` in place; returns false on a contradiction.
function deduce(g, n) {
  var changed = true
  while (changed) {
    changed = false
    for (var isRow = 0; isRow < 2; ++isRow) {
      var lines = []
      for (var r = 0; r < n; ++r) lines.push(line(g, n, r, !!isRow))
      for (r = 0; r < n; ++r) {
        if (full(lines[r])) continue
        var agree = lineAgree(lines, r, n)
        if (!agree) return false
        for (var k = 0; k < n; ++k) {
          if (lines[r][k] || !agree[k]) continue
          g[isRow ? r * n + k : k * n + r] = agree[k]
          lines[r][k] = agree[k]
          changed = true
        }
      }
    }
  }
  return true
}

// The first empty cell a single row or column forces right now, or null.
function forcedCell(g, n) {
  for (var isRow = 0; isRow < 2; ++isRow) {
    var lines = []
    for (var r = 0; r < n; ++r) lines.push(line(g, n, r, !!isRow))
    for (r = 0; r < n; ++r) {
      if (full(lines[r])) continue
      var agree = lineAgree(lines, r, n)
      if (!agree) continue
      for (var k = 0; k < n; ++k) if (!lines[r][k] && agree[k]) return isRow ? r * n + k : k * n + r
    }
  }
  return -1
}

function solvesByDeduction(puzzle, n) {
  var g = puzzle.slice()
  if (!deduce(g, n)) return false
  for (var i = 0; i < g.length; ++i) if (!g[i]) return false
  return true
}

function fillRandom(g, n, pos) {
  if (pos === g.length) return true
  var vals = Rng.random() < 0.5 ? [1, 2] : [2, 1]
  for (var k = 0; k < 2; ++k) {
    if (!canPlace(g, n, pos, vals[k])) continue
    g[pos] = vals[k]
    if (uniqueLines(g, n, pos) && fillRandom(g, n, pos + 1)) return true
    g[pos] = 0
  }
  return false
}

// Deducible implies unique: the solver only fills what's forced.
function generate(n) {
  var solution = emptyGrid(n)
  fillRandom(solution, n, 0)
  var puzzle = solution.slice()
  var order = shuffled(solution.map(function(_, i) { return i }))
  for (var k = 0; k < order.length; ++k) {
    var i = order[k], keep = puzzle[i]
    puzzle[i] = 0
    if (!solvesByDeduction(puzzle, n)) puzzle[i] = keep
  }
  return { solution: solution, puzzle: puzzle }
}

// ---- state -----------------------------------------------------------------

function makeState(size, solved) {
  var n = size || 6
  var gen = generate(n)
  var given = gen.puzzle.map(function(v) { return v !== 0 })
  return { n: n, grid: gen.puzzle.slice(), given: given, solution: gen.solution, cursor: { x: 0, y: 0 },
    history: [], solved: false, count: solved || 0, hint: null, note: "" }
}

function copy(s) {
  return { n: s.n, grid: s.grid, given: s.given, solution: s.solution, cursor: s.cursor, history: s.history,
    solved: s.solved, count: s.count, hint: null, note: "" }
}

function moveCursor(state, dx, dy) {
  var s = copy(state)
  s.cursor = { x: Math.max(0, Math.min(state.n - 1, state.cursor.x + dx)), y: Math.max(0, Math.min(state.n - 1, state.cursor.y + dy)) }
  return s
}

function setCell(state, v) {
  var i = state.cursor.y * state.n + state.cursor.x
  if (state.solved || state.given[i] || state.grid[i] === v) return state
  var s = copy(state)
  var g = state.grid.slice(); g[i] = v
  s.grid = g
  s.history = state.history.concat([{ i: i, v: state.grid[i] }]).slice(-300)
  s.solved = isSolved(g, state.n)
  if (s.solved) s.count = state.count + 1
  return s
}

// SPACE cycles empty -> colour 1 -> colour 2 -> empty.
function cycle(state) {
  var i = state.cursor.y * state.n + state.cursor.x
  return setCell(state, (state.grid[i] + 1) % 3)
}

function undo(state) {
  if (state.solved || !state.history.length) return state
  var h = state.history[state.history.length - 1]
  var s = copy(state)
  var g = state.grid.slice(); g[h.i] = h.v
  s.grid = g
  s.history = state.history.slice(0, -1)
  s.cursor = { x: h.i % state.n, y: Math.floor(h.i / state.n) }
  return s
}

// Cells currently breaking a rule (for red outlines): part of a triple, in
// an over-full line, or in a full line that duplicates another.
function errors(state) {
  var g = state.grid, n = state.n, bad = {}
  for (var r = 0; r < n; ++r) {
    for (var isRow = 0; isRow < 2; ++isRow) {
      var l = line(g, n, r, !!isRow)
      var idx = function(k) { return isRow ? r * n + k : k * n + r }
      for (var k = 0; k + 2 < n; ++k)
        if (l[k] && l[k] === l[k + 1] && l[k] === l[k + 2]) { bad[idx(k)] = bad[idx(k + 1)] = bad[idx(k + 2)] = true }
      for (var v = 1; v <= 2; ++v) {
        var cnt = 0; for (k = 0; k < n; ++k) if (l[k] === v) cnt++
        if (cnt > n / 2) for (k = 0; k < n; ++k) if (l[k] === v) bad[idx(k)] = true
      }
      if (full(l)) for (var o = 0; o < n; ++o) if (o !== r) {
        var ol = line(g, n, o, !!isRow)
        if (full(ol) && sameLine(l, ol)) for (k = 0; k < n; ++k) bad[idx(k)] = true
      }
    }
  }
  return bad
}

function isSolved(g, n) {
  for (var i = 0; i < g.length; ++i) if (!g[i]) return false
  var st = { grid: g, n: n }
  var e = errors(st)
  for (var k in e) return false
  return true
}

// A nudge in the spirit of the original: first point out a mistake, else
// find a cell its row or column forces, else reveal a cell of the solution.
function hint(state) {
  if (state.solved) return state
  var s = copy(state)
  var n = state.n, g = state.grid
  var e = errors(state)
  for (var k in e) {
    s.hint = { i: Number(k) }
    s.note = "something's off here"
    return s
  }
  // Wrong-but-legal cells come before deductions: reasoning from them
  // leads nowhere good.
  for (var i = 0; i < g.length; ++i) {
    if (g[i] && g[i] !== state.solution[i]) {
      s.hint = { i: i }; s.note = "this one is wrong"
      s.cursor = { x: i % n, y: Math.floor(i / n) }
      return s
    }
  }
  var f = forcedCell(g, n)
  if (f >= 0) {
    s.hint = { i: f }
    s.note = "its row or column decides this one"
    s.cursor = { x: f % n, y: Math.floor(f / n) }
    return s
  }
  var empties = []
  for (i = 0; i < g.length; ++i) if (!g[i]) empties.push(i)
  if (!empties.length) return s
  var pick = empties[Math.floor(Rng.random() * empties.length)]
  s.cursor = { x: pick % n, y: Math.floor(pick / n) }
  s.hint = { i: pick }
  s.note = "try this one"
  return s
}

function filledCount(state) {
  var c = 0
  for (var i = 0; i < state.grid.length; ++i) if (state.grid[i]) c++
  return c
}

function serialize(state) {
  return { n: state.n, grid: state.grid, given: state.given, solution: state.solution, cursor: state.cursor,
    solved: state.solved, count: state.count }
}

function deserialize(obj) {
  if (!obj || !obj.n || !Array.isArray(obj.grid) || obj.grid.length !== obj.n * obj.n || !Array.isArray(obj.solution)) return null
  return { n: obj.n, grid: obj.grid, given: obj.given, solution: obj.solution, cursor: obj.cursor || { x: 0, y: 0 },
    history: [], solved: !!obj.solved, count: obj.count || 0, hint: null, note: "" }
}
