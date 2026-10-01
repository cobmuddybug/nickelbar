.pragma library
.import "meter.js" as Meter
.import "../../engine/Rng.js" as Rng

// Fishing: pick a bait, charge a cast (how far decides which water you fish),
// wait for a bite, hook it in time, then reel without snapping the line:
// hold to reel (tension builds), let go to ease it, and ride out the surges.
// Endless; the catch log and points are the score.

var BAITS = [
  { name: "WORM",   bite: 1.0, rare: 0.0 },     // bites quickly, mostly small fry
  { name: "MINNOW", bite: 1.4, rare: 0.5 },
  { name: "LURE",   bite: 2.0, rare: 1.0 }      // slow to bite but the good ones go for it
]

// zone 0 shallows, 1 middle, 2 deep. rare 0 common .. 1 prize.
var SPECIES = [
  { id: "minnow",  name: "Minnow",     pts: 5,   zone: 0, rare: 0.0, str: 0.15, w: [0.02, 0.1] },
  { id: "perch",   name: "Perch",      pts: 10,  zone: 0, rare: 0.1, str: 0.25, w: [0.1, 0.8] },
  { id: "boot",    name: "Old Boot",   pts: 1,   zone: 0, rare: 0.0, str: 0.1,  w: [0.5, 0.9] },
  { id: "carp",    name: "Carp",       pts: 20,  zone: 1, rare: 0.2, str: 0.4,  w: [1, 6] },
  { id: "trout",   name: "Trout",      pts: 25,  zone: 1, rare: 0.3, str: 0.45, w: [0.5, 3] },
  { id: "bass",    name: "Bass",       pts: 35,  zone: 1, rare: 0.5, str: 0.55, w: [1, 5] },
  { id: "pike",    name: "Pike",       pts: 60,  zone: 2, rare: 0.4, str: 0.7,  w: [3, 12] },
  { id: "eel",     name: "Eel",        pts: 70,  zone: 2, rare: 0.5, str: 0.65, w: [1, 4] },
  { id: "catfish", name: "Catfish",    pts: 90,  zone: 2, rare: 0.7, str: 0.8,  w: [5, 30] },
  { id: "sturgeon", name: "Sturgeon",  pts: 200, zone: 2, rare: 0.95, str: 0.95, w: [20, 90] }
]

function makeState() {
  return { phase: "idle", bait: 0, power: 0, powerDir: 1, zone: 0, t: 0, biteIn: 0, fish: null, weight: 0,
           tension: 0, progress: 0, surge: 0, surgeIn: 1, hold: false, msg: "", log: {}, score: 0, casts: 0 }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function setBait(s, d) {
  if (s.phase !== "idle") return s
  var o = copy(s); o.bait = (s.bait + d + BAITS.length) % BAITS.length; return o
}

function pick(zone, rare) {
  var pool = SPECIES.filter(function(f) { return f.zone === zone })
  var weights = pool.map(function(f) { return Math.max(0.05, 1 - Math.abs(f.rare - rare * 0.9)) * (1.2 - f.rare * 0.6) })
  var total = weights.reduce(function(a, b) { return a + b }, 0), r = Rng.random() * total
  for (var i = 0; i < pool.length; ++i) { r -= weights[i]; if (r <= 0) return pool[i] }
  return pool[pool.length - 1]
}

// The one button: charge, cast, strike on a bite, and carry on after a result.
function action(s) {
  var o = copy(s)
  if (s.phase === "idle") { o.phase = "charge"; o.power = 0; o.powerDir = 1; o.msg = ""; o.ev = ["click"]; o.evSeq = (s.evSeq || 0) + 1; return o }
  if (s.phase === "charge") {
    o.phase = "wait"; o.zone = s.power < 0.34 ? 0 : s.power < 0.7 ? 1 : 2
    o.t = 0; o.casts = s.casts + 1
    o.ev = ["tick"]; o.evSeq = (s.evSeq || 0) + 1
    o.biteIn = (1.2 + Rng.random() * 3.2) * BAITS[s.bait].bite * (0.7 + 0.3 * (o.zone + 1) / 2)
    return o
  }
  if (s.phase === "wait") { o.phase = "idle"; o.msg = "Too early — reeled in empty"; o.ev = ["pop"]; o.evSeq = (s.evSeq || 0) + 1; return o }
  if (s.phase === "bite") {
    o.phase = "reel"; o.progress = 0.4; o.tension = 0.2; o.surge = 0; o.surgeIn = 1.2 + Rng.random()
    o.ev = ["click"]; o.evSeq = (s.evSeq || 0) + 1
    return o
  }
  if (s.phase === "result") { o.phase = "idle"; return o }
  return s
}

function setHold(s, h) { if (s.hold === h) return s; var o = copy(s); o.hold = h; return o }

function land(s, f) {
  var o = copy(s), w = f.w[0] + Rng.random() * (f.w[1] - f.w[0])
  w = Math.round(w * 10) / 10
  var log = {}
  for (var k in s.log) log[k] = s.log[k]
  var prev = log[f.id] || { n: 0, best: 0 }
  log[f.id] = { n: prev.n + 1, best: Math.max(prev.best, w) }
  o.log = log; o.weight = w
  var pts = Math.round(f.pts * (0.7 + 0.6 * (w - f.w[0]) / Math.max(0.01, f.w[1] - f.w[0])))
  o.score = s.score + pts
  o.msg = (prev.n === 0 ? "NEW! " : "") + f.name + "  " + w + " kg  +" + pts
  o.phase = "result"; o.fish = f
  o.ev = ["coin"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function step(state, dt) {
  var s = copy(state)
  if (state.phase === "charge") {
    var pm = Meter.swing(state.power, state.powerDir, dt, 1.0)
    s.power = pm.v; s.powerDir = pm.dir
    return s
  }
  if (state.phase === "wait") {
    s.t = state.t + dt
    if (s.t >= state.biteIn) {
      s.phase = "bite"; s.t = 0
      s.ev = ["ding"]; s.evSeq = (state.evSeq || 0) + 1
      s.fish = pick(state.zone, BAITS[state.bait].rare)
    }
    return s
  }
  if (state.phase === "bite") {
    s.t = state.t + dt
    if (s.t > 1.9) { s.phase = "idle"; s.fish = null; s.msg = "It got away with the bait" }
    return s
  }
  if (state.phase === "reel") {
    var f = state.fish, str = f.str
    s.surgeIn = state.surgeIn - dt
    if (state.surge > 0) s.surge = Math.max(0, state.surge - dt)
    if (s.surgeIn <= 0) { s.surge = 0.4 + Rng.random() * 0.4; s.surgeIn = 1.4 + Rng.random() * (1.8 - str) }
    var pulling = s.surge > 0
    var rise = (state.hold ? 0.5 + str * 0.4 : -0.75) + (pulling ? 0.3 + str * 0.5 : 0)
    s.tension = clamp(state.tension + rise * dt, 0, 1.2)
    var gain = state.hold ? (0.5 - 0.2 * str) * (s.tension > 0.85 ? 0.6 : 1) : 0
    var loss = (pulling ? 0.1 + 0.1 * str : 0.01 + 0.01 * str)
    s.progress = clamp(state.progress + (gain - loss) * dt, 0, 1)
    if (s.tension >= 1) { s.phase = "result"; s.msg = "SNAP! The " + f.name + " took the line"; s.fish = null; s.ev = ["buzz"]; s.evSeq = (state.evSeq || 0) + 1; return s }
    if (s.progress >= 1) return land(s, f)
    if (s.progress <= 0) { s.phase = "result"; s.msg = "The " + f.name + " slipped the hook"; s.fish = null; s.ev = ["pop"]; s.evSeq = (state.evSeq || 0) + 1; return s }
    return s
  }
  return state
}

function serialize(s) { return { log: s.log, score: s.score, casts: s.casts, bait: s.bait } }
function deserialize(o) {
  if (!o || typeof o.log !== "object" || typeof o.score !== "number") return null
  var s = makeState()
  s.log = o.log; s.score = o.score; s.casts = o.casts || 0; s.bait = o.bait || 0
  return s
}
