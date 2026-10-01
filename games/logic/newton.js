.pragma library

// Newton's Apples: fifty apples, a dispenser you slide along the top, and a
// big rotating wheel with six cups on its rim. An apple that falls into a
// cup rides it round; when the cup swings past the bottom it tips out and
// pays its value for each apple inside. Fill the jackpot cup, three apples
// deep, for a bonus. Apples that hit the wheel's hub just bounce off.

var APPLES = 50
var CX = 0.5
var CY = 0.68
var RW = 0.22          // cup ring radius
var RD = 0.17          // hub radius
var AR = 0.017
var CUP_R = 0.05
var G = 1.7
var VALUES = [10, 20, 10, 50, 20, 100]     // the last is the jackpot cup

function makeState() {
  var cups = VALUES.map(function(v, i) { return { value: v, jackpot: i === 5, n: 0, a: i / 6 * Math.PI * 2 } })
  return { x: 0.5, left: APPLES, wheel: 0, dir: 1, cups: cups, apples: [], score: 0, caught: 0, missed: 0, dumped: 0, cool: 0, msg: "", done: false, t: 0 }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function omega(s) { return (0.8 + (APPLES - s.left) * 0.012) * s.dir }
function cupPos(s, i) { var a = s.cups[i].a + s.wheel; return { x: CX + Math.cos(a) * RW, y: CY + Math.sin(a) * RW, a: a } }

function slide(s, dx) { var o = copy(s); o.x = clamp(s.x + dx, 0.06, 0.94); return o }

function drop(s) {
  if (s.done || s.left <= 0 || s.cool > 0) return s
  var o = copy(s)
  o.apples = s.apples.concat([{ x: s.x, y: 0.05, vx: 0, vy: 0 }]); o.left = s.left - 1; o.cool = 0.3
  o.ev = ["tick"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state), evs = []
  s.t = state.t + dt; s.cool = Math.max(0, state.cool - dt)
  var prevWheel = state.wheel
  s.wheel = state.wheel + omega(state) * dt
  s.cups = state.cups.map(function(c) { return { value: c.value, jackpot: c.jackpot, n: c.n, a: c.a } })
  var apples = [], captured = 0, missed = 0, hit
  state.apples.forEach(function(a) {
    var p = { x: a.x, y: a.y, vx: a.vx, vy: a.vy + G * dt }
    p.x += p.vx * dt; p.y += p.vy * dt
    // Into a cup?
    var got = false
    for (var i = 0; i < 6 && !got; ++i) {
      var cp = cupPos(s, i)
      if (Math.hypot(p.x - cp.x, p.y - cp.y) < CUP_R && cp.y < CY + RW * 0.55) { s.cups[i].n += 1; got = true; captured++; evs.push("pop") }
    }
    if (got) return
    // The hub.
    var dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy)
    if (d < RD + AR) {
      var nx = dx / d, ny = dy / d, vn = p.vx * nx + p.vy * ny
      p.x = CX + nx * (RD + AR); p.y = CY + ny * (RD + AR)
      if (vn < 0) { p.vx -= 1.5 * vn * nx; p.vy -= 1.5 * vn * ny }
      p.vx += -ny * omega(s) * 0.25
    }
    if (p.y > 1.12) { missed++; return }
    apples.push(p)
  })
  s.apples = apples; s.caught = state.caught + captured; s.missed = state.missed + missed
  // Cups tip out as they pass the bottom (angle pi/2).
  for (var k = 0; k < 6; ++k) {
    var a0 = ((state.cups[k].a + prevWheel) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    var a1 = ((s.cups[k].a + s.wheel) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    var target = Math.PI / 2, crossed = state.dir > 0 ? (a0 < target && a1 >= target) : (a0 > target && a1 <= target)
    if (crossed && s.cups[k].n > 0) {
      var c = s.cups[k], gain = c.n * c.value + (c.jackpot && c.n >= 3 ? 500 : 0)
      s.score += gain; s.dumped += c.n
      evs.push(c.jackpot && c.n >= 3 ? "ding" : "coin")
      s.msg = (c.jackpot && c.n >= 3 ? "JACKPOT! " : "") + "+" + gain
      c.n = 0
    }
  }
  if (evs.length) { s.ev = evs; s.evSeq = (state.evSeq || 0) + 1 }
  if (s.left <= 0 && s.apples.length === 0) {
    // Whatever is still riding pays out too.
    s.cups.forEach(function(c) { s.score += c.n * c.value; s.dumped += c.n; c.n = 0 })
    s.done = true
  }
  return s
}

function serialize(s) { return null }
function deserialize(o) { return null }
