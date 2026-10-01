.pragma library
.import "../../engine/Rng.js" as Rng

// Big Fish (after Fishy). Eat fish smaller than you, don't get eaten by
// bigger ones, and grow. Fish you can eat are drawn in a calm colour,
// ones that can eat you in the danger colour, and they switch as you grow.
//
// On top of the original:
//   * a quick run of meals builds a combo multiplier
//   * reach full size and the level ends: you start small again in a
//     busier sea (and keep the points)
//   * jellyfish sting anything, stunning you for a moment
//   * golden fish are quick, and worth a lot of growth
//   * from level 3 a shark crosses now and then, flagged at the edge a
//     second before it arrives
//
// Units: the sea is W × H; fish sizes are radii.

var W = 16
var H = 10
var START_R = 0.3
var LEVEL_R = 1.25
var LIVES = 3
var ACCEL = 18
var DRAG = 3.2
var MAX_SPEED = 6

function makeState() {
  var s = { level: 1, score: 0, lives: LIVES, t: 0, dead: false, fish: [], pops: [], spawnT: 0, sharkT: 12,
            combo: 0, comboT: 0, msg: "LEVEL 1", msgT: 1.5, stun: 0, inv: 2, eaten: 0, warn: null, levelT: 0 }
  s.p = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: START_R, face: 1 }
  for (var i = 0; i < 8; ++i) spawn(s, true)
  return s
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

// A new fish from one side, sized around the player's size so there's
// always food and always danger.
function spawn(s, anywhere) {
  var r = Rng.random(), size
  var kind = "fish"
  if (r < 0.05) kind = "gold"
  else if (r < 0.1 + s.level * 0.01) kind = "jelly"
  if (kind === "jelly") size = 0.35 + Rng.random() * 0.2
  else if (kind === "gold") size = s.p.r * 0.7
  else {
    var bigger = Rng.random() < 0.3 + s.level * 0.03
    size = bigger ? s.p.r * (1.15 + Rng.random() * 1.6) : s.p.r * (0.25 + Rng.random() * 0.7)
    size = Math.max(0.12, Math.min(2.4, size))
  }
  var fromLeft = Rng.random() < 0.5
  var speed = kind === "jelly" ? 0.4 : kind === "gold" ? 4.5 : (1 + Rng.random() * 1.8) * (1 + s.level * 0.06) / Math.sqrt(Math.max(0.4, size))
  s.fish = s.fish.concat([{
    kind: kind, r: size, x: anywhere ? Rng.random() * W : fromLeft ? -size * 2 : W + size * 2,
    y: size + Rng.random() * (H - size * 2), vx: kind === "jelly" ? (fromLeft ? 0.3 : -0.3) : (fromLeft ? speed : -speed),
    phase: Rng.random() * 6, hue: Math.floor(Rng.random() * 3)
  }])
}

function pop(s, x, y, text, big) { s.pops = s.pops.concat([{ x: x, y: y, text: text, t: 1, big: !!big }]) }

function loseLife(s) {
  s.lives--
  if (s.lives <= 0) { s.dead = true; return }
  s.p = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: Math.max(START_R, s.p.r * 0.7), face: 1 }
  s.inv = 2.5
  s.combo = 0
  s.msg = "GOBBLED!"; s.msgT = 1.2
}

// input: { dx, dy } (-1..1), or { tx, ty } to swim toward a point.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.inv = Math.max(0, s.inv - dt)
  s.stun = Math.max(0, s.stun - dt)
  s.comboT = Math.max(0, s.comboT - dt)
  if (!s.comboT) s.combo = 0
  s.pops = s.pops.map(function(o) { return { x: o.x, y: o.y - dt * 0.8, text: o.text, t: o.t - dt, big: o.big } }).filter(function(o) { return o.t > 0 })

  // Swimming, with a bit of glide.
  var p = shallow(s.p), ax = 0, ay = 0
  if (!s.stun) {
    if (input.tx !== undefined) {
      var dx = input.tx - p.x, dy = input.ty - p.y, d = Math.sqrt(dx * dx + dy * dy)
      if (d > 0.1) { ax = dx / d * Math.min(1, d); ay = dy / d * Math.min(1, d) }
    } else { ax = input.dx || 0; ay = input.dy || 0 }
  }
  var boost = 1 + (1 - Math.min(1, p.r / LEVEL_R)) * 0.25
  p.vx += ax * ACCEL * boost * dt; p.vy += ay * ACCEL * boost * dt
  p.vx -= p.vx * DRAG * dt; p.vy -= p.vy * DRAG * dt
  var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy), max = MAX_SPEED * boost
  if (sp > max) { p.vx *= max / sp; p.vy *= max / sp }
  p.x = Math.max(p.r, Math.min(W - p.r, p.x + p.vx * dt))
  p.y = Math.max(p.r, Math.min(H - p.r, p.y + p.vy * dt))
  if (Math.abs(p.vx) > 0.2) p.face = p.vx > 0 ? 1 : -1
  s.p = p

  // Other fish swim on, waving a little; off the far side, they're gone.
  var keep = []
  for (var i = 0; i < s.fish.length; ++i) {
    var f = shallow(s.fish[i])
    f.phase += dt * 3
    f.x += f.vx * dt
    f.y += Math.sin(f.phase) * (f.kind === "jelly" ? 0.9 : 0.25) * dt
    f.y = Math.max(f.r, Math.min(H - f.r, f.y))
    if (f.x < -f.r * 4 - 1 || f.x > W + f.r * 4 + 1) continue
    // Contact.
    var ddx = f.x - p.x, ddy = f.y - p.y, touch = Math.sqrt(ddx * ddx + ddy * ddy) < (f.r + p.r) * 0.82
    if (touch) {
      if (f.kind === "jelly") { if (!s.inv && !s.stun) { s.stun = 1; s.combo = 0; pop(s, p.x, p.y - p.r, "ZAP") } keep.push(f); continue }
      if (p.r > f.r * 1.05) {
        // A meal.
        s.combo = s.comboT > 0 ? s.combo + 1 : 1
        s.comboT = 1.4
        var pts = Math.round(10 * (f.kind === "gold" ? 10 : 1) * (1 + f.r * 2) * s.combo)
        s.score += pts
        s.eaten++
        pop(s, f.x, f.y, "+" + pts + (s.combo > 1 ? " ×" + s.combo : ""), f.kind === "gold" || s.combo >= 4)
        var grow = f.kind === "gold" ? 1 : 0.45
        p.r = Math.min(LEVEL_R, Math.sqrt(p.r * p.r + f.r * f.r * grow))
        continue
      }
      if (f.r > p.r * 1.05 && !s.inv) { keep.push(f); s.fish = keep.concat(s.fish.slice(i + 1)); loseLife(s); return s }
    }
    keep.push(f)
  }
  s.fish = keep

  // Shark: warned at the edge, then a fast crossing.
  if (s.level >= 3) {
    s.sharkT -= dt
    if (!s.warn && s.sharkT <= 1.2) s.warn = { y: 1 + Rng.random() * (H - 2), left: Rng.random() < 0.5 }
    if (s.sharkT <= 0 && s.warn) {
      s.fish = s.fish.concat([{ kind: "shark", r: 1.9, x: s.warn.left ? -4 : W + 4, y: s.warn.y, vx: s.warn.left ? 9 : -9, phase: 0, hue: 0 }])
      s.warn = null
      s.sharkT = Math.max(6, 16 - s.level)
    }
  }

  s.spawnT -= dt
  var busy = 7 + s.level * 1.5
  if (s.spawnT <= 0 && s.fish.length < busy) { spawn(s, false); s.spawnT = Math.max(0.25, 1 - s.level * 0.07) * (0.5 + Rng.random()) }

  // Full grown: next level.
  if (p.r >= LEVEL_R - 1e-6) {
    s.level++
    var bonus = 500 * s.level
    s.score += bonus
    s.msg = "LEVEL " + s.level + "  +" + bonus; s.msgT = 2
    s.p = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: START_R, face: 1 }
    s.inv = 2
    s.fish = []
    for (var k = 0; k < 8; ++k) spawn(s, true)
  }
  return s
}

// Growth toward the next level, 0..1.
function progress(s) { return (s.p.r - START_R) / (LEVEL_R - START_R) }
