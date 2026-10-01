.pragma library
.import "physics.js" as Phys
.import "../../engine/Rng.js" as Rng

// Bumper Cars: a round arena with no walls; knock the other cars off the
// edge. Cars slide (low friction), steer by pushing toward a direction, and
// can boost: a short dash that hits much harder, then a meter to refill.
// Clear a round to start the next with more, cleverer cars; fall off and
// it's over.

var R = 0.5            // arena radius
var CAR = 0.04         // car radius
var BOOST_COST = 0.45

function mk(x, y, ai) {
  return { x: x, y: y, vx: 0, vy: 0, fx: 0, fy: -1, boost: 0, meter: 1, out: false, ai: ai || 0, think: 0, tx: 0, ty: 0, touched: 0 }
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function makeRound(round, score, best) {
  var n = Math.min(7, round + 2), cars = [mk(0, 0.18, 0)]
  cars[0].fy = -1
  for (var i = 0; i < n; ++i) {
    var a = (i / n) * Math.PI * 2 + 0.4
    var c = mk(Math.cos(a) * 0.3, Math.sin(a) * 0.3 - 0.08, (0.5 + Math.min(0.5, round * 0.08) + Rng.random() * 0.15) * [0.7, 1, 1.3][LEVEL])
    cars.push(c)
  }
  return { round: round, cars: cars, score: score, kos: 0, ix: 0, iy: 0, wantBoost: false, t: 0, done: false, pops: [], clear: 0, best: best || 0 }
}

function makeState() { return makeRound(1, 0, 0) }

function copyCar(c) { var o = {}; for (var k in c) o[k] = c[k]; return o }

function setInput(s, ix, iy) { if (s.ix === ix && s.iy === iy) return s; var o = shallow(s); o.ix = ix; o.iy = iy; return o }
function shallow(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function boost(s) { var o = shallow(s); o.wantBoost = true; return o }

function dashCar(c) {
  var sp = Math.sqrt(c.vx * c.vx + c.vy * c.vy)
  var dx = sp > 0.05 ? c.vx / sp : c.fx, dy = sp > 0.05 ? c.vy / sp : c.fy
  c.vx += dx * 0.55; c.vy += dy * 0.55; c.boost = 0.28; c.meter -= BOOST_COST
}

function think(c, cars, round, dt) {
  var p = cars[0], d = Math.sqrt(c.x * c.x + c.y * c.y)
  var gx = 0, gy = 0
  if (d > 0.33) { gx = -c.x / d; gy = -c.y / d }          // wary of the edge
  else {
    var best = null, bd = 9
    for (var i = 0; i < cars.length; ++i) {
      var o = cars[i]
      if (o === c || o.out) continue
      var dist = Math.hypot(o.x - c.x, o.y - c.y) * (i === 0 ? 0.85 : 1)
      if (dist < bd) { bd = dist; best = o }
    }
    if (best) {
      // Aim to push the target outward: come at it from the arena's middle side.
      var od = Math.hypot(best.x, best.y) || 1
      var ax = best.x + best.vx * 0.2 - (best.x / od) * 0.05, ay = best.y + best.vy * 0.2 - (best.y / od) * 0.05
      var vx = ax - c.x, vy = ay - c.y, vl = Math.hypot(vx, vy) || 1
      gx = vx / vl; gy = vy / vl
      var close = Math.hypot(best.x - c.x, best.y - c.y)
      var aligned = (c.vx * gx + c.vy * gy) > 0.05
      if (close < 0.17 && c.meter >= BOOST_COST + 0.05 && aligned && Rng.random() < dt * 3 * c.ai) dashCar(c)
    }
  }
  c.tx = gx; c.ty = gy
}

function serialize(s) { return JSON.parse(JSON.stringify(s)) }
function deserialize(o) {
  if (!o || !Array.isArray(o.cars) || o.done || o.cars[0].out) return null
  var s = JSON.parse(JSON.stringify(o)); s.ix = 0; s.iy = 0; s.wantBoost = false; return s
}

function step(state, dt) {
  if (state.done) return state
  var s = shallow(state), evs = []
  s.t = state.t + dt
  s.pops = state.pops.filter(function(p) { return p.life > dt }).map(function(p) { return { x: p.x, y: p.y, v: p.v, life: p.life - dt } })
  var cars = state.cars.map(copyCar), i, j
  var p = cars[0]
  if (!p.out) {
    var l = Math.hypot(state.ix, state.iy)
    if (l > 0) { p.fx = state.ix / l; p.fy = state.iy / l; p.vx += p.fx * 1.5 * dt; p.vy += p.fy * 1.5 * dt }
    if (state.wantBoost && p.meter >= BOOST_COST) { dashCar(p); evs.push("stomp") }
  }
  s.wantBoost = false
  for (i = 1; i < cars.length; ++i) {
    var c = cars[i]
    if (c.out) continue
    c.think -= dt
    if (c.think <= 0) { think(c, cars, state.round, dt); c.think = 0.12 + Rng.random() * 0.1 / c.ai }
    if (s.t > 1.2) { c.vx += c.tx * (0.8 + 0.4 * c.ai) * dt; c.vy += c.ty * (0.8 + 0.4 * c.ai) * dt }
    c.fx = c.tx || c.fx; c.fy = c.ty || c.fy
  }
  for (i = 0; i < cars.length; ++i) {
    var a = cars[i]
    if (a.out) continue
    a.meter = Math.min(1, a.meter + dt * 0.35)
    a.boost = Math.max(0, a.boost - dt); a.touched = Math.max(0, a.touched - dt)
    var f = Math.exp(-1.2 * dt); a.vx *= f; a.vy *= f
    a.x += a.vx * dt; a.y += a.vy * dt
  }
  for (i = 0; i < cars.length; ++i) for (j = i + 1; j < cars.length; ++j) {
    var A = cars[i], B = cars[j]
    if (A.out || B.out) continue
    var dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy)
    if (d >= CAR * 2 || d === 0) continue
    var closing = Phys.collide(A, CAR, A.boost > 0 ? 3 : 1, B, CAR, B.boost > 0 ? 3 : 1, 0.9)
    if (closing > 0.25) evs.push("thud")
    if (i === 0) B.touched = 3
  }
  var left = 0
  for (i = 0; i < cars.length; ++i) {
    var q = cars[i]
    if (q.out) continue
    if (Math.hypot(q.x, q.y) > R + CAR * 0.4) {
      q.out = true
      if (i === 0) { s.done = true }
      else {
        evs.push("pop")
        var gain = q.touched > 0 ? 100 : 25
        s.score = s.score + gain; if (q.touched > 0) s.kos = state.kos + 1
        s.pops = s.pops.concat([{ x: q.x, y: q.y, v: gain, life: 1 }])
      }
    } else if (i > 0) left++
  }
  s.cars = cars
  if (evs.length) { s.ev = evs; s.evSeq = (state.evSeq || 0) + 1 }
  if (!s.done && left === 0) {
    var bonus = 150 * state.round
    var nr = makeRound(state.round + 1, s.score + bonus, state.best)
    nr.pops = [{ x: 0, y: 0, v: bonus, life: 1.4 }]
    nr.clear = 1.5
    nr.kos = s.kos
    return nr
  }
  s.best = Math.max(s.best, s.score)
  return s
}
