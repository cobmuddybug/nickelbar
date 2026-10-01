.pragma library
.import "../../engine/Rng.js" as Rng

// Hoops, after the Pop-A-Shot arcade game. The aim sweeps side to side on
// its own; hold to build power, let go to shoot. Get the aim onto the hoop
// and the power into the green band. 45 seconds; baskets are 2 points, 3
// in the last ten seconds, and after twenty seconds the hoop starts to
// slide. Ball flight is animation only: the result is decided on release.

var TIME = 45
var FLIGHT = 0.6
var SWEET = 0.72          // ideal power
var BAND = 0.07           // ± power that still drops clean
var HOOP_R = 0.075        // hoop half-width in field units (field x 0..1)

function makeState() {
  return { clock: TIME, aimT: 0, aim: 0.5, charging: false, power: 0, balls: [], score: 0, made: 0, shots: 0,
           streak: 0, hoopT: 0, note: "", noteLife: 0, done: false }
}

function copy(s) {
  return { clock: s.clock, aimT: s.aimT, aim: s.aim, charging: s.charging, power: s.power, balls: s.balls,
           score: s.score, made: s.made, shots: s.shots, streak: s.streak, hoopT: s.hoopT, note: s.note,
           noteLife: s.noteLife, done: s.done }
}

function hoopX(s, clock) {
  var t = TIME - clock
  return t < 20 ? 0.5 : 0.5 + Math.sin((t - 20) * 1.1) * 0.25
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.clock = Math.max(0, state.clock - dt)
  s.noteLife = Math.max(0, state.noteLife - dt)
  // The aim sweeps on its own, a little faster as the clock runs down.
  s.aimT = state.aimT + dt * (1.5 + (TIME - s.clock) / TIME * 1.2)
  s.aim = 0.5 + Math.sin(s.aimT) * 0.42
  if (state.charging) s.power = Math.min(1, state.power + dt * 0.9)
  s.balls = state.balls.filter(function(b) { return b.t + dt < FLIGHT + 0.5 }).map(function(b) {
    return { from: b.from, to: b.to, power: b.power, made: b.made, rim: b.rim, t: b.t + dt }
  })
  if (s.clock === 0 && !s.balls.some(function(b) { return b.t < FLIGHT })) s.done = true
  return s
}

function charge(state) {
  if (state.done || state.clock <= 0 || state.charging) return state
  var s = copy(state)
  s.charging = true
  s.power = 0
  return s
}

function release(state) {
  if (!state.charging) return state
  var s = copy(state)
  s.charging = false
  var hx = hoopX(state, Math.max(0, state.clock - FLIGHT))
  var off = Math.abs(state.aim - hx) / HOOP_R, perr = Math.abs(state.power - SWEET) / BAND
  var made = false, rim = false
  if (off < 0.9 && perr < 1) made = true
  else if (off < 1.4 && perr < 1.8) { rim = true; made = Rng.random() < 0.4 }
  var pts = state.clock <= 10 ? 3 : 2
  s.shots = state.shots + 1
  if (made) { s.score = state.score + pts; s.made = state.made + 1; s.streak = state.streak + 1 }
  else s.streak = 0
  s.note = made ? (rim ? "RATTLED IN! +" + pts : "SWISH! +" + pts) : rim ? "IN AND OUT" : state.power < SWEET ? "SHORT" : "LONG"
  s.noteLife = 1
  s.balls = state.balls.concat([{ from: 0.5, to: state.aim, power: state.power, made: made, rim: rim, t: 0 }])
  return s
}
