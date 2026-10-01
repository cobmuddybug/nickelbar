.pragma library
.import "../../engine/Rng.js" as Rng

// Asteroids on a wrapping 4:3 field (W x 1). Pure logic: step(state, input,
// dt) returns a new state every tick (see snake.js for why QML needs new
// references). Rocks split large -> medium -> small; each wave adds one
// large rock. A respawned ship is briefly invulnerable.

var W = 4 / 3
var H = 1
var TURN_SPEED = 4.2      // rad/s
var THRUST = 0.9          // units/s^2
var DRAG = 0.55           // fraction of speed kept per second
var MAX_SPEED = 0.75
var BULLET_SPEED = 1.1
var BULLET_LIFE = 0.8     // seconds
var MAX_BULLETS = 5
var FIRE_COOLDOWN = 0.16
var SHIP_R = 0.022
var ROCK_R = [0, 0.028, 0.05, 0.085]     // index = size
var ROCK_SCORE = [0, 100, 50, 20]
var INVULN = 2.2

function wrap(v, max) { return ((v % max) + max) % max }

function makeRock(x, y, size, speedScale) {
  var a = Rng.random() * Math.PI * 2
  var sp = (0.05 + Rng.random() * 0.08) * (4 - size) * 0.6 * (speedScale || 1)
  var verts = []
  var n = 9 + Math.floor(Rng.random() * 4)
  for (var i = 0; i < n; ++i) verts.push(0.72 + Rng.random() * 0.36)
  return { x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: size,
    rot: Rng.random() * Math.PI * 2, spin: (Rng.random() - 0.5) * 1.6, verts: verts }
}

function spawnWave(wave, ship) {
  var rocks = []
  var count = 3 + wave
  for (var i = 0; i < count; ++i) {
    var x, y, guard = 0
    do {
      x = Rng.random() * W; y = Rng.random() * H
    } while (guard++ < 50 && Math.hypot(x - ship.x, y - ship.y) < 0.35)
    rocks.push(makeRock(x, y, 3, 1 + wave * 0.08))
  }
  return rocks
}

function freshShip() { return { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: INVULN } }

function makeState() {
  var ship = freshShip()
  return { ship: ship, rocks: spawnWave(1, ship), bullets: [], sparks: [], score: 0, lives: 3,
    wave: 1, alive: true, cooldown: 0, respawn: 0, thrusting: false, nextLifeAt: 10000 }
}

function copy(s) {
  return { ship: s.ship, rocks: s.rocks, bullets: s.bullets, sparks: s.sparks, score: s.score,
    lives: s.lives, wave: s.wave, alive: s.alive, cooldown: s.cooldown, respawn: s.respawn,
    thrusting: s.thrusting, nextLifeAt: s.nextLifeAt }
}

function fire(state) {
  if (!state.alive || state.respawn > 0 || state.cooldown > 0 || state.bullets.length >= MAX_BULLETS) return state
  var s = copy(state), sh = state.ship
  var dx = Math.cos(sh.a), dy = Math.sin(sh.a)
  s.bullets = state.bullets.concat([{ x: wrap(sh.x + dx * SHIP_R, W), y: wrap(sh.y + dy * SHIP_R, H),
    vx: sh.vx + dx * BULLET_SPEED, vy: sh.vy + dy * BULLET_SPEED, life: BULLET_LIFE }])
  s.cooldown = FIRE_COOLDOWN
  return s
}

// Shortest wrapped distance, so collisions work across the seams.
function dist(ax, ay, bx, by) {
  var dx = Math.abs(ax - bx), dy = Math.abs(ay - by)
  dx = Math.min(dx, W - dx); dy = Math.min(dy, H - dy)
  return Math.sqrt(dx * dx + dy * dy)
}

function burst(sparks, x, y, n) {
  var out = sparks.slice()
  for (var i = 0; i < n; ++i) {
    var a = Rng.random() * Math.PI * 2, sp = 0.1 + Rng.random() * 0.25
    out.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + Rng.random() * 0.4 })
  }
  return out.length > 120 ? out.slice(out.length - 120) : out
}

// input: { turn: -1|0|1, thrust: bool }
function step(state, input, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.cooldown = Math.max(0, state.cooldown - dt)

  // Ship
  var sh = state.ship
  if (state.respawn > 0) {
    s.respawn = Math.max(0, state.respawn - dt)
    if (s.respawn === 0) s.ship = freshShip()
  } else {
    var a = sh.a + (input.turn || 0) * TURN_SPEED * dt
    var vx = sh.vx, vy = sh.vy
    s.thrusting = !!input.thrust
    if (input.thrust) { vx += Math.cos(a) * THRUST * dt; vy += Math.sin(a) * THRUST * dt }
    var keep = Math.pow(DRAG, dt)
    vx *= keep; vy *= keep
    var sp = Math.sqrt(vx * vx + vy * vy)
    if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp }
    s.ship = { x: wrap(sh.x + vx * dt, W), y: wrap(sh.y + vy * dt, H), a: a, vx: vx, vy: vy,
      inv: Math.max(0, sh.inv - dt) }
  }

  // Bullets
  var bullets = []
  for (var i = 0; i < state.bullets.length; ++i) {
    var b = state.bullets[i]
    var life = b.life - dt
    if (life > 0) bullets.push({ x: wrap(b.x + b.vx * dt, W), y: wrap(b.y + b.vy * dt, H), vx: b.vx, vy: b.vy, life: life })
  }

  // Rocks move; bullets split them.
  var rocks = [], sparks = state.sparks, score = state.score
  var spent = {}
  for (var r = 0; r < state.rocks.length; ++r) {
    var rk = state.rocks[r]
    var moved = { x: wrap(rk.x + rk.vx * dt, W), y: wrap(rk.y + rk.vy * dt, H), vx: rk.vx, vy: rk.vy,
      size: rk.size, rot: rk.rot + rk.spin * dt, spin: rk.spin, verts: rk.verts }
    var hit = -1
    for (var bi = 0; bi < bullets.length; ++bi) {
      if (spent[bi]) continue
      if (dist(bullets[bi].x, bullets[bi].y, moved.x, moved.y) < ROCK_R[rk.size]) { hit = bi; break }
    }
    if (hit < 0) { rocks.push(moved); continue }
    spent[hit] = true
    score += ROCK_SCORE[rk.size]
    sparks = burst(sparks, moved.x, moved.y, 4 + rk.size * 3)
    if (rk.size > 1) {
      rocks.push(makeRock(moved.x, moved.y, rk.size - 1, 1 + state.wave * 0.08))
      rocks.push(makeRock(moved.x, moved.y, rk.size - 1, 1 + state.wave * 0.08))
    }
  }
  s.bullets = bullets.filter(function(_, idx) { return !spent[idx] })

  // Ship vs rocks
  if (s.respawn === 0 && s.ship.inv <= 0) {
    for (var k = 0; k < rocks.length; ++k) {
      if (dist(s.ship.x, s.ship.y, rocks[k].x, rocks[k].y) < ROCK_R[rocks[k].size] + SHIP_R * 0.7) {
        sparks = burst(sparks, s.ship.x, s.ship.y, 18)
        s.lives = state.lives - 1
        if (s.lives <= 0) s.alive = false
        else s.respawn = 1.2
        s.thrusting = false
        break
      }
    }
  }

  // Extra life every 10k.
  if (score >= s.nextLifeAt) { s.lives += 1; s.nextLifeAt += 10000 }

  // Sparks
  var nextSparks = []
  for (var p = 0; p < sparks.length; ++p) {
    var sp2 = sparks[p], l2 = sp2.life - dt
    if (l2 > 0) nextSparks.push({ x: sp2.x + sp2.vx * dt, y: sp2.y + sp2.vy * dt, vx: sp2.vx, vy: sp2.vy, life: l2 })
  }
  s.sparks = nextSparks
  s.score = score
  s.rocks = rocks

  if (!rocks.length && s.alive) {
    s.wave = state.wave + 1
    s.rocks = spawnWave(s.wave, s.ship)
    s.ship = { x: s.ship.x, y: s.ship.y, a: s.ship.a, vx: s.ship.vx, vy: s.ship.vy, inv: INVULN }
  }
  return s
}

function serialize(state) {
  return { score: state.score, lives: state.lives, wave: state.wave, alive: state.alive, nextLifeAt: state.nextLifeAt }
}

// Resumes at the same wave/score/lives with a fresh field.
function deserialize(obj) {
  if (!obj || typeof obj.score !== "number" || obj.alive === false) return null
  var s = makeState()
  s.score = obj.score; s.lives = obj.lives || 3; s.wave = obj.wave || 1
  s.nextLifeAt = obj.nextLifeAt || 10000
  s.rocks = spawnWave(s.wave, s.ship)
  return s
}
