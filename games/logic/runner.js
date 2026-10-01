.pragma library
.import "../../engine/Rng.js" as Rng

// Endless runner. World units: the ground is at y = 0, up is positive, and
// the runner stands at x = RUNNER_X. Obstacles scroll left at `speed`,
// which ramps with distance (like Stack's level speed curve). Holding
// DOWN ducks (and fast-falls mid-air); UP/SPACE jumps.

var RUNNER_X = 0.18
var RUNNER_W = 0.045
var RUNNER_H = 0.11
var DUCK_H = 0.06
var GRAVITY = 3.6
var JUMP_V = 1.25
var FAST_FALL = 6.0
var START_SPEED = 0.42
var MAX_SPEED = 1.1
var VIEW_W = 1.6

function makeState() {
  return { y: 0, vy: 0, ducking: false, speed: START_SPEED, distance: 0, obstacles: [],
    nextGap: 0.9, alive: true, clock: 0 }
}

function copy(s) {
  return { y: s.y, vy: s.vy, ducking: s.ducking, speed: s.speed, distance: s.distance,
    obstacles: s.obstacles, nextGap: s.nextGap, alive: s.alive, clock: s.clock }
}

function jump(state) {
  if (!state.alive || state.y > 0) return state
  var s = copy(state)
  s.vy = JUMP_V
  s.ducking = false
  return s
}

function spawn(speed, distance) {
  var r = Rng.random()
  // Birds only once things are moving; low birds must be jumped, high
  // birds ducked.
  if (distance > 25 && r < 0.28) {
    var high = Rng.random() < 0.55
    return { kind: "bird", x: VIEW_W + 0.1, w: 0.06, h: 0.04, y: high ? 0.075 : 0.02 }
  }
  var n = r < 0.55 ? 1 : (r < 0.85 ? 2 : 3)
  var tall = Rng.random() < 0.4
  return { kind: "cactus", x: VIEW_W + 0.1, w: 0.03 * n + 0.01 * (n - 1), h: tall ? 0.1 : 0.07, y: 0, n: n }
}

// input: { duck: bool }
function step(state, input, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.clock = state.clock + dt
  s.speed = Math.min(MAX_SPEED, START_SPEED + state.distance * 0.0022)
  s.distance = state.distance + s.speed * dt * 10

  var duck = !!input.duck
  var vy = state.vy - (duck && state.y > 0 ? FAST_FALL : GRAVITY) * dt
  var y = state.y + vy * dt
  if (y <= 0) { y = 0; vy = 0 }
  s.y = y; s.vy = vy
  s.ducking = duck && y === 0

  var obs = []
  for (var i = 0; i < state.obstacles.length; ++i) {
    var o = state.obstacles[i]
    var nx = o.x - s.speed * dt
    if (nx + o.w > -0.1) obs.push({ kind: o.kind, x: nx, w: o.w, h: o.h, y: o.y, n: o.n })
  }
  s.nextGap = state.nextGap - s.speed * dt
  if (s.nextGap <= 0) {
    obs.push(spawn(s.speed, s.distance))
    // Gap scales with speed so a jump always fits, with some variety.
    s.nextGap = s.speed * (0.75 + Rng.random() * 0.9)
  }
  s.obstacles = obs

  // Collision with a slightly forgiving hitbox.
  var rh = s.ducking ? DUCK_H : RUNNER_H
  var rx0 = RUNNER_X + 0.008, rx1 = RUNNER_X + RUNNER_W - 0.008
  var ry0 = s.y, ry1 = s.y + rh - 0.008
  for (var k = 0; k < obs.length; ++k) {
    var ob = obs[k]
    if (rx1 > ob.x + 0.004 && rx0 < ob.x + ob.w - 0.004 && ry1 > ob.y + 0.004 && ry0 < ob.y + ob.h - 0.004) {
      s.alive = false
      break
    }
  }
  return s
}

function score(state) { return Math.floor(state.distance) }
