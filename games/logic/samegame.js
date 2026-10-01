.pragma library
.import "../../engine/Rng.js" as Rng

// Same Game, after Simon Tatham's (and KDE's KSame / GNOME's Swell Foop).
// Pick a group of two or more touching tiles of one colour to clear it;
// tiles above drop, and empty columns close up to the left. A group of n
// scores (n - 2)^2, so big groups pay. Clearing the board is a bonus.
//
// grid[x][y]: columns bottom-up, -1 empty.

var SIZES = [{ w: 8, h: 6, colors: 3, name: "8×6" }, { w: 12, h: 8, colors: 4, name: "12×8" },
             { w: 16, h: 10, colors: 5, name: "16×10" }]

function makeState(size) {
  var sz = SIZES[size], grid = []
  for (var x = 0; x < sz.w; ++x) {
    var col = []
    for (var y = 0; y < sz.h; ++y) col.push(Math.floor(Rng.random() * sz.colors))
    grid.push(col)
  }
  return { size: size, w: sz.w, h: sz.h, grid: grid, cursor: { x: 0, y: 0 }, score: 0, history: [], last: 0, done: false }
}

function copy(s) {
  return { size: s.size, w: s.w, h: s.h, grid: s.grid, cursor: s.cursor, score: s.score, history: s.history, last: s.last, done: s.done }
}

function at(s, x, y) { return x >= 0 && y >= 0 && x < s.w && y < s.h ? s.grid[x][y] : -1 }

function group(s, x, y) {
  var c = at(s, x, y)
  if (c < 0) return []
  var out = [], seen = {}, st = [[x, y]]
  seen[x + "," + y] = true
  while (st.length) {
    var p = st.pop()
    out.push(p)
    var nb = [[p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]]
    for (var i = 0; i < 4; ++i) {
      var k = nb[i][0] + "," + nb[i][1]
      if (seen[k] || at(s, nb[i][0], nb[i][1]) !== c) continue
      seen[k] = true
      st.push(nb[i])
    }
  }
  return out
}

function anyMoves(s) {
  for (var x = 0; x < s.w; ++x)
    for (var y = 0; y < s.h; ++y) {
      var c = s.grid[x][y]
      if (c < 0) continue
      if (at(s, x + 1, y) === c || at(s, x, y + 1) === c) return true
    }
  return false
}

function cleared(s) { return s.grid.length === 0 || s.grid[0][0] < 0 }

// Screen y is top-down; the grid is bottom-up.
function cellAt(s, cx, cy) { return [cx, s.h - 1 - cy] }

function pick(s) {
  if (s.done) return s
  var p = cellAt(s, s.cursor.x, s.cursor.y), g = group(s, p[0], p[1])
  if (g.length < 2) return s
  var gone = {}
  for (var i = 0; i < g.length; ++i) gone[g[i][0] + "," + g[i][1]] = true
  var cols = []
  for (var x = 0; x < s.w; ++x) {
    var col = []
    for (var y = 0; y < s.h; ++y) if (s.grid[x][y] >= 0 && !gone[x + "," + y]) col.push(s.grid[x][y])
    if (col.length) { while (col.length < s.h) col.push(-1); cols.push(col) }
  }
  var empty = []
  for (var e = 0; e < s.h; ++e) empty.push(-1)
  while (cols.length < s.w) cols.push(empty.slice())
  var n = copy(s)
  n.history = s.history.concat([{ grid: s.grid, score: s.score }]).slice(-100)
  n.grid = cols
  n.last = (g.length - 2) * (g.length - 2)
  n.score = s.score + n.last
  if (cleared(n)) { n.score += 1000; n.done = true }
  else if (!anyMoves(n)) n.done = true
  return n
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.cursor = { x: (s.cursor.x + dx + s.w) % s.w, y: (s.cursor.y + dy + s.h) % s.h }
  return n
}

function undo(s) {
  if (!s.history.length) return s
  var n = copy(s), h = s.history[s.history.length - 1]
  n.grid = h.grid; n.score = h.score; n.history = s.history.slice(0, -1); n.done = false; n.last = 0
  return n
}

function tilesLeft(s) {
  var k = 0
  for (var x = 0; x < s.w; ++x) for (var y = 0; y < s.h; ++y) if (s.grid[x][y] >= 0) k++
  return k
}

function serialize(s) { return { size: s.size, grid: s.grid, score: s.score, done: s.done } }

function deserialize(o) {
  if (!o || !o.grid || !SIZES[o.size] || o.grid.length !== SIZES[o.size].w || o.done) return null
  var s = makeState(o.size)
  s.grid = o.grid; s.score = o.score || 0
  return s
}
