.pragma library
.import "../../engine/Rng.js" as Rng

// Bridges (Hashiwokakero). Islands carry a number; join them with straight
// horizontal or vertical bridges, one or two between any pair, so every
// island has exactly its number of bridges, no bridges cross, and all the
// islands end up connected.
//
// Puzzles are grown from a solution: islands are placed one at a time off
// the side of an existing island, joined by a bridge that doesn't cross
// anything already there, and a few extra links close loops. The numbers
// come from that layout, so there's always an answer. Layouts are kept
// only if a deduction solver (see solvesByDeduction) pins down every
// bridge, so the answer is unique and never needs a guess. Any arrangement
// that meets the rules counts all the same.
//
// Keyboard: arrows hop between islands. SPACE "grabs" the island you're
// on; while grabbed, an arrow cycles the bridge that way (none, one, two).
// SPACE again lets go.

var SIZES = [7, 9, 11, 13]

function key(a, b) { return a < b ? a + "-" + b : b + "-" + a }

// Island lookup: grid cell -> island index.
function cellMap(islands) {
  var m = {}
  for (var i = 0; i < islands.length; ++i) m[islands[i].x + "," + islands[i].y] = i
  return m
}

// The first island from `i` going (dx, dy), and the empty cells between.
function neighbour(islands, map, n, i, dx, dy) {
  var x = islands[i].x + dx, y = islands[i].y + dy
  var path = []
  while (x >= 0 && y >= 0 && x < n && y < n) {
    var j = map[x + "," + y]
    if (j !== undefined) return { j: j, path: path }
    path.push({ x: x, y: y })
    x += dx; y += dy
  }
  return null
}

// Would a bridge a-b cross any bridge in `links` (key -> count)?
function crosses(islands, links, a, b) {
  var A = islands[a], B = islands[b]
  for (var k in links) {
    if (!links[k]) continue
    var ends = k.split("-")
    var C = islands[+ends[0]], D = islands[+ends[1]]
    if (+ends[0] === a || +ends[0] === b || +ends[1] === a || +ends[1] === b) continue
    var h1 = A.y === B.y, h2 = C.y === D.y
    if (h1 === h2) continue
    var H = h1 ? [A, B] : [C, D], V = h1 ? [C, D] : [A, B]
    var hx0 = Math.min(H[0].x, H[1].x), hx1 = Math.max(H[0].x, H[1].x), hy = H[0].y
    var vy0 = Math.min(V[0].y, V[1].y), vy1 = Math.max(V[0].y, V[1].y), vx = V[0].x
    if (vx > hx0 && vx < hx1 && hy > vy0 && hy < vy1) return true
  }
  return false
}

// Cells a bridge a-b runs through (excluding the islands).
function span(islands, a, b) {
  var A = islands[a], B = islands[b], out = []
  var dx = Math.sign(B.x - A.x), dy = Math.sign(B.y - A.y)
  for (var x = A.x + dx, y = A.y + dy; x !== B.x || y !== B.y; x += dx, y += dy) out.push({ x: x, y: y })
  return out
}

function generate(n) {
  var target = Math.round(n * n * 0.22)
  for (var attempt = 0; attempt < 60; ++attempt) {
    var islands = [{ x: Math.floor(Rng.random() * n), y: Math.floor(Rng.random() * n) }]
    var links = {}
    var used = {}   // cells covered by a bridge
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    var tries = 0
    while (islands.length < target && tries++ < 4000) {
      var from = Math.floor(Rng.random() * islands.length)
      var d = dirs[Math.floor(Rng.random() * 4)]
      var dist = 2 + Math.floor(Rng.random() * Math.max(1, Math.floor(n / 2)))
      var nx = islands[from].x + d[0] * dist, ny = islands[from].y + d[1] * dist
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
      if (used[nx + "," + ny]) continue
      var map = cellMap(islands)
      if (map[nx + "," + ny] !== undefined) continue
      // No island right next to another, and a clear run to it.
      var crowded = false
      for (var q = 0; q < 4 && !crowded; ++q)
        if (map[(nx + dirs[q][0]) + "," + (ny + dirs[q][1])] !== undefined) crowded = true
      if (crowded) continue
      var blocked = false
      for (var s = 1; s < dist && !blocked; ++s) {
        var cx = islands[from].x + d[0] * s, cy = islands[from].y + d[1] * s
        if (map[cx + "," + cy] !== undefined || used[cx + "," + cy]) blocked = true
      }
      if (blocked) continue
      islands.push({ x: nx, y: ny })
      var idx = islands.length - 1
      links[key(from, idx)] = Rng.random() < 0.4 ? 2 : 1
      var cells = span(islands, from, idx)
      for (var c = 0; c < cells.length; ++c) used[cells[c].x + "," + cells[c].y] = true
    }
    if (islands.length < target * 0.8) continue
    // Close a few loops where a clear, uncrossed line already exists.
    var m2 = cellMap(islands)
    for (var i = 0; i < islands.length; ++i) {
      var nb = [neighbour(islands, m2, n, i, 1, 0), neighbour(islands, m2, n, i, 0, 1)]
      for (var t = 0; t < 2; ++t) {
        if (!nb[t]) continue
        var j = nb[t].j, k = key(i, j)
        if (links[k] || Rng.random() > 0.3) continue
        var clear = true
        for (var p = 0; p < nb[t].path.length; ++p) if (used[nb[t].path[p].x + "," + nb[t].path[p].y]) clear = false
        if (!clear || crosses(islands, links, i, j)) continue
        links[k] = Rng.random() < 0.3 ? 2 : 1
        for (var p2 = 0; p2 < nb[t].path.length; ++p2) used[nb[t].path[p2].x + "," + nb[t].path[p2].y] = true
      }
    }
    var need = islands.map(function() { return 0 })
    for (var lk in links) {
      var e = lk.split("-")
      need[+e[0]] += links[lk]; need[+e[1]] += links[lk]
    }
    for (var z = 0; z < islands.length; ++z) islands[z].need = need[z]
    return islands
  }
  return null
}

// ---- deduction ---------------------------------------------------------------

// Solves like a person, no guessing. Each possible bridge (a pair of
// islands that face each other) carries a range [lo, hi] of 0..2, narrowed
// by three rules until nothing changes:
//   - an island's number: a pair must carry at least what the island
//     can't place elsewhere, and at most what it has left over
//   - crossing: a bridge that must exist rules out the ones it crosses
//   - no closed groups: a bridge can't be used if it would finish a group
//     of islands that can't reach the rest
// True if every range closes up — the answer is then unique.
function solvesByDeduction(islands, n) {
  var map = cellMap(islands), edges = [], at = islands.map(function() { return [] })
  for (var i = 0; i < islands.length; ++i) {
    var nb = [neighbour(islands, map, n, i, 1, 0), neighbour(islands, map, n, i, 0, 1)]
    for (var t = 0; t < 2; ++t) {
      if (!nb[t]) continue
      var e = { a: i, b: nb[t].j, lo: 0, hi: 2, cross: [] }
      at[i].push(edges.length); at[nb[t].j].push(edges.length)
      edges.push(e)
    }
  }
  for (var x = 0; x < edges.length; ++x)
    for (var y = x + 1; y < edges.length; ++y) {
      var one = {}; one[key(edges[y].a, edges[y].b)] = 1
      if (crosses(islands, one, edges[x].a, edges[x].b)) { edges[x].cross.push(y); edges[y].cross.push(x) }
    }

  // Would fixing edge k at v close off a finished group short of everyone?
  // Other pairs count at their minimum: if that already meets every
  // number in the group, nothing more can leave it.
  function isolates(k, v) {
    var seen = {}, stack = [edges[k].a], size = 0
    seen[edges[k].a] = true
    while (stack.length) {
      var i = stack.pop(), deg = 0
      size++
      for (var q = 0; q < at[i].length; ++q) {
        var e = edges[at[i][q]], w = at[i][q] === k ? v : e.lo
        deg += w
        var j = e.a === i ? e.b : e.a
        if (w && !seen[j]) { seen[j] = true; stack.push(j) }
      }
      if (deg !== islands[i].need) return false
    }
    return size < islands.length
  }

  var changed = true
  while (changed) {
    changed = false
    for (i = 0; i < islands.length; ++i) {
      var sumLo = 0, sumHi = 0
      for (var q = 0; q < at[i].length; ++q) { sumLo += edges[at[i][q]].lo; sumHi += edges[at[i][q]].hi }
      if (sumLo > islands[i].need || sumHi < islands[i].need) return false
      for (q = 0; q < at[i].length; ++q) {
        e = edges[at[i][q]]
        var lo = Math.max(e.lo, islands[i].need - (sumHi - e.hi)), hi = Math.min(e.hi, islands[i].need - (sumLo - e.lo))
        if (lo !== e.lo || hi !== e.hi) {
          sumLo += lo - e.lo; sumHi += hi - e.hi
          e.lo = lo; e.hi = hi; changed = true
        }
      }
    }
    for (x = 0; x < edges.length; ++x) {
      e = edges[x]
      if (e.lo > e.hi) return false
      if (e.lo > 0) for (q = 0; q < e.cross.length; ++q) {
        var c = edges[e.cross[q]]
        if (c.hi) { if (c.lo) return false; c.hi = 0; changed = true }
      }
      while (e.hi > e.lo && isolates(x, e.hi)) { e.hi--; changed = true }
    }
  }
  for (x = 0; x < edges.length; ++x) if (edges[x].lo !== edges[x].hi) return false
  return true
}

function makeState(n, count) {
  var islands = null
  for (var tries = 0; tries < 200 && !islands; ++tries) {
    islands = generate(n)
    if (islands && !solvesByDeduction(islands, n)) islands = null
  }
  if (!islands) islands = generate(n)
  // Start on the island nearest the top-left.
  var start = 0
  for (var i = 1; i < islands.length; ++i)
    if (islands[i].y * n + islands[i].x < islands[start].y * n + islands[start].x) start = i
  return { n: n, islands: islands, links: {}, cursor: start, grabbed: false, history: [], moves: 0,
    count: count || 0, solved: false, note: "" }
}

function copy(s) {
  return { n: s.n, islands: s.islands, links: s.links, cursor: s.cursor, grabbed: s.grabbed,
    history: s.history, moves: s.moves, count: s.count, solved: s.solved, note: "" }
}

function degree(s, i) {
  var d = 0
  for (var k in s.links) {
    if (!s.links[k]) continue
    var e = k.split("-")
    if (+e[0] === i || +e[1] === i) d += s.links[k]
  }
  return d
}

function connected(s) {
  var adj = s.islands.map(function() { return [] })
  for (var k in s.links) {
    if (!s.links[k]) continue
    var e = k.split("-")
    adj[+e[0]].push(+e[1]); adj[+e[1]].push(+e[0])
  }
  var seen = {}, stack = [0], n = 0
  seen[0] = true
  while (stack.length) {
    var i = stack.pop(); n++
    for (var j = 0; j < adj[i].length; ++j) if (!seen[adj[i][j]]) { seen[adj[i][j]] = true; stack.push(adj[i][j]) }
  }
  return n === s.islands.length
}

function isSolved(s) {
  for (var i = 0; i < s.islands.length; ++i) if (degree(s, i) !== s.islands[i].need) return false
  return connected(s)
}

function doneCount(s) {
  var n = 0
  for (var i = 0; i < s.islands.length; ++i) if (degree(s, i) === s.islands[i].need) n++
  return n
}

// Arrow without grabbing: the next island that way, or failing that the
// nearest one roughly in that direction.
function moveCursor(state, dx, dy) {
  if (state.grabbed) return build(state, dx, dy)
  var map = cellMap(state.islands)
  var nb = neighbour(state.islands, map, state.n, state.cursor, dx, dy)
  var target = nb ? nb.j : -1
  if (target < 0) {
    var cur = state.islands[state.cursor], best = 1e9
    for (var i = 0; i < state.islands.length; ++i) {
      var t = state.islands[i]
      var along = dx ? (t.x - cur.x) * dx : (t.y - cur.y) * dy
      if (along <= 0) continue
      var sc = along + (dx ? Math.abs(t.y - cur.y) : Math.abs(t.x - cur.x)) * 2
      if (sc < best) { best = sc; target = i }
    }
  }
  if (target < 0) return state
  var s = copy(state)
  s.cursor = target
  return s
}

// Cycle the bridge from the cursor island in direction (dx, dy).
function build(state, dx, dy) {
  var map = cellMap(state.islands)
  var nb = neighbour(state.islands, map, state.n, state.cursor, dx, dy)
  if (!nb) { var n0 = copy(state); n0.note = "no island that way"; return n0 }
  var k = key(state.cursor, nb.j)
  var cur = state.links[k] || 0
  var next = (cur + 1) % 3
  if (next > 0 && cur === 0 && crosses(state.islands, state.links, state.cursor, nb.j)) {
    var n1 = copy(state); n1.note = "would cross a bridge"; return n1
  }
  var s = copy(state)
  var links = {}
  for (var q in state.links) if (state.links[q]) links[q] = state.links[q]
  if (next) links[k] = next; else delete links[k]
  s.links = links
  s.history = state.history.concat([state.links])
  s.moves = state.moves + 1
  if (isSolved(s)) { s.solved = true; s.count = state.count + 1; s.grabbed = false }
  return s
}

// Put the cursor on island i (for the mouse).
function moveTo(state, i) {
  if (i === state.cursor) return state
  var s = copy(state)
  s.cursor = i
  return s
}

function activate(state) {
  var s = copy(state)
  s.grabbed = !state.grabbed
  return s
}

function undo(state) {
  if (!state.history.length || state.solved) return state
  var s = copy(state)
  s.links = state.history[state.history.length - 1]
  s.history = state.history.slice(0, -1)
  return s
}

// Clear every bridge on the current island.
function clearIsland(state) {
  var s = copy(state), links = {}, changed = false
  for (var k in state.links) {
    var e = k.split("-")
    if (+e[0] === state.cursor || +e[1] === state.cursor) { changed = true; continue }
    links[k] = state.links[k]
  }
  if (!changed) return state
  s.links = links
  s.history = state.history.concat([state.links])
  s.moves = state.moves + 1
  return s
}

function serialize(s) {
  return { n: s.n, islands: s.islands, links: s.links, moves: s.moves, count: s.count, solved: s.solved }
}

function deserialize(o) {
  if (!o || !o.islands || !o.islands.length || !o.n) return null
  return { n: o.n, islands: o.islands, links: o.links || {}, cursor: 0, grabbed: false, history: [],
    moves: o.moves || 0, count: o.count || 0, solved: !!o.solved, note: "" }
}
