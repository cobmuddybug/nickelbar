.pragma library
.import "../../engine/Rng.js" as Rng

// Net (after Simon Tatham's): a network of pipes on a grid, every tile
// spun at random. Rotate tiles until everything connects back to the
// source in the middle with no loose ends. The layout is a random spanning
// tree, so there are no loops, and any arrangement that powers every tile
// with no open ends is a solution. Trees are kept only if a deduction
// solver (see solvesByDeduction) can settle every tile, so there is just
// the one answer and it never takes a guess.
//
// Tiles are 4-bit masks of their open sides: up 1, right 2, down 4, left 8.

var SIZES = [5, 7, 9, 11]
var UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8
var DIRS = [{ bit: UP, dx: 0, dy: -1, opp: DOWN }, { bit: RIGHT, dx: 1, dy: 0, opp: LEFT },
            { bit: DOWN, dx: 0, dy: 1, opp: UP }, { bit: LEFT, dx: -1, dy: 0, opp: RIGHT }]
var UNDO_LIMIT = 400

function rotCW(m) { return ((m << 1) | (m >> 3)) & 15 }
function rotCCW(m) { return ((m >> 1) | ((m & 1) << 3)) & 15 }

function bits(m) { var n = 0; for (var i = 0; i < 4; ++i) if (m & (1 << i)) n++; return n }

// Random spanning tree grown from the centre (randomised Prim). Tiles with
// all four sides open are avoided where possible: they can't be rotated
// into anything different, which makes for dull puzzles.
function makeTree(n) {
  var grid = []
  for (var i = 0; i < n * n; ++i) grid.push(0)
  var c = Math.floor(n / 2)
  var inTree = {}
  inTree[c * n + c] = true
  var frontier = []
  function addFrontier(x, y) {
    for (var d = 0; d < 4; ++d) {
      var nx = x + DIRS[d].dx, ny = y + DIRS[d].dy
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || inTree[ny * n + nx]) continue
      frontier.push({ x: x, y: y, d: d })
    }
  }
  addFrontier(c, c)
  var added = 1
  while (added < n * n && frontier.length) {
    var pick = Math.floor(Rng.random() * frontier.length)
    var e = frontier[pick]
    frontier.splice(pick, 1)
    var tx = e.x + DIRS[e.d].dx, ty = e.y + DIRS[e.d].dy
    if (inTree[ty * n + tx]) continue
    if (bits(grid[e.y * n + e.x]) >= 3 && Rng.random() < 0.85) { frontier.push(e); if (frontier.length > 1) continue }
    grid[e.y * n + e.x] |= DIRS[e.d].bit
    grid[ty * n + tx] |= DIRS[e.d].opp
    inTree[ty * n + tx] = true
    added++
    addFrontier(tx, ty)
  }
  return grid
}

// Solves like a person, no guessing. Each tile keeps the set of
// orientations still possible; one is ruled out if it
//   - points a pipe off the board, or disagrees with a side its neighbour
//     has already settled (open or closed)
//   - closes a loop, which a tree can't have
//   - seals off a finished group of tiles that can't reach the rest
// and a side every remaining orientation agrees on is settled. True if
// every tile ends up with one orientation — the layout is then unique.
function solvesByDeduction(tree, n) {
  var N = n * n, opts = [], side = []   // side[i*4+d]: -1 unknown, 0 closed, 1 open
  for (var i = 0; i < N; ++i) {
    var o = [], m = tree[i]
    for (var r = 0; r < 4; ++r) { if (o.indexOf(m) < 0) o.push(m); m = rotCW(m) }
    opts.push(o)
  }
  for (i = 0; i < N * 4; ++i) side.push(-1)
  function nbr(i, d) {
    var x = i % n + DIRS[d].dx, y = Math.floor(i / n) + DIRS[d].dy
    return x < 0 || y < 0 || x >= n || y >= n ? -1 : y * n + x
  }
  // Tiles joined to `from` through sides settled open, never entering
  // `skip`; `at`/`m` optionally overrides one tile's sides with mask m.
  function group(from, skip, at, m) {
    var seen = {}, stack = [from], out = []
    seen[from] = true
    while (stack.length) {
      var t = stack.pop()
      out.push(t)
      for (var d = 0; d < 4; ++d) {
        var open = t === at ? !!(m & DIRS[d].bit) : side[t * 4 + d] === 1
        var j = nbr(t, d)
        if (open && j >= 0 && j !== skip && !seen[j]) { seen[j] = true; stack.push(j) }
      }
    }
    return out
  }
  function allowed(i, m) {
    for (var d = 0; d < 4; ++d) {
      var open = !!(m & DIRS[d].bit), j = nbr(i, d)
      if (open && j < 0) return false
      if (side[i * 4 + d] !== -1 && side[i * 4 + d] !== (open ? 1 : 0)) return false
    }
    // A loop: two of m's pipes lead into the same settled group.
    var reach = {}
    for (d = 0; d < 4; ++d) {
      if (!(m & DIRS[d].bit)) continue
      var g = group(nbr(i, d), i, -1, 0)
      for (var k = 0; k < g.length; ++k) { if (reach[g[k]]) return false; reach[g[k]] = true }
    }
    // A sealed group: every tile in it settled, so nothing can leave.
    var gr = group(i, -1, i, m)
    if (gr.length === N) return true
    for (k = 0; k < gr.length; ++k) {
      var t = gr[k]
      if (t === i) continue
      for (d = 0; d < 4; ++d) if (side[t * 4 + d] === -1 && nbr(t, d) !== i) return true
    }
    return false
  }
  var changed = true
  while (changed) {
    changed = false
    for (i = 0; i < N; ++i) {
      if (opts[i].length === 1 && side[i * 4] !== -1 && side[i * 4 + 1] !== -1 && side[i * 4 + 2] !== -1 && side[i * 4 + 3] !== -1) continue
      var keep = opts[i].filter(function(m) { return allowed(i, m) })
      if (!keep.length) return false
      if (keep.length !== opts[i].length) { opts[i] = keep; changed = true }
      for (var d = 0; d < 4; ++d) {
        if (side[i * 4 + d] !== -1) continue
        var ones = 0
        for (var k = 0; k < keep.length; ++k) if (keep[k] & DIRS[d].bit) ones++
        if (ones && ones !== keep.length) continue
        var v = ones ? 1 : 0, j = nbr(i, d)
        side[i * 4 + d] = v
        if (j >= 0) side[j * 4 + (d + 2) % 4] = v
        changed = true
      }
    }
  }
  for (i = 0; i < N; ++i) if (opts[i].length !== 1) return false
  return true
}

function makeState(n, count) {
  var solution = makeTree(n)
  for (var tries = 0; tries < 60 && !solvesByDeduction(solution, n); ++tries) solution = makeTree(n)
  var grid = solution.map(function(m) {
    var r = Math.floor(Rng.random() * 4), out = m
    for (var i = 0; i < r; ++i) out = rotCW(out)
    return out
  })
  var s = { n: n, grid: grid, locked: grid.map(function() { return false }), cursor: { x: Math.floor(n / 2), y: Math.floor(n / 2) },
    moves: 0, history: [], count: count || 0, solved: false, note: "" }
  // Never hand out a board that's already solved.
  if (isSolved(s)) return makeState(n, count)
  return s
}

function copy(s) {
  return { n: s.n, grid: s.grid, locked: s.locked, cursor: s.cursor, moves: s.moves, history: s.history,
    count: s.count, solved: s.solved, note: "" }
}

// Set of indices connected to the source through matching pipes.
function powered(s) {
  var n = s.n, c = Math.floor(n / 2), start = c * n + c
  var on = {}
  on[start] = true
  var queue = [start]
  while (queue.length) {
    var i = queue.shift(), x = i % n, y = Math.floor(i / n)
    for (var d = 0; d < 4; ++d) {
      if (!(s.grid[i] & DIRS[d].bit)) continue
      var nx = x + DIRS[d].dx, ny = y + DIRS[d].dy
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
      var j = ny * n + nx
      if (on[j] || !(s.grid[j] & DIRS[d].opp)) continue
      on[j] = true
      queue.push(j)
    }
  }
  return on
}

// Open pipe ends that lead nowhere (off the board or into a closed side).
function looseEnds(s) {
  var n = s.n, loose = {}
  for (var i = 0; i < n * n; ++i) {
    var x = i % n, y = Math.floor(i / n)
    for (var d = 0; d < 4; ++d) {
      if (!(s.grid[i] & DIRS[d].bit)) continue
      var nx = x + DIRS[d].dx, ny = y + DIRS[d].dy
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || !(s.grid[ny * n + nx] & DIRS[d].opp)) {
        loose[i] = (loose[i] || 0) | DIRS[d].bit
      }
    }
  }
  return loose
}

function poweredCount(s) { return Object.keys(powered(s)).length }

function isSolved(s) {
  return poweredCount(s) === s.n * s.n && Object.keys(looseEnds(s)).length === 0
}

function moveCursor(state, dx, dy) {
  var n = state.n
  var s = copy(state)
  s.cursor = { x: (state.cursor.x + dx + n) % n, y: (state.cursor.y + dy + n) % n }
  return s
}

function rotate(state, cw) {
  var i = state.cursor.y * state.n + state.cursor.x
  if (state.locked[i]) { var n0 = copy(state); n0.note = "locked (X to unlock)"; return n0 }
  var s = copy(state)
  s.grid = state.grid.slice()
  s.grid[i] = cw ? rotCW(state.grid[i]) : rotCCW(state.grid[i])
  if (s.grid[i] === state.grid[i]) return state
  var h = state.history.concat([{ i: i, m: state.grid[i] }])
  s.history = h.length > UNDO_LIMIT ? h.slice(h.length - UNDO_LIMIT) : h
  s.moves = state.moves + 1
  if (isSolved(s)) { s.solved = true; s.count = state.count + 1 }
  return s
}

function toggleLock(state) {
  var i = state.cursor.y * state.n + state.cursor.x
  var s = copy(state)
  s.locked = state.locked.slice()
  s.locked[i] = !s.locked[i]
  return s
}

function undo(state) {
  if (!state.history.length || state.solved) return state
  var last = state.history[state.history.length - 1]
  var s = copy(state)
  s.grid = state.grid.slice()
  s.grid[last.i] = last.m
  s.history = state.history.slice(0, -1)
  s.cursor = { x: last.i % state.n, y: Math.floor(last.i / state.n) }
  return s
}

function serialize(s) {
  return { n: s.n, grid: s.grid, locked: s.locked, moves: s.moves, count: s.count, solved: s.solved }
}

function deserialize(o) {
  if (!o || !o.grid || !o.n || o.grid.length !== o.n * o.n) return null
  var s = { n: o.n, grid: o.grid, locked: o.locked || o.grid.map(function() { return false }),
    cursor: { x: Math.floor(o.n / 2), y: Math.floor(o.n / 2) }, moves: o.moves || 0, history: [],
    count: o.count || 0, solved: !!o.solved, note: "" }
  return s
}
