.pragma library
.import "../../engine/Rng.js" as Rng

// Inertia, after Simon Tatham's. The ball slides in any of eight
// directions until a wall or the edge stops it, or it lands on a stop
// square (the circles). It picks up gems it passes over and dies on a
// mine. Collect every gem. Undo works even after dying.
//
// Boards are generated so every gem is on a safe slide from somewhere the
// ball can get to, and from everywhere it can get to it can get back, so
// there's no dead end to be trapped in.
// Cells: "#" wall, "s" stop, "m" mine, "g" gem, "." blank.

var DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
var W = 10
var H = 8

// Where a slide from p in direction d ends, and what it passes.
function slide(cells, p, d) {
  var x = p % W, y = Math.floor(p / W), path = []
  for (;;) {
    var nx = x + DIRS[d][0], ny = y + DIRS[d][1]
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || cells[ny * W + nx] === "#") break
    x = nx; y = ny
    var i = y * W + x
    path.push(i)
    if (cells[i] === "m") return { end: i, path: path, dead: true }
    if (cells[i] === "s") break
  }
  return { end: y * W + x, path: path, dead: false }
}

function generate() {
  for (var attempt = 0; attempt < 400; ++attempt) {
    var cells = []
    for (var i = 0; i < W * H; ++i) {
      var r = Rng.random()
      cells.push(r < 0.08 ? "#" : r < 0.24 ? "s" : r < 0.34 ? "m" : r < 0.5 ? "g" : ".")
    }
    var start = Math.floor(Rng.random() * W * H)
    cells[start] = "s"
    // Positions reachable from the start, and the reverse edges.
    var seen = {}, order = [start], back = {}
    seen[start] = true
    for (var k = 0; k < order.length; ++k)
      for (var d = 0; d < 8; ++d) {
        var sl = slide(cells, order[k], d)
        if (sl.dead || sl.end === order[k]) continue
        ;(back[sl.end] = back[sl.end] || []).push(order[k])
        if (!seen[sl.end]) { seen[sl.end] = true; order.push(sl.end) }
      }
    // Everything reachable must lead back to the start.
    var home = {}, st = [start]
    home[start] = true
    while (st.length) {
      var q = st.pop(), prev = back[q] || []
      for (var b = 0; b < prev.length; ++b) if (!home[prev[b]]) { home[prev[b]] = true; st.push(prev[b]) }
    }
    if (order.some(function(p) { return !home[p] })) continue
    // Gems nobody can safely slide over become blanks.
    var safe = {}
    for (var m = 0; m < order.length; ++m)
      for (var d2 = 0; d2 < 8; ++d2) {
        var s2 = slide(cells, order[m], d2)
        if (!s2.dead) for (var t = 0; t < s2.path.length; ++t) safe[s2.path[t]] = true
      }
    var gems = 0
    for (var c = 0; c < cells.length; ++c) {
      if (cells[c] !== "g") continue
      if (safe[c]) gems++
      else cells[c] = "."
    }
    if (gems < 8 || order.length < 12) continue
    return { cells: cells.join(""), start: start }
  }
  return null
}

function makeState(solved) {
  var b = generate()
  var gems = {}
  for (var i = 0; i < b.cells.length; ++i) if (b.cells[i] === "g") gems[i] = true
  return { board: b.cells, pos: b.start, gems: gems, left: Object.keys(gems).length, dead: false, moves: 0,
           deaths: 0, history: [], won: false, solved: solved || 0, trail: [] }
}

function copy(s) {
  return { board: s.board, pos: s.pos, gems: s.gems, left: s.left, dead: s.dead, moves: s.moves, deaths: s.deaths,
           history: s.history, won: s.won, solved: s.solved, trail: s.trail }
}

// Cell as it is now (gems vanish once taken).
function cellAt(s, i) { var c = s.board[i]; return c === "g" && !s.gems[i] ? "." : c }

function move(s, d) {
  if (s.dead || s.won) return s
  var sl = slide(s.board, s.pos, d)
  if (sl.end === s.pos) return s
  var n = copy(s)
  n.history = s.history.concat([{ pos: s.pos, gems: s.gems, left: s.left }]).slice(-300)
  var gems = s.gems, left = s.left
  for (var i = 0; i < sl.path.length; ++i) {
    if (!gems[sl.path[i]]) continue
    if (gems === s.gems) { gems = {}; for (var k in s.gems) gems[k] = true }
    delete gems[sl.path[i]]
    left--
  }
  n.gems = gems; n.left = left
  n.pos = sl.end
  n.trail = [s.pos].concat(sl.path)
  n.moves = s.moves + 1
  if (sl.dead) { n.dead = true; n.deaths = s.deaths + 1 }
  else if (left === 0) { n.won = true; n.solved = s.solved + 1 }
  return n
}

function undo(s) {
  if (!s.history.length || s.won) return s
  var n = copy(s), h = s.history[s.history.length - 1]
  n.pos = h.pos; n.gems = h.gems; n.left = h.left; n.dead = false
  n.history = s.history.slice(0, -1)
  n.trail = []
  return n
}

function serialize(s) {
  return { board: s.board, pos: s.pos, gems: Object.keys(s.gems).map(Number), moves: s.moves, deaths: s.deaths,
           solved: s.solved, won: s.won, dead: s.dead }
}

function deserialize(o) {
  if (!o || typeof o.board !== "string" || o.board.length !== W * H || o.won) return o && o.won ? { solvedOnly: o.solved } : null
  var gems = {}
  for (var i = 0; i < (o.gems || []).length; ++i) gems[o.gems[i]] = true
  return { board: o.board, pos: o.pos, gems: gems, left: Object.keys(gems).length, dead: !!o.dead, moves: o.moves || 0,
           deaths: o.deaths || 0, history: [], won: false, solved: o.solved || 0, trail: [] }
}
