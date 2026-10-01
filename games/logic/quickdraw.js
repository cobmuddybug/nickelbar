.pragma library
.import "../../engine/Rng.js" as Rng

// Quick Draw: a showdown. Wait for DRAW, then fire before the outlaw does.
// Fire early and you've fouled; some outlaws pull a decoy (a crow flaps off
// the saloon sign) that you must ignore. Three lives; each outlaw is faster
// than the last, down to a floor just above what a person can do.

var LIVES = 3

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function oppTime(level) { return Math.max(0.24, 0.72 - level * 0.05) * [1.35, 1, 0.85][LEVEL] }

function makeDuel(s, level) {
  var o = {}; for (var k in s) o[k] = s[k]
  var drawAt = 1.2 + Rng.random() * 2.6
  o.level = level; o.phase = "wait"; o.t = 0; o.drawAt = drawAt
  o.fakeAt = level >= 2 && Rng.random() < 0.45 ? 0.5 + Rng.random() * Math.max(0.2, drawAt - 1.1) : -1
  o.opp = oppTime(level) * (0.9 + Rng.random() * 0.2)
  o.ms = 0; o.msg = ""; o.won = false
  return o
}

function makeState() {
  var s = { lives: LIVES, score: 0, streak: 0, best: 0, done: false, level: 1, phase: "wait", t: 0, drawAt: 0, fakeAt: -1, opp: 0.7, ms: 0, msg: "", won: false }
  return makeDuel(s, 1)
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

function lose(s, msg) {
  var o = copy(s)
  o.phase = "result"; o.t = 0; o.won = false; o.msg = msg; o.lives = s.lives - 1; o.streak = 0
  if (o.lives <= 0) o.done = true
  o.ev = ["buzz"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function fire(s) {
  if (s.done) return s
  if (s.phase === "wait") return lose(s, s.fakeAt >= 0 && s.t >= s.fakeAt ? "DECOY! You shot at a crow" : "TOO EARLY!")
  if (s.phase === "draw") {
    var o = copy(s)
    o.ms = Math.round(s.t * 1000)
    o.phase = "result"; o.t = 0; o.won = true; o.streak = s.streak + 1
    var pts = Math.max(10, Math.round((0.7 - s.t) * 1000)) * s.level
    o.score = s.score + pts; o.msg = "DRAWN IN " + o.ms + " ms  +" + pts
    o.ev = ["crash"]; o.evSeq = (s.evSeq || 0) + 1
    return o
  }
  if (s.phase === "result" && !s.done) return makeDuel(s, s.won ? s.level + 1 : s.level)
  return s
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.t = state.t + dt
  if (state.phase === "wait" && s.t >= state.drawAt) { s.phase = "draw"; s.t = 0; s.ev = ["ding"]; s.evSeq = (state.evSeq || 0) + 1 }
  else if (state.phase === "wait" && state.fakeAt >= 0 && state.t < state.fakeAt && s.t >= state.fakeAt) { s.ev = ["tick"]; s.evSeq = (state.evSeq || 0) + 1 }
  else if (state.phase === "draw" && s.t >= state.opp) return lose(s, "TOO SLOW: the outlaw shot first")
  return s
}
