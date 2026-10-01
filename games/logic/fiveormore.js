.pragma library
.import "../../engine/Rng.js" as Rng

// Five or More, after GNOME Five or More (and Color Lines). Move a ball to
// any empty square it can reach by a clear path (no diagonals). Lining up
// five or more of a colour, in any direction, clears them and earns
// another move; otherwise three more balls arrive. The board filling up
// ends it. Scores follow GNOME's: 10, 12, 18, 28, 42, 82, 108, 138, 172,
// 210 for lines of 5..14.

var N = 9
var COLORS = 7
var POINTS = [0, 0, 0, 0, 0, 10, 12, 18, 28, 42, 82, 108, 138, 172, 210]

function emptyCells(g) {
  var out = []
  for (var i = 0; i < N * N; ++i) if (g[i] < 0) out.push(i)
  return out
}

function nextColors() {
  return [Math.floor(Rng.random() * COLORS), Math.floor(Rng.random() * COLORS), Math.floor(Rng.random() * COLORS)]
}

function makeState() {
  var g = []
  for (var i = 0; i < N * N; ++i) g.push(-1)
  var s = { grid: g, next: nextColors(), cursor: { x: 4, y: 4 }, sel: -1, score: 0, over: false, note: "", flash: [] }
  return drop(s)
}

function copy(s) {
  return { grid: s.grid, next: s.next, cursor: s.cursor, sel: s.sel, score: s.score, over: s.over, note: "", flash: [] }
}

// Cells in runs of 5+ through any ball, and the points for them.
function lines(g) {
  var gone = {}, pts = 0, dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (var y = 0; y < N; ++y)
    for (var x = 0; x < N; ++x) {
      var c = g[y * N + x]
      if (c < 0) continue
      for (var d = 0; d < 4; ++d) {
        var dx = dirs[d][0], dy = dirs[d][1]
        var px = x - dx, py = y - dy
        if (px >= 0 && py >= 0 && px < N && py < N && g[py * N + px] === c) continue   // not the start of the run
        var run = [], cx = x, cy = y
        while (cx >= 0 && cy >= 0 && cx < N && cy < N && g[cy * N + cx] === c) { run.push(cy * N + cx); cx += dx; cy += dy }
        if (run.length >= 5) { pts += POINTS[Math.min(run.length, 14)]; for (var r = 0; r < run.length; ++r) gone[run[r]] = true }
      }
    }
  return { cells: Object.keys(gone).map(Number), points: pts }
}

function clearLines(s) {
  var l = lines(s.grid)
  if (!l.cells.length) return false
  s.grid = s.grid.slice()
  for (var i = 0; i < l.cells.length; ++i) s.grid[l.cells[i]] = -1
  s.score += l.points
  s.flash = l.cells
  return true
}

// Three new balls (the ones previewed), then fresh previews.
function drop(s) {
  var g = s.grid.slice()
  for (var k = 0; k < s.next.length; ++k) {
    var e = emptyCells(g)
    if (!e.length) break
    g[e[Math.floor(Rng.random() * e.length)]] = s.next[k]
  }
  s.grid = g
  s.next = nextColors()
  clearLines(s)
  if (!emptyCells(s.grid).length) s.over = true
  return s
}

function reachable(g, from, to) {
  var seen = {}, q = [from]
  seen[from] = true
  while (q.length) {
    var c = q.shift()
    if (c === to) return true
    var x = c % N, y = Math.floor(c / N), nb = []
    if (x > 0) nb.push(c - 1); if (x < N - 1) nb.push(c + 1); if (y > 0) nb.push(c - N); if (y < N - 1) nb.push(c + N)
    for (var i = 0; i < nb.length; ++i) if (!seen[nb[i]] && g[nb[i]] < 0) { seen[nb[i]] = true; q.push(nb[i]) }
  }
  return false
}

function activate(s) {
  if (s.over) return s
  var at = s.cursor.y * N + s.cursor.x, n = copy(s)
  if (s.grid[at] >= 0) { n.sel = s.sel === at ? -1 : at; return n }
  if (s.sel < 0) { n.note = "pick a ball first"; return n }
  if (!reachable(s.grid, s.sel, at)) { n.note = "no way through"; return n }
  n.grid = s.grid.slice()
  n.grid[at] = s.grid[s.sel]
  n.grid[s.sel] = -1
  n.sel = -1
  if (!clearLines(n)) drop(n)
  return n
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.sel = s.sel
  n.cursor = { x: (s.cursor.x + dx + N) % N, y: (s.cursor.y + dy + N) % N }
  return n
}

function serialize(s) { return { grid: s.grid, next: s.next, score: s.score, over: s.over } }

function deserialize(o) {
  if (!o || !o.grid || o.grid.length !== N * N || o.over) return null
  return { grid: o.grid, next: o.next || nextColors(), cursor: { x: 4, y: 4 }, sel: -1, score: o.score || 0, over: false, note: "", flash: [] }
}
