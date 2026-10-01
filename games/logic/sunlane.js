.pragma library
.import "../../engine/Rng.js" as Rng

// Sunlane (after Space Harrier): a rail shooter. You skim over an endless
// chequered plain, free to move anywhere on the screen, while things come
// at you out of the horizon: enemies that shoot back, and columns rooted in
// the ground. Shoot the enemies; dodge the rest. Three lives, no end.
//
// World: x in -1..1 (left..right), y in 0..1 (ground..sky), z in 0..1
// (z = 0 is the plane you fly in; z = 1 is the horizon). Everything comes
// toward you, i.e. z falls.

var LIVES = 3
var SHIP_Z = 0.03
var SHIP_R = { x: 0.16, y: 0.13 }
var ENEMY_R = { x: 0.17, y: 0.15 }
var SHOT_SPEED = 1.5
var FIRE_RATE = 7           // shots per second while held
var MOVE_X = 1.5, MOVE_Y = 1.15

function rnd() { return Rng.random() }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function makeState() {
  return {
    ship: { x: 0, y: 0.35, tx: 0, ty: 0.35 },
    enemies: [], columns: [], shots: [], eshots: [], bursts: [],
    lives: LIVES, invuln: 0, score: 0, alive: true, t: 0, scroll: 0,
    cooldown: 0, spawnEnemy: 1.2, spawnColumn: 2.0, kills: 0, level: 1, flash: 0
  }
}

function speedFactor(s) { return 1 + (s.level - 1) * 0.09 }

function setTarget(s, x, y) {
  var o = {}
  for (var k in s) o[k] = s[k]
  o.ship = { x: s.ship.x, y: s.ship.y, tx: clamp(x, -1, 1), ty: clamp(y, 0.04, 0.92) }
  return o
}

function spawnFormation(s) {
  var kind = Math.floor(rnd() * 4), out = [], n, i
  var speed = 0.26 * speedFactor(s)
  var baseX = (rnd() * 1.4) - 0.7, baseY = 0.2 + rnd() * 0.55
  if (kind === 0) {              // a single fast one
    out.push({ x: baseX, y: baseY, z: 1, vz: speed * 1.5, phase: rnd() * 6, wob: 0.15, fireIn: 1.0 + rnd() })
  } else if (kind === 1) {       // a line across
    n = 4
    for (i = 0; i < n; ++i) out.push({ x: -0.75 + i * 0.5, y: baseY, z: 1 + i * 0.035, vz: speed, phase: 0, wob: 0.06, fireIn: 1.5 + rnd() * 2 })
  } else if (kind === 2) {       // a V
    n = 5
    for (i = 0; i < n; ++i) {
      var k = i - 2
      out.push({ x: k * 0.32, y: clamp(baseY + Math.abs(k) * 0.07, 0.1, 0.9), z: 1 + Math.abs(k) * 0.06, vz: speed, phase: 0, wob: 0.05, fireIn: 1.8 + rnd() * 2 })
    }
  } else {                       // a weaving pair
    for (i = 0; i < 2; ++i) out.push({ x: i ? 0.5 : -0.5, y: baseY, z: 1 + i * 0.1, vz: speed * 1.1, phase: i * 3.1, wob: 0.55, fireIn: 1.2 + rnd() })
  }
  return out
}

function step(s, input, dt) {
  if (!s.alive) return s
  var fire = input && input.fire
  var ship = { x: s.ship.x, y: s.ship.y, tx: s.ship.tx, ty: s.ship.ty }
  var dx = ship.tx - ship.x, dy = ship.ty - ship.y
  ship.x += clamp(dx, -MOVE_X * dt, MOVE_X * dt)
  ship.y += clamp(dy, -MOVE_Y * dt, MOVE_Y * dt)
  var t = s.t + dt, sf = speedFactor(s)
  var level = 1 + Math.floor(t / 30)
  var score = s.score, kills = s.kills, lives = s.lives, invuln = Math.max(0, s.invuln - dt), flash = Math.max(0, s.flash - dt)
  var cooldown = s.cooldown - dt
  var shots = s.shots.map(function(o) { return { x: o.x, y: o.y, z: o.z + SHOT_SPEED * dt } })
  var newShots = []
  if (fire && cooldown <= 0) { newShots.push({ x: ship.x, y: ship.y, z: SHIP_Z }); cooldown = 1 / FIRE_RATE }
  var speedZ = 0.55 * sf
  // ---- spawning
  var spawnEnemy = s.spawnEnemy - dt, spawnColumn = s.spawnColumn - dt
  var enemies = s.enemies.map(function(e) { return { x: e.x, y: e.y, z: e.z - e.vz * dt, vz: e.vz, phase: e.phase + dt * 2.2, wob: e.wob, fireIn: e.fireIn - dt, bx: e.bx === undefined ? e.x : e.bx, by: e.by === undefined ? e.y : e.by } })
  enemies.forEach(function(e) { if (e.bx === e.x && e.by === e.y && e.baseSet === undefined) { e.baseSet = true } })
  var columns = s.columns.map(function(c) { return { x: c.x, z: c.z - speedZ * dt, h: c.h } })
  if (spawnEnemy <= 0) {
    var f = spawnFormation({ level: level })
    for (var i = 0; i < f.length; ++i) { f[i].bx = f[i].x; f[i].by = f[i].y; enemies.push(f[i]) }
    spawnEnemy = Math.max(1.0, 3.0 - level * 0.18) + rnd() * 1.2
  }
  if (spawnColumn <= 0) {
    var cx = rnd() * 1.7 - 0.85, run = rnd() < 0.35 ? 3 : 1
    for (var r = 0; r < run; ++r) columns.push({ x: clamp(cx + (r - (run - 1) / 2) * 0.28, -1, 1), z: 1 + r * 0.02, h: 0.18 + rnd() * 0.32 })
    spawnColumn = Math.max(0.7, 1.9 - level * 0.1) + rnd() * 1.0
  }
  // ---- enemy motion and fire
  var eshots = s.eshots.map(function(o) { return { x: o.x + o.vx * dt, y: o.y + o.vy * dt, z: o.z + o.vz * dt, vx: o.vx, vy: o.vy, vz: o.vz } })
  for (var j = 0; j < enemies.length; ++j) {
    var e = enemies[j]
    e.x = clamp(e.bx + Math.sin(e.phase) * e.wob, -1, 1)
    e.y = clamp(e.by + Math.cos(e.phase * 0.8) * e.wob * 0.35, 0.06, 0.94)
    if (e.fireIn <= 0 && e.z > 0.25 && e.z < 0.9) {
      var vz = -0.75 * sf, tt = (e.z - SHIP_Z) / -vz
      eshots.push({ x: e.x, y: e.y, z: e.z, vx: (ship.x - e.x) / tt, vy: (ship.y - e.y) / tt, vz: vz })
      e.fireIn = 1.8 + rnd() * 2.2 / Math.min(2, sf)
    }
  }
  // ---- player shots vs enemies, columns
  var bursts = s.bursts.map(function(b) { return { x: b.x, y: b.y, z: b.z, age: b.age + dt } }).filter(function(b) { return b.age < 0.45 })
  var liveShots = [], all = shots.concat(newShots)
  for (var q = 0; q < all.length; ++q) {
    var sh = all[q], zPrev = sh.z - SHOT_SPEED * dt, dead = false
    if (sh.z > 1.05) continue
    for (var w = 0; w < enemies.length && !dead; ++w) {
      var en = enemies[w]
      if (en.dead) continue
      if (zPrev - 0.03 <= en.z && sh.z + 0.03 >= en.z) {
        var ex = (sh.x - en.x) / ENEMY_R.x, ey = (sh.y - en.y) / ENEMY_R.y
        if (ex * ex + ey * ey < 1) {
          en.dead = true; dead = true; kills++
          score += Math.round(100 * (1.2 - en.z * 0.6))
          bursts.push({ x: en.x, y: en.y, z: en.z, age: 0 })
        }
      }
    }
    if (!dead) for (var c = 0; c < columns.length && !dead; ++c) {
      var col = columns[c]
      if (zPrev - 0.03 <= col.z && sh.z + 0.03 >= col.z && Math.abs(sh.x - col.x) < 0.1 && sh.y < col.h) dead = true
    }
    if (!dead) liveShots.push(sh)
  }
  enemies = enemies.filter(function(e) { return !e.dead })
  // ---- hazards vs ship
  var hit = false
  if (invuln <= 0) {
    for (var a = 0; a < enemies.length; ++a) {
      var ee = enemies[a]
      if (ee.z < SHIP_Z + 0.05 && ee.z > SHIP_Z - 0.07) {
        var hx = (ee.x - ship.x) / (ENEMY_R.x + SHIP_R.x * 0.5), hy = (ee.y - ship.y) / (ENEMY_R.y + SHIP_R.y * 0.5)
        if (hx * hx + hy * hy < 1) { hit = true; ee.dead = true; bursts.push({ x: ee.x, y: ee.y, z: ee.z, age: 0 }) }
      }
    }
    for (var b2 = 0; b2 < columns.length; ++b2) {
      var cc = columns[b2]
      if (cc.z < SHIP_Z + 0.04 && cc.z > SHIP_Z - 0.06 && Math.abs(cc.x - ship.x) < 0.11 + SHIP_R.x * 0.5 && ship.y < cc.h + SHIP_R.y * 0.5) hit = true
    }
    for (var d = 0; d < eshots.length; ++d) {
      var es = eshots[d]
      if (es.z < SHIP_Z + 0.04 && es.z > SHIP_Z - 0.08) {
        var sx = (es.x - ship.x) / SHIP_R.x, sy = (es.y - ship.y) / SHIP_R.y
        if (sx * sx + sy * sy < 1) { hit = true; es.z = -1 }
      }
    }
  }
  enemies = enemies.filter(function(e) { return !e.dead && e.z > -0.1 })
  eshots = eshots.filter(function(e) { return e.z > -0.1 })
  columns = columns.filter(function(c2) { return c2.z > -0.1 })
  var alive = true
  if (hit) {
    lives--; invuln = 2.0; flash = 0.35
    bursts.push({ x: ship.x, y: ship.y, z: SHIP_Z, age: 0 })
    if (lives <= 0) alive = false
  }
  score += Math.round(10 * dt * 10) / 10
  return { ship: ship, enemies: enemies, columns: columns, shots: liveShots, eshots: eshots, bursts: bursts,
           lives: lives, invuln: invuln, score: score, alive: alive, t: t, scroll: s.scroll + speedZ * dt,
           cooldown: cooldown, spawnEnemy: spawnEnemy, spawnColumn: spawnColumn, kills: kills, level: level, flash: flash }
}

function serialize(s) { return s }
function deserialize(o) {
  if (!o || !o.ship || !o.enemies) return null
  return o
}
