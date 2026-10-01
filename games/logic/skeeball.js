.pragma library
.import "../../engine/Rng.js" as Rng

// Skee-ball as a two-meter timing game. Each of the nine balls goes:
//   aim   — a needle sweeps left/right; SPACE locks it
//   power — a bar fills and drains; SPACE locks it
//   roll  — the ball travels up the lane (animation only)
//   score — shows what it landed in, then the next ball
// Board coordinates: x 0..1 across, y 0 (back wall) .. 1 (ramp lip). The
// landing point comes from the two meters plus a little wobble, then maps
// to the arcade's rings (10-50) and the two 100 pockets in the top corners.

var BALLS = 9
var CENTER = { x: 0.5, y: 0.38 }
var RINGS = [{ r: 0.065, pts: 50 }, { r: 0.13, pts: 40 }, { r: 0.2, pts: 30 }, { r: 0.28, pts: 20 }]
var POCKETS = [{ x: 0.13, y: 0.1 }, { x: 0.87, y: 0.1 }]
var POCKET_R = 0.055
var FIELD_Y = 0.72  // shorter than this and the ball drops in the 10 gutter
var ROLL_TIME = 1.1

function makeState() {
  return { phase: "aim", ball: 1, score: 0, aim: 0, power: 0, t: 0, lockedAim: 0, lockedPower: 0,
    landing: null, lastPts: 0, throws: [], done: false }
}

function copy(s) {
  return { phase: s.phase, ball: s.ball, score: s.score, aim: s.aim, power: s.power, t: s.t,
    lockedAim: s.lockedAim, lockedPower: s.lockedPower, landing: s.landing, lastPts: s.lastPts,
    throws: s.throws, done: s.done }
}

// Meters speed up a little with each ball.
function meterSpeed(ball) { return 1.6 + ball * 0.08 }

function scoreAt(x, y) {
  for (var p = 0; p < POCKETS.length; ++p) {
    var dx = x - POCKETS[p].x, dy = y - POCKETS[p].y
    if (dx * dx + dy * dy <= POCKET_R * POCKET_R) return 100
  }
  if (y > FIELD_Y) return 0
  var d = Math.sqrt((x - CENTER.x) * (x - CENTER.x) + (y - CENTER.y) * (y - CENTER.y))
  for (var i = 0; i < RINGS.length; ++i) if (d <= RINGS[i].r) return RINGS[i].pts
  return 10
}

function landingFor(aim, power) {
  var wobble = function(k) { return (Rng.random() - 0.5) * k }
  var x = Math.max(0.04, Math.min(0.96, 0.5 + aim * 0.46 + wobble(0.035)))
  // Power 1.0 carries to the back wall; too hard rattles back a touch.
  var y = 1.05 - power * 1.0 + wobble(0.04)
  if (power > 0.97) y = 0.08 + wobble(0.03)
  return { x: x, y: Math.max(0.04, Math.min(1.0, y)) }
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.t = state.t + dt
  var sp = meterSpeed(state.ball)
  if (state.phase === "aim") s.aim = Math.sin(s.t * sp)
  else if (state.phase === "power") s.power = (1 - Math.cos(s.t * sp * 1.3)) / 2
  else if (state.phase === "roll" && s.t >= ROLL_TIME) {
    var pts = scoreAt(state.landing.x, state.landing.y)
    s.phase = "score"
    s.lastPts = pts
    s.score = state.score + pts
    s.throws = state.throws.concat([{ x: state.landing.x, y: state.landing.y, pts: pts }])
    s.t = 0
  } else if (state.phase === "score" && s.t >= 0.9) {
    if (state.ball >= BALLS) { s.done = true; return s }
    s.ball = state.ball + 1
    s.phase = "aim"
    s.t = Rng.random() * 3
  }
  return s
}

function press(state) {
  if (state.done) return state
  var s = copy(state)
  if (state.phase === "aim") { s.lockedAim = state.aim; s.phase = "power"; s.t = 0 }
  else if (state.phase === "power") {
    s.lockedPower = state.power
    s.landing = landingFor(state.lockedAim, state.power)
    s.phase = "roll"; s.t = 0
  } else if (state.phase === "score") { s.t = 0.9 }
  else return state
  return s
}

// Where the ball is drawn during the roll: up the lane, arcing over the lip.
function ballPos(state) {
  if (state.phase !== "roll" || !state.landing) return null
  var k = Math.min(1, state.t / ROLL_TIME)
  var startX = 0.5 + state.lockedAim * 0.1
  var e = 1 - Math.pow(1 - k, 2)
  return { x: startX + (state.landing.x - startX) * e, lane: 1 - e, k: k }
}
