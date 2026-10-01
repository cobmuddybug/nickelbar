.pragma library
.import "../../engine/Rng.js" as Rng

// 0h n0, after Q42's game. Every cell is a blue dot or a red wall.
//   - A number on a blue dot says how many other blue dots it can see
//     looking straight up, down, left and right (walls and edges block).
//   - Every blue dot must see at least one other blue dot.
// Cell values: 0 empty, 1 blue, 2 red. Puzzles start from a random valid
// board with every blue numbered and every red shown, then givens are
// removed in random order while a deduction solver (the reasoning a person
// does, no guessing) can still fill the whole board. Mutators return new
// top-level states (see snake.js).

var SIZES = [4, 5, 6, 7, 8] // 9x9 generation stalls the shell for over half a second
var EMPTY = 0, BLUE = 1, RED = 2
var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function shuffled(a) {
  a = a.slice()
  for (var i = a.length - 1; i > 0; --i) { var j = Math.floor(Rng.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t }
  return a
}

// Blue cells visible from i (fully decided board).
function sees(g, n, i) {
  var x = i % n, y = Math.floor(i / n), count = 0
  for (var d = 0; d < 4; ++d) {
    var cx = x + DIRS[d][0], cy = y + DIRS[d][1]
    while (cx >= 0 && cy >= 0 && cx < n && cy < n && g[cy * n + cx] === BLUE) { count++; cx += DIRS[d][0]; cy += DIRS[d][1] }
  }
  return count
}

// For a partial board: [min, max] of what cell i could end up seeing.
// min counts only the blue run before the first non-blue; max also walks
// through empties.
function range(g, n, i) {
  var x = i % n, y = Math.floor(i / n), lo = 0, hi = 0
  for (var d = 0; d < 4; ++d) {
    var cx = x + DIRS[d][0], cy = y + DIRS[d][1], solid = true
    while (cx >= 0 && cy >= 0 && cx < n && cy < n) {
      var v = g[cy * n + cx]
      if (v === RED) break
      if (v === BLUE && solid) lo++
      else solid = false
      hi++
      cx += DIRS[d][0]; cy += DIRS[d][1]
    }
  }
  return [lo, hi]
}

function solvedBoard(g, n, clues) {
  for (var i = 0; i < g.length; ++i) {
    if (g[i] === EMPTY) return false
    if (g[i] === BLUE) {
      var s = sees(g, n, i)
      if (s === 0 || (clues[i] > 0 && s !== clues[i])) return false
    }
  }
  return true
}

// Every way number i can split its count over the four directions given
// the board so far, folded into the cells they all agree on: a list of
// { i, v } still empty on the board. Null if no split fits.
function clueForces(g, n, clues, i) {
  var x = i % n, y = Math.floor(i / n), opts = []
  // opts[d]: the run lengths direction d allows (k blues, then a wall/edge).
  for (var d = 0; d < 4; ++d) {
    var cells = [], cx = x + DIRS[d][0], cy = y + DIRS[d][1]
    while (cx >= 0 && cy >= 0 && cx < n && cy < n) { cells.push(cy * n + cx); cx += DIRS[d][0]; cy += DIRS[d][1] }
    var ks = []
    for (var k = 0; k <= cells.length; ++k) {
      if (k > 0 && g[cells[k - 1]] === RED) break
      if (k < cells.length && g[cells[k]] === BLUE) continue
      ks.push(k)
    }
    opts.push({ cells: cells, ks: ks })
  }
  var agree = {}, any = false, pick = [0, 0, 0, 0]
  function visit(d, left) {
    if (d === 4) {
      if (left) return
      var seen = {}
      for (var e = 0; e < 4; ++e) {
        var c = opts[e].cells, k = pick[e]
        for (var m = 0; m < k; ++m) seen[c[m]] = BLUE
        if (k < c.length) seen[c[k]] = RED
      }
      if (!any) { agree = seen; any = true; return }
      for (var key in agree) if (seen[key] !== agree[key]) delete agree[key]
      return
    }
    for (var q = 0; q < opts[d].ks.length; ++q) {
      if (opts[d].ks[q] > left) break
      pick[d] = opts[d].ks[q]
      visit(d + 1, left - opts[d].ks[q])
    }
  }
  visit(0, clues[i])
  if (!any) return null
  var out = []
  for (var c in agree) if (g[+c] === EMPTY) out.push({ i: +c, v: agree[c] })
  return out
}

// One deduction a person could make right now, or null: from a single
// number (every way it can still be met agrees on this cell), a blue with
// only one way left to see anything, or an empty cell walled in on every
// side (a blue there would see nothing). `false` on a contradiction.
function nextDeduction(g, n, clues) {
  for (var i = 0; i < g.length; ++i) {
    if (!clues[i]) continue
    var f = clueForces(g, n, clues, i)
    if (!f) return false
    if (f.length) return { i: f[0].i, v: f[0].v, from: i }
  }
  for (i = 0; i < g.length; ++i) {
    if (g[i] === RED) continue
    var x = i % n, y = Math.floor(i / n), open = []
    for (var k = 0; k < 4; ++k) {
      var nx = x + DIRS[k][0], ny = y + DIRS[k][1]
      if (nx >= 0 && ny >= 0 && nx < n && ny < n && g[ny * n + nx] !== RED) open.push(ny * n + nx)
    }
    if (g[i] === EMPTY && !open.length) return { i: i, v: RED, from: i }
    if (g[i] === BLUE && open.length === 0) return false
    if (g[i] === BLUE && open.length === 1 && g[open[0]] === EMPTY) return { i: open[0], v: BLUE, from: i }
  }
  return null
}

// Fills `g` in place with deductions until stuck; true if it ends up full
// (then the answer is unique and no step needed a guess).
function solvesByDeduction(g, n, clues) {
  g = g.slice()
  for (;;) {
    var d = nextDeduction(g, n, clues)
    if (d === false) return false
    if (!d) break
    g[d.i] = d.v
  }
  for (var i = 0; i < g.length; ++i) if (g[i] === EMPTY) return false
  return solvedBoard(g, n, clues)
}

function randomBoard(n) {
  for (var attempt = 0; attempt < 200; ++attempt) {
    var g = []
    for (var i = 0; i < n * n; ++i) g.push(Rng.random() < 0.3 ? RED : BLUE)
    // No lonely blues; cap numbers at 9 so they fit in a cell.
    var ok = true
    for (i = 0; i < g.length && ok; ++i) if (g[i] === BLUE && (sees(g, n, i) === 0 || sees(g, n, i) > 9)) ok = false
    if (ok) return g
  }
  return null
}

// Takes givens away while the puzzle stays deducible. A blue given always
// keeps its number (an unnumbered given blue is noise), so a blue and its
// number come off together.
function generate(n) {
  var solution = null
  while (!solution) solution = randomBoard(n)
  var clues = solution.map(function(v, i) { return v === BLUE ? sees(solution, n, i) : 0 })
  var grid = solution.slice()
  var order = shuffled(solution.map(function(_, i) { return i }))
  for (var k = 0; k < order.length; ++k) {
    var i = order[k]
    var saveV = grid[i], saveC = clues[i]
    grid[i] = EMPTY; clues[i] = 0
    if (!solvesByDeduction(grid, n, clues)) { grid[i] = saveV; clues[i] = saveC }
  }
  return { solution: solution, grid: grid, clues: clues }
}

function makeState(size, solved) {
  var n = size || 5
  var gen = generate(n)
  return { n: n, grid: gen.grid, clues: gen.clues, given: gen.grid.map(function(v) { return v !== EMPTY }),
    solution: gen.solution, cursor: { x: 0, y: 0 }, history: [], solved: false, count: solved || 0, hint: null, note: "" }
}

function copy(s) {
  return { n: s.n, grid: s.grid, clues: s.clues, given: s.given, solution: s.solution, cursor: s.cursor,
    history: s.history, solved: s.solved, count: s.count, hint: null, note: "" }
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
  s.solved = solvedBoard(g, state.n, state.clues)
  if (s.solved) s.count = state.count + 1
  return s
}

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

// Per numbered cell: "over" (already sees too many), "done" (exactly
// right with no way to see more), or "" — drives the number colours.
function clueStatus(state, i) {
  var r = range(state.grid, state.n, i)
  var c = state.clues[i]
  if (r[0] > c || r[1] < c) return "over"
  if (r[0] === c && r[1] === c) return "done"
  return ""
}

function hint(state) {
  if (state.solved) return state
  var s = copy(state), g = state.grid, n = state.n
  for (var i = 0; i < g.length; ++i) {
    if (state.clues[i] && clueStatus(state, i) === "over") {
      s.hint = { i: i }; s.note = "this number can't work any more"
      return s
    }
  }
  for (i = 0; i < g.length; ++i) {
    if (g[i] !== EMPTY && g[i] !== state.solution[i]) {
      s.hint = { i: i }; s.note = "this one is wrong"
      s.cursor = { x: i % n, y: Math.floor(i / n) }
      return s
    }
  }
  var d = nextDeduction(g, n, state.clues)
  if (d) {
    var what = d.v === RED ? "a wall" : "a blue dot"
    s.hint = { i: d.i }
    s.note = state.clues[d.from] ? "that number needs " + what + " here" : "this one has to be " + what
    s.cursor = { x: d.i % n, y: Math.floor(d.i / n) }
    return s
  }
  var empties = []
  for (i = 0; i < g.length; ++i) if (g[i] === EMPTY) empties.push(i)
  if (!empties.length) return s
  var pick = empties[Math.floor(Rng.random() * empties.length)]
  s.cursor = { x: pick % n, y: Math.floor(pick / n) }
  s.hint = { i: pick }; s.note = "try this one"
  return s
}

function filledCount(state) {
  var c = 0
  for (var i = 0; i < state.grid.length; ++i) if (state.grid[i]) c++
  return c
}

function serialize(state) {
  return { n: state.n, grid: state.grid, clues: state.clues, given: state.given, solution: state.solution,
    cursor: state.cursor, solved: state.solved, count: state.count }
}

function deserialize(obj) {
  if (!obj || !obj.n || !Array.isArray(obj.grid) || obj.grid.length !== obj.n * obj.n || !Array.isArray(obj.clues)) return null
  return { n: obj.n, grid: obj.grid, clues: obj.clues, given: obj.given, solution: obj.solution,
    cursor: obj.cursor || { x: 0, y: 0 }, history: [], solved: !!obj.solved, count: obj.count || 0, hint: null, note: "" }
}
