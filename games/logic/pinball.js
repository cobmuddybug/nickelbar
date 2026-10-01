.pragma library
.import "../../engine/Rng.js" as Rng

// Pinball: one table, three balls. Pull the plunger to launch, keep the
// ball up with the flippers. Pop bumpers, slingshots, three top lanes
// (light all three to raise the multiplier) and a bank of three drop
// targets (knock all three down for a big award). The multiplier applies
// to everything and resets with each ball.
//
// Table units: W × H with y pointing down (the flippers are at the bottom).
// The plunger lane runs up the right edge.

var W = 10
var H = 16
var BALL_R = 0.25
var G = 13
var MAX_V = 32
var BALLS = 3
var SUBSTEPS = 8

var LANE_X0 = 9.0          // inner wall of the plunger lane
var LANE_X1 = 9.7          // outer wall
var PLUNGER_Y = 15.0
var FIELD_R = 9.0          // right edge of the playfield proper

// Flippers: pivot, length, capsule radius, rest and raised angles (for the
// left one; the right one mirrors it).
var FLIP_LEN = 1.55
var FLIP_R = 0.17
var FLIP_REST = 0.5
var FLIP_UP = -0.45
var FLIP_SPEED = 24        // rad/s
var FLIPPERS = [
  { x: 2.75, y: 13.4, side: -1 },
  { x: 6.55, y: 13.4, side: 1 }
]

var BUMPERS = [
  { x: 3.25, y: 5.1, r: 0.55 },
  { x: 6.05, y: 5.1, r: 0.55 },
  { x: 4.65, y: 7.0, r: 0.55 }
]

var LANES = [3.45, 4.65, 5.85]    // rollover lanes near the top
var LANE_Y = 2.3
var TARGETS = [                    // drop targets on the left wall
  { x: 0.45, y0: 7.0, y1: 7.6 },
  { x: 0.45, y0: 7.8, y1: 8.4 },
  { x: 0.45, y0: 8.6, y1: 9.2 }
]

// Static geometry as line segments. kind: "wall" or "sling" (kicks).
function buildWalls() {
  var w = []
  function seg(ax, ay, bx, by, kind) { w.push({ ax: ax, ay: ay, bx: bx, by: by, kind: kind || "wall" }) }
  // Top arch: half an ellipse from the left wall over to the lane's outer wall.
  var cx = (0.3 + LANE_X1) / 2, cy = 3.2, rx = (LANE_X1 - 0.3) / 2, ry = 2.9, n = 20
  for (var i = 0; i < n; ++i) {
    var a0 = Math.PI + Math.PI * i / n, a1 = Math.PI + Math.PI * (i + 1) / n
    seg(cx + rx * Math.cos(a0), cy + ry * Math.sin(a0), cx + rx * Math.cos(a1), cy + ry * Math.sin(a1))
  }
  // Each side (the right mirrors the left about the flippers' centre): the
  // outer wall, the inlane guide down to the flipper pivot, and a
  // slingshot filling the corner above it, its long face the kicker.
  var m = FLIPPERS[0].x + FLIPPERS[1].x
  for (var side = 0; side < 2; ++side) {
    var X = side ? function(x) { return m - x } : function(x) { return x }
    seg(X(0.3), side ? 4.4 : 3.2, X(0.3), 11.2)
    seg(X(0.3), 11.2, X(FLIPPERS[0].x - 0.05), FLIPPERS[0].y - 0.05)
    seg(X(0.3), 10.2, X(2.1), 12.81, "sling")
  }
  seg(FIELD_R, 11.2, FIELD_R, H + 1)                // lane divider, lower half
  seg(LANE_X1, 3.2, LANE_X1, H + 1)                 // lane outer wall
  seg(LANE_X0, PLUNGER_Y, LANE_X1, PLUNGER_Y)       // plunger tip
  // Top lane posts.
  for (var p = 0; p < LANES.length + 1; ++p) {
    var px = (p === 0 ? LANES[0] - 0.6 : p === LANES.length ? LANES[LANES.length - 1] + 0.6 : (LANES[p - 1] + LANES[p]) / 2)
    seg(px, LANE_Y - 0.45, px, LANE_Y + 0.45)
  }
  return w
}
var WALLS = buildWalls()

function makeState() {
  return {
    ball: { x: (LANE_X0 + LANE_X1) / 2, y: PLUNGER_Y - BALL_R, vx: 0, vy: 0 },
    inLane: true, charge: 0, charging: false,
    flip: [FLIP_REST, FLIP_REST], flipW: [0, 0],
    lanes: [false, false, false], targets: [false, false, false],
    mult: 1, score: 0, balls: BALLS, ballNo: 1, done: false,
    flash: [0, 0, 0], slingFlash: [0, 0], drainT: 0, msg: "", msgT: 0, stuckT: 0
  }
}

function copy(s) {
  return {
    ball: s.ball ? { x: s.ball.x, y: s.ball.y, vx: s.ball.vx, vy: s.ball.vy } : null,
    inLane: s.inLane, charge: s.charge, charging: s.charging,
    flip: s.flip.slice(), flipW: s.flipW.slice(), lanes: s.lanes.slice(), targets: s.targets.slice(),
    mult: s.mult, score: s.score, balls: s.balls, ballNo: s.ballNo, done: s.done,
    flash: s.flash.slice(), slingFlash: s.slingFlash.slice(), drainT: s.drainT, msg: s.msg, msgT: s.msgT, stuckT: s.stuckT
  }
}

// Flipper segment endpoints for angle a.
function flipperEnds(i, a) {
  var f = FLIPPERS[i], dx = Math.cos(a) * FLIP_LEN, dy = Math.sin(a) * FLIP_LEN
  return { ax: f.x, ay: f.y, bx: f.x - f.side * dx, by: f.y + dy }
}

// Push the ball out of a capsule (segment plus radius), bouncing it off a
// surface moving with velocity (svx, svy). Returns the contact normal's
// approach speed (0 when there was no contact).
function collideSeg(b, ax, ay, bx, by, rad, e, svx, svy) {
  var ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey
  var t = len2 ? Math.max(0, Math.min(1, ((b.x - ax) * ex + (b.y - ay) * ey) / len2)) : 0
  var cx = ax + ex * t, cy = ay + ey * t
  var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy, rr = rad + BALL_R
  if (d2 >= rr * rr) return 0
  var d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d
  b.x = cx + nx * rr; b.y = cy + ny * rr
  var rvx = b.vx - (svx || 0), rvy = b.vy - (svy || 0), vn = rvx * nx + rvy * ny
  if (vn >= 0) return 0.0001
  b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny
  return -vn
}

var cur = []         // sound events raised during the current step
var EVN = 0

function award(s, pts) { s.score += pts * s.mult; cur.push(pts >= 100 ? "ding" : "tick") }

function say(s, text) { s.msg = text; s.msgT = 1.6 }

// input: { left, right, plunge } booleans for this tick.
function step(state, input, dt) {
  cur = []
  var s = stepInner(state, input, dt)
  if (cur.length && s !== state) { s.ev = cur; s.evSeq = ++EVN }
  return s
}

function stepInner(state, input, dt) {
  if (state.done) return state
  var s = copy(state)
  s.msgT = Math.max(0, s.msgT - dt)
  for (var fl = 0; fl < 3; ++fl) s.flash[fl] = Math.max(0, s.flash[fl] - dt)
  for (var sf = 0; sf < 2; ++sf) s.slingFlash[sf] = Math.max(0, s.slingFlash[sf] - dt)

  // Drained: a short pause, then the next ball (or the end).
  if (!s.ball) {
    s.drainT -= dt
    if (s.drainT <= 0) {
      if (s.balls <= 0) { s.done = true; return s }
      s.ball = { x: (LANE_X0 + LANE_X1) / 2, y: PLUNGER_Y - BALL_R, vx: 0, vy: 0 }
      s.inLane = true; s.ballNo++; s.mult = 1; s.lanes = [false, false, false]
    }
    return s
  }

  // Plunger: charge while held, fire on release.
  if (s.inLane && s.ball.y > PLUNGER_Y - BALL_R - 0.3 && s.ball.x > LANE_X0) {
    if (input.plunge) { s.charging = true; s.charge = Math.min(1, s.charge + dt * 1.1) }
    else if (s.charging) {
      s.ball.vy = -(15 + 15 * s.charge)
      s.charging = false; s.charge = 0
    }
  } else { s.charging = false; s.charge = 0 }

  var targets = [input.left ? FLIP_UP : FLIP_REST, input.right ? FLIP_UP : FLIP_REST]
  var h = dt / SUBSTEPS, b = s.ball
  for (var k = 0; k < SUBSTEPS; ++k) {
    // Flippers swing toward their target angle at a fixed speed.
    for (var f = 0; f < 2; ++f) {
      var da = targets[f] - s.flip[f], maxd = FLIP_SPEED * h
      var moved = Math.max(-maxd, Math.min(maxd, da))
      s.flip[f] += moved
      s.flipW[f] = moved / h
    }
    b.vy += G * h
    b.x += b.vx * h; b.y += b.vy * h

    for (var i = 0; i < WALLS.length; ++i) {
      var w = WALLS[i]
      var hit = collideSeg(b, w.ax, w.ay, w.bx, w.by, 0.05, w.kind === "sling" ? 0.2 : 0.45)
      if (w.kind === "sling" && hit > 1.5) {
        // Kick along the face's inward normal.
        var ex = w.bx - w.ax, ey = w.by - w.ay, el = Math.sqrt(ex * ex + ey * ey), nx = -ey / el, ny = ex / el
        if ((b.x - w.ax) * nx + (b.y - w.ay) * ny < 0) { nx = -nx; ny = -ny }
        b.vx += nx * 11; b.vy += ny * 11
        s.slingFlash[w.ax < W / 2 ? 0 : 1] = 0.15
        award(s, 10)
      }
    }
    for (var j = 0; j < BUMPERS.length; ++j) {
      var bu = BUMPERS[j], bx = b.x - bu.x, by = b.y - bu.y, bd = Math.sqrt(bx * bx + by * by), rr = bu.r + BALL_R
      if (bd < rr) {
        var ux = bx / (bd || 1e-6), uy = by / (bd || 1e-6)
        b.x = bu.x + ux * rr; b.y = bu.y + uy * rr
        var vn = b.vx * ux + b.vy * uy
        b.vx -= vn * ux; b.vy -= vn * uy
        var kick = Math.max(13, Math.abs(vn) * 0.8)
        b.vx += ux * kick; b.vy += uy * kick
        if (s.flash[j] < 0.05) award(s, 100)
        s.flash[j] = 0.12
      }
    }
    for (var t = 0; t < TARGETS.length; ++t) {
      if (s.targets[t]) continue
      var tg = TARGETS[t]
      if (collideSeg(b, tg.x, tg.y0, tg.x, tg.y1, 0.08, 0.3) > 1) {
        s.targets[t] = true
        award(s, 250)
        if (s.targets.every(function(x) { return x })) {
          award(s, 1500); say(s, "TARGETS 1500 ×" + s.mult)
          s.targets = [false, false, false]
        }
      }
    }
    for (var fi = 0; fi < 2; ++fi) {
      var e = flipperEnds(fi, s.flip[fi]), fw = s.flipW[fi] * -FLIPPERS[fi].side
      // Surface velocity at the closest point: ω × r about the pivot.
      var ex2 = e.bx - e.ax, ey2 = e.by - e.ay, l2 = ex2 * ex2 + ey2 * ey2
      var tt = Math.max(0, Math.min(1, ((b.x - e.ax) * ex2 + (b.y - e.ay) * ey2) / l2))
      var rx = ex2 * tt, ry = ey2 * tt
      collideSeg(b, e.ax, e.ay, e.bx, e.by, FLIP_R, 0.25, -fw * ry, fw * rx)
    }
    // Top lanes: rolling through lights one.
    if (Math.abs(b.y - LANE_Y) < 0.3) {
      for (var l = 0; l < LANES.length; ++l) {
        if (!s.lanes[l] && Math.abs(b.x - LANES[l]) < 0.3) {
          s.lanes[l] = true; award(s, 50)
          if (s.lanes.every(function(x) { return x })) {
            award(s, 500)
            s.mult = Math.min(5, s.mult + 1)
            say(s, "MULTIPLIER ×" + s.mult)
            s.lanes = [false, false, false]
          }
        }
      }
    }
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
    if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp }
  }
  if (s.inLane && b.x < LANE_X0 - BALL_R) s.inLane = false
  if (!s.inLane && b.x > LANE_X0 && b.y > 4.4) s.inLane = true

  // A ball that has come to rest outside the lane and off the flippers
  // gets a gentle nudge.
  var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
  s.stuckT = speed < 0.4 && !s.inLane && b.y < 12.5 ? s.stuckT + dt : 0
  if (s.stuckT > 2) { b.vx += (Rng.random() - 0.5) * 6; b.vy -= 3; s.stuckT = 0 }

  if (b.y > H + BALL_R * 2) {
    s.ball = null
    s.balls--
    s.drainT = 1.2
    cur.push("thud")
    say(s, s.balls > 0 ? "BALL LOST" : "LAST BALL GONE")
  }
  return s
}

function serialize(s) {
  return { score: s.score, balls: s.balls, ballNo: s.ballNo, targets: s.targets, lanes: s.lanes, mult: s.mult }
}

// A restored game puts the current ball back on the plunger.
function deserialize(o) {
  if (!o || typeof o.score !== "number") return null
  var s = makeState()
  s.score = o.score; s.balls = o.balls; s.ballNo = o.ballNo || 1
  s.targets = o.targets || s.targets; s.lanes = o.lanes || s.lanes; s.mult = o.mult || 1
  return s
}
