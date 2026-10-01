.pragma library
.import "../../engine/Rng.js" as Rng

// Plinko (after the TV game and pachinko). Slide the chip along the top,
// drop it, and it bounces down through the pegs into a prize slot. Ten
// chips; score is the total. The big slot is in the middle, but the pegs
// decide.
//
// Field units: W wide, H tall; pegs in staggered rows, SLOTS at the bottom.

var W = 9
var H = 11.5
var ROWS = 10
var PEG_R = 0.09
var BALL_R = 0.26
var CHIPS = 10
var SLOTS = [100, 500, 1000, 0, 10000, 0, 1000, 500, 100]
var SLOT_TOP = H - 1.1
var G = 24

function pegs() {
  var out = []
  for (var r = 0; r < ROWS; ++r) {
    var off = r % 2 ? 0.5 : 0
    for (var c = 0; c <= W; ++c) {
      var x = c + off
      // None so near a wall that a chip could wedge between them.
      if (x < 0.75 || x > W - 0.75) continue
      out.push({ x: x, y: 1.3 + r * 0.9 })
    }
  }
  return out
}
var PEGS = pegs()

function makeState() {
  return { dropX: W / 2, chips: CHIPS, score: 0, ball: null, landed: [], last: -1, flash: 0, done: false }
}

var EVN = 0     // copy() below drops fields, so event numbers come from here

function copy(s) {
  return { dropX: s.dropX, chips: s.chips, score: s.score, ball: s.ball, landed: s.landed, last: s.last,
           flash: s.flash, done: s.done }
}

function slide(state, x) {
  if (state.ball) return state
  var s = copy(state)
  s.dropX = Math.max(0.9, Math.min(W - 0.9, x))
  return s
}

function drop(state) {
  if (state.ball || state.done || state.chips <= 0) return state
  var s = copy(state)
  s.ball = { x: state.dropX, y: 0.4, vx: (Rng.random() - 0.5) * 0.3, vy: 0 }
  s.chips = state.chips - 1
  return s
}

function step(state, dt) {
  var s = copy(state), evs = []
  s.flash = Math.max(0, state.flash - dt)
  if (!state.ball) {
    if (!state.chips && !state.done) s.done = true
    return s
  }
  var b = { x: state.ball.x, y: state.ball.y, vx: state.ball.vx, vy: state.ball.vy }
  var n = 4, h = dt / n
  for (var k = 0; k < n; ++k) {
    b.vy += G * h
    b.x += b.vx * h; b.y += b.vy * h
    for (var i = 0; i < PEGS.length; ++i) {
      var p = PEGS[i], dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy, rr = PEG_R + BALL_R
      if (d2 >= rr * rr) continue
      var d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d
      b.x = p.x + nx * rr; b.y = p.y + ny * rr
      var vn = b.vx * nx + b.vy * ny
      if (vn < 0) { b.vx -= 1.4 * vn * nx; b.vy -= 1.4 * vn * ny; evs.push("tick") }
      // A little randomness so it's not a solved problem.
      b.vx += (Rng.random() - 0.5) * 0.6
    }
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.5 }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.5 }
    // Slot dividers.
    if (b.y > SLOT_TOP) {
      for (var w = 1; w < SLOTS.length; ++w) {
        var wx = w * W / SLOTS.length
        if (Math.abs(b.x - wx) < BALL_R) { b.x = wx + (b.x < wx ? -BALL_R : BALL_R); b.vx = -b.vx * 0.3 }
      }
    }
    b.vx *= 0.999
    b.vx = Math.max(-5, Math.min(5, b.vx))
  }
  if (b.y > H - BALL_R) {
    var slot = Math.max(0, Math.min(SLOTS.length - 1, Math.floor(b.x / (W / SLOTS.length))))
    s.score = state.score + SLOTS[slot]
    s.landed = state.landed.concat([slot])
    s.last = slot
    s.flash = 1
    s.ball = null
    s.ev = [SLOTS[slot] >= 500 ? "ding" : "click"]; s.evSeq = ++EVN
    return s
  }
  s.ball = b
  if (evs.length) { s.ev = evs; s.evSeq = ++EVN }
  return s
}
