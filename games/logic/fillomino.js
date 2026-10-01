.pragma library
.import "../../engine/Rng.js" as Rng

// Fillomino: fill every cell with a number so that each group of touching
// equal numbers has exactly that many cells (a 3 sits in a group of three,
// a 1 stands alone). Some numbers are given.
//
// Generator: carve the board into random regions, label each with its size,
// then hide numbers one at a time for as long as the answer stays unique
// (checked by an exhaustive search), and put a few back so it isn't brutal.

function rnd(rand) { return (rand || Rng.random)() }
function shuffle(a, rand) {
  for (var i = a.length - 1; i > 0; --i) {
    var j = Math.floor(rnd(rand) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}
function grid(n, v) { var g = []; for (var y = 0; y < n; ++y) g.push(new Array(n).fill(v)); return g }
function neighbours(n, x, y) {
  var out = []
  if (x > 0) out.push([x - 1, y]); if (x + 1 < n) out.push([x + 1, y])
  if (y > 0) out.push([x, y - 1]); if (y + 1 < n) out.push([x, y + 1])
  return out
}

// Random partition into regions of size 1..maxSize, built so that no two
// touching regions share a size (they would read as one bigger region).
// Each region is grown from a random free cell; if its finished size matches
// a neighbour's it is regrown with another target, and failing that it
// settles for a single cell. Returns the number
// grid, or null if it painted itself into a corner (callers just try again).
function carve(n, maxSize, rand) {
  var reg = grid(n, -1), sizes = [], next = 0
  var order = shuffle(Array.apply(null, Array(n * n)).map(function(_, i) { return i }), rand)

  function grow(sx, sy, want) {
    var cells = [[sx, sy]], taken = {}
    taken[sy * n + sx] = true
    while (cells.length < want) {
      var frontier = []
      for (var i = 0; i < cells.length; ++i) {
        var nb = neighbours(n, cells[i][0], cells[i][1])
        for (var j = 0; j < nb.length; ++j) if (reg[nb[j][1]][nb[j][0]] < 0 && !taken[nb[j][1] * n + nb[j][0]]) frontier.push(nb[j])
      }
      if (!frontier.length) break
      var pick = frontier[Math.floor(rnd(rand) * frontier.length)]
      taken[pick[1] * n + pick[0]] = true; cells.push(pick)
    }
    return cells
  }
  // sizes of the regions touching these cells
  function touching(cells) {
    var seen = {}
    for (var i = 0; i < cells.length; ++i) {
      var nb = neighbours(n, cells[i][0], cells[i][1])
      for (var j = 0; j < nb.length; ++j) { var r = reg[nb[j][1]][nb[j][0]]; if (r >= 0) seen[r] = true }
    }
    return Object.keys(seen).map(Number)
  }

  for (var oi = 0; oi < order.length; ++oi) {
    var sx = order[oi] % n, sy = Math.floor(order[oi] / n)
    if (reg[sy][sx] >= 0) continue
    var cells = null
    for (var tries = 0; tries < 10 && !cells; ++tries) {
      var want = 1 + Math.floor(Math.pow(rnd(rand), 1.3) * maxSize)
      var cand = grow(sx, sy, want)
      var clash = touching(cand).some(function(r) { return sizes[r] === cand.length })
      if (!clash) cells = cand
    }
    if (!cells) {
      // no size fits (a pocket of one cell between same-sized neighbours): give up on this carving
      var lone = [[sx, sy]]
      if (touching(lone).some(function(r) { return sizes[r] === 1 })) return null
      cells = lone
    }
    for (var c = 0; c < cells.length; ++c) reg[cells[c][1]][cells[c][0]] = next
    sizes[next] = cells.length; next++
  }
  var nums = grid(n, 0)
  for (var y2 = 0; y2 < n; ++y2) for (var x2 = 0; x2 < n; ++x2) nums[y2][x2] = sizes[reg[y2][x2]]
  return isValidFull(nums, n) ? nums : null
}

// Groups of equal touching numbers, as arrays of cell ids.
function groups(nums, n) {
  var seen = grid(n, false), out = []
  for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) {
    if (seen[y][x] || !nums[y][x]) continue
    var v = nums[y][x], stack = [[x, y]], cells = []
    seen[y][x] = true
    while (stack.length) {
      var c = stack.pop(); cells.push(c)
      var nb = neighbours(n, c[0], c[1])
      for (var k = 0; k < nb.length; ++k) {
        var nx = nb[k][0], ny = nb[k][1]
        if (!seen[ny][nx] && nums[ny][nx] === v) { seen[ny][nx] = true; stack.push([nx, ny]) }
      }
    }
    out.push({ value: v, cells: cells })
  }
  return out
}

function isValidFull(nums, n) {
  var g = groups(nums, n)
  for (var i = 0; i < g.length; ++i) if (g[i].cells.length !== g[i].value) return false
  return true
}

// ---- exhaustive uniqueness search ------------------------------------------------

// Counts solutions (up to `limit`) consistent with `given`, cells with 0 free.
// Each step takes the unplaced cell with the fewest options (a given number
// first) and tries every region shape through it.
// If `maxNodes` is given and the search gets that big, it gives up and reports `limit`
// ("not provably unique"), which keeps the generator from stalling on a hard hidden clue.
function countSolutions(given, n, maxSize, limit, maxNodes) {
  var val = grid(n, 0)   // 0 = not yet placed in a region
  var count = 0, nodes = 0

  // Placing region `cells` (value v) must not touch a placed region of value
  // v, nor an unplaced cell whose given number is v (they would merge).
  function conflicts(cells, v) {
    for (var i = 0; i < cells.length; ++i) {
      var nb = neighbours(n, cells[i][0], cells[i][1])
      for (var k = 0; k < nb.length; ++k) {
        var nx = nb[k][0], ny = nb[k][1]
        if (val[ny][nx] === v) return true
        if (val[ny][nx] === 0 && given[ny][nx] === v && !inCells(cells, nx, ny)) return true
      }
    }
    return false
  }
  function inCells(cells, x, y) {
    for (var i = 0; i < cells.length; ++i) if (cells[i][0] === x && cells[i][1] === y) return true
    return false
  }

  function place(cells, v) {
    if (maxNodes && ++nodes > maxNodes) { count = limit; return }
    if (conflicts(cells, v)) return
    for (var i = 0; i < cells.length; ++i) val[cells[i][1]][cells[i][0]] = v
    rec()
    for (var j = 0; j < cells.length; ++j) val[cells[j][1]][cells[j][0]] = 0
  }

  // Every connected group of v free, compatible cells containing `root`,
  // each exactly once (Redelmeier's scheme, rooted at an arbitrary cell).
  function grow(root, v) {
    var rx = root % n, ry = Math.floor(root / n)
    function ok(id) {
      var x = id % n, y = Math.floor(id / n), g = given[y][x]
      return val[y][x] === 0 && (g === 0 || g === v)
    }
    if (!ok(root)) return
    var banned = {}; banned[root] = true
    function ext(cur, cand) {
      if (count >= limit) return
      if (cur.length === v) { place(cur, v); return }
      var cs = cand.slice()
      while (cs.length) {
        if (count >= limit) return
        var id = cs.pop()
        var x = id % n, y = Math.floor(id / n)
        var newCand = cs.slice(), added = []
        var nb = neighbours(n, x, y)
        for (var k = 0; k < nb.length; ++k) {
          var nid = nb[k][1] * n + nb[k][0]
          if (!banned[nid] && ok(nid)) { banned[nid] = true; added.push(nid); newCand.push(nid) }
        }
        cur.push([x, y])
        ext(cur, newCand)
        cur.pop()
        for (var a = 0; a < added.length; ++a) banned[added[a]] = false
      }
    }
    var seed = [], nb0 = neighbours(n, rx, ry)
    for (var k0 = 0; k0 < nb0.length; ++k0) {
      var nid0 = nb0[k0][1] * n + nb0[k0][0]
      if (ok(nid0)) { banned[nid0] = true; seed.push(nid0) }
    }
    ext([[rx, ry]], seed)
  }

  function rec() {
    if (count >= limit) return
    // A given cell first (its region size is known); prefer one already
    // squeezed by placed cells. Otherwise the first free cell.
    var best = -1, bestScore = 99, firstFree = -1
    for (var i = 0; i < n * n; ++i) {
      var x = i % n, y = Math.floor(i / n)
      if (val[y][x] !== 0) continue
      if (firstFree < 0) firstFree = i
      if (given[y][x]) {
        var free = 0, nb = neighbours(n, x, y)
        for (var k = 0; k < nb.length; ++k) if (val[nb[k][1]][nb[k][0]] === 0) free++
        var score = free
        if (score < bestScore) { bestScore = score; best = i }
      }
    }
    if (best < 0) best = firstFree
    if (best < 0) { count++; return }
    var g = given[Math.floor(best / n)][best % n]
    if (g) grow(best, g)
    else for (var v = 1; v <= maxSize; ++v) grow(best, v)
  }
  rec()
  return count
}

// ---- generator ---------------------------------------------------------------------

function generate(n, rand) {
  var maxSize = n <= 5 ? 4 : (n <= 7 ? 5 : 6)
  for (var attempt = 0; attempt < 200; ++attempt) {
    var nums = null
    for (var k = 0; k < 4000 && !nums; ++k) nums = carve(n, maxSize, rand)
    if (!nums) continue
    var given = nums.map(function(r) { return r.slice() })
    var order = shuffle(Array.apply(null, Array(n * n)).map(function(_, i) { return i }), rand)
    var hidden = []
    for (var i = 0; i < order.length; ++i) {
      var x = order[i] % n, y = Math.floor(order[i] / n)
      var keep = given[y][x]
      given[y][x] = 0
      if (countSolutions(given, n, maxSize, 2, 4000) === 1) hidden.push([x, y, keep])
      else given[y][x] = keep
    }
    // hand some back so it isn't minimal
    shuffle(hidden, rand)
    var give = Math.floor(hidden.length * 0.3)
    for (var g = 0; g < give; ++g) given[hidden[g][1]][hidden[g][0]] = hidden[g][2]
    var showing = 0
    for (var yy = 0; yy < n; ++yy) for (var xx = 0; xx < n; ++xx) if (given[yy][xx]) showing++
    if (showing >= 5) return { given: given, solution: nums }
  }
  return null
}

// ---- play state ---------------------------------------------------------------------

function makeState(n, rand) {
  n = n || 6
  var p = generate(n, rand)
  while (!p) p = generate(n, rand)
  return { size: n, given: p.given, solution: p.solution, fill: p.given.map(function(r) { return r.slice() }),
           cursor: { x: 0, y: 0 }, moves: 0, won: false, history: [] }
}

function clone(s, patch) {
  var o = { size: s.size, given: s.given, solution: s.solution, fill: s.fill, cursor: s.cursor,
            moves: s.moves, won: s.won, history: s.history }
  for (var k in patch) o[k] = patch[k]
  return o
}

function isDone(s) {
  for (var y = 0; y < s.size; ++y) for (var x = 0; x < s.size; ++x) if (!s.fill[y][x]) return false
  return isValidFull(s.fill, s.size)
}

function moveCursor(s, dx, dy) {
  var x = Math.max(0, Math.min(s.size - 1, s.cursor.x + dx)), y = Math.max(0, Math.min(s.size - 1, s.cursor.y + dy))
  return clone(s, { cursor: { x: x, y: y } })
}

function setDigit(s, d, x, y) {
  x = x === undefined ? s.cursor.x : x; y = y === undefined ? s.cursor.y : y
  if (s.won || s.given[y][x] || s.fill[y][x] === d) return s
  var fill = s.fill.map(function(r) { return r.slice() })
  var was = fill[y][x]
  fill[y][x] = d
  return clone(s, { fill: fill, moves: s.moves + 1, won: isDone(clone(s, { fill: fill })),
                    history: s.history.concat([{ x: x, y: y, was: was }]) })
}

// Change the digit under the pointer/cursor by +1 / -1 (wrapping through blank).
function step(s, delta, x, y) {
  x = x === undefined ? s.cursor.x : x; y = y === undefined ? s.cursor.y : y
  if (s.given[y][x]) return s
  var max = 9, cur = s.fill[y][x]
  var next = cur + delta
  if (next > max) next = 0
  if (next < 0) next = max
  return setDigit(s, next, x, y)
}

function undo(s) {
  if (s.won || !s.history.length) return s
  var h = s.history[s.history.length - 1]
  var fill = s.fill.map(function(r) { return r.slice() })
  fill[h.y][h.x] = h.was
  return clone(s, { fill: fill, cursor: { x: h.x, y: h.y }, history: s.history.slice(0, -1) })
}

// Groups that are already too big (can only be wrong).
function tooBig(s) {
  var bad = grid(s.size, false), g = groups(s.fill, s.size)
  for (var i = 0; i < g.length; ++i) if (g[i].cells.length > g[i].value)
    for (var j = 0; j < g[i].cells.length; ++j) bad[g[i].cells[j][1]][g[i].cells[j][0]] = true
  return bad
}

// Groups that are exactly the right size (drawn as settled).
function complete(s) {
  var ok = grid(s.size, false), g = groups(s.fill, s.size)
  for (var i = 0; i < g.length; ++i) if (g[i].cells.length === g[i].value)
    for (var j = 0; j < g[i].cells.length; ++j) ok[g[i].cells[j][1]][g[i].cells[j][0]] = true
  return ok
}

function serialize(s) {
  return { size: s.size, given: s.given, solution: s.solution, fill: s.fill, cursor: s.cursor,
           moves: s.moves, won: s.won, history: s.history }
}
function deserialize(o) {
  if (!o || !o.given || !o.fill || !o.solution) return null
  return { size: o.size || o.given.length, given: o.given, solution: o.solution, fill: o.fill,
           cursor: o.cursor || { x: 0, y: 0 }, moves: o.moves || 0, won: !!o.won,
           history: Array.isArray(o.history) ? o.history : [] }
}
