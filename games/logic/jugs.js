.pragma library
.import "meter.js" as Meter
.import "physics.js" as Phys

// Milk Jugs: a side-on carnival stand. Three balls to knock a pyramid of
// jugs clean off their shelf. Set the angle, time the power meter, throw;
// the jugs are small circles with gravity, so a good hit sends the whole
// stack tumbling and a glancing one leaves it standing. Clear the rack for
// a bonus and a bigger pyramid set farther back.

var G = 3.2
var JR = 0.045         // jug radius
var BR = 0.035         // ball radius
var SHELF = 0.0        // shelf height (y up from the shelf)
var FLOOR = -0.6

function rack(level) {
  var rows = Math.min(5, 2 + Math.floor((level + 1) / 2)), out = [], x0 = 1.3 + Math.min(0.5, level * 0.06)
  for (var r = 0; r < rows; ++r)
    for (var i = 0; i < rows - r; ++i)
      out.push({ x: x0 + (i + r / 2) * JR * 2.05, y: JR + r * JR * 1.8, vx: 0, vy: 0, awake: false, out: false, ox: 0, oy: 0 })
  out.forEach(function(j) { j.ox = j.x; j.oy = j.y })
  return out
}

function shelfEnd(level) {
  var rows = Math.min(5, 2 + Math.floor((level + 1) / 2))
  return 1.3 + Math.min(0.5, level * 0.06) + rows * JR * 2.05 + 0.1
}

function makeState(level, total) {
  level = level || 1
  return { level: level, jugs: rack(level), shelf: shelfEnd(level), balls: 3, angle: 0.5, m: 0, mDir: 1, phase: "aim", b: null, settle: 0,
           total: total || 0, down: 0, msg: "", done: false }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function setAngle(s, a) { if (s.phase !== "aim") return s; var o = copy(s); o.angle = clamp(a, 0.05, 1.1); return o }

function throwBall(s) {
  if (s.phase !== "aim" || s.done) return s
  var o = copy(s), v = 1.6 + s.m * 2.4
  o.phase = "fly"; o.settle = 0; o.balls = s.balls - 1
  o.b = { x: 0.1, y: 0.25, vx: v * Math.cos(s.angle), vy: v * Math.sin(s.angle) }
  o.ev = ["thud"]; o.evSeq = (s.evSeq || 0) + 1
  o.jugs = s.jugs.map(function(j) { var c = {}; for (var k in j) c[k] = j[k]; return c })
  return o
}

// True while the two overlap (and bounces them, softly: a ball against glass).
function hit(a, ra, ma, b, rb, mb) { return Phys.collide(a, ra, ma, b, rb, mb, 0.45) >= 0 }

function isDown(j) { return j.out || Math.hypot(j.x - j.ox, j.y - j.oy) > JR * 1.2 }

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  if (state.phase === "aim") {
    var mm = Meter.swing(state.m, state.mDir, dt, 1.1)
    s.m = mm.v; s.mDir = mm.dir
    return s
  }
  if (state.phase !== "fly") return state
  var b = { x: state.b.x, y: state.b.y, vx: state.b.vx, vy: state.b.vy }, evs = []
  var jugs = state.jugs.map(function(j) { var c = {}; for (var k in j) c[k] = j[k]; return c })
  var left = dt, i, k
  while (left > 1e-9) {
    var h = Math.min(1 / 240, left); left -= h
    b.vy -= G * h; b.x += b.vx * h; b.y += b.vy * h
    if (b.y < BR && b.x < state.shelf) { b.y = BR; b.vy = Math.abs(b.vy) * 0.3; b.vx *= 0.97 }
    if (b.y < FLOOR) { b.y = FLOOR; b.vx = 0; b.vy = 0 }
    for (i = 0; i < jugs.length; ++i) {
      var j = jugs[i]
      if (j.out) continue
      if (j.awake) {
        j.vy -= G * h; j.x += j.vx * h; j.y += j.vy * h
        if (j.y < JR && j.x < state.shelf) { j.y = JR; j.vy = Math.abs(j.vy) * 0.2; j.vx *= 0.96 }
        if (j.y < FLOOR + JR) { j.out = true }
      }
      if (hit(b, BR, 3, j, JR, 1)) { if (!j.awake) evs.push("clack"); j.awake = true }
      for (k = 0; k < i; ++k) {
        var q = jugs[k]
        if (q.out) continue
        if ((j.awake || q.awake) && hit(q, JR, 1, j, JR, 1)) { if (!j.awake || !q.awake) evs.push("clack"); j.awake = true; q.awake = true }
      }
    }
    // A resting jug loses its support when what's under it moves.
    for (i = 0; i < jugs.length; ++i) {
      var u = jugs[i]
      if (u.awake || u.out || u.y < JR * 1.5) continue
      var held = false
      for (k = 0; k < jugs.length; ++k) {
        var w = jugs[k]
        if (w !== u && !w.awake && !w.out && w.y < u.y && Math.hypot(w.x - u.x, w.y - u.y) < JR * 2.4) held = true
      }
      if (!held) u.awake = true
    }
  }
  s.b = b; s.jugs = jugs; s.settle = state.settle + dt
  if (evs.length) { s.ev = evs; s.evSeq = (state.evSeq || 0) + 1 }
  var calm = jugs.every(function(j) { return !j.awake || j.out || Math.abs(j.vx) + Math.abs(j.vy) < 0.05 }) && Math.abs(b.vx) + Math.abs(b.vy) < 0.1
  if ((calm && s.settle > 0.6) || s.settle > 5 || b.x > 4) return settle(s)
  return s
}

function settle(s) {
  var o = copy(s), down = s.jugs.filter(isDown).length, gain = (down - s.down) * 10
  o.down = down; o.total = s.total + gain
  o.msg = gain > 0 ? "+" + gain : "NOTHING"
  o.phase = "aim"; o.b = null
  // Freeze fallen jugs where they landed.
  o.jugs = s.jugs.map(function(j) { var c = {}; for (var k in j) c[k] = j[k]; c.awake = false; c.vx = 0; c.vy = 0; return c })
  if (down === s.jugs.length) {
    var bonus = 100 * s.level + o.balls * 50
    var nx = makeState(s.level + 1, o.total + bonus)
    nx.msg = "RACK CLEARED +" + bonus
    nx.ev = ["power"]; nx.evSeq = (s.evSeq || 0) + 1
    return nx
  }
  if (o.balls <= 0) o.done = true
  return o
}

function serialize(s) { return { level: s.level, total: s.total } }
function deserialize(o) { return o && typeof o.level === "number" ? makeState(o.level, o.total || 0) : null }
