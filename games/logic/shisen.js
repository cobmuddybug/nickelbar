.pragma library
.import "../../engine/Rng.js" as Rng

// Shisen-Sho, after KDE's KShisen. Remove matching pairs of mahjong tiles
// that can be joined by a line with at most two turns, running only
// through empty squares (the line may leave the board and come back round
// the outside). Clear the board.
//
// Deals are random, but only used once a quick randomised play-through has
// cleared them, so there's always a way. Faces use mahjong.js's numbering
// (0-33 here: suits, winds, dragons).

var SIZES = [{ w: 12, h: 6, name: "12×6" }, { w: 14, h: 8, name: "14×8" }, { w: 16, h: 8, name: "16×8" }]

// Path of at most two turns from a to b through empty squares, on the
// board padded with an empty ring. Returns padded points or null.
function path(w, h, grid, a, b) {
  var PW = w + 2, PH = h + 2
  function empty(x, y) {
    if (x < 0 || y < 0 || x >= PW || y >= PH) return false
    if (x === 0 || y === 0 || x === PW - 1 || y === PH - 1) return true
    return grid[(y - 1) * w + (x - 1)] < 0
  }
  var ax = a % w + 1, ay = Math.floor(a / w) + 1, bx = b % w + 1, by = Math.floor(b / w) + 1
  var D = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  // BFS over (x, y, dir) keeping the fewest turns.
  var best = {}, q = []
  for (var d = 0; d < 4; ++d) q.push({ x: ax, y: ay, d: d, t: 0, prev: null })
  while (q.length) {
    var cur = q.shift()
    var nx = cur.x + D[cur.d][0], ny = cur.y + D[cur.d][1]
    if (nx === bx && ny === by) {
      var pts = [{ x: bx, y: by }], p = cur
      while (p) { pts.push({ x: p.x, y: p.y }); p = p.prev }
      return pts.reverse()
    }
    if (!empty(nx, ny)) continue
    for (var d2 = 0; d2 < 4; ++d2) {
      var t = cur.t + (d2 === cur.d ? 0 : 1)
      if (t > 2) continue
      var k = nx + "," + ny + "," + d2
      if (best[k] !== undefined && best[k] <= t) continue
      best[k] = t
      var node = { x: nx, y: ny, d: d2, t: t, prev: cur }
      if (d2 === cur.d) q.unshift(node); else q.push(node)
    }
  }
  return null
}

// Everything reachable from square a by a line of at most two turns:
// `open` holds the empty squares it can run through (board indices), `hit`
// the tiles it can end on. One 0-1 BFS over (square, direction) on the
// padded board.
function reach(w, h, grid, a) {
  var PW = w + 2, PH = h + 2, M = PW * PH
  var turns = new Array(M * 4)
  for (var i = 0; i < M * 4; ++i) turns[i] = 9
  var D = [1, -1, PW, -PW]
  function board(pp) {
    var x = pp % PW, y = Math.floor(pp / PW)
    if (x === 0 || y === 0 || x === PW - 1 || y === PH - 1) return -1
    return (y - 1) * w + (x - 1)
  }
  var start = (Math.floor(a / w) + 1) * PW + (a % w + 1)
  var dq = [], head = 0, open = {}, hit = {}
  for (var d = 0; d < 4; ++d) { turns[start * 4 + d] = 0; dq.push(start * 4 + d) }
  while (head < dq.length) {
    var node = dq[head++], pp = Math.floor(node / 4), dir = node % 4, t = turns[node]
    var np = pp + D[dir], nx = np % PW, ny = Math.floor(np / PW)
    if (np < 0 || np >= M || (dir < 2 && ny !== Math.floor(pp / PW))) continue
    var bi = board(np)
    if (bi >= 0 && grid[bi] >= 0) { if (bi !== a) hit[bi] = true; continue }
    if (bi >= 0) open[bi] = true
    for (var d2 = 0; d2 < 4; ++d2) {
      var nt = t + (d2 === dir ? 0 : 1)
      if (nt > 2 || turns[np * 4 + d2] <= nt) continue
      turns[np * 4 + d2] = nt
      dq.push(np * 4 + d2)
    }
  }
  return { open: open, hit: hit }
}

// Every pair that could be taken right now, as [a, b].
function pairs(w, h, grid) {
  var out = []
  for (var a = 0; a < grid.length; ++a) {
    if (grid[a] < 0) continue
    var hit = reach(w, h, grid, a).hit
    for (var b in hit) if (+b > a && grid[+b] === grid[a]) out.push([a, +b])
  }
  return out
}

// Can this grid be cleared? A few randomised greedy run-throughs; any that
// clears it proves it can be.
function clearable(w, h, grid) {
  for (var run = 0; run < 25; ++run) {
    var g = grid.slice(), left = 0
    for (var i = 0; i < g.length; ++i) if (g[i] >= 0) left++
    while (left) {
      var ps = pairs(w, h, g)
      if (!ps.length) break
      var p = ps[Math.floor(Rng.random() * ps.length)]
      g[p[0]] = -1; g[p[1]] = -1
      left -= 2
    }
    if (!left) return true
  }
  return false
}

function randomGrid(w, h) {
  var N = w * h, pool = [], faces = []
  for (var f = 0; f < 34; ++f) pool.push(f)
  for (var s = pool.length - 1; s > 0; --s) { var r = Math.floor(Rng.random() * (s + 1)); var t = pool[s]; pool[s] = pool[r]; pool[r] = t }
  for (var k = 0; k < N / 4; ++k) faces.push(pool[k], pool[k], pool[k], pool[k])
  for (var s2 = faces.length - 1; s2 > 0; --s2) { var r2 = Math.floor(Rng.random() * (s2 + 1)); var t2 = faces[s2]; faces[s2] = faces[r2]; faces[r2] = t2 }
  return faces
}

// Random deals until one is shown to be clearable.
function deal(w, h) {
  for (var attempt = 0; attempt < 40; ++attempt) {
    var g = randomGrid(w, h)
    if (clearable(w, h, g)) return g
  }
  return randomGrid(w, h)
}

function makeState(size, cleared) {
  var sz = SIZES[size]
  return { size: size, w: sz.w, h: sz.h, grid: deal(sz.w, sz.h), cursor: { x: 0, y: 0 }, sel: -1, flash: null,
           history: [], shuffles: 0, hints: 0, time: 0, done: false, cleared: cleared || 0, note: "" }
}

function copy(s) {
  return { size: s.size, w: s.w, h: s.h, grid: s.grid, cursor: s.cursor, sel: s.sel, flash: null, history: s.history,
           shuffles: s.shuffles, hints: s.hints, time: s.time, done: s.done, cleared: s.cleared, note: "" }
}

function left(s) { var n = 0; for (var i = 0; i < s.grid.length; ++i) if (s.grid[i] >= 0) n++; return n }

function findPair(s) {
  var ps = pairs(s.w, s.h, s.grid)
  return ps.length ? ps[0] : null
}

function activate(s) {
  if (s.done) return s
  var at = s.cursor.y * s.w + s.cursor.x, n = copy(s)
  if (s.grid[at] < 0) { n.sel = -1; return n }
  if (s.sel < 0 || s.sel === at) { n.sel = s.sel === at ? -1 : at; return n }
  if (s.grid[s.sel] !== s.grid[at]) { n.sel = at; return n }
  var p = path(s.w, s.h, s.grid, s.sel, at)
  if (!p) { n.note = "can't join those (two turns at most)"; n.sel = s.sel; return n }
  n.history = s.history.concat([s.grid]).slice(-200)
  n.grid = s.grid.slice()
  n.grid[s.sel] = -1; n.grid[at] = -1
  n.sel = -1
  n.flash = p
  if (!left(n)) { n.done = true; n.cleared = s.cleared + 1 }
  else if (!findPair(n)) n.note = "no moves left: X to shuffle"
  return n
}

// Shuffle what's left (a penalty), keeping tiles on the squares they're on.
function shuffle(s) {
  if (s.done) return s
  var n = copy(s), cells = [], faces = []
  for (var i = 0; i < s.grid.length; ++i) if (s.grid[i] >= 0) { cells.push(i); faces.push(s.grid[i]) }
  n.history = s.history.concat([s.grid]).slice(-200)
  for (var guard = 0; guard < 50; ++guard) {
    for (var k = faces.length - 1; k > 0; --k) { var r = Math.floor(Rng.random() * (k + 1)); var t = faces[k]; faces[k] = faces[r]; faces[r] = t }
    n.grid = s.grid.slice()
    for (var c = 0; c < cells.length; ++c) n.grid[cells[c]] = faces[c]
    if (findPair(n)) break
  }
  n.shuffles = s.shuffles + 1
  n.sel = -1
  return n
}

function hint(s) {
  var p = findPair(s), n = copy(s)
  if (!p) { n.note = "no moves left: X to shuffle"; return n }
  n.flash = path(s.w, s.h, s.grid, p[0], p[1])
  n.hints = s.hints + 1
  return n
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.sel = s.sel
  n.cursor = { x: (s.cursor.x + dx + s.w) % s.w, y: (s.cursor.y + dy + s.h) % s.h }
  return n
}

function undo(s) {
  if (!s.history.length || s.done) return s
  var n = copy(s)
  n.grid = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  n.sel = -1
  return n
}

function tick(s, dt) { if (s.done) return s; var n = copy(s); n.sel = s.sel; n.time = s.time + dt; return n }

function serialize(s) { return { size: s.size, grid: s.grid, shuffles: s.shuffles, hints: s.hints, time: s.time, cleared: s.cleared, done: s.done } }

function deserialize(o) {
  if (!o || !o.grid || !SIZES[o.size] || o.grid.length !== SIZES[o.size].w * SIZES[o.size].h || o.done) return null
  var s = makeState(o.size, o.cleared)
  s.grid = o.grid; s.shuffles = o.shuffles || 0; s.hints = o.hints || 0; s.time = o.time || 0
  return s
}
