.pragma library

// Mini golf, nine holes seen from above. Aim, hold to build power, release
// to putt. Walls bank, sand drags, water costs a stroke and puts you back
// where you hit from, slopes pull the ball downhill, and hole 7 has a
// windmill. Eight strokes and you pick up.
//
// Score is points, not strokes, so it can sit with the other bests: each
// hole pays 20 × (3 + par - strokes), floored at 0, and an ace pays 100.
//
// Course units: W × H, y down.

var W = 10
var H = 7
var BALL_R = 0.12
var CUP_R = 0.2
var MAX_SPEED = 9.5
var FRICTION = 2.4          // units/s² of rolling drag
var DAMPING = 0.35          // and a little proportional drag
var SAND = 7                // extra drag in sand
var SINK_SPEED = 3.2        // faster than this over the cup and it lips out
var MAX_STROKES = 8
var SUBSTEPS = 6

function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] }

// Each hole: boundary polygons (the first is the green's edge; others are
// solid blocks), round posts, sand/water rectangles, slopes (a rectangle
// and the pull on the ball), and an optional windmill.
var HOLES = [
  { par: 2, tee: [2, 3.5], cup: [8, 3.5], walls: [rect(1, 2, 9, 5)] },
  { par: 3, tee: [2, 2], cup: [7.5, 5.2],
    walls: [[[1, 1], [9, 1], [9, 6.2], [6.2, 6.2], [6.2, 3], [1, 3]]] },
  { par: 2, tee: [1.8, 3.5], cup: [8.2, 3.5],
    walls: [rect(1, 1.5, 9, 5.5), rect(4.4, 2.4, 5.6, 4.6)] },
  { par: 3, tee: [1.6, 3.5], cup: [8.4, 3.5], walls: [rect(1, 1, 9, 6)],
    posts: [[3, 2.2, 0.3], [3, 4.8, 0.3], [4.6, 3.5, 0.35], [6.2, 2, 0.3], [6.2, 5, 0.3], [7.4, 3.5, 0.3], [4.6, 1.5, 0.25], [4.6, 5.5, 0.25]] },
  { par: 3, tee: [2, 5.4], cup: [8.2, 1.8], walls: [rect(1, 1, 9, 6)],
    slopes: [{ r: [3.5, 1, 6.5, 6], ax: 0, ay: 2.6 }] },
  { par: 3, tee: [1.8, 3.5], cup: [8.3, 3.5], walls: [rect(1, 1, 9, 6)],
    water: [[4, 1, 6, 2.9], [4, 4.1, 6, 6]] },
  { par: 3, tee: [5, 5.6], cup: [5, 1.5],
    walls: [[[3.5, 1], [6.5, 1], [6.5, 3], [5.6, 3.4], [5.6, 3.9], [7.5, 4.4], [7.5, 6.3], [2.5, 6.3], [2.5, 4.4], [4.4, 3.9], [4.4, 3.4], [3.5, 3]]],
    windmill: { x: 5, y: 3.65, len: 0.95, speed: 1.9 } },
  { par: 3, tee: [1.6, 5.5], cup: [8.3, 1.7],
    walls: [[[1, 4.5], [7, 4.5], [7, 1], [9, 1], [9, 6.2], [1, 6.2]]],
    sand: [[7.4, 2.5, 9, 3.4], [7, 1, 7.7, 2.3]] },
  { par: 4, tee: [1.5, 1.6], cup: [8.5, 5.4],
    walls: [rect(0.8, 0.8, 9.2, 6.2), rect(0.8, 2.4, 6.8, 2.8), rect(3.2, 4.2, 9.2, 4.6)],
    slopes: [{ r: [0.8, 2.8, 9.2, 4.2], ax: -1.4, ay: 0 }], sand: [[6.8, 0.8, 9.2, 1.6]] }
]

function holePoints(par, strokes) { return strokes === 1 ? 100 : Math.max(0, 20 * (3 + par - strokes)) }

function inRect(r, x, y) { return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3] }

function segmentsOf(hole) {
  var out = []
  for (var p = 0; p < hole.walls.length; ++p) {
    var poly = hole.walls[p]
    for (var i = 0; i < poly.length; ++i) {
      var a = poly[i], b = poly[(i + 1) % poly.length]
      out.push([a[0], a[1], b[0], b[1]])
    }
  }
  return out
}
var SEGS = HOLES.map(segmentsOf)

function aimAt(x, y, tx, ty) { return Math.atan2(ty - y, tx - x) }

function startHole(s, i) {
  var h = HOLES[i]
  s.hole = i
  s.ball = { x: h.tee[0], y: h.tee[1], vx: 0, vy: 0 }
  s.last = { x: h.tee[0], y: h.tee[1] }
  s.aim = aimAt(h.tee[0], h.tee[1], h.cup[0], h.cup[1])
  s.strokes = 0
  s.phase = "aim"
  s.charge = 0; s.chargeDir = 1; s.charging = false
}

function makeState() {
  var s = { hole: 0, cards: [], points: 0, t: 0, msg: "", msgT: 0 }
  startHole(s, 0)
  return s
}

function copy(s) {
  return {
    hole: s.hole, cards: s.cards.slice(), points: s.points, t: s.t, msg: s.msg, msgT: s.msgT,
    ball: { x: s.ball.x, y: s.ball.y, vx: s.ball.vx, vy: s.ball.vy }, last: { x: s.last.x, y: s.last.y },
    aim: s.aim, strokes: s.strokes, phase: s.phase, charge: s.charge, chargeDir: s.chargeDir, charging: s.charging
  }
}

function windmillEnds(w, t) {
  var a = t * w.speed, dx = Math.cos(a) * w.len, dy = Math.sin(a) * w.len
  return { ax: w.x - dx, ay: w.y - dy, bx: w.x + dx, by: w.y + dy }
}

function collideSeg(b, ax, ay, bx, by, rad, e, svx, svy) {
  var ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey
  var t = len2 ? Math.max(0, Math.min(1, ((b.x - ax) * ex + (b.y - ay) * ey) / len2)) : 0
  var cx = ax + ex * t, cy = ay + ey * t
  var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy, rr = rad + BALL_R
  if (d2 >= rr * rr) return false
  var d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d
  b.x = cx + nx * rr; b.y = cy + ny * rr
  var rvx = b.vx - (svx || 0), rvy = b.vy - (svy || 0), vn = rvx * nx + rvy * ny
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny }
  return true
}

function say(s, m) { s.msg = m; s.msgT = 1.8 }

function finishHole(s, holed) {
  var h = HOLES[s.hole], pts = holed ? holePoints(h.par, s.strokes) : 0
  s.cards.push({ strokes: holed ? s.strokes : MAX_STROKES + 1, par: h.par, pts: pts })
  s.points += pts
  var d = s.strokes - h.par
  say(s, !holed ? "PICKED UP" : s.strokes === 1 ? "HOLE IN ONE!" : d <= -2 ? "EAGLE" : d === -1 ? "BIRDIE" : d === 0 ? "PAR" : d === 1 ? "BOGEY" : "+" + d)
  s.phase = "sunk"
}

// input: { turn (-1..1, fast), fine (-1..1, slow), hold }.
function step(state, input, dt) {
  var s = copy(state), h = HOLES[s.hole]
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  if (s.phase === "done" || s.phase === "sunk") return s

  if (s.phase === "aim") {
    s.aim += (input.turn || 0) * 1.3 * dt + (input.fine || 0) * 0.22 * dt
    if (input.hold) {
      s.charging = true
      s.charge += s.chargeDir * dt * 0.85
      if (s.charge >= 1) { s.charge = 1; s.chargeDir = -1 }
      if (s.charge <= 0.03) { s.charge = 0.03; s.chargeDir = 1 }
    } else if (s.charging) return shoot(s, s.aim, s.charge)
    return s
  }

  // Rolling.
  var b = s.ball, sub = dt / SUBSTEPS, segs = SEGS[s.hole]
  for (var k = 0; k < SUBSTEPS; ++k) {
    var tNow = s.t - dt + sub * (k + 1)
    for (var sl = 0; sl < (h.slopes || []).length; ++sl) {
      var slope = h.slopes[sl]
      if (inRect(slope.r, b.x, b.y)) { b.vx += slope.ax * sub; b.vy += slope.ay * sub }
    }
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
    var drag = FRICTION, sandy = false
    for (var sa = 0; sa < (h.sand || []).length; ++sa) if (inRect(h.sand[sa], b.x, b.y)) sandy = true
    if (sandy) drag += SAND
    var nsp = Math.max(0, sp - (drag + DAMPING * sp) * sub)
    if (sp > 0) { b.vx *= nsp / sp; b.vy *= nsp / sp }
    b.x += b.vx * sub; b.y += b.vy * sub
    for (var i = 0; i < segs.length; ++i) collideSeg(b, segs[i][0], segs[i][1], segs[i][2], segs[i][3], 0.04, 0.72)
    for (var p = 0; p < (h.posts || []).length; ++p) {
      var po = h.posts[p]
      collideSeg(b, po[0], po[1], po[0], po[1], po[2], 0.75)
    }
    if (h.windmill) {
      var w = h.windmill, e = windmillEnds(w, tNow)
      var ex = e.bx - w.x, ey = e.by - w.y, el2 = ex * ex + ey * ey
      var tt = ((b.x - w.x) * ex + (b.y - w.y) * ey) / el2
      tt = Math.max(-1, Math.min(1, tt))
      collideSeg(b, e.ax, e.ay, e.bx, e.by, 0.09, 0.6, -w.speed * ey * tt, w.speed * ex * tt)
    }
    // The cup: slow enough over it and it drops; otherwise the lip bends it.
    var cx = b.x - h.cup[0], cy = b.y - h.cup[1], cd = Math.sqrt(cx * cx + cy * cy)
    sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
    if (cd < CUP_R) {
      if (sp < SINK_SPEED) { b.x = h.cup[0]; b.y = h.cup[1]; b.vx = 0; b.vy = 0; finishHole(s, true); return s }
      b.vx -= cx / (cd || 1) * 6 * sub; b.vy -= cy / (cd || 1) * 6 * sub
    }
  }
  for (var wa = 0; wa < (h.water || []).length; ++wa) {
    if (inRect(h.water[wa], b.x, b.y)) {
      s.strokes++
      say(s, "SPLASH  +1")
      b.x = s.last.x; b.y = s.last.y; b.vx = 0; b.vy = 0
      return settle(s)
    }
  }
  if (Math.sqrt(b.vx * b.vx + b.vy * b.vy) < 0.05) { b.vx = 0; b.vy = 0; return settle(s) }
  return s
}

function settle(s) {
  var h = HOLES[s.hole]
  if (s.strokes >= MAX_STROKES) { finishHole(s, false); return s }
  s.phase = "aim"
  s.last = { x: s.ball.x, y: s.ball.y }
  s.aim = aimAt(s.ball.x, s.ball.y, h.cup[0], h.cup[1])
  s.charge = 0; s.chargeDir = 1; s.charging = false
  return s
}

function shoot(state, aim, power) {
  if (state.phase !== "aim") return state
  var s = copy(state)
  var v = MAX_SPEED * Math.max(0.03, Math.min(1, power))
  s.ball.vx = Math.cos(aim) * v; s.ball.vy = Math.sin(aim) * v
  s.aim = aim
  s.last = { x: s.ball.x, y: s.ball.y }
  s.strokes++
  s.phase = "roll"
  s.charging = false; s.charge = 0
  return s
}

function nextHole(state) {
  if (state.phase !== "sunk") return state
  var s = copy(state)
  if (s.hole + 1 >= HOLES.length) { s.phase = "done"; return s }
  startHole(s, s.hole + 1)
  return s
}

function totalPar(upto) {
  var t = 0
  for (var i = 0; i < upto; ++i) t += HOLES[i].par
  return t
}

function totalStrokes(s) {
  var t = 0
  for (var i = 0; i < s.cards.length; ++i) t += s.cards[i].strokes
  return t
}

// Strokes relative to par over the holes finished so far.
function toPar(s) { return totalStrokes(s) - totalPar(s.cards.length) }

function serialize(s) { return { hole: s.hole, cards: s.cards, points: s.points } }

function deserialize(o) {
  if (!o || typeof o.hole !== "number" || !o.cards || o.hole >= HOLES.length) return null
  var s = makeState()
  s.cards = o.cards.slice(); s.points = o.points || 0
  startHole(s, o.hole)
  return s
}
