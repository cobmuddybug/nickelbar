.pragma library

// High Striker: mash to build hammer power, then strike. The bell at the top
// is a narrow window just under full power; swing harder and the puck
// overshoots and the bell stays silent. Five swings. Power drains while you
// hesitate, so mashing has to be steady rather than frantic.

var SWINGS = 5
var BELL_LO = 0.9
var BELL_HI = 1.0
var AUTO = 7          // seconds of mashing before the hammer swings itself

function makeState() {
  return { swing: 1, phase: "mash", power: 0, t: 0, puck: 0, level: 0, outcome: "", scores: [], total: 0, anim: 0, done: false }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

function mash(s) {
  if (s.phase !== "mash") return s
  var o = copy(s); o.power = Math.min(1.5, s.power + 0.065); if (o.t === 0) o.t = 0.0001
  o.ev = ["click"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function strike(s) {
  if (s.phase !== "mash" || s.power <= 0.02) return s
  var o = copy(s)
  o.phase = "fly"; o.anim = 0
  o.level = s.power
  o.ev = ["thud"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function judge(p) {
  if (p >= BELL_LO && p <= BELL_HI) return { pts: 250, out: "DING! JACKPOT" }
  if (p > BELL_HI) return { pts: Math.max(0, Math.round((1.5 - p) * 120) - 10), out: "TOO HARD: THE PUCK FLIES PAST THE BELL" }
  return { pts: Math.round(p * 100), out: p > 0.75 ? "SO CLOSE" : p > 0.45 ? "RESPECTABLE" : "WEAK" }
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  if (state.phase === "mash") {
    if (state.t > 0) {
      s.t = state.t + dt
      s.power = Math.max(0, state.power - dt * 0.28 * (0.6 + state.power))
      if (s.t >= AUTO) { s.phase = "fly"; s.anim = 0; s.level = Math.max(0.02, s.power); return s }
    }
    return s
  }
  if (state.phase === "fly") {
    s.anim = state.anim + dt
    s.puck = Math.min(state.level, state.level * Math.min(1, s.anim / 0.8))
    if (s.anim >= 0.8) {
      var j = judge(state.level)
      s.phase = "result"; s.anim = 0; s.outcome = j.out
      s.ev = [j.pts >= 250 ? "ding" : j.pts === 0 || state.level > BELL_HI ? "buzz" : "pop"]; s.evSeq = (state.evSeq || 0) + 1
      s.scores = state.scores.concat([j.pts]); s.total = state.total + j.pts
    }
    return s
  }
  if (state.phase === "result") {
    s.anim = state.anim + dt
    if (s.anim >= 1.6) {
      if (state.swing >= SWINGS) { s.done = true; return s }
      s.swing = state.swing + 1; s.phase = "mash"; s.power = 0; s.t = 0; s.puck = 0; s.anim = 0; s.outcome = ""
    }
    return s
  }
  return s
}
