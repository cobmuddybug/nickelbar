.pragma library
.import "../../engine/Rng.js" as Rng

// Whack-a-Mole. Sixty seconds, nine holes. Moles pop up for a moment and
// drop back; hit one while it's up for 10 points, a golden one for 50.
// Hits in a row build a combo (up to ×4); swinging at an empty hole
// breaks it. Moles come quicker and stay up less as the clock runs down.
//
// holes[i]: null, or { gold, up (seconds left up), age, hit (seconds of
// "bonk" left after a hit) }.

var TIME = 60
var N = 9

function makeState() {
  var holes = []
  for (var i = 0; i < N; ++i) holes.push(null)
  return { holes: holes, clock: TIME, score: 0, combo: 0, best: 0, hits: 0, misses: 0, spawnIn: 0.6,
           cursor: 4, pops: [], done: false }
}

function copy(s) {
  return { holes: s.holes, clock: s.clock, score: s.score, combo: s.combo, best: s.best, hits: s.hits,
           misses: s.misses, spawnIn: s.spawnIn, cursor: s.cursor, pops: s.pops, done: s.done }
}

function progress(s) { return 1 - s.clock / TIME }            // 0 at the start, 1 at the bell
function upTime(s) { return 1.25 - progress(s) * 0.7 }
function gap(s) { return 0.75 - progress(s) * 0.45 }
function multiplier(s) { return Math.min(4, 1 + Math.floor(s.combo / 4)) }

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.clock = Math.max(0, state.clock - dt)
  s.pops = state.pops.filter(function(p) { return p.life > dt }).map(function(p) { return { i: p.i, v: p.v, life: p.life - dt } })
  var holes = state.holes.map(function(h) {
    if (!h) return null
    if (h.hit > 0) return h.hit - dt > 0 ? { gold: h.gold, up: 0, age: h.age + dt, hit: h.hit - dt } : null
    var up = h.up - dt
    return up > 0 ? { gold: h.gold, up: up, age: h.age + dt, hit: 0 } : null
  })
  s.spawnIn = state.spawnIn - dt
  if (s.spawnIn <= 0 && s.clock > 0) {
    var empty = []
    for (var i = 0; i < N; ++i) if (!holes[i]) empty.push(i)
    // Late on, two can come up at once.
    var count = progress(s) > 0.5 && Rng.random() < 0.35 ? 2 : 1
    for (var k = 0; k < count && empty.length; ++k) {
      var j = empty.splice(Math.floor(Rng.random() * empty.length), 1)[0]
      holes[j] = { gold: Rng.random() < 0.08, up: upTime(s) * (0.8 + Rng.random() * 0.4), age: 0, hit: 0 }
    }
    s.spawnIn = gap(s) * (0.7 + Rng.random() * 0.6)
  }
  s.holes = holes
  if (s.clock === 0 && !holes.some(function(h) { return h && h.hit > 0 })) s.done = true
  return s
}

function whack(state, i) {
  if (state.done || state.clock <= 0 || i < 0 || i >= N) return state
  var s = copy(state), h = state.holes[i]
  s.cursor = i
  if (h && h.hit === 0) {
    s.combo = state.combo + 1
    var v = (h.gold ? 50 : 10) * multiplier(s)
    s.score = state.score + v
    s.hits = state.hits + 1
    s.best = Math.max(state.best, s.combo)
    s.holes = state.holes.slice()
    s.holes[i] = { gold: h.gold, up: 0, age: h.age, hit: 0.35 }
    s.pops = state.pops.concat([{ i: i, v: v, life: 0.6 }])
  } else if (!h) {
    s.combo = 0
    s.misses = state.misses + 1
  }
  return s
}

function moveCursor(state, dx, dy) {
  var s = copy(state), x = state.cursor % 3, y = Math.floor(state.cursor / 3)
  s.cursor = Math.max(0, Math.min(2, y + dy)) * 3 + Math.max(0, Math.min(2, x + dx))
  return s
}
