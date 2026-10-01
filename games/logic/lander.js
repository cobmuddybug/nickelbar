.pragma library
.import "../../engine/Rng.js" as Rng

// Lunar Lander on a 4:3 field (W x 1). Rotate with LEFT/RIGHT, burn with
// UP or SPACE, set down gently on a flat pad. Narrow pads pay more. Fuel is
// the whole game: a landing tops it up a little, a crash costs a chunk,
// and when it runs dry the next touchdown is the last.
//
// Pure logic, like asteroids.js: step() returns a new state every tick.

var W = 4 / 3
var H = 1
var GRAVITY = 0.055          // units/s^2
var THRUST = 0.13
var TURN_SPEED = 2.6         // rad/s
var MAX_TILT = Math.PI * 0.55
var BURN_RATE = 9            // fuel per second of thrust
var START_FUEL = 1000
var CRASH_COST = 200
var SAFE_VY = 0.045
var SAFE_VX = 0.03
var SAFE_TILT = 0.2          // radians either side of upright
var SHIP_H = 0.022           // centre to feet
var SHIP_W = 0.018           // half the leg span

// Terrain: jagged ridge line with flat pads cut in. Each pad is a segment
// { x0, x1, y, mult } lying exactly on the ridge.
function makeTerrain(round) {
  var n = 48
  var pts = []
  var y = 0.72 + Rng.random() * 0.12
  for (var i = 0; i <= n; ++i) {
    y += (Rng.random() - 0.5) * 0.14
    y = Math.max(0.45, Math.min(0.95, y))
    pts.push({ x: i / n * W, y: y })
  }
  // Pads: wide x2, medium x3, narrow x5 (narrower with each round).
  var shrink = Math.max(0.6, 1 - (round - 1) * 0.06)
  var widths = [{ w: 5, m: 2 }, { w: 3, m: 3 }, { w: 2, m: 5 }]
  var used = {}
  var pads = []
  for (var p = 0; p < widths.length; ++p) {
    var span = Math.max(1, Math.round(widths[p].w * shrink))
    for (var tries = 0; tries < 60; ++tries) {
      var start = 1 + Math.floor(Rng.random() * (n - span - 1))
      var clash = false
      for (var k = start - 2; k <= start + span + 2; ++k) if (used[k]) clash = true
      if (clash) continue
      var py = pts[start].y
      for (var j = start; j <= start + span; ++j) { pts[j] = { x: pts[j].x, y: py }; used[j] = true }
      pads.push({ x0: pts[start].x, x1: pts[start + span].x, y: py, mult: widths[p].m })
      break
    }
  }
  return { pts: pts, pads: pads }
}

function groundAt(terrain, x) {
  var pts = terrain.pts
  if (x <= 0) return pts[0].y
  if (x >= W) return pts[pts.length - 1].y
  var seg = W / (pts.length - 1)
  var i = Math.min(pts.length - 2, Math.floor(x / seg))
  var t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x)
  return pts[i].y + (pts[i + 1].y - pts[i].y) * t
}

function padUnder(terrain, x0, x1) {
  for (var i = 0; i < terrain.pads.length; ++i) {
    var p = terrain.pads[i]
    if (x0 >= p.x0 - 0.002 && x1 <= p.x1 + 0.002) return p
  }
  return null
}

function freshShip() {
  var left = Rng.random() < 0.5
  return { x: left ? 0.12 : W - 0.12, y: 0.1, vx: (left ? 1 : -1) * (0.05 + Rng.random() * 0.04), vy: 0, a: 0 }
}

function makeState() {
  return { round: 1, score: 0, fuel: START_FUEL, terrain: makeTerrain(1), ship: freshShip(),
    phase: "fly", timer: 0, result: null, burning: false, alive: true, landings: 0, sparks: [] }
}

function copy(s) {
  return { round: s.round, score: s.score, fuel: s.fuel, terrain: s.terrain, ship: s.ship, phase: s.phase,
    timer: s.timer, result: s.result, burning: s.burning, alive: s.alive, landings: s.landings, sparks: s.sparks }
}

function altitude(s) { return Math.max(0, groundAt(s.terrain, s.ship.x) - s.ship.y - SHIP_H) }

function burst(n, x, y) {
  var out = []
  for (var i = 0; i < n; ++i) {
    var a = -Rng.random() * Math.PI, sp = 0.05 + Rng.random() * 0.25
    out.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Rng.random() * 0.8 })
  }
  return out
}

function nextRound(s) {
  var n = copy(s)
  n.round = s.round + 1
  n.terrain = makeTerrain(n.round)
  n.ship = freshShip()
  n.phase = "fly"
  n.timer = 0
  n.result = null
  n.sparks = []
  return n
}

// input: { turn: -1|0|1, burn: bool }
function step(state, input, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.sparks = state.sparks.map(function(p) {
    return { x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx, vy: p.vy + GRAVITY * dt, life: p.life - dt }
  }).filter(function(p) { return p.life > 0 })

  if (state.phase !== "fly") {
    s.timer = state.timer + dt
    if (s.timer > 2.4) {
      if (s.fuel <= 0) { s.alive = false; return s }
      return nextRound(s)
    }
    return s
  }

  var sh = state.ship
  var a = Math.max(-MAX_TILT, Math.min(MAX_TILT, sh.a + (input.turn || 0) * TURN_SPEED * dt))
  var burning = !!input.burn && state.fuel > 0
  var vx = sh.vx, vy = sh.vy + GRAVITY * dt
  if (burning) {
    vx += Math.sin(a) * THRUST * dt
    vy -= Math.cos(a) * THRUST * dt
    s.fuel = Math.max(0, state.fuel - BURN_RATE * dt)
  }
  var x = sh.x + vx * dt, y = sh.y + vy * dt
  // Off the side: wrap, as the classic does.
  if (x < 0) x += W
  if (x >= W) x -= W
  if (y < -0.3) { y = -0.3; vy = Math.max(0, vy) }
  s.ship = { x: x, y: y, vx: vx, vy: vy, a: a }
  s.burning = burning

  // Touchdown: both feet, or anything, below the ridge.
  var gl = groundAt(state.terrain, x - SHIP_W), gr = groundAt(state.terrain, x + SHIP_W)
  var gc = groundAt(state.terrain, x)
  var feet = y + SHIP_H
  if (feet >= Math.min(gl, gr, gc)) {
    var pad = padUnder(state.terrain, x - SHIP_W, x + SHIP_W)
    var gentle = Math.abs(vy) <= SAFE_VY && Math.abs(vx) <= SAFE_VX && Math.abs(a) <= SAFE_TILT
    s.burning = false
    s.phase = "landed"
    s.timer = 0
    if (pad && gentle) {
      var soft = Math.abs(vy) < SAFE_VY * 0.5 && Math.abs(vx) < SAFE_VX * 0.5
      var pts = (soft ? 50 : 25) * pad.mult
      s.score = state.score + pts
      s.fuel = s.fuel + 50 * pad.mult
      s.landings = state.landings + 1
      s.ship = { x: x, y: pad.y - SHIP_H, vx: 0, vy: 0, a: 0 }
      s.result = { ok: true, text: (soft ? "PERFECT LANDING" : "LANDED") + "  +" + pts, mult: pad.mult }
    } else {
      s.fuel = Math.max(0, s.fuel - CRASH_COST)
      s.ship = { x: x, y: Math.min(y, gc - SHIP_H), vx: 0, vy: 0, a: a }
      s.sparks = s.sparks.concat(burst(40, x, gc - 0.005))
      var why = !pad ? "NOT ON A PAD" : Math.abs(vy) > SAFE_VY ? "TOO FAST" : Math.abs(vx) > SAFE_VX ? "DRIFTING" : "NOT LEVEL"
      s.result = { ok: false, text: "CRASHED · " + why + "  -" + CRASH_COST + " FUEL" }
      s.phase = "crashed"
    }
  }
  return s
}

function serialize(s) {
  return { round: s.round, score: s.score, fuel: s.fuel, landings: s.landings, alive: s.alive }
}

// Resumes with the same score and fuel over fresh terrain.
function deserialize(o) {
  if (!o || typeof o.score !== "number" || o.alive === false || !(o.fuel > 0)) return null
  var s = makeState()
  s.round = o.round || 1
  s.score = o.score
  s.fuel = o.fuel
  s.landings = o.landings || 0
  s.terrain = makeTerrain(s.round)
  return s
}
