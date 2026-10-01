.pragma library
.import "meter.js" as Meter
.import "../../engine/Rng.js" as Rng

// Ring Toss: twelve rings, a table of bottles, the far ones worth more.
// Slide the aim across; a marker sweeps toward the back and forth, and the
// ring lands wherever it is when you throw, give or take a wobble that grows
// with distance. A ring that lands over a neck scores; one that clips the
// glass bounces off.

var RINGS = 12
var NECK = 0.03        // within this of a bottle's centre: on
var CLIP = 0.065       // within this: a bounce

function bottles() {
  var out = [], r, i
  var rows = [[5, 0.3, 10], [4, 0.52, 25], [3, 0.74, 50]]
  for (r = 0; r < rows.length; ++r)
    for (i = 0; i < rows[r][0]; ++i) out.push({ x: (i + 0.5) / rows[r][0] * 0.84 + 0.08, y: rows[r][1], pts: rows[r][2], on: false })
  out.push({ x: 0.5, y: 0.92, pts: 100, on: false })
  return out
}

function makeState() {
  return { bottles: bottles(), rings: RINGS, ax: 0.5, m: 0.5, mDir: 1, phase: "aim", fly: null, msg: "", total: 0, hits: 0, done: false, sweep: 0.9 }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// The marker's depth: 0.12 (front of the table) to 1.0 (back).
function depth(m) { return 0.12 + m * 0.88 }

function aim(s, x) { if (s.phase !== "aim") return s; var o = copy(s); o.ax = clamp(x, 0.05, 0.95); return o }

function gauss() { return (Rng.random() + Rng.random() + Rng.random() - 1.5) * 0.8 }

function toss(s) {
  if (s.phase !== "aim" || s.done) return s
  var o = copy(s), d = depth(s.m), wob = 0.006 + 0.014 * d
  o.phase = "fly"
  o.fly = { x: s.ax + gauss() * wob, y: d + gauss() * wob, t: 0 }
  o.rings = s.rings - 1
  o.ev = ["tick"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function land(s) {
  var o = copy(s), f = s.fly, best = -1, bd = 9
  for (var i = 0; i < s.bottles.length; ++i) {
    var b = s.bottles[i], d = Math.hypot(b.x - f.x, (b.y - f.y) * 0.8)
    if (d < bd) { bd = d; best = i }
  }
  o.bottles = s.bottles.map(function(b) { return { x: b.x, y: b.y, pts: b.pts, on: b.on } })
  o.msg = "MISS"
  if (bd < NECK && !s.bottles[best].on) {
    o.bottles[best].on = true
    o.total = s.total + s.bottles[best].pts; o.hits = s.hits + 1
    o.msg = "RINGER! +" + s.bottles[best].pts
  } else if (bd < NECK) o.msg = "ALREADY HAS ONE"
  else if (bd < CLIP) o.msg = "CLIPPED THE GLASS"
  o.phase = "aim"; o.fly = null
  o.ev = [o.msg.indexOf("RINGER") === 0 ? "ding" : o.msg === "CLIPPED THE GLASS" ? "clack" : "thud"]; o.evSeq = (s.evSeq || 0) + 1
  if (o.bottles.every(function(b) { return b.on })) { o.total += 200; o.msg = "TABLE CLEARED +200"; o.done = true }
  else if (o.rings <= 0) o.done = true
  return o
}

function step(state, dt) {
  if (state.done && state.phase !== "fly") return state
  var s = copy(state)
  if (state.phase === "aim") {
    var mm = Meter.swing(state.m, state.mDir, dt, state.sweep)
    s.m = mm.v; s.mDir = mm.dir
    return s
  }
  if (state.phase === "fly") {
    s.fly = { x: state.fly.x, y: state.fly.y, t: state.fly.t + dt }
    if (s.fly.t >= 0.5) return land(s)
  }
  return s
}
