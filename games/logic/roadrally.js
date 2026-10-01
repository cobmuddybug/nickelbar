.pragma library
.import "../../engine/Rng.js" as Rng

// Road Rally (after Road Fighter and Rad Racer's top-down cousins): drive up
// an endless four-lane road against a fuel gauge. Overtake traffic, grab fuel
// cans, avoid oil, and reach each checkpoint to top the tank up. A rear-end
// at speed or the roadside wall is a crash; running dry ends the run.
//
// World: `d` is distance along the road, in units of one lane width; `p` is
// the player's lateral position and `q` a car's, both measured from the road's
// centre line (lanes are 1 wide, so the road spans -2..2). The road itself
// wanders sideways by roadOff(d); everything is stored in road coordinates, so
// a bend only ever moves the player relative to the road.

var HALF = 2.0              // road half-width
var EDGE = 2.55             // beyond this is the wall
var CAR_W = 0.6, CAR_L = 1.5
var BASE = 9, TOP = 14, TURBO = 19, GRASS_V = 5.5
var FUEL_MAX = 100
var AHEAD = 10.5            // how far up the screen the QML shows
var LANES = [-1.5, -0.5, 0.5, 1.5]
var CRASH_TIME = 1.3

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }
function traffic() { return LEVEL === 0 ? 0.75 : (LEVEL === 2 ? 1.3 : 1) }
function drain() { return LEVEL === 0 ? 0.8 : (LEVEL === 2 ? 1.1 : 1) }

function rnd() { return Rng.random() }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function pick(a) { return a[Math.floor(rnd() * a.length)] }

// The road's sideways wander. A pure function of distance, so the QML can
// draw the road ahead; it starts nearly straight and bends more with distance.
function roadOff(d) {
  var a = Math.min(1.9, 0.35 + d * 0.0006)
  return a * (Math.sin(d / 38) * 0.7 + Math.sin(d / 17 + 1.3) * 0.3 - Math.sin(1.3) * 0.3)
}

function stageLength(n) { return 500 + 90 * n }

function makeState() {
  var s = {
    d: 0, v: 0, p: 0.5, fuel: FUEL_MAX, score: 0, stage: 1, stageEnd: stageLength(1),
    cars: [], slicks: [], cans: [], bursts: [],
    crashT: 0, skidT: 0, skidDir: 1, inv: 0, bumpT: 0, turboOn: false,
    t: 0, alive: true, why: "", passes: 0, nextId: 1,
    spawnGap: 0, slickGap: 60, canGap: 40, msg: "", msgT: 0,
    ev: [], evSeq: 0
  }
  // a few cars already on the road ahead
  for (var d = 12; d < AHEAD + 8; d += 3.5 + rnd() * 3) trySpawn(s, d)
  return s
}

function cp(s) {
  var o = {}
  for (var k in s) o[k] = s[k]
  o.cars = s.cars.map(function(c) { var n = {}; for (var k2 in c) n[k2] = c[k2]; return n })
  o.slicks = s.slicks.map(function(c) { return { d: c.d, q: c.q, used: c.used } })
  o.cans = s.cans.map(function(c) { return { d: c.d, q: c.q } })
  o.bursts = s.bursts.map(function(b) { return { d: b.d, q: b.q, age: b.age } })
  o.ev = []
  return o
}

function laneFree(s, d, q, gap) {
  for (var i = 0; i < s.cars.length; ++i) {
    var c = s.cars[i]
    if (Math.abs(c.q - q) < 0.8 && Math.abs(c.d - d) < gap + c.len / 2) return false
  }
  return true
}

function carKind(stage) {
  var r = rnd() * 100, weaver = Math.min(35, 10 + stage * 5)
  if (r < weaver) return "weaver"
  if (r < weaver + 15) return "truck"
  return "blue"
}

function trySpawn(s, d) {
  var kind = carKind(s.stage), lanes = LANES.slice(), i
  // never wall off the whole road: keep one lane clear around this distance
  var busy = 0
  for (i = 0; i < LANES.length; ++i) if (!laneFree(s, d, LANES[i], 3.2)) busy++
  if (busy >= 3) return false
  while (lanes.length) {
    var q = lanes.splice(Math.floor(rnd() * lanes.length), 1)[0]
    if (!laneFree(s, d, q, 3.0)) continue
    var c = { id: s.nextId++, d: d, q: q, tq: q, kind: kind, w: CAR_W, len: CAR_L, v: 0, passed: false, wig: 0 }
    var sp = Math.min(1.5, (s.stage - 1) * 0.25)
    if (kind === "truck") { c.w = 0.78; c.len = 2.7; c.v = 4.2 + rnd() * 0.8 }
    else if (kind === "weaver") c.v = 7 + rnd() * 2 + sp
    else c.v = 5.5 + rnd() * 2 + sp
    s.cars.push(c)
    return true
  }
  return false
}

function crashPlayer(o, car) {
  o.crashT = CRASH_TIME; o.inv = CRASH_TIME + 1.1
  o.fuel = Math.max(0, o.fuel - 8)
  o.bursts.push({ d: o.d + 0.4, q: o.p, age: 0 })
  o.ev.push("crash")
  if (car) { car.dead = true; o.bursts.push({ d: car.d, q: car.q, age: 0 }) }
}

// input: { dx: -1..1, up, down, turbo (booleans), target: lateral position or null }
function step(s, input, dt) {
  if (!s.alive) return s
  input = input || {}
  dt = Math.min(dt, 0.05)
  var o = cp(s), i, c
  o.t = s.t + dt
  o.msgT = Math.max(0, s.msgT - dt); if (o.msgT === 0) o.msg = ""
  o.inv = Math.max(0, s.inv - dt); o.bumpT = Math.max(0, s.bumpT - dt)
  o.skidT = Math.max(0, s.skidT - dt)
  var crashing = s.crashT > 0
  o.crashT = Math.max(0, s.crashT - dt)

  // ---- speed
  var onGrass = Math.abs(o.p) > HALF - 0.12
  var turbo = !!input.turbo && o.fuel > 0 && !crashing
  o.turboOn = turbo && o.v > BASE
  var target = BASE + (input.up ? TOP - BASE : 0)
  if (turbo) target = TURBO
  if (input.down) target = 2.5
  if (onGrass) target = Math.min(target, GRASS_V)
  if (crashing) target = 0
  var accel = target > o.v ? (turbo ? 7 : 5) : (crashing ? 14 : (input.down ? 14 : 8))
  o.v += clamp(target - o.v, -accel * dt, accel * dt)

  // ---- steering and the bend
  var dx = clamp(input.dx || 0, -1, 1)
  if (!dx && input.target !== null && input.target !== undefined) dx = clamp((input.target - o.p) * 4, -1, 1)
  if (o.skidT > 0) dx = o.skidDir * 0.9 + dx * 0.3
  if (crashing) dx = 0
  o.p += dx * 2.6 * Math.min(1, o.v / 5) * dt
  var d0 = o.d
  o.d += o.v * dt
  o.p -= roadOff(o.d) - roadOff(d0)
  if (Math.abs(o.p) > EDGE && !crashing && o.inv <= 0) {
    crashPlayer(o, null)
    o.p = (o.p < 0 ? -1 : 1) * (HALF - 0.45)
  }
  o.p = clamp(o.p, -EDGE, EDGE)

  // ---- fuel
  o.fuel -= (1.3 + (s.stage - 1) * 0.07) * drain() * (o.turboOn ? 1.8 : 1) * dt
  if (o.fuel <= 0) { o.fuel = 0; o.alive = false; o.why = "OUT OF FUEL"; o.ev.push("die") }

  // ---- traffic
  for (i = 0; i < o.cars.length; ++i) {
    c = o.cars[i]
    // follow a slower car in the same lane instead of driving through it
    for (var j = 0; j < o.cars.length; ++j) {
      var a = o.cars[j]
      if (a !== c && Math.abs(a.q - c.q) < 0.7 && a.d > c.d && a.d - c.d < (a.len + c.len) / 2 + 0.7 && a.v < c.v) c.v = a.v
    }
    // weavers change lane when the player closes in from behind
    if (c.kind === "weaver" && c.wig <= 0 && c.d > o.d + 1 && c.d - o.d < 6.5 && Math.abs(c.q - o.p) < 0.9) {
      var cand = []
      for (var l = 0; l < LANES.length; ++l) if (Math.abs(LANES[l] - c.q) < 1.2 && Math.abs(LANES[l] - c.q) > 0.4 && laneFree(o, c.d, LANES[l], 2.4)) cand.push(LANES[l])
      if (cand.length) c.tq = pick(cand)
      c.wig = 1.6
    }
    c.wig = Math.max(0, c.wig - dt)
    c.q += clamp(c.tq - c.q, -1.5 * dt, 1.5 * dt)
    c.d += c.v * dt
    if (!c.passed && c.d + c.len / 2 < o.d - CAR_L / 2) { c.passed = true; o.passes++; o.score += 25 }
  }

  // ---- spawning, by distance covered so the density doesn't depend on speed
  o.spawnGap -= o.v * dt
  if (o.spawnGap <= 0) {
    var gap = Math.max(2.4, 5.6 - s.stage * 0.35) / traffic()
    if (trySpawn(o, o.d + AHEAD + 4)) o.spawnGap = gap * (0.7 + rnd() * 0.6)
    else o.spawnGap = 0.8
  }
  o.slickGap -= o.v * dt
  if (o.slickGap <= 0) {
    if (o.stage > 1 || o.d > 250) o.slicks.push({ d: o.d + AHEAD + 4, q: rnd() * 3 - 1.5, used: false })
    o.slickGap = 70 + rnd() * 60
  }
  o.canGap -= o.v * dt
  if (o.canGap <= 0) {
    var cq = pick(LANES)
    if (laneFree(o, o.d + AHEAD + 4, cq, 3)) { o.cans.push({ d: o.d + AHEAD + 4, q: cq }); o.canGap = (LEVEL === 0 ? 38 : (LEVEL === 2 ? 55 : 48)) + rnd() * 30 }
    else o.canGap = 1
  }

  // ---- pickups and hazards
  for (i = 0; i < o.cans.length; ++i) {
    var can = o.cans[i]
    if (Math.abs(can.d - o.d) < 0.9 && Math.abs(can.q - o.p) < 0.55) {
      can.got = true; o.fuel = Math.min(FUEL_MAX, o.fuel + 20); o.score += 50; o.ev.push("coin")
    }
  }
  for (i = 0; i < o.slicks.length; ++i) {
    var sl = o.slicks[i]
    if (!sl.used && o.inv <= 0 && !crashing && Math.abs(sl.d - o.d) < 0.7 && Math.abs(sl.q - o.p) < 0.6) {
      sl.used = true; o.skidT = 1.1; o.skidDir = rnd() < 0.5 ? -1 : 1; o.ev.push("pop")
    }
  }

  // ---- car collisions
  if (o.inv <= 0 && !crashing) {
    for (i = 0; i < o.cars.length; ++i) {
      c = o.cars[i]
      if (c.dead) continue
      var ox = (CAR_W * 0.45 + c.w * 0.45) - Math.abs(o.p - c.q)
      var oy = (CAR_L * 0.47 + c.len * 0.47) - Math.abs(o.d - c.d)
      if (ox <= 0 || oy <= 0) continue
      if (ox < oy) {                                  // side swipe
        o.p += (o.p < c.q ? -1 : 1) * ox
        c.q += (o.p < c.q ? 1 : -1) * ox * 0.5; c.tq = c.q
        o.v *= 0.93
        if (o.bumpT <= 0) { o.ev.push("bump"); o.bumpT = 0.3 }
      } else if (o.d < c.d) {                         // ran into the back of it
        var closing = o.v - c.v
        if (closing > 3.2) { crashPlayer(o, closing > 7 ? c : null); if (closing <= 7) c.v += 1 }
        else {
          o.d = c.d - (CAR_L * 0.47 + c.len * 0.47) - 0.01
          o.v = Math.min(o.v, c.v)
          if (closing > 1 && o.bumpT <= 0) { o.ev.push("bump"); o.bumpT = 0.3 }
        }
      }
      if (o.crashT > 0) break
    }
  }

  // ---- checkpoint
  if (o.d >= o.stageEnd) {
    o.stage++
    o.stageEnd += stageLength(o.stage)
    o.fuel = Math.min(FUEL_MAX, o.fuel + 35)
    o.score += 300
    o.msg = "CHECKPOINT"; o.msgT = 2
    o.ev.push("flag")
  }
  o.score += o.v * dt * 0.5

  // ---- housekeeping
  o.cars = o.cars.filter(function(k) { return !k.dead && k.d > o.d - 6 && k.d < o.d + AHEAD + 30 })
  o.slicks = o.slicks.filter(function(k) { return k.d > o.d - 6 })
  o.cans = o.cans.filter(function(k) { return !k.got && k.d > o.d - 6 })
  o.bursts = o.bursts.filter(function(b) { b.age += dt; return b.age < 0.7 })
  if (o.ev.length) o.evSeq = s.evSeq + 1
  return o
}

function serialize(s) { return s }
function deserialize(o) {
  if (!o || !o.cars || o.d === undefined) return null
  return o
}
