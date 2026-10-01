.pragma library

// Loopy (Slitherlink), after Simon Tatham's. Draw a single closed loop
// along the grid lines, never crossing or branching, so every numbered
// square has exactly that many of its four sides on the loop.
//
// Puzzles are prebuilt with one answer (dev/tools/tatham/loopy.js):
// { w, h, clues } with "0"-"3" or "." per square. Edges: w*(h+1)
// horizontal ones first, then (w+1)*h vertical; 0 blank, 1 line, 2 cross.
//
// Keyboard: the cursor sits on a dot. SPACE toggles a pen that draws (or
// rubs out) a line along each arrow move; X toggles a pen that marks
// crosses instead. With no pen, arrows just move.

function hE(p, x, y) { return y * p.w + x }
function vE(p, x, y) { return p.w * (p.h + 1) + y * (p.w + 1) + x }
function edgeCount(p) { return p.w * (p.h + 1) + (p.w + 1) * p.h }
function clue(p, i) { var c = p.clues[i]; return c === "." ? -1 : c.charCodeAt(0) - 48 }

function cellEdges(p, x, y) { return [hE(p, x, y), hE(p, x, y + 1), vE(p, x, y), vE(p, x + 1, y)] }

function vertEdges(p, x, y) {
  var out = []
  if (x > 0) out.push(hE(p, x - 1, y))
  if (x < p.w) out.push(hE(p, x, y))
  if (y > 0) out.push(vE(p, x, y - 1))
  if (y < p.h) out.push(vE(p, x, y))
  return out
}

// The edge between dot (x, y) and its neighbour (x + dx, y + dy).
function edgeBetween(p, x, y, dx, dy) {
  if (dx) return hE(p, Math.min(x, x + dx), y)
  return vE(p, x, Math.min(y, y + dy))
}

function makeState(p, size, idx) {
  var e = []
  for (var i = 0; i < edgeCount(p); ++i) e.push(0)
  return { p: p, size: size, idx: idx, edges: e, cursor: { x: 0, y: 0 }, pen: 0, history: [], solved: false }
}

function copy(s) {
  return { p: s.p, size: s.size, idx: s.idx, edges: s.edges, cursor: s.cursor, pen: s.pen, history: s.history, solved: s.solved }
}

function around(s, x, y) {
  var es = cellEdges(s.p, x, y), n = 0
  for (var i = 0; i < 4; ++i) if (s.edges[es[i]] === 1) n++
  return n
}

function degree(s, x, y) {
  var es = vertEdges(s.p, x, y), n = 0
  for (var i = 0; i < es.length; ++i) if (s.edges[es[i]] === 1) n++
  return n
}

// Ends of an edge as dot coordinates.
function ends(p, e) {
  var HC = p.w * (p.h + 1)
  if (e < HC) { var y = Math.floor(e / p.w), x = e % p.w; return [[x, y], [x + 1, y]] }
  var k = e - HC, vy = Math.floor(k / (p.w + 1)), vx = k % (p.w + 1)
  return [[vx, vy], [vx, vy + 1]]
}

function isSolved(s) {
  var p = s.p
  for (var y = 0; y < p.h; ++y)
    for (var x = 0; x < p.w; ++x) {
      var c = clue(p, y * p.w + x)
      if (c >= 0 && around(s, x, y) !== c) return false
    }
  var first = -1, total = 0
  for (var e = 0; e < s.edges.length; ++e) if (s.edges[e] === 1) { total++; if (first < 0) first = e }
  if (!total) return false
  for (var vy = 0; vy <= p.h; ++vy)
    for (var vx = 0; vx <= p.w; ++vx) { var d = degree(s, vx, vy); if (d !== 0 && d !== 2) return false }
  // Every vertex is degree 0 or 2, so lines form loops; walk one and
  // check it uses every line.
  var start = ends(p, first)[0], cur = ends(p, first)[1], prev = first, len = 1
  while (cur[0] !== start[0] || cur[1] !== start[1]) {
    var es = vertEdges(p, cur[0], cur[1]), next = -1
    for (var i = 0; i < es.length; ++i) if (es[i] !== prev && s.edges[es[i]] === 1) next = es[i]
    if (next < 0) return false
    var en = ends(p, next)
    cur = en[0][0] === cur[0] && en[0][1] === cur[1] ? en[1] : en[0]
    prev = next
    len++
    if (len > total) return false
  }
  return len === total
}

function moveCursor(s, dx, dy) {
  var p = s.p, x = s.cursor.x + dx, y = s.cursor.y + dy
  if (x < 0 || y < 0 || x > p.w || y > p.h) return s
  var n = copy(s)
  n.cursor = { x: x, y: y }
  if (s.pen && !s.solved) {
    var e = edgeBetween(p, s.cursor.x, s.cursor.y, dx, dy)
    n.history = s.history.concat([s.edges]).slice(-400)
    n.edges = s.edges.slice()
    n.edges[e] = s.edges[e] === s.pen ? 0 : s.pen
    n.solved = isSolved(n)
  }
  return n
}

// Toggle edge e to `mark` (1 line, 2 cross), for the mouse.
function toggleEdge(s, e, mark) {
  if (s.solved || e < 0 || e >= s.edges.length) return s
  var n = copy(s)
  n.history = s.history.concat([s.edges]).slice(-400)
  n.edges = s.edges.slice()
  n.edges[e] = s.edges[e] === mark ? 0 : mark
  n.solved = isSolved(n)
  return n
}

// The edge nearest a point given in dot units, or -1 if it's not close.
function nearestEdge(p, u, v) {
  var best = -1, bd = 0.16
  for (var e = 0; e < edgeCount(p); ++e) {
    var en = ends(p, e), mx = (en[0][0] + en[1][0]) / 2, my = (en[0][1] + en[1][1]) / 2
    var d = (mx - u) * (mx - u) + (my - v) * (my - v)
    if (d < bd) { bd = d; best = e }
  }
  return best
}

function setPen(s, pen) { var n = copy(s); n.pen = s.pen === pen ? 0 : pen; return n }

function undo(s) {
  if (!s.history.length || s.solved) return s
  var n = copy(s)
  n.edges = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  return n
}

function serialize(s) { return { size: s.size, idx: s.idx, edges: s.edges } }

function deserialize(o, p) {
  if (!o || !o.edges || o.edges.length !== edgeCount(p)) return null
  var s = makeState(p, o.size, o.idx)
  s.edges = o.edges
  s.solved = isSolved(s)
  return s
}
