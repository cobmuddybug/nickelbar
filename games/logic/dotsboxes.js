.pragma library
.import "../../engine/Rng.js" as Rng

// Dots and Boxes, after KDE's KSquares. Take turns drawing a line between
// two neighbouring dots; whoever draws a box's fourth side owns it and
// must draw again. Most boxes wins.
//
// The AI takes any box it's offered, otherwise plays a line that doesn't
// hand over a box, and when every line gives something away, it gives the
// smallest chain it can. Edges are numbered as in loopy.js: the w*(h+1)
// horizontal ones, then (w+1)*h vertical.

var W = 5
var H = 5
var HC = W * (H + 1)
var E = HC + (W + 1) * H

function hE(x, y) { return y * W + x }
function vE(x, y) { return HC + y * (W + 1) + x }
function boxEdges(b) { var x = b % W, y = Math.floor(b / W); return [hE(x, y), hE(x, y + 1), vE(x, y), vE(x + 1, y)] }

function edgeBoxes(e) {
  if (e < HC) {
    var x = e % W, y = Math.floor(e / W), out = []
    if (y > 0) out.push((y - 1) * W + x)
    if (y < H) out.push(y * W + x)
    return out
  }
  var k = e - HC, vy = Math.floor(k / (W + 1)), vx = k % (W + 1), o = []
  if (vx > 0) o.push(vy * W + vx - 1)
  if (vx < W) o.push(vy * W + vx)
  return o
}

// Midpoint of an edge in dot units, for drawing and cursor moves.
function mid(e) {
  if (e < HC) return { x: e % W + 0.5, y: Math.floor(e / W) }
  var k = e - HC
  return { x: k % (W + 1), y: Math.floor(k / (W + 1)) + 0.5 }
}

function makeState(level, wins, losses) {
  var edges = [], owner = []
  for (var e = 0; e < E; ++e) edges.push(0)
  for (var b = 0; b < W * H; ++b) owner.push(0)
  return { edges: edges, owner: owner, cursor: 0, level: level === undefined ? 1 : level, last: [], done: false,
           wins: wins || 0, losses: losses || 0, turnNote: "" }
}

function copy(s) {
  return { edges: s.edges, owner: s.owner, cursor: s.cursor, level: s.level, last: s.last, done: s.done,
           wins: s.wins, losses: s.losses, turnNote: "" }
}

function sides(edges, b) { var es = boxEdges(b), n = 0; for (var i = 0; i < 4; ++i) if (edges[es[i]]) n++; return n }

// Draw edge e for player p (1 you, 2 AI). Returns boxes completed.
function draw(n, e, p) {
  n.edges[e] = p
  var got = 0, bs = edgeBoxes(e)
  for (var i = 0; i < bs.length; ++i) if (!n.owner[bs[i]] && sides(n.edges, bs[i]) === 4) { n.owner[bs[i]] = p; got++ }
  return got
}

function count(s, p) { var k = 0; for (var i = 0; i < s.owner.length; ++i) if (s.owner[i] === p) k++; return k }

// How many boxes the opponent could then take in a row by greedy play.
function giveaway(edges, e) {
  var ed = edges.slice(), taken = 0
  ed[e] = 1
  for (;;) {
    var grab = -1
    for (var b = 0; b < W * H && grab < 0; ++b) {
      if (sides(ed, b) !== 3) continue
      var es = boxEdges(b)
      for (var i = 0; i < 4; ++i) if (!ed[es[i]]) { grab = es[i]; break }
    }
    if (grab < 0) return taken
    ed[grab] = 1
    var bs = edgeBoxes(grab)
    for (var k = 0; k < bs.length; ++k) if (sides(ed, bs[k]) === 4) taken++
  }
}

function aiEdge(s) {
  var free = []
  for (var e = 0; e < E; ++e) if (!s.edges[e]) free.push(e)
  // A box for the taking.
  for (var i = 0; i < free.length; ++i) {
    var bs = edgeBoxes(free[i])
    for (var k = 0; k < bs.length; ++k) if (sides(s.edges, bs[k]) === 3) return free[i]
  }
  var safe = free.filter(function(e2) {
    var b2 = edgeBoxes(e2)
    for (var q = 0; q < b2.length; ++q) if (sides(s.edges, b2[q]) === 2) return false
    return true
  })
  if (safe.length && (s.level > 0 || Rng.random() < 0.7)) return safe[Math.floor(Rng.random() * safe.length)]
  if (s.level === 0) return free[Math.floor(Rng.random() * free.length)]
  var best = [], bestN = 1e9
  for (var j = 0; j < free.length; ++j) {
    var g = giveaway(s.edges, free[j])
    if (g < bestN) { bestN = g; best = [free[j]] }
    else if (g === bestN) best.push(free[j])
  }
  return best[Math.floor(Rng.random() * best.length)]
}

function finish(n) {
  var left = 0
  for (var i = 0; i < n.owner.length; ++i) if (!n.owner[i]) left++
  if (left) return n
  n.done = true
  var me = count(n, 1), ai = count(n, 2)
  if (me > ai) n.wins++
  else if (ai > me) n.losses++
  return n
}

// Your line at the cursor, then the AI's turn(s) if it's theirs.
function play(s) {
  if (s.done || s.edges[s.cursor]) return s
  var n = copy(s)
  n.edges = s.edges.slice(); n.owner = s.owner.slice()
  var got = draw(n, s.cursor, 1)
  n.last = []
  if (got) { n.turnNote = "your turn again"; return finish(n) }
  while (!finish(n).done) {
    var e = aiEdge(n)
    n.last.push(e)
    if (!draw(n, e, 2)) break
  }
  return n
}

// Cursor hops to the nearest edge roughly in the arrow's direction.
function moveCursor(s, dx, dy) {
  var m = mid(s.cursor), best = -1, bd = 1e9
  for (var e = 0; e < E; ++e) {
    if (e === s.cursor) continue
    var p = mid(e), vx = p.x - m.x, vy = p.y - m.y
    var along = vx * dx + vy * dy, across = Math.abs(vx * dy - vy * dx)
    if (along <= 0 || across > along) continue
    var d = along + across * 1.5
    if (d < bd) { bd = d; best = e }
  }
  if (best < 0) return s
  var n = copy(s)
  n.cursor = best
  return n
}

function setCursor(s, e) {
  if (e < 0 || e >= E || e === s.cursor) return s
  var n = copy(s)
  n.cursor = e
  return n
}

function serialize(s) { return { edges: s.edges, owner: s.owner, level: s.level, wins: s.wins, losses: s.losses, done: s.done } }

function deserialize(o) {
  if (!o || !o.edges || o.edges.length !== E) return null
  var s = makeState(o.level, o.wins, o.losses)
  s.edges = o.edges; s.owner = o.owner; s.done = !!o.done
  return s
}
