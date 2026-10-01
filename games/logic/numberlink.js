.pragma library
.import "../../engine/Rng.js" as Rng

// Numberlink (after Flow Free): join each pair of matching dots with a path,
// paths never cross, and together the paths must cover every cell.
//
// Generator: a random path that visits every cell once (built with the
// "fewest exits first" heuristic), cut into pieces; the two ends of each
// piece become a pair of dots. So a solution always exists.
//
// Play: press a dot (or any part of a path) to pick it up, drag / arrow on
// to draw. Running into another path cuts it; running back along your own
// path rewinds it. Ending on the matching dot completes the pair.

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

// A Hamiltonian path on the n x n grid, by randomised walk with backtracking.
function hamiltonian(n, rand, budget) {
  var seen = grid(n, false), path = [], steps = 0
  function degree(x, y) {
    var d = 0, nb = neighbours(n, x, y)
    for (var i = 0; i < nb.length; ++i) if (!seen[nb[i][1]][nb[i][0]]) d++
    return d
  }
  function walk(x, y) {
    if (steps++ > budget) return false
    seen[y][x] = true; path.push([x, y])
    if (path.length === n * n) return true
    var nb = shuffle(neighbours(n, x, y).filter(function(p) { return !seen[p[1]][p[0]] }), rand)
    nb.sort(function(a, b) { return degree(a[0], a[1]) - degree(b[0], b[1]) })
    for (var i = 0; i < nb.length; ++i) if (walk(nb[i][0], nb[i][1])) return true
    seen[y][x] = false; path.pop()
    return false
  }
  var sx = Math.floor(rnd(rand) * n), sy = Math.floor(rnd(rand) * n)
  return walk(sx, sy) ? path : null
}

function colourCount(n) { return Math.min(9, Math.max(3, n - 1)) }

function generate(n, rand) {
  var k = colourCount(n)
  for (var attempt = 0; attempt < 200; ++attempt) {
    var path = hamiltonian(n, rand, 4000)
    if (!path) continue
    // cut into k pieces of at least three cells
    var total = n * n, minLen = 3
    var lens = []
    for (var i = 0; i < k; ++i) lens.push(minLen)
    var extra = total - minLen * k
    if (extra < 0) continue
    while (extra > 0) { lens[Math.floor(rnd(rand) * k)]++; extra-- }
    var pairs = [], at = 0
    for (var c = 0; c < k; ++c) {
      pairs.push({ a: path[at], b: path[at + lens[c] - 1] })
      at += lens[c]
    }
    return { pairs: shuffle(pairs, rand), solution: path, lens: lens }
  }
  return null
}

// ---- play state ------------------------------------------------------------------

function makeState(n, rand) {
  n = n || 5
  var p = generate(n, rand)
  while (!p) p = generate(n, rand)
  return { size: n, pairs: p.pairs, paths: p.pairs.map(function() { return [] }), cursor: { x: 0, y: 0 },
           active: -1, moves: 0, won: false }
}

function clone(s, patch) {
  var o = { size: s.size, pairs: s.pairs, paths: s.paths, cursor: s.cursor, active: s.active,
            moves: s.moves, won: s.won }
  for (var k in patch) o[k] = patch[k]
  return o
}

// colour of the dot at (x, y), or -1
function dotAt(s, x, y) {
  for (var i = 0; i < s.pairs.length; ++i) {
    var p = s.pairs[i]
    if ((p.a[0] === x && p.a[1] === y) || (p.b[0] === x && p.b[1] === y)) return i
  }
  return -1
}

// owner grid: the colour whose path covers each cell, -1 if none
function owners(s) {
  var o = grid(s.size, -1)
  for (var i = 0; i < s.paths.length; ++i)
    for (var j = 0; j < s.paths[i].length; ++j) o[s.paths[i][j][1]][s.paths[i][j][0]] = i
  return o
}

function connectedPair(s, i) {
  var p = s.paths[i]
  if (p.length < 2) return false
  var first = p[0], last = p[p.length - 1], pr = s.pairs[i]
  function isDot(c) { return (c[0] === pr.a[0] && c[1] === pr.a[1]) || (c[0] === pr.b[0] && c[1] === pr.b[1]) }
  return isDot(first) && isDot(last) && !(first[0] === last[0] && first[1] === last[1])
}

function covered(s) {
  var o = owners(s), n = 0
  for (var y = 0; y < s.size; ++y) for (var x = 0; x < s.size; ++x) if (o[y][x] >= 0) n++
  return n
}

function isSolved(s) {
  for (var i = 0; i < s.pairs.length; ++i) if (!connectedPair(s, i)) return false
  return covered(s) === s.size * s.size
}

function finish(s, patch) {
  var next = clone(s, patch)
  next.won = isSolved(next)
  if (next.won) next.active = -1
  return next
}

// Pick up colour i at (x, y): a dot starts a fresh path, part of a path
// continues from that cell.
function pickUp(s, x, y) {
  if (s.won) return s
  var d = dotAt(s, x, y)
  var paths = s.paths.slice()
  if (d >= 0) {
    paths[d] = [[x, y]]
    return finish(s, { paths: paths, active: d, cursor: { x: x, y: y }, moves: s.moves + 1 })
  }
  var o = owners(s)[y][x]
  if (o >= 0) {
    var idx = -1
    for (var j = 0; j < s.paths[o].length; ++j) if (s.paths[o][j][0] === x && s.paths[o][j][1] === y) idx = j
    paths[o] = s.paths[o].slice(0, idx + 1)
    return finish(s, { paths: paths, active: o, cursor: { x: x, y: y } })
  }
  return clone(s, { cursor: { x: x, y: y } })
}

function drop(s) {
  return s.active < 0 ? s : clone(s, { active: -1 })
}

// Extend (or rewind) the active path onto the neighbouring cell (x, y).
function stepTo(s, x, y) {
  if (s.won || s.active < 0) return s
  var a = s.active, path = s.paths[a]
  if (!path.length) return s
  var head = path[path.length - 1]
  if (Math.abs(head[0] - x) + Math.abs(head[1] - y) !== 1) return s
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return s
  // rewind one step
  if (path.length >= 2 && path[path.length - 2][0] === x && path[path.length - 2][1] === y) {
    var back = s.paths.slice(); back[a] = path.slice(0, -1)
    return finish(s, { paths: back, cursor: { x: x, y: y } })
  }
  // already finished: only rewinding is allowed
  if (connectedPair(s, a)) return s
  var d = dotAt(s, x, y)
  var pr = s.pairs[a]
  var isOwnStart = path[0][0] === x && path[0][1] === y
  if (d >= 0 && d !== a) return s
  if (isOwnStart) return s
  var paths = s.paths.slice()
  var own = -1
  for (var j = 0; j < path.length; ++j) if (path[j][0] === x && path[j][1] === y) own = j
  if (own >= 0) {                 // ran into itself: rewind to there
    paths[a] = path.slice(0, own + 1)
    return finish(s, { paths: paths, cursor: { x: x, y: y } })
  }
  var o = owners(s)[y][x]
  if (o >= 0 && o !== a) paths[o] = s.paths[o].slice(0, s.paths[o].findIndex(function(c) { return c[0] === x && c[1] === y }))
  paths[a] = path.concat([[x, y]])
  var done = d === a          // reached the matching dot
  return finish(s, { paths: paths, cursor: { x: x, y: y }, active: done ? -1 : a, moves: s.moves + 1 })
}

// Keyboard: with a path in hand arrows extend it; otherwise they move the cursor.
function moveCursor(s, dx, dy) {
  var x = Math.max(0, Math.min(s.size - 1, s.cursor.x + dx)), y = Math.max(0, Math.min(s.size - 1, s.cursor.y + dy))
  if (s.active >= 0) return stepTo(s, x, y)
  return clone(s, { cursor: { x: x, y: y } })
}

// Drag towards (x, y): walk along the straighter axis until there or blocked.
function dragTo(s, x, y) {
  if (s.active < 0) return s
  var cur = s
  for (var guard = 0; guard < 40; ++guard) {
    var path = cur.paths[cur.active]
    if (!path.length) break
    var head = path[path.length - 1]
    var dx = x - head[0], dy = y - head[1]
    if (dx === 0 && dy === 0) break
    var sx = 0, sy = 0
    if (Math.abs(dx) >= Math.abs(dy)) sx = dx > 0 ? 1 : -1; else sy = dy > 0 ? 1 : -1
    var next = stepTo(cur, head[0] + sx, head[1] + sy)
    if (next === cur) {
      // try the other axis
      if (sx !== 0 && dy !== 0) next = stepTo(cur, head[0], head[1] + (dy > 0 ? 1 : -1))
      else if (sy !== 0 && dx !== 0) next = stepTo(cur, head[0] + (dx > 0 ? 1 : -1), head[1])
      if (next === cur) break
    }
    cur = next
    if (cur.active < 0) break
  }
  return cur
}

function clearColour(s, i) {
  var paths = s.paths.slice(); paths[i] = []
  return clone(s, { paths: paths, active: s.active === i ? -1 : s.active })
}

function serialize(s) {
  return { size: s.size, pairs: s.pairs, paths: s.paths, cursor: s.cursor, active: s.active, moves: s.moves, won: s.won }
}
function deserialize(o) {
  if (!o || !o.pairs || !o.paths) return null
  return { size: o.size, pairs: o.pairs, paths: o.paths, cursor: o.cursor || { x: 0, y: 0 },
           active: typeof o.active === "number" ? o.active : -1, moves: o.moves || 0, won: !!o.won }
}
