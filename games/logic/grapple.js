.pragma library
.import "../../engine/Rng.js" as Rng

// Grapple (after Floating Point). Swing rightward under an endless
// ceiling. Hold to shoot a line up and ahead; it catches on the ceiling
// and you swing; let go to fly. Push with LEFT/RIGHT to pump the swing,
// UP/DOWN to reel the line in or pay it out. Gaps in the ceiling have nothing
// to catch, spikes rise from the floor, and the floor itself is the end.
// Score is metres travelled plus ten per orb.
//
// Units: the view is VIEW_W × H, y down; x grows forever. The world is a
// column per unit of x: ceil[i] is the ceiling's underside (or NONE for a
// gap), spike[i] the top of a floor spike (or H for none).

var H = 12
var VIEW_W = 20
var R = 0.3
var G = 17
var MAX_LINE = 10
var REEL = 2.2
var MIN_LINE = 1.2
var PUMP = 7
var DRIFT = 2.5
var NONE = -99

function makeWorld() { return { ceil: [], spike: [], orbs: [], gen: 0, h: 2.5, gapLeft: 0, spikeLeft: 0, spikeH: 0 } }

function genTo(w, x) {
  while (w.gen < x) {
    var i = w.gen++
    var far = i / 400
    if (w.gapLeft > 0) { w.gapLeft--; w.ceil.push(NONE) }
    else {
      if (i > 25 && Rng.random() < 0.035 + far * 0.03) w.gapLeft = 2 + Math.floor(Rng.random() * (3 + far * 3))
      w.h = Math.max(0.8, Math.min(5.5, w.h + (Rng.random() - 0.5) * 1.1))
      w.ceil.push(w.h)
    }
    // Spikes come in short runs of the same height.
    if (w.spikeLeft <= 0 && i > 20 && Rng.random() < 0.04 + far * 0.03) {
      w.spikeLeft = 1 + Math.floor(Rng.random() * 3)
      w.spikeH = 1 + Rng.random() * Math.min(4, 1.5 + far * 2)
    }
    w.spike.push(w.spikeLeft > 0 ? H - w.spikeH : H)
    w.spikeLeft--
    if (i > 12 && i % 9 === 0 && Rng.random() < 0.6) {
      var cy = 6 + Rng.random() * 2.5
      for (var k = 0; k < 4; ++k) w.orbs.push({ x: i + k * 0.9, y: cy - Math.sin(k / 3 * Math.PI) * 1.2, got: false })
    }
  }
}

function ceilAt(w, x) { var i = Math.floor(x); return i >= 0 && i < w.ceil.length ? w.ceil[i] : 2 }
function spikeAt(w, x) { var i = Math.floor(x); return i >= 0 && i < w.spike.length ? w.spike[i] : H }

function makeState() {
  var w = makeWorld()
  genTo(w, VIEW_W + 10)
  for (var i = 0; i < 12; ++i) { w.ceil[i] = 2; w.spike[i] = H }
  var s = {
    w: w, p: { x: 3, y: 6, vx: 5, vy: 0 }, line: null, target: null, started: false,
    camX: 0, dist: 0, orbs: 0, dead: false, t: 0, holding: false, missT: 0, missTo: null
  }
  return s
}

// Where a line fired from (x, y) at angle a catches, or null.
function cast(w, x, y, a) {
  var dx = Math.cos(a), dy = Math.sin(a)
  for (var d = 0.2; d <= MAX_LINE; d += 0.08) {
    var px = x + dx * d, py = y + dy * d
    var c = ceilAt(w, px)
    if (c !== NONE && py <= c) return { x: px, y: c, len: d }
    if (py < -1) return null
  }
  return null
}

function shallow(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

// The grab point the line would take: aiming up and forward (about 55°)
// by default, and fanning out either side of that until something's in
// reach. With `want` (the mouse), aim that way instead.
var PREFERRED = -0.95
function autoAim(w, x, y, want) {
  var base = want === undefined || want === null ? PREFERRED : want
  for (var k = 0; k <= 30; ++k) {
    var off = Math.ceil(k / 2) * 0.08 * (k % 2 ? 1 : -1), a = base + off
    if (a > -0.15 || a < -3.0) continue
    var hit = cast(w, x, y, a)
    if (hit) { hit.a = a; return hit }
  }
  return null
}

// input: { hold, dx (pump the swing / drift), dy (-1 reel in, +1 pay out),
// aim (mouse angle, or null for auto) }.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state), w = s.w
  s.t += dt
  s.missT = Math.max(0, s.missT - dt)
  var p = { x: s.p.x, y: s.p.y, vx: s.p.vx, vy: s.p.vy }
  s.target = s.line ? null : autoAim(w, p.x, p.y, input.aim)
  // Everything waits for the first grab.
  if (!s.started) { if (!input.hold) return s; s.started = true }

  if (input.hold && !state.holding && !state.line) {
    if (s.target) s.line = { x: s.target.x, y: s.target.y, len: s.target.len }
    else { var ma = input.aim === undefined || input.aim === null ? PREFERRED : input.aim; s.missT = 0.25; s.missTo = { x: p.x + Math.cos(ma) * MAX_LINE, y: p.y + Math.sin(ma) * MAX_LINE } }
  }
  if (!input.hold) s.line = null
  s.holding = !!input.hold
  var dy = input.dy || 0
  if (s.line && dy) s.line = { x: s.line.x, y: s.line.y, len: Math.max(MIN_LINE, Math.min(MAX_LINE, s.line.len + dy * REEL * dt)) }

  // LEFT/RIGHT: on the line, push along the swing (pumping); in the air, a
  // little drift.
  var dxIn = input.dx || 0
  if (dxIn) {
    if (s.line) {
      var rx = p.x - s.line.x, ry = p.y - s.line.y, rl = Math.sqrt(rx * rx + ry * ry) || 1
      var tx = -ry / rl, ty = rx / rl
      if (tx * dxIn < 0) { tx = -tx; ty = -ty }
      p.vx += tx * PUMP * dt; p.vy += ty * PUMP * dt
    } else p.vx += dxIn * DRIFT * dt
  }

  var n = 4, h = dt / n
  for (var k = 0; k < n; ++k) {
    p.vy += G * h
    p.x += p.vx * h; p.y += p.vy * h
    if (s.line) {
      var dx = p.x - s.line.x, dy = p.y - s.line.y, d = Math.sqrt(dx * dx + dy * dy)
      if (d > s.line.len) {
        var nx = dx / d, ny = dy / d
        p.x = s.line.x + nx * s.line.len; p.y = s.line.y + ny * s.line.len
        var vr = p.vx * nx + p.vy * ny
        if (vr > 0) { p.vx -= vr * nx; p.vy -= vr * ny }
      }
    }
    // Ceiling: bump off it.
    var c = ceilAt(w, p.x)
    if (c !== NONE && p.y - R < c) { p.y = c + R; if (p.vy < 0) p.vy = -p.vy * 0.3 }
  }
  p.vx *= Math.pow(0.995, dt * 60)
  s.p = p

  if (p.y + R > H || p.y + R > spikeAt(w, p.x - R * 0.6) || p.y + R > spikeAt(w, p.x + R * 0.6)) { s.dead = true; s.line = null }
  var got = 0
  for (var o = 0; o < w.orbs.length; ++o) {
    var orb = w.orbs[o]
    if (!orb.got && Math.abs(orb.x - p.x) < 0.55 && Math.abs(orb.y - p.y) < 0.55) { orb.got = true; got++ }
  }
  s.orbs += got
  s.dist = Math.max(state.dist, Math.floor(p.x - 3))
  s.camX = Math.max(state.camX, p.x - VIEW_W * 0.35)
  genTo(w, Math.ceil(s.camX + VIEW_W + 10))
  return s
}

function score(s) { return s.dist + s.orbs * 10 }
