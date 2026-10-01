.pragma library
.import "../../engine/Rng.js" as Rng

// Tetravex, after GNOME Tetravex. Square tiles carry a digit on each edge;
// move them from the right-hand pile onto the left-hand board so every
// pair of touching edges shows the same digit. The puzzle is cut from a
// solved board, then shuffled onto the pile.
//
// A tile is [top, right, bottom, left]. slots: 2 * n * n positions, the
// board first (row by row), then the pile; each holds a tile index or -1.

var SIZES = [2, 3, 4, 5]

function makeState(n, solved) {
  var hor = [], ver = [], tiles = []
  for (var y = 0; y < n; ++y)
    for (var x = 0; x < n; ++x) {
      var top = y === 0 ? rnd() : ver[(y - 1) * n + x]
      var left = x === 0 ? rnd() : hor[y * n + x - 1]
      var right = rnd(), bottom = rnd()
      hor[y * n + x] = right; ver[y * n + x] = bottom
      tiles.push([top, right, bottom, left])
    }
  var order = []
  for (var i = 0; i < n * n; ++i) order.push(i)
  for (var j = order.length - 1; j > 0; --j) { var k = Math.floor(Rng.random() * (j + 1)); var t = order[j]; order[j] = order[k]; order[k] = t }
  var slots = []
  for (var b = 0; b < n * n; ++b) slots.push(-1)
  for (var p = 0; p < n * n; ++p) slots.push(order[p])
  return { n: n, tiles: tiles, slots: slots, cursor: { side: 1, x: 0, y: 0 }, held: -1, moves: 0, time: 0,
           done: false, solved: solved || 0, history: [] }
}

function rnd() { return Math.floor(Rng.random() * 10) }

function copy(s) {
  return { n: s.n, tiles: s.tiles, slots: s.slots, cursor: s.cursor, held: s.held, moves: s.moves, time: s.time,
           done: s.done, solved: s.solved, history: s.history }
}

function slotOf(s, c) { return c.side * s.n * s.n + c.y * s.n + c.x }

// Board slots whose tile disagrees with a neighbour.
function mismatches(s) {
  var n = s.n, bad = {}
  for (var y = 0; y < n; ++y)
    for (var x = 0; x < n; ++x) {
      var a = s.slots[y * n + x]
      if (a < 0) continue
      if (x + 1 < n) { var r = s.slots[y * n + x + 1]; if (r >= 0 && s.tiles[a][1] !== s.tiles[r][3]) { bad[y * n + x] = true; bad[y * n + x + 1] = true } }
      if (y + 1 < n) { var d = s.slots[(y + 1) * n + x]; if (d >= 0 && s.tiles[a][2] !== s.tiles[d][0]) { bad[y * n + x] = true; bad[(y + 1) * n + x] = true } }
    }
  return bad
}

function isSolved(s) {
  for (var i = 0; i < s.n * s.n; ++i) if (s.slots[i] < 0) return false
  return !Object.keys(mismatches(s)).length
}

// Left/right step across both halves as one wide grid.
function moveCursor(s, dx, dy) {
  var n = s.n, gx = s.cursor.side * n + s.cursor.x + dx
  gx = (gx + 2 * n) % (2 * n)
  var nc = { side: gx >= n ? 1 : 0, x: gx % n, y: (s.cursor.y + dy + n) % n }
  var out = copy(s)
  out.cursor = nc
  return out
}

// SPACE: pick up the tile under the cursor, or put the held one down
// (swapping with whatever's there).
function activate(s) {
  if (s.done) return s
  var at = slotOf(s, s.cursor)
  var n = copy(s)
  if (s.held < 0) { if (s.slots[at] >= 0) n.held = at; return n }
  if (s.held === at) { n.held = -1; return n }
  n.history = s.history.concat([s.slots]).slice(-200)
  n.slots = s.slots.slice()
  var t = n.slots[at]
  n.slots[at] = n.slots[s.held]
  n.slots[s.held] = t
  n.held = -1
  n.moves = s.moves + 1
  if (isSolved(n)) { n.done = true; n.solved = s.solved + 1 }
  return n
}

function undo(s) {
  if (!s.history.length || s.done) return s
  var n = copy(s)
  n.slots = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  n.held = -1
  return n
}

function tick(s, dt) { if (s.done) return s; var n = copy(s); n.time = s.time + dt; return n }

function serialize(s) { return { n: s.n, tiles: s.tiles, slots: s.slots, moves: s.moves, time: s.time, solved: s.solved, done: s.done } }

function deserialize(o) {
  if (!o || !o.tiles || !o.slots || o.slots.length !== 2 * o.n * o.n) return null
  var s = makeState(o.n, o.solved)
  s.tiles = o.tiles; s.slots = o.slots; s.moves = o.moves || 0; s.time = o.time || 0
  s.done = !!o.done
  return s
}
