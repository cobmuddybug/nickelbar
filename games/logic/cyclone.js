.pragma library
.import "../../engine/Rng.js" as Rng

// Cyclone, the midway light-chaser. A light runs round a ring of LIGHTS;
// stop it with SPACE. Dead on the jackpot pays big, one either side pays
// well, the marked lights a little. Ten spins, each faster than the last,
// and later ones speed up and ease off as they go to put you off.

var LIGHTS = 40
var SPINS = 10
var JACKPOT = 0
var PAYS = { jackpot: 500, near: 100, mark: 25, plain: 5 }

function payFor(i) {
  var d = Math.min(i, LIGHTS - i)
  if (d === 0) return PAYS.jackpot
  if (d === 1) return PAYS.near
  if (i % 5 === 0) return PAYS.mark
  return PAYS.plain
}

function makeState() {
  return { pos: 10 + Rng.random() * 20, speed: 14, spin: 1, score: 0, phase: "run", hold: 0, last: -1, lastPay: 0,
           wobble: Rng.random() * 6, log: [], done: false }
}

function copy(s) {
  return { pos: s.pos, speed: s.speed, spin: s.spin, score: s.score, phase: s.phase, hold: s.hold, last: s.last,
           lastPay: s.lastPay, wobble: s.wobble, log: s.log, done: s.done }
}

// Lights per second for this spin, with a slow surge later on.
function speedAt(s, t) {
  var base = 14 + (s.spin - 1) * 3.2
  return s.spin > 4 ? base * (1 + 0.28 * Math.sin(t * 2.3 + s.wobble)) : base
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  if (state.phase === "held") {
    s.hold = state.hold - dt
    if (s.hold <= 0) {
      if (state.spin >= SPINS) { s.done = true; return s }
      s.spin = state.spin + 1
      s.phase = "run"
      s.wobble = Rng.random() * 6
    }
    return s
  }
  s.hold = state.hold + dt   // doubles as the run's clock
  s.speed = speedAt(state, s.hold)
  s.pos = (state.pos + s.speed * dt) % LIGHTS
  return s
}

function current(s) { return Math.floor(s.pos) % LIGHTS }

function stop(state) {
  if (state.done || state.phase !== "run") return state
  var s = copy(state), i = current(state)
  s.phase = "held"
  s.hold = 1.4
  s.last = i
  s.lastPay = payFor(i)
  s.score = state.score + s.lastPay
  s.log = state.log.concat([s.lastPay])
  return s
}
