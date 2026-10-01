.pragma library
.import "../../engine/Rng.js" as Rng

// Shooting gallery. Three rows of targets slide past, each row its own way
// and speed: ducks (10), plates (25) and the odd star (100). Twenty-five
// shots; a hit knocks the target down and it comes back round later.
// Consecutive hits build a streak bonus (+5 a hit on top, up to +25).
//
// Field: W wide, H tall; targets have x (wrapping over the row's span),
// a row, a kind, and down (seconds until it pops back up).

var W = 1.6
var H = 1
var SHOTS = 25
var ROWS = [{ y: 0.24, speed: 0.22 }, { y: 0.5, speed: -0.3 }, { y: 0.76, speed: 0.4 }]
var KINDS = { duck: { pts: 10, r: 0.055 }, plate: { pts: 25, r: 0.04 }, star: { pts: 100, r: 0.03 } }
var SPAN = W + 0.4

function makeTargets() {
  var out = []
  for (var r = 0; r < ROWS.length; ++r) {
    var n = 6 - r
    for (var i = 0; i < n; ++i) {
      var roll = Rng.random()
      out.push({ row: r, x: i * SPAN / n + Rng.random() * 0.1, kind: roll < 0.08 + r * 0.04 ? "star" : roll < 0.45 ? "plate" : "duck", down: 0 })
    }
  }
  return out
}

function makeState() {
  return { targets: makeTargets(), aim: { x: W / 2, y: 0.5 }, shots: SHOTS, score: 0, streak: 0, hits: 0,
           flashes: [], recoil: 0, clock: 0, done: false }
}

function copy(s) {
  return { targets: s.targets, aim: s.aim, shots: s.shots, score: s.score, streak: s.streak, hits: s.hits,
           flashes: s.flashes, recoil: s.recoil, clock: s.clock, done: s.done }
}

function speedFor(s, row) { return ROWS[row].speed * (1 + Math.min(0.8, (SHOTS - s.shots) * 0.02)) }

// Where target t is on screen (x wraps across the row's span).
function screenX(t) { return ((t.x % SPAN) + SPAN) % SPAN - 0.2 }

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.clock = state.clock + dt
  s.recoil = Math.max(0, state.recoil - dt)
  s.flashes = state.flashes.filter(function(f) { return f.life > dt }).map(function(f) { return { x: f.x, y: f.y, v: f.v, life: f.life - dt } })
  s.targets = state.targets.map(function(t) {
    return { row: t.row, x: t.x + speedFor(state, t.row) * dt, kind: t.kind, down: Math.max(0, t.down - dt) }
  })
  if (state.shots <= 0 && !s.flashes.length) s.done = true
  return s
}

function aimAt(state, x, y) {
  var s = copy(state)
  s.aim = { x: Math.max(0, Math.min(W, x)), y: Math.max(0.05, Math.min(H - 0.05, y)) }
  return s
}

function shoot(state) {
  if (state.done || state.shots <= 0 || state.recoil > 0) return state
  var s = copy(state), a = state.aim, hit = -1
  s.shots = state.shots - 1
  s.recoil = 0.18
  for (var i = 0; i < state.targets.length; ++i) {
    var t = state.targets[i]
    if (t.down > 0) continue
    var dx = screenX(t) - a.x, dy = ROWS[t.row].y - a.y, r = KINDS[t.kind].r
    if (dx * dx + dy * dy <= r * r) { hit = i; break }
  }
  if (hit < 0) { s.streak = 0; s.flashes = state.flashes.concat([{ x: a.x, y: a.y, v: 0, life: 0.3 }]); return s }
  var tg = state.targets[hit]
  s.streak = state.streak + 1
  var v = KINDS[tg.kind].pts + Math.min(25, (s.streak - 1) * 5)
  s.score = state.score + v
  s.hits = state.hits + 1
  s.targets = state.targets.slice()
  s.targets[hit] = { row: tg.row, x: tg.x, kind: Rng.random() < 0.12 ? "star" : tg.kind === "star" ? "duck" : tg.kind, down: 2.5 + Rng.random() * 2 }
  s.flashes = state.flashes.concat([{ x: a.x, y: a.y, v: v, life: 0.7 }])
  return s
}
