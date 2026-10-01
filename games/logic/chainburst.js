.pragma library
.import "../../engine/Rng.js" as Rng

// Chain Burst (after Boomshine). Dots drift about the box. You get one
// burst per level: it swells, hangs, and fades, and any dot that touches
// a burst bursts too. Catch the level's quota in the chain to go on.
//
// Making it more of a game than the original toy:
//   * each link in the chain is worth more than the last (1, 2, 3, ...),
//     so long chains pay far more than wide ones
//   * gold dots are worth five times as much and burst bigger
//   * from level 6, fast "sparks" streak about; from level 9 some dots
//     are "duds" that burst small
//   * three misses and the game is over; clearing with room to spare
//     banks a bonus
//
// Units: the box is W × H.

var W = 16
var H = 11
var LEVELS = 12
var DOT_R = 0.16
var BURST_R = 1.25
var GROW = 0.28, HOLD = 1.6, FADE = 0.45
var LIVES = 3

function levelSpec(n) {
  // n from 1: how many dots, how many to catch.
  var dots = 5 + n * 5, need = [1, 2, 4, 6, 10, 15, 18, 22, 30, 37, 48, 55][Math.min(n, 12) - 1]
  if (n > 12) need = Math.min(dots - 3, 55 + (n - 12) * 4)
  return { dots: dots, need: need }
}

function makeDots(n) {
  var spec = levelSpec(n), dots = []
  for (var i = 0; i < spec.dots; ++i) {
    var kind = "dot"
    var r = Rng.random()
    if (r < 0.08) kind = "gold"
    else if (n >= 6 && r < 0.2) kind = "spark"
    else if (n >= 9 && r < 0.32) kind = "dud"
    var sp = kind === "spark" ? 3.2 : 0.9 + Rng.random() * 0.9, a = Rng.random() * Math.PI * 2
    dots.push({ x: 0.5 + Rng.random() * (W - 1), y: 0.5 + Rng.random() * (H - 1), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                kind: kind, hue: Math.floor(Rng.random() * 6), state: "free", t: 0, gen: 0 })
  }
  return dots
}

function makeLevel(s) {
  s.dots = makeDots(s.level)
  s.need = levelSpec(s.level).need
  s.caught = 0
  s.chainPts = 0
  s.used = false
  s.phase = "aim"
  s.maxGen = 0
  s.msg = "LEVEL " + s.level + ": catch " + s.need + " of " + s.dots.length; s.msgT = 2
}

function makeState() {
  var s = { level: 1, score: 0, lives: LIVES, aim: { x: W / 2, y: H / 2 }, t: 0, dead: false, pops: [], msg: "", msgT: 0, endT: 0 }
  makeLevel(s)
  return s
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

function moveAim(state, dx, dy, dt) {
  var s = shallow(state)
  s.aim = { x: Math.max(0.3, Math.min(W - 0.3, s.aim.x + dx * 7 * dt)), y: Math.max(0.3, Math.min(H - 0.3, s.aim.y + dy * 7 * dt)) }
  return s
}

function setAim(state, x, y) {
  var s = shallow(state)
  s.aim = { x: Math.max(0.3, Math.min(W - 0.3, x)), y: Math.max(0.3, Math.min(H - 0.3, y)) }
  return s
}

function burstRadius(d) {
  var full = d.kind === "gold" ? BURST_R * 1.45 : d.kind === "dud" ? BURST_R * 0.55 : d.kind === "player" ? BURST_R * 1.1 : BURST_R
  if (d.t < GROW) return full * d.t / GROW
  if (d.t < GROW + HOLD) return full
  return full * Math.max(0, 1 - (d.t - GROW - HOLD) / FADE)
}

function fire(state) {
  if (state.used || state.phase !== "aim") return state
  var s = shallow(state)
  s.used = true
  s.phase = "chain"
  s.dots = s.dots.concat([{ x: s.aim.x, y: s.aim.y, vx: 0, vy: 0, kind: "player", hue: 0, state: "burst", t: 0, gen: 0 }])
  return s
}

function step(state, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.pops = s.pops.map(function(p) { return { x: p.x, y: p.y - dt * 0.8, text: p.text, t: p.t - dt, big: p.big } }).filter(function(p) { return p.t > 0 })

  if (s.phase === "end") {
    s.endT -= dt
    if (s.endT <= 0) {
      if (s.passed) { s.level++; makeLevel(s) }
      else if (s.lives <= 0) s.dead = true
      else makeLevel(s)
    }
    return s
  }

  var dots = s.dots.map(function(d) { return shallow(d) })
  var bursts = []
  for (var i = 0; i < dots.length; ++i) {
    var d = dots[i]
    if (d.state === "free") {
      d.x += d.vx * dt; d.y += d.vy * dt
      if (d.x < DOT_R) { d.x = DOT_R; d.vx = Math.abs(d.vx) }
      if (d.x > W - DOT_R) { d.x = W - DOT_R; d.vx = -Math.abs(d.vx) }
      if (d.y < DOT_R) { d.y = DOT_R; d.vy = Math.abs(d.vy) }
      if (d.y > H - DOT_R) { d.y = H - DOT_R; d.vy = -Math.abs(d.vy) }
    } else if (d.state === "burst") {
      d.t += dt
      if (d.t > GROW + HOLD + FADE) d.state = "gone"
      else bursts.push(d)
    }
  }
  // Anything touching a live burst joins the chain, one link further on.
  for (var j = 0; j < dots.length; ++j) {
    var f = dots[j]
    if (f.state !== "free") continue
    for (var b = 0; b < bursts.length; ++b) {
      var br = burstRadius(bursts[b]), dx = f.x - bursts[b].x, dy = f.y - bursts[b].y
      if (br > 0.05 && dx * dx + dy * dy < (br + DOT_R) * (br + DOT_R)) {
        f.state = "burst"; f.t = 0; f.gen = bursts[b].gen + 1
        s.caught++
        s.maxGen = Math.max(s.maxGen, f.gen)
        var pts = f.gen * (f.kind === "gold" ? 5 : 1) * 10
        s.chainPts += pts
        s.score += pts
        s.pops = s.pops.concat([{ x: f.x, y: f.y, text: "+" + pts, t: 0.9, big: f.kind === "gold" || f.gen >= 8 }])
        break
      }
    }
  }
  s.dots = dots

  // The chain has run out when nothing is bursting any more.
  if (s.phase === "chain" && !dots.some(function(d) { return d.state === "burst" })) {
    s.phase = "end"
    s.endT = 2
    s.passed = s.caught >= s.need
    if (s.passed) {
      var extra = (s.caught - s.need) * 25 * s.level
      s.score += extra
      s.msg = (s.caught === s.dots.length - 1 ? "CLEAN SWEEP! " : "CLEARED  ") + s.caught + "/" + s.need + (extra ? "  +" + extra : "")
      if (s.caught === s.dots.length - 1) s.score += 500 * s.level
    } else {
      s.lives--
      s.msg = s.lives > 0 ? "MISSED: " + s.caught + " of " + s.need + "  ·  try again" : "OUT OF TRIES"
    }
    s.msgT = 2
  }
  return s
}
