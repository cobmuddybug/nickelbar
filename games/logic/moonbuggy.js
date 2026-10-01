.pragma library
.import "../../engine/Rng.js" as Rng

// Moon Buggy, after the terminal game moon-buggy. Your buggy drives right
// across the moon; jump over craters, and jump over or shoot the rocks.
// It speeds up as you go. Score is distance, plus a bonus per rock shot.
//
// World units: the view is VIEW wide, the buggy sits at BUGGY_X from its
// left edge. Obstacles: { kind: "crater", x, w } gaps in the ground, and
// { kind: "rock", x, w, h } lumps on it.

var VIEW = 16
var BUGGY_X = 3
var BUGGY_W = 1.2
var GRAVITY = 30
var JUMP_V = 11.5
var SHOT_SPEED = 22

function makeState() {
  return { dist: 0, speed: 6, y: 0, vy: 0, obstacles: [], nextAt: 14, shots: [], score: 0, bonus: 0, lives: 3,
           crash: 0, alive: true, cooldown: 0, clock: 0, bits: [] }
}

function copy(s) {
  return { dist: s.dist, speed: s.speed, y: s.y, vy: s.vy, obstacles: s.obstacles, nextAt: s.nextAt, shots: s.shots,
           score: s.score, bonus: s.bonus, lives: s.lives, crash: s.crash, alive: s.alive, cooldown: s.cooldown,
           clock: s.clock, bits: s.bits }
}

function onGround(s) { return s.y <= 0 && s.vy <= 0 }

function jump(s) {
  if (!s.alive || s.crash > 0 || !onGround(s)) return s
  var n = copy(s)
  n.vy = JUMP_V
  return n
}

function fire(s) {
  if (!s.alive || s.crash > 0 || s.cooldown > 0) return s
  var n = copy(s)
  n.shots = s.shots.concat([{ x: s.dist + BUGGY_X + BUGGY_W, y: s.y + 0.5 }])
  n.cooldown = 0.35
  return n
}

// Obstacles spaced so each can be cleared at the current speed; a crater
// and a rock never overlap.
function spawn(s) {
  var obs = s.obstacles.slice(), at = s.nextAt
  var r = Rng.random()
  if (r < 0.5) {
    var w = 1 + Rng.random() * Math.min(2.2, 0.8 + s.dist / 400)
    obs.push({ kind: "crater", x: at, w: w })
    at += w
  } else {
    var h = 0.6 + Rng.random() * 0.6
    obs.push({ kind: "rock", x: at, w: 0.9, h: h, hit: false })
    at += 0.9
    // Sometimes a crater right after, so a jump has to be timed.
    if (s.dist > 150 && Rng.random() < 0.3) { obs.push({ kind: "crater", x: at + 2.5, w: 1.2 }); at += 3.7 }
  }
  var gap = Math.max(4.5, 11 - s.dist / 120) + Rng.random() * 5
  return { obstacles: obs, nextAt: at + gap }
}

function step(state, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.clock = state.clock + dt
  s.bits = state.bits.filter(function(b) { return b.life > dt }).map(function(b) {
    return { x: b.x + b.vx * dt, y: b.y + b.vy * dt, vx: b.vx, vy: b.vy - GRAVITY * 0.5 * dt, life: b.life - dt }
  })
  if (state.crash > 0) {
    s.crash = Math.max(0, state.crash - dt)
    if (s.crash === 0) {
      if (s.lives <= 0) { s.alive = false; return s }
      // Restart a little back from the crash, with the way ahead cleared.
      var from = s.dist + BUGGY_X - 1
      s.obstacles = state.obstacles.filter(function(o) { return o.x + o.w < from - 2 || o.x > from + 10 })
      s.y = 0; s.vy = 0
    }
    return s
  }
  s.cooldown = Math.max(0, state.cooldown - dt)
  s.speed = Math.min(14, 6 + state.dist / 150)
  s.dist = state.dist + s.speed * dt
  s.score = Math.floor(s.dist) + s.bonus
  if (s.dist + VIEW + 2 > state.nextAt) { var sp = spawn(s); s.obstacles = sp.obstacles; s.nextAt = sp.nextAt }
  s.obstacles = s.obstacles.filter(function(o) { return o.x + o.w > s.dist - 2 })

  // Jumping.
  s.vy = state.vy - GRAVITY * dt
  s.y = Math.max(0, state.y + state.vy * dt)
  if (s.y === 0 && s.vy < 0) s.vy = 0

  // Shots fly on and break the first rock they reach.
  var shots = [], obs = s.obstacles
  for (var i = 0; i < state.shots.length; ++i) {
    var sh = { x: state.shots[i].x + SHOT_SPEED * dt, y: state.shots[i].y }
    if (sh.x > s.dist + VIEW + 1) continue
    var hit = -1
    for (var k = 0; k < obs.length; ++k)
      if (obs[k].kind === "rock" && !obs[k].hit && sh.x >= obs[k].x && sh.x <= obs[k].x + obs[k].w + SHOT_SPEED * dt && sh.y <= obs[k].h) { hit = k; break }
    if (hit < 0) { shots.push(sh); continue }
    obs = obs.slice()
    obs[hit] = { kind: "rock", x: obs[hit].x, w: obs[hit].w, h: obs[hit].h, hit: true }
    s.bonus += 25
    for (var p = 0; p < 6; ++p) s.bits = s.bits.concat([{ x: obs[hit].x + 0.4, y: obs[hit].h / 2, vx: (Rng.random() - 0.3) * 6, vy: Rng.random() * 6, life: 0.6 }])
  }
  s.shots = shots
  s.obstacles = obs

  // Crashes: wheels over a crater while on the ground, or into a rock.
  var bx0 = s.dist + BUGGY_X, bx1 = bx0 + BUGGY_W
  for (var j = 0; j < obs.length; ++j) {
    var o = obs[j]
    if (o.kind === "crater" && s.y === 0 && bx0 + 0.3 > o.x && bx1 - 0.3 < o.x + o.w + 0.2 && bx0 + BUGGY_W / 2 > o.x && bx0 + BUGGY_W / 2 < o.x + o.w) { crash(s); break }
    if (o.kind === "rock" && !o.hit && bx1 > o.x + 0.1 && bx0 < o.x + o.w - 0.1 && s.y < o.h - 0.1) { crash(s); break }
  }
  return s
}

function crash(s) {
  s.lives--
  s.crash = 1.2
  for (var p = 0; p < 10; ++p)
    s.bits = s.bits.concat([{ x: s.dist + BUGGY_X + 0.6, y: s.y + 0.4, vx: (Rng.random() - 0.5) * 8, vy: Rng.random() * 8, life: 0.9 }])
}

function serialize(s) { return { dist: s.dist, bonus: s.bonus, lives: s.lives, alive: s.alive } }

function deserialize(o) {
  if (!o || typeof o.dist !== "number" || o.alive === false) return null
  var s = makeState()
  s.dist = o.dist; s.bonus = o.bonus || 0; s.lives = o.lives || 3; s.nextAt = o.dist + 14
  s.score = Math.floor(s.dist) + s.bonus
  return s
}
