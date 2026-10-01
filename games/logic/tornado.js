.pragma library

// Tornado: thirty balls dropped into a spinning storm. Three arms sweep
// around the funnel and a swirl drags everything round it; hold LEFT or
// RIGHT to blow a wind that steers the balls as they fall. They land in the
// slots along the bottom, the middle ones worth the most, and a ball that
// ends in the eye (the centre slot) while the storm is at full strength is
// worth a jackpot.

var BALLS = 30
var W = 1.0
var H = 1.2
var CX = 0.5
var CY = 0.55
var BR = 0.02
var SLOTS = [5, 10, 25, 50, 250, 50, 25, 10, 5]    // nine slots, the eye in the middle
var FLOOR = 1.1
var G = 1.6

function makeState() {
  return { x: 0.5, left: BALLS, balls: [], arm: 0, wind: 0, score: 0, cool: 0, msg: "", log: [], done: false, t: 0, power: 1 }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function slide(s, dx) { var o = copy(s); o.x = clamp(s.x + dx, 0.08, 0.92); return o }
function setWind(s, w) { if (s.wind === w) return s; var o = copy(s); o.wind = w; return o }
function drop(s) {
  if (s.done || s.left <= 0 || s.cool > 0) return s
  var o = copy(s)
  o.balls = s.balls.concat([{ x: s.x, y: 0.04, vx: 0, vy: 0 }]); o.left = s.left - 1; o.cool = 0.35
  o.ev = ["tick"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

// Distance from a point to a segment, with the closest point.
function seg(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
  var qx = ax + dx * t, qy = ay + dy * t
  return { d: Math.hypot(px - qx, py - qy), qx: qx, qy: qy }
}

function armEnds(s, k) {
  var a = s.arm + k * Math.PI * 2 / 3, r = 0.24
  return { ax: CX, ay: CY, bx: CX + Math.cos(a) * r, by: CY + Math.sin(a) * r }
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state), evs = []
  s.t = state.t + dt; s.cool = Math.max(0, state.cool - dt)
  s.arm = state.arm + dt * 2.6
  var balls = [], i, k
  state.balls.forEach(function(b) {
    var p = { x: b.x, y: b.y, vx: b.vx, vy: b.vy }
    p.vy += G * dt
    p.vx += state.wind * 0.9 * dt
    // Swirl: a push around the eye that fades with distance.
    var dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy)
    if (d < 0.3 && d > 0.001) { var f = (0.3 - d) / 0.3; p.vx += -dy / d * 1.2 * f * dt; p.vy += dx / d * 0.6 * f * dt }
    p.x += p.vx * dt; p.y += p.vy * dt
    for (k = 0; k < 3; ++k) {
      var e = armEnds(s, k), r = seg(p.x, p.y, e.ax, e.ay, e.bx, e.by)
      if (r.d < BR + 0.012 && r.d > 0) {
        var nx = (p.x - r.qx) / r.d, ny = (p.y - r.qy) / r.d, vn = p.vx * nx + p.vy * ny
        p.x = r.qx + nx * (BR + 0.012); p.y = r.qy + ny * (BR + 0.012)
        if (vn < 0) { p.vx -= 1.7 * vn * nx; p.vy -= 1.7 * vn * ny }
        evs.push("tick")
        // The arm's own motion kicks the ball along.
        var tx = -(r.qy - CY), ty = r.qx - CX
        p.vx += tx * 2.6 * 0.5; p.vy += ty * 2.6 * 0.5
      }
    }
    if (p.x < BR) { p.x = BR; p.vx = Math.abs(p.vx) * 0.6 }
    if (p.x > W - BR) { p.x = W - BR; p.vx = -Math.abs(p.vx) * 0.6 }
    if (p.y >= FLOOR) {
      var slot = clamp(Math.floor(p.x / W * SLOTS.length), 0, SLOTS.length - 1)
      var v = SLOTS[slot]
      s.score += v; s.msg = (v >= 250 ? "THE EYE! " : "") + "+" + v
      s.log = s.log.concat([v]).slice(-12)
      evs.push(v >= 250 ? "ding" : v >= 50 ? "coin" : "click")
      return
    }
    balls.push(p)
  })
  s.balls = balls
  if (evs.length) { s.ev = evs; s.evSeq = (state.evSeq || 0) + 1 }
  if (s.left <= 0 && balls.length === 0) s.done = true
  return s
}

function serialize(s) { return null }
function deserialize(o) { return null }
