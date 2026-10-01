.pragma library

// Pitfall: run through a jungle of screens, hop the hazards, grab the
// treasure. World units: one screen is 0..1 wide, the ground is y = 0 and
// up is positive. The jungle is made of N screens generated from a hash of
// their index, so it is the same every game and needs no storage.
//
//   surface  logs (rolling), fire, cobra, tar pit, quicksand (both crossed
//            by swinging on a vine), crocodile pond (hop across on closed
//            mouths), and a hole with a ladder on every third screen
//   tunnel   under each hole: a scorpion, sometimes a brick wall, and a way
//            to skip three surface screens at a time
//
// Points, as in the original: 2000 to start, treasure adds 2000-5000, a
// log/fire/cobra costs 100. Pits, water and scorpions cost a life (three).

var N = 100                 // screens; the last one is the way out
var START_SCORE = 2000
var LIVES = 3
var TIME = 480              // seconds

var WALK = 0.32
var GRAVITY = 2.6
var JUMP_V = 0.9
var JUMP_V_UNDER = 0.62
var LOG_SPEED = 0.27
var PLAYER_W = 0.04
var PLAYER_H = 0.11
var HOLE_X = 0.5
var HOLE_R = 0.05

var PIT_L = 0.25, PIT_R = 0.75
var VINE_X = 0.5, VINE_Y = 0.47, VINE_LEN = 0.4
var VINE_A = 0.9, VINE_W = 2.1
var CROC_X = [0.34, 0.5, 0.66], CROC_HALF = 0.05
var CROC_PERIOD = 2.4, CROC_OPEN = 1.0

var TREASURE_VALUE = [2000, 3000, 4000, 5000]
var TREASURE_NAME = ["money bag", "silver bar", "gold bar", "diamond ring"]

// ---- the jungle ---------------------------------------------------------

function rnd(i, k) {
  var h = (Math.imul(i + 1, 374761393) + Math.imul(k + 1, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// "start", "logs", "fire", "cobra", "tar", "sand", "crocs", "hole" or "clear".
function kind(i) {
  if (i === 0) return "start"
  if (i === N - 1) return "clear"
  if (i % 3 === 1) return "hole"
  var r = rnd(i, 1)
  if (r < 0.26) return "logs"
  if (r < 0.36) return "fire"
  if (r < 0.46) return "cobra"
  if (r < 0.60) return "tar"
  if (r < 0.70) return "sand"
  if (r < 0.82) return "crocs"
  return "clear"
}

function hasLogs(i) {
  var k = kind(i)
  return k === "logs" || (k === "hole" && rnd(i, 3) < 0.4)
}
function hasPit(k) { return k === "tar" || k === "sand" || k === "crocs" }
function hasVine(k) { return k === "tar" || k === "sand" }

// Treasure sits by a screen edge, clear of the hazards.
function treasureAt(i) {
  if (i === 0 || i === N - 1) return null
  if (rnd(i, 2) >= 0.32) return null
  var t = Math.floor(rnd(i, 4) * 4)
  return { x: rnd(i, 5) < 0.5 ? 0.1 : 0.9, type: t, value: TREASURE_VALUE[t] }
}

function countTreasures() {
  var n = 0
  for (var i = 0; i < N; ++i) if (treasureAt(i)) n++
  return n
}

// Which side of a tunnel's ladder the brick wall is on: 0 none, 1 right, -1 left.
function wallAt(i) {
  var r = rnd(i, 6)
  return r < 0.4 ? 0 : (r < 0.7 ? 1 : -1)
}
function wallX(side) { return side > 0 ? 0.78 : 0.2 }

// Vine angle at a given clock.
function vineAngle(clock, i) { return VINE_A * Math.sin(VINE_W * clock + i * 1.7) }
function vineTip(clock, i) {
  var th = vineAngle(clock, i)
  return { x: VINE_X + VINE_LEN * Math.sin(th), y: VINE_Y - VINE_LEN * Math.cos(th),
    vx: VINE_LEN * Math.cos(th) * VINE_A * VINE_W * Math.cos(VINE_W * clock + i * 1.7) }
}

// A crocodile is closed (safe to stand on) for part of each period, with
// the three out of step.
function crocOpen(clock, n) {
  var ph = ((clock + n * 0.8) % CROC_PERIOD + CROC_PERIOD) % CROC_PERIOD
  return ph >= CROC_PERIOD - CROC_OPEN
}
// Seconds until this croc next opens (0 if open now).
function crocWarn(clock, n) {
  var ph = ((clock + n * 0.8) % CROC_PERIOD + CROC_PERIOD) % CROC_PERIOD
  return ph >= CROC_PERIOD - CROC_OPEN ? 0 : (CROC_PERIOD - CROC_OPEN) - ph
}

// ---- state ---------------------------------------------------------------

function makeState() {
  return { i: 0, x: 0.1, y: 0, vy: 0, airVx: null, mode: "run", face: 1,
    lives: LIVES, score: START_SCORE, time: TIME, clock: 0,
    invuln: 0, dead: 0, deadWhy: "", vineCool: 0, holeLock: 0,
    logs: [], logT: 0.6, scorpion: null, taken: {}, treasures: 0,
    flash: "", flashT: 0, alive: true, won: false }
}

function copy(s) {
  var o = {}
  for (var k in s) o[k] = s[k]
  return o
}

function serialize(s) { return JSON.stringify(s) }
function deserialize(str) {
  try {
    var s = typeof str === "string" ? JSON.parse(str) : str
    if (s && typeof s.i === "number" && s.i >= 0 && s.i < N && s.alive && typeof s.mode === "string") return s
  } catch (e) {}
  return null
}

function say(s, text) { s.flash = text; s.flashT = 1.6 }

function die(s, why) {
  s.lives -= 1
  s.dead = 1.0
  s.deadWhy = why
  s.mode = "dead"
  s.vy = 0
  s.airVx = null
  say(s, why)
}

function enterScreen(s, i, x) {
  s.i = i
  s.x = x
  s.logs = []
  s.logT = 0.4
}

// Jump (surface, tunnel) or let go of the vine.
function jump(state) {
  if (!state.alive || state.dead > 0) return state
  var s = copy(state)
  if (state.mode === "run" && state.y === 0) {
    s.mode = "air"; s.vy = JUMP_V; s.airVx = null
  } else if (state.mode === "under" && state.y === 0) {
    s.vy = JUMP_V_UNDER
  } else if (state.mode === "vine") {
    var tip = vineTip(state.clock, state.i)
    s.mode = "air"; s.vy = 0.5; s.airVx = tip.vx; s.vineCool = 0.5
  } else {
    return state
  }
  return s
}

// Is there something to stand on at (x, 0) on this screen?
function standable(s, k, x) {
  if (!hasPit(k)) return true
  if (x <= PIT_L || x >= PIT_R) return true
  if (k === "crocs") {
    for (var n = 0; n < 3; ++n) {
      if (Math.abs(x - CROC_X[n]) < CROC_HALF && !crocOpen(s.clock, n)) return true
    }
  }
  return false
}

function land(s, k) {
  s.y = 0; s.vy = 0; s.airVx = null
  if (standable(s, k, s.x)) { s.mode = "run"; return }
  s.mode = "run"
  die(s, k === "crocs" ? "Eaten by a crocodile" : (k === "tar" ? "Sank in the tar" : "Sank in the quicksand"))
}

// input: { dx: -1|0|1, up: bool }
function step(state, input, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.clock = state.clock + dt
  s.time = state.time - dt
  if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt)
  if (s.vineCool > 0) s.vineCool = Math.max(0, s.vineCool - dt)
  if (s.flashT > 0) s.flashT = Math.max(0, s.flashT - dt)

  if (s.time <= 0) {
    s.time = 0; s.alive = false
    say(s, "Out of time")
    return s
  }

  if (state.dead > 0) {
    s.dead = state.dead - dt
    if (s.dead <= 0) {
      s.dead = 0
      if (s.lives <= 0) { s.alive = false; return s }
      s.mode = "run"; s.y = 0; s.vy = 0; s.x = 0.1; s.face = 1
      s.logs = []; s.logT = 0.6
      s.invuln = 2
      s.holeLock = 0
    }
    return s
  }

  var dx = input.dx || 0
  if (dx) s.face = dx
  var k = kind(s.i)

  // Surface logs roll in from the right while you are up top.
  if (s.mode !== "under" && hasLogs(s.i)) {
    var logs = []
    for (var q = 0; q < state.logs.length; ++q) {
      var nx = state.logs[q].x - LOG_SPEED * dt
      if (nx > -0.1) logs.push({ x: nx })
    }
    s.logT = state.logT - dt
    if (s.logT <= 0) {
      logs.push({ x: 1.06 })
      s.logT = 1.5 + rnd(s.i * 7 + Math.floor(s.clock), 8) * 1.5
    }
    s.logs = logs
  }

  if (s.mode === "run" || s.mode === "air") stepSurface(s, k, dx, dt)
  else if (s.mode === "vine") stepVine(s, k)
  else if (s.mode === "under") stepUnder(s, input, dx, dt)

  if (s.alive && s.won) s.alive = false
  return s
}

function stepSurface(s, k, dx, dt) {
  if (s.mode === "run") {
    s.x += dx * WALK * dt
  } else {
    s.x += (s.airVx !== null ? s.airVx : dx * WALK) * dt
    s.vy -= GRAVITY * dt
    s.y += s.vy * dt
  }

  // Off the edge of the screen.
  if (s.x > 1) {
    if (s.i >= N - 1) {
      s.won = true
      s.score = Math.min(114000, s.score + Math.floor(s.time) * 10)
      say(s, "Out of the jungle")
      s.x = 1
      return
    }
    enterScreen(s, s.i + 1, 0.02)
    k = kind(s.i)
  } else if (s.x < 0) {
    if (s.i === 0) s.x = 0
    else { enterScreen(s, s.i - 1, 0.98); k = kind(s.i) }
  }

  // Vine: grab it in mid-air.
  if (s.mode === "air" && hasVine(k) && s.vineCool <= 0) {
    var tip = vineTip(s.clock, s.i)
    if (Math.abs(s.x - tip.x) < 0.06 && Math.abs((s.y + 0.09) - tip.y) < 0.07) {
      s.mode = "vine"; s.airVx = null; s.vy = 0
      stepVine(s, k)
      return
    }
  }

  if (s.mode === "air" && s.y <= 0 && s.vy <= 0) land(s, k)
  else if (s.mode === "run" && !standable(s, k, s.x)) {
    die(s, k === "crocs" ? "Fell in with the crocodiles" : (k === "tar" ? "Sank in the tar" : "Sank in the quicksand"))
    return
  }
  if (s.dead > 0) return

  // A hole drops you into the tunnel (no penalty), unless you have just
  // climbed out of it and are still standing on it.
  if (s.holeLock && Math.abs(s.x - HOLE_X) >= HOLE_R + 0.01) s.holeLock = 0
  if (k === "hole" && s.mode === "run" && !s.holeLock && Math.abs(s.x - HOLE_X) < HOLE_R) {
    descend(s)
    return
  }

  // Treasure.
  var tr = treasureAt(s.i)
  if (tr && !s.taken[s.i] && Math.abs(s.x - tr.x) < 0.05 && s.y < 0.12) {
    var taken = {}
    for (var key in s.taken) taken[key] = true
    taken[s.i] = true
    s.taken = taken
    s.treasures += 1
    s.score = Math.min(114000, s.score + tr.value)
    say(s, "+" + tr.value + " " + TREASURE_NAME[tr.type])
  }

  // Things that cost points.
  if (s.invuln <= 0) {
    var hit = ""
    for (var q = 0; q < s.logs.length; ++q) {
      if (Math.abs(s.x - s.logs[q].x) < 0.05 && s.y < 0.07) hit = "Log"
    }
    if (k === "fire" && Math.abs(s.x - 0.5) < 0.045 && s.y < 0.07) hit = "Fire"
    if (k === "cobra" && Math.abs(s.x - 0.5) < 0.04 && s.y < 0.08) hit = "Cobra"
    if (hit) {
      s.score = Math.max(0, s.score - 100)
      s.invuln = 1.2
      say(s, hit + "! -100")
    }
  }
}

function stepVine(s, k) {
  var tip = vineTip(s.clock, s.i)
  s.x = tip.x
  s.y = tip.y - 0.09
  s.vy = 0
}

function descend(s) {
  s.mode = "under"
  s.x = HOLE_X
  s.y = 0; s.vy = 0; s.airVx = null
  s.invuln = Math.max(s.invuln, 1.0)
  var side = wallAt(s.i)
  s.scorpion = { x: side > 0 ? 0.25 : (side < 0 ? 0.75 : 0.25), dir: side < 0 ? -1 : 1 }
  s.logs = []
}

function stepUnder(s, input, dx, dt) {
  var side = wallAt(s.i)
  var lo = side < 0 ? wallX(side) + 0.03 : 0
  var hi = side > 0 ? wallX(side) - 0.03 : 1.01
  s.x += dx * WALK * dt
  if (s.x > hi) s.x = hi
  if (s.x < lo) s.x = lo

  if (s.y > 0 || s.vy > 0) {
    s.vy -= GRAVITY * dt
    s.y += s.vy * dt
    if (s.y <= 0) { s.y = 0; s.vy = 0 }
  }

  // Off either end: three surface screens at a time.
  if (s.x > 1) {
    if (s.i + 3 < N - 1) { enterScreen(s, s.i + 3, 0.02); s.scorpion = freshScorpion(s.i) }
    else s.x = 1
  } else if (s.x < 0) {
    if (s.i - 3 >= 1) { enterScreen(s, s.i - 3, 0.98); s.scorpion = freshScorpion(s.i) }
    else s.x = 0
  }

  // Scorpion.
  var sc = s.scorpion
  if (sc) {
    var side2 = wallAt(s.i)
    var slo = side2 < 0 ? wallX(side2) + 0.08 : 0.08
    var shi = side2 > 0 ? wallX(side2) - 0.08 : 0.92
    var nx = sc.x + sc.dir * 0.2 * dt
    var dir = sc.dir
    if (nx > shi) { nx = shi; dir = -1 }
    if (nx < slo) { nx = slo; dir = 1 }
    s.scorpion = { x: nx, dir: dir }
    if (s.invuln <= 0 && Math.abs(s.x - nx) < 0.05 && s.y < 0.05) {
      die(s, "Stung by a scorpion")
      return
    }
  }

  // Ladder up.
  if (input.up && Math.abs(s.x - HOLE_X) < HOLE_R && s.y < 0.1) {
    s.mode = "air"; s.y = 0; s.vy = 0.7; s.x = HOLE_X; s.airVx = 0
    s.holeLock = 1
    s.scorpion = null
  }
}

function freshScorpion(i) {
  var side = wallAt(i)
  return { x: rnd(i, 9) < 0.5 ? 0.3 : 0.7, dir: side < 0 ? -1 : 1 }
}

function score(state) { return state.score }
