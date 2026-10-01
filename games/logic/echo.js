.pragma library
.import "../../engine/Rng.js" as Rng

// Echo: a repeat-the-sequence game with two instruments. PADS is four big
// coloured pads (arrow keys or 1-4); KEYS is eight notes of a scale (1-8).
// The machine plays a pattern, you play it back, and it adds one more each
// time. One wrong note and it's over; the score is the pattern length you
// got through, times the pad count.

var MODES = [{ id: "pads", n: 4, name: "PADS" }, { id: "keys", n: 8, name: "KEYS" }]

function makeState(mode) {
  var s = { mode: mode || 0, seq: [], pos: 0, phase: "show", idx: 0, t: -0.8, lit: -1, litFor: 0, score: 0, done: false, wrong: -1, best: 0 }
  s.seq = [rnd(s)]
  return s
}

function rnd(s) { return Math.floor(Rng.random() * MODES[s.mode].n) }
function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

function on(s) { return Math.max(0.16, 0.42 - s.seq.length * 0.012) }
function gap(s) { return Math.max(0.08, 0.16 - s.seq.length * 0.004) }

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  if (state.litFor > 0) { s.litFor = state.litFor - dt; if (s.litFor <= 0) { s.lit = -1; s.litFor = 0 } }
  if (state.phase === "show") {
    s.t = state.t + dt
    var slot = on(state) + gap(state)
    if (s.t >= 0) {
      var k = Math.floor(s.t / slot), within = s.t - k * slot
      if (k >= state.seq.length) { s.phase = "input"; s.pos = 0; s.lit = -1; s.litFor = 0; return s }
      s.lit = within < on(state) ? state.seq[k] : -1
      s.litFor = 0
    }
  }
  return s
}

function press(state, i) {
  if (state.done || state.phase !== "input" || i < 0 || i >= MODES[state.mode].n) return state
  var s = copy(state)
  s.lit = i; s.litFor = 0.22
  if (i !== state.seq[state.pos]) { s.done = true; s.wrong = i; s.phase = "wrong"; return s }
  s.pos = state.pos + 1
  if (s.pos >= state.seq.length) {
    s.score = state.seq.length * MODES[state.mode].n
    s.best = state.seq.length
    s.seq = state.seq.concat([rnd(state)])
    s.phase = "show"; s.idx = 0; s.t = -0.7
  }
  return s
}

// Changing instrument restarts the round.
function setMode(state, m) { return state.mode === m ? state : makeState(m) }
