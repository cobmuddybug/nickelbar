.pragma library

// Klotski, after GNOME Klotski and the Huarong Dao puzzle: slide the blocks
// about until the big 2x2 one reaches the bottom middle. Levels come from
// games/data/klotski.json (dev/tools/klotski.js), each with the shortest
// solution in single-square moves, so there's a par to aim for.
//
// A layout is 20 chars on a 4x5 board: a letter per block, "." empty.

var W = 4
var H = 5
var GOAL = { x: 1, y: 3 }

function pieces(layout) {
  var out = {}
  for (var i = 0; i < W * H; ++i) {
    var c = layout[i]
    if (c === ".") continue
    var x = i % W, y = Math.floor(i / W)
    if (!out[c]) out[c] = { x: x, y: y, w: 1, h: 1 }
    var p = out[c]
    p.w = Math.max(p.w, x - p.x + 1); p.h = Math.max(p.h, y - p.y + 1)
  }
  return out
}

function bigId(layout) {
  var ps = pieces(layout)
  for (var id in ps) if (ps[id].w === 2 && ps[id].h === 2) return id
  return ""
}

function makeState(level, idx) {
  return { layout: level.layout, idx: idx, min: level.min, cursor: { x: 1, y: 1 }, grabbed: "", moves: 0,
           history: [], done: false, note: "" }
}

function copy(s) {
  return { layout: s.layout, idx: s.idx, min: s.min, cursor: s.cursor, grabbed: s.grabbed, moves: s.moves,
           history: s.history, done: s.done, note: "" }
}

function isSolved(layout) {
  var b = pieces(layout)[bigId(layout)]
  return !!b && b.x === GOAL.x && b.y === GOAL.y
}

function slide(s, id, dx, dy) {
  var p = pieces(s.layout)[id], nx = p.x + dx, ny = p.y + dy
  if (nx < 0 || ny < 0 || nx + p.w > W || ny + p.h > H) return null
  for (var y = ny; y < ny + p.h; ++y)
    for (var x = nx; x < nx + p.w; ++x) {
      var c = s.layout[y * W + x]
      if (c !== "." && c !== id) return null
    }
  var a = s.layout.split("")
  for (var y1 = p.y; y1 < p.y + p.h; ++y1) for (var x1 = p.x; x1 < p.x + p.w; ++x1) a[y1 * W + x1] = "."
  for (var y2 = ny; y2 < ny + p.h; ++y2) for (var x2 = nx; x2 < nx + p.w; ++x2) a[y2 * W + x2] = id
  return a.join("")
}

// With a block grabbed, arrows slide it; otherwise they move the cursor.
function moveCursor(s, dx, dy) {
  if (s.done) return s
  var n = copy(s)
  if (s.grabbed) {
    var l = slide(s, s.grabbed, dx, dy)
    if (!l) { n.note = "blocked"; return n }
    n.history = s.history.concat([s.layout]).slice(-500)
    n.layout = l
    n.moves = s.moves + 1
    n.cursor = { x: Math.max(0, Math.min(W - 1, s.cursor.x + dx)), y: Math.max(0, Math.min(H - 1, s.cursor.y + dy)) }
    if (isSolved(l)) { n.done = true; n.grabbed = "" }
    return n
  }
  n.cursor = { x: (s.cursor.x + dx + W) % W, y: (s.cursor.y + dy + H) % H }
  return n
}

function activate(s) {
  if (s.done) return s
  var n = copy(s), c = s.layout[s.cursor.y * W + s.cursor.x]
  if (s.grabbed) { n.grabbed = ""; return n }
  if (c === ".") { n.note = "nothing there"; return n }
  n.grabbed = c
  return n
}

function undo(s) {
  if (!s.history.length || s.done) return s
  var n = copy(s)
  n.layout = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  n.moves = s.moves + 1   // undoing still counts, as in GNOME Klotski
  return n
}

function serialize(s) { return { idx: s.idx, layout: s.layout, moves: s.moves } }
