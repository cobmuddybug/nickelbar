.pragma library
.import "meter.js" as Meter
.import "physics.js" as Phys

// Bowling: ten frames, a lane position, an aim, a spin and a power meter.
// The throw is a small physics run: a heavy ball (with a late hook from the
// spin) against ten pins that knock each other about. The lane is 1 unit
// wide with gutters outside it, the foul line at y = 0 and the head pin at
// y = HEAD; pins that move fast enough when hit count as down.

var LANE = 0.5          // half the lane width
var HEAD = 5.2
var END = 7.0
var BALL_R = 0.11
var PIN_R = 0.05
var SUB = 1 / 240

function pinSpots() {
  var out = []
  for (var r = 0; r < 4; ++r)
    for (var i = 0; i <= r; ++i) out.push({ x: (i - r / 2) * 0.29, y: HEAD + r * 0.25 })
  return out
}
var SPOTS = pinSpots()

function freshPins() {
  return SPOTS.map(function(p) { return { x: p.x, y: p.y, vx: 0, vy: 0, down: false, gone: false } })
}

function makeState() {
  return {
    rolls: [], frame: 1, ball: 1, standing: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    phase: "place", x: 0, angle: 0, spin: 0, meter: 0, meterDir: 1,
    pins: freshPins(), b: null, settle: 0, last: -1, done: false
  }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function setX(s, v) { if (s.phase !== "place") return s; var o = copy(s); o.x = clamp(v, -0.4, 0.4); return o }
function setAngle(s, v) { if (s.phase !== "aim" && s.phase !== "place") return s; var o = copy(s); o.angle = clamp(v, -0.16, 0.16); return o }
function setSpin(s, v) { if (s.phase !== "place" && s.phase !== "aim") return s; var o = copy(s); o.spin = clamp(v, -1, 1); return o }

// Space: lock position, lock aim, then release on the meter.
function advance(s) {
  if (s.done) return s
  var o = copy(s)
  o.ev = ["click"]; o.evSeq = (s.evSeq || 0) + 1
  if (s.phase === "place") { o.phase = "aim"; return o }
  if (s.phase === "aim") { o.phase = "power"; o.meter = 0; o.meterDir = 1; return o }
  if (s.phase === "power") return launch(s, s.meter)
  return s
}

function launch(s, power) {
  var o = copy(s)
  var v = 3.2 + clamp(power, 0, 1) * 3.8
  o.b = { x: s.x, y: 0, vx: v * Math.sin(s.angle), vy: v * Math.cos(s.angle), gutter: false, gone: false }
  o.pins = s.pins.map(function(p) { return { x: p.x, y: p.y, vx: 0, vy: 0, down: false, gone: false } })
  o.phase = "roll"; o.settle = 0
  o.ev = ["thud"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

// Did a and b collide hard enough (closing speed above `hard`) to knock something down?
function collide(a, ra, ma, b, rb, mb, hard) { return Phys.collide(a, ra, ma, b, rb, mb, 0.75) > hard }

function step(state, dt) {
  if (state.done) return state
  if (state.phase === "power") {
    var o = copy(state)
    var mm = Meter.swing(state.meter, state.meterDir, dt, 1.15)
    o.meter = mm.v; o.meterDir = mm.dir
    return o
  }
  if (state.phase !== "roll") return state
  var s = copy(state)
  var b = { x: state.b.x, y: state.b.y, vx: state.b.vx, vy: state.b.vy, gutter: state.b.gutter, gone: state.b.gone }
  var pins = state.pins.map(function(p) { return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, down: p.down, gone: p.gone } })
  var left = dt, evs = []
  while (left > 1e-9) {
    var h = Math.min(SUB, left); left -= h
    if (!b.gone) {
      if (!b.gutter && b.y > 0.3 && b.y < 4.6) b.vx += state.spin * 0.8 * h
      b.x += b.vx * h; b.y += b.vy * h
      if (!b.gutter && Math.abs(b.x) > LANE + 0.02 && b.y < HEAD - 0.4) { b.gutter = true; b.vx = 0; b.x = (b.x < 0 ? -1 : 1) * 0.62 }
      if (b.gutter) b.x = (b.x < 0 ? -1 : 1) * 0.62
      if (b.y > END + 0.5) b.gone = true
    }
    for (var i = 0; i < 10; ++i) {
      var p = pins[i]
      if (p.gone) continue
      p.x += p.vx * h; p.y += p.vy * h
      var f = Math.exp(-1.6 * h); p.vx *= f; p.vy *= f
      if (p.y > END || Math.abs(p.x) > 0.75) { p.gone = true; p.down = true }
      if (!b.gone && !b.gutter && collide(b, BALL_R, 6, p, PIN_R, 1, 0)) { p.down = true; evs.push("clack") }
      for (var j = 0; j < i; ++j) {
        var q = pins[j]
        if (q.gone) continue
        var hit = collide(q, PIN_R, 1, p, PIN_R, 1, 0.12)
        if (hit) { p.down = true; q.down = true; evs.push("clack") }
      }
    }
  }
  s.b = b; s.pins = pins; s.settle = state.settle + dt
  if (evs.length) { s.ev = evs; s.evSeq = (state.evSeq || 0) + 1 }
  var calm = pins.every(function(p) { return p.gone || Math.abs(p.vx) + Math.abs(p.vy) < 0.06 })
  if ((b.gone || Math.abs(b.vy) < 0.3) && (calm || s.settle > 6)) return finishRoll(s)
  if (s.settle > 9) return finishRoll(s)
  return s
}

function finishRoll(s) {
  var o = copy(s)
  var down = 0, still = []
  for (var i = 0; i < 10; ++i) {
    if (s.standing.indexOf(i) < 0) continue
    var p = s.pins[i]
    if (p.down || p.gone || Math.hypot(p.x - SPOTS[i].x, p.y - SPOTS[i].y) > 0.06) down++
    else still.push(i)
  }
  var rolls = s.rolls.concat([down])
  o.rolls = rolls; o.last = down
  if (down === s.standing.length && down > 0) { o.ev = ["ding"]; o.evSeq = (s.evSeq || 0) + 1 }
  var frame = s.frame, ball = s.ball, reset = false, done = false
  if (frame < 10) {
    if (ball === 1 && down === s.standing.length) { frame++; ball = 1; reset = true }
    else if (ball === 1) ball = 2
    else { frame++; ball = 1; reset = true }
  } else {
    var swept = still.length === 0
    if (ball === 1) { ball = 2; if (swept) reset = true }
    else if (ball === 2) {
      var b1 = rolls[rolls.length - 2]
      if (b1 === 10 || swept) { ball = 3; if (swept) reset = true }
      else done = true
    } else done = true
  }
  o.frame = frame; o.ball = ball; o.done = done
  o.standing = reset || done ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : still
  var keep = o.standing
  o.pins = freshPins().map(function(p, i) { if (keep.indexOf(i) < 0) p.gone = true; return p })
  o.b = null; o.phase = "place"
  return o
}

// Standard scoring over a flat roll list. Returns { frames: [{rolls, total}], total }.
function tally(rolls) {
  var frames = [], i = 0, total = 0
  for (var f = 1; f <= 10; ++f) {
    if (i >= rolls.length) break
    var r1 = rolls[i], fr = { rolls: [r1], total: null }
    if (f < 10) {
      if (r1 === 10) {
        fr.rolls = [10]
        if (i + 2 < rolls.length) { total += 10 + rolls[i + 1] + rolls[i + 2]; fr.total = total }
        i += 1
      } else {
        if (i + 1 < rolls.length) {
          var r2 = rolls[i + 1]; fr.rolls = [r1, r2]
          if (r1 + r2 === 10) { if (i + 2 < rolls.length) { total += 10 + rolls[i + 2]; fr.total = total } }
          else { total += r1 + r2; fr.total = total }
        }
        i += 2
      }
    } else {
      fr.rolls = rolls.slice(i, i + 3)
      var sum = fr.rolls.reduce(function(a, b) { return a + b }, 0)
      var need = (r1 === 10 || (fr.rolls.length > 1 && r1 + fr.rolls[1] === 10)) ? 3 : 2
      if (fr.rolls.length >= need) { total += sum; fr.total = total }
      i += need
    }
    frames.push(fr)
  }
  var running = 0
  frames.forEach(function(x) { if (x.total !== null) running = x.total })
  return { frames: frames, total: running }
}

function score(s) { return tally(s.rolls).total }

// Display marks for one frame: ["X"], ["7", "/"], ["9", "-"], ...
function marks(fr, tenth) {
  var out = [], open = null          // open: the first ball of a pair still waiting for its second
  for (var i = 0; i < fr.rolls.length; ++i) {
    var r = fr.rolls[i]
    if (r === 10 && open === null) { out.push("X"); continue }
    if (open !== null) {
      out.push(open + r === 10 ? "/" : r === 0 ? "-" : String(r))
      open = null
    } else {
      out.push(r === 0 ? "-" : String(r))
      open = r
    }
  }
  return out
}

function serialize(s) { return { rolls: s.rolls, frame: s.frame, ball: s.ball, standing: s.standing, x: s.x, angle: s.angle, spin: s.spin, done: s.done } }
function deserialize(o) {
  if (!o || !Array.isArray(o.rolls) || !Array.isArray(o.standing)) return null
  var s = makeState()
  s.rolls = o.rolls; s.frame = o.frame; s.ball = o.ball; s.standing = o.standing
  s.x = o.x || 0; s.angle = o.angle || 0; s.spin = o.spin || 0; s.done = !!o.done
  s.pins = freshPins().map(function(p, i) { if (s.standing.indexOf(i) < 0) p.gone = true; return p })
  return s
}
