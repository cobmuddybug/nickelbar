.pragma library
.import "../../engine/Rng.js" as Rng

// Raid: a side-scrolling shooter. Hold fire, weave through drone waves and
// gunships, grab capsules to power up (double shot, spread, then a shield),
// and beat the boss that closes each stage. The field is 1.6 wide by 1 high;
// you start on the left and everything comes in from the right.

var W = 1.6
var H = 1.0
var SHIP_R = 0.022
var LIVES = 3

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function makeState() {
  return { ship: { x: 0.2, y: 0.5 }, dx: 0, dy: 0, fire: false, power: 1, shield: false, lives: [5, 3, 2][LEVEL], inv: 1.5, cool: 0,
           bullets: [], enemies: [], shots: [], caps: [], booms: [], t: 0, spawnIn: 1.0, wave: 1, stageT: 0, boss: null,
           kills: 0, score: 0, done: false }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function setInput(s, dx, dy, fire) {
  if (s.dx === dx && s.dy === dy && s.fire === fire) return s
  var o = copy(s); o.dx = dx; o.dy = dy; o.fire = fire; return o
}

function spawn(s, rnd) {
  var d = 1 + (s.wave - 1) * 0.18, r = rnd(), list = s.enemies.slice()
  if (r < 0.45) {                                   // a line of drones riding a sine
    var y0 = 0.2 + rnd() * 0.6, n = 4 + Math.floor(rnd() * 3)
    for (var i = 0; i < n; ++i) list.push({ type: "drone", x: W + 0.06 + i * 0.12, y: y0, y0: y0, hp: 1, t: -i * 0.12, fire: 0, carrier: i === 0 && rnd() < 0.5 })
  } else if (r < 0.75) {
    list.push({ type: "gunner", x: W + 0.05, y: 0.15 + rnd() * 0.7, y0: 0, hp: 3, t: 0, fire: 0.8 + rnd(), carrier: rnd() < 0.4 })
  } else {
    list.push({ type: "diver", x: W + 0.05, y: 0.1 + rnd() * 0.8, y0: 0, hp: 1, t: 0, fire: 0, carrier: false })
  }
  s.enemies = list
  s.spawnIn = Math.max(0.5, (1.5 - d * 0.1) * (0.7 + rnd() * 0.6) * [1.35, 1, 0.8][LEVEL])
}

function aimed(from, to, speed) {
  var dx = to.x - from.x, dy = to.y - from.y, l = Math.hypot(dx, dy) || 1
  return { x: from.x, y: from.y, vx: dx / l * speed, vy: dy / l * speed }
}

function hurt(s) {
  if (s.inv > 0) return
  s._e.push("thud")
  if (s.shield) { s.shield = false; s.inv = 1.0; return }
  s.lives -= 1; s.power = 1; s.inv = 2.2
  s.booms = s.booms.concat([{ x: s.ship.x, y: s.ship.y, life: 0.5 }])
  if (s.lives <= 0) s.done = true
}

function serialize(s) { var o = JSON.parse(JSON.stringify(s)); o.dx = 0; o.dy = 0; o.fire = false; return o }
function deserialize(o) {
  if (!o || !o.ship || !Array.isArray(o.enemies) || o.done || o.lives <= 0) return null
  var s = JSON.parse(JSON.stringify(o)); s.inv = Math.max(s.inv, 2); s.shots = []; return s
}

function step(state, dt, rnd) {
  if (state.done) return state
  rnd = rnd || Rng.random
  var s = copy(state), i, j
  s._e = []
  s.t = state.t + dt; s.stageT = state.stageT + dt
  s.inv = Math.max(0, state.inv - dt); s.cool = state.cool - dt
  s.booms = state.booms.filter(function(b) { return b.life > dt }).map(function(b) { return { x: b.x, y: b.y, life: b.life - dt } })
  var d = 1 + (s.wave - 1) * 0.18
  // Ship.
  var l = Math.hypot(state.dx, state.dy) || 1
  s.ship = { x: clamp(state.ship.x + state.dx / l * 0.75 * dt, 0.03, 1.0), y: clamp(state.ship.y + state.dy / l * 0.75 * dt, 0.03, H - 0.03) }
  var bullets = state.bullets.map(function(b) { return { x: b.x + b.vx * dt, y: b.y + b.vy * dt, vx: b.vx, vy: b.vy } })
    .filter(function(b) { return b.x < W + 0.05 && b.x > -0.05 && b.y > -0.05 && b.y < H + 0.05 })
  if (state.fire && s.cool <= 0) {
    s.cool = 0.16
    s._e.push("tick")
    var sx = s.ship.x + 0.03, sy = s.ship.y
    bullets.push({ x: sx, y: sy, vx: 1.8, vy: 0 })
    if (state.power >= 2) { bullets.push({ x: sx, y: sy - 0.03, vx: 1.8, vy: 0 }); bullets.push({ x: sx, y: sy + 0.03, vx: 1.8, vy: 0 }) }
    if (state.power >= 3) { bullets.push({ x: sx, y: sy, vx: 1.7, vy: -0.4 }); bullets.push({ x: sx, y: sy, vx: 1.7, vy: 0.4 }) }
  }
  // Enemies.
  var enemies = [], shots = state.shots.map(function(b) { return { x: b.x + b.vx * dt, y: b.y + b.vy * dt, vx: b.vx, vy: b.vy } })
    .filter(function(b) { return b.x > -0.05 && b.x < W + 0.1 && b.y > -0.05 && b.y < H + 0.05 })
  var caps = state.caps.map(function(c) { return { x: c.x - 0.25 * dt, y: c.y + Math.sin(s.t * 3 + c.x * 5) * 0.12 * dt, kind: c.kind } }).filter(function(c) { return c.x > -0.05 })
  state.enemies.forEach(function(e) {
    var n = { type: e.type, x: e.x, y: e.y, y0: e.y0, hp: e.hp, t: e.t + dt, fire: e.fire, carrier: e.carrier }
    if (e.type === "drone") { n.x -= (0.5 + 0.08 * d) * dt; n.y = e.y0 + Math.sin(n.t * 4) * 0.12 }
    else if (e.type === "gunner") {
      n.x -= (n.x > 1.15 ? 0.45 : 0.08) * dt
      n.fire -= dt
      if (n.fire <= 0 && n.x < W) { shots.push(aimed(n, s.ship, 0.5 + 0.05 * d)); n.fire = Math.max(0.7, 1.7 - d * 0.12) }
    } else if (e.type === "diver") {
      n.x -= 0.55 * dt; n.y += clamp(s.ship.y - n.y, -1, 1) * 0.6 * dt
    }
    if (n.x > -0.1) enemies.push(n)
  })
  // Boss.
  var boss = state.boss ? { x: state.boss.x, y: state.boss.y, hp: state.boss.hp, max: state.boss.max, t: state.boss.t + dt, fire: state.boss.fire - dt, wave: state.boss.wave } : null
  if (!boss && s.stageT > 40 && enemies.length === 0 && s.wave > 0) {
    boss = { x: W + 0.2, y: 0.5, hp: 40 + s.wave * 18, max: 40 + s.wave * 18, t: 0, fire: 1.5, wave: s.wave }
  } else if (boss) {
    boss.x = Math.max(1.25, boss.x - 0.25 * dt); boss.y = 0.5 + Math.sin(boss.t * 0.9) * 0.3
    if (boss.fire <= 0 && boss.x < W - 0.1) {
      boss.fire = Math.max(0.55, 1.3 - 0.08 * s.wave)
      var base = aimed(boss, s.ship, 0.6)
      shots.push(base)
      var a0 = Math.atan2(base.vy, base.vx)
      for (var k = -1; k <= 1; k += 2) shots.push({ x: boss.x, y: boss.y, vx: Math.cos(a0 + k * 0.35) * 0.6, vy: Math.sin(a0 + k * 0.35) * 0.6 })
    }
  }
  if (!boss && s.stageT <= 40) { s.spawnIn = state.spawnIn - dt; if (s.spawnIn <= 0) { s.enemies = enemies; spawn(s, rnd); enemies = s.enemies } }
  // Bullets hit things.
  var live = []
  bullets.forEach(function(b) {
    var used = false
    for (var e = 0; e < enemies.length && !used; ++e) {
      var en = enemies[e]
      if (Math.abs(b.x - en.x) < 0.035 && Math.abs(b.y - en.y) < 0.035) { en.hp -= 1; used = true }
    }
    if (!used && boss && Math.abs(b.x - boss.x) < 0.09 && Math.abs(b.y - boss.y) < 0.12) { boss.hp -= 1; used = true; s.score += 2 }
    if (!used) live.push(b)
  })
  s.bullets = live
  var alive = []
  enemies.forEach(function(en) {
    if (en.hp > 0) { alive.push(en); return }
    s.kills += 1; s.score += en.type === "gunner" ? 40 : 20; s._e.push("pop")
    s.booms = s.booms.concat([{ x: en.x, y: en.y, life: 0.3 }])
    if (en.carrier) caps.push({ x: en.x, y: en.y, kind: s.power >= 3 && !s.shield ? "shield" : "power" })
  })
  s.enemies = alive
  if (boss && boss.hp <= 0) {
    s._e.push("crash"); s.score += 1500; s.wave += 1; s.stageT = 0; s.booms = s.booms.concat([{ x: boss.x, y: boss.y, life: 0.8 }])
    caps.push({ x: boss.x, y: boss.y, kind: "power" }); caps.push({ x: boss.x, y: boss.y + 0.1, kind: "shield" })
    boss = null; s.shots = []; s.spawnIn = 2
  }
  s.boss = boss
  // The ship gets hit or collects.
  var p = s.ship
  s.shots = shots.filter(function(b) {
    if (Math.hypot(b.x - p.x, b.y - p.y) < SHIP_R + 0.012) { hurt(s); return false }
    return true
  })
  s.enemies = s.enemies.filter(function(en) {
    if (Math.abs(en.x - p.x) < 0.04 && Math.abs(en.y - p.y) < 0.04) { hurt(s); s.score += 10; return false }
    return true
  })
  if (boss && Math.abs(boss.x - p.x) < 0.09 && Math.abs(boss.y - p.y) < 0.12) hurt(s)
  s.caps = caps.filter(function(c) {
    if (Math.hypot(c.x - p.x, c.y - p.y) < 0.045) {
      if (c.kind === "shield") s.shield = true; else s.power = Math.min(3, s.power + 1)
      s._e.push("power")
      s.score += 50
      return false
    }
    return true
  })
  if (s._e.length) { s.ev = s._e; s.evSeq = (state.evSeq || 0) + 1 }
  return s
}
