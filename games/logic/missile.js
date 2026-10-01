.pragma library
.import "../../engine/Rng.js" as Rng

// Missile Command on a 4:3 field (W x 1). Six cities and three batteries
// sit on the ground; incoming warheads fall on them in waves. The player
// steers a crosshair and fires from the nearest battery that has ammo;
// counter-missiles burst into expanding blasts that take out anything
// passing through (warheads that land blow up too, which can save or cost
// a neighbour). Later waves bring faster warheads that split in the air.
//
// Pure logic, like asteroids.js: step() returns a new state every tick.

var W = 4 / 3
var H = 1
var GROUND = 0.93
var CROSS_SPEED = 0.95      // units/s while a direction is held
var SHOT_SPEED = [1.3, 2.0, 1.3]  // the centre battery fires faster
var AMMO = 10
var BLAST_R = 0.065
var BLAST_GROW = 0.35       // seconds to full size
var BLAST_HOLD = 0.2
var BLAST_FADE = 0.45
var CITY_X = [0.2, 0.33, 0.46, 0.87, 1.0, 1.13]
var BATTERY_X = [0.07, W / 2, W - 0.07]
var CITY_POINTS = 100
var AMMO_POINTS = 5
var WARHEAD_POINTS = 25
var BONUS_CITY_EVERY = 10000

function multiplier(wave) { return Math.min(6, Math.floor((wave + 1) / 2)) }

function batteries() {
  return BATTERY_X.map(function(x) { return { x: x, ammo: AMMO, alive: true } })
}

function makeState() {
  return startWave({ score: 0, wave: 1, cities: [true, true, true, true, true, true], spare: 0,
    nextCityAt: BONUS_CITY_EVERY, cross: { x: W / 2, y: 0.45 }, alive: true })
}

function startWave(base) {
  var wave = base.wave
  return { score: base.score, wave: wave, cities: base.cities.slice(), spare: base.spare,
    nextCityAt: base.nextCityAt, cross: base.cross, alive: true,
    batteries: batteries(), shots: [], enemies: [], blasts: [],
    spawnLeft: 10 + wave * 2, spawnTimer: 1.2, phase: "play", timer: 0, tally: null }
}

function copy(s) {
  return { score: s.score, wave: s.wave, cities: s.cities, spare: s.spare, nextCityAt: s.nextCityAt,
    cross: s.cross, alive: s.alive, batteries: s.batteries, shots: s.shots, enemies: s.enemies,
    blasts: s.blasts, spawnLeft: s.spawnLeft, spawnTimer: s.spawnTimer, phase: s.phase,
    timer: s.timer, tally: s.tally }
}

function citiesLeft(s) {
  var n = 0
  for (var i = 0; i < s.cities.length; ++i) if (s.cities[i]) n++
  return n
}

// Targets still standing: cities and batteries, as ground x positions.
function targets(s) {
  var out = []
  for (var i = 0; i < s.cities.length; ++i) if (s.cities[i]) out.push({ kind: "city", i: i, x: CITY_X[i] })
  for (var b = 0; b < s.batteries.length; ++b) if (s.batteries[b].alive) out.push({ kind: "battery", i: b, x: BATTERY_X[b] })
  return out
}

function warheadSpeed(wave) { return 0.055 + wave * 0.009 }

function spawnWarhead(s, from) {
  var t = targets(s)
  if (!t.length) return null
  var target = t[Math.floor(Rng.random() * t.length)]
  var sx = from ? from.x : Rng.random() * W
  var sy = from ? from.y : 0
  return { sx: sx, sy: sy, x: sx, y: sy, tx: target.x, ty: GROUND,
    speed: warheadSpeed(s.wave) * (0.8 + Rng.random() * 0.4),
    // From wave 3 some warheads split once, somewhere in the upper half.
    splitAt: !from && s.wave >= 3 && Rng.random() < Math.min(0.45, 0.1 + s.wave * 0.04) ? 0.25 + Rng.random() * 0.25 : -1 }
}

function moveCross(state, dx, dy, dt) {
  var s = copy(state)
  s.cross = { x: Math.max(0.01, Math.min(W - 0.01, state.cross.x + dx * CROSS_SPEED * dt)),
    y: Math.max(0.03, Math.min(GROUND - 0.1, state.cross.y + dy * CROSS_SPEED * dt)) }
  return s
}

// Put the crosshair straight at (x, y), for the mouse.
function aim(state, x, y) {
  var s = copy(state)
  s.cross = { x: Math.max(0.01, Math.min(W - 0.01, x)), y: Math.max(0.03, Math.min(GROUND - 0.1, y)) }
  return s
}

// Fire at the crosshair from the closest battery that can.
function fire(state) {
  if (state.phase !== "play" || !state.alive) return state
  var best = -1, bestD = 1e9
  for (var i = 0; i < state.batteries.length; ++i) {
    var b = state.batteries[i]
    if (!b.alive || b.ammo <= 0) continue
    var d = Math.abs(b.x - state.cross.x)
    if (d < bestD) { bestD = d; best = i }
  }
  if (best < 0) return state
  var s = copy(state)
  s.batteries = state.batteries.map(function(b, i) { return i === best ? { x: b.x, ammo: b.ammo - 1, alive: b.alive } : b })
  var sy = GROUND - 0.03
  s.shots = state.shots.concat([{ sx: BATTERY_X[best], sy: sy, x: BATTERY_X[best], y: sy,
    tx: state.cross.x, ty: state.cross.y, speed: SHOT_SPEED[best] }])
  return s
}

function blastRadius(b) {
  if (b.t < BLAST_GROW) return BLAST_R * b.scale * (b.t / BLAST_GROW)
  if (b.t < BLAST_GROW + BLAST_HOLD) return BLAST_R * b.scale
  return BLAST_R * b.scale * Math.max(0, 1 - (b.t - BLAST_GROW - BLAST_HOLD) / BLAST_FADE)
}

function blastDone(b) { return b.t >= BLAST_GROW + BLAST_HOLD + BLAST_FADE }

function advance(p, dt) {
  var dx = p.tx - p.x, dy = p.ty - p.y
  var d = Math.sqrt(dx * dx + dy * dy)
  var stepLen = p.speed * dt
  if (d <= stepLen) return { x: p.tx, y: p.ty, arrived: true }
  return { x: p.x + dx / d * stepLen, y: p.y + dy / d * stepLen, arrived: false }
}

// input: { dx, dy } held direction
function step(state, input, dt) {
  if (!state.alive) return state
  var s = input && (input.dx || input.dy) ? moveCross(state, input.dx, input.dy, dt) : copy(state)

  if (state.phase === "tally") {
    s.timer = state.timer + dt
    if (s.timer > 2.6) {
      var next = startWave({ score: s.score, wave: state.wave + 1, cities: s.cities, spare: s.spare,
        nextCityAt: s.nextCityAt, cross: s.cross })
      return next
    }
    return s
  }

  var mult = multiplier(state.wave)
  var blasts = state.blasts.map(function(b) { return { x: b.x, y: b.y, t: b.t + dt, scale: b.scale, enemy: b.enemy } })
    .filter(function(b) { return !blastDone(b) })

  // Counter-missiles
  var shots = []
  for (var i = 0; i < state.shots.length; ++i) {
    var sh = state.shots[i], a = advance(sh, dt)
    if (a.arrived) blasts.push({ x: sh.tx, y: sh.ty, t: 0, scale: 1, enemy: false })
    else shots.push({ sx: sh.sx, sy: sh.sy, x: a.x, y: a.y, tx: sh.tx, ty: sh.ty, speed: sh.speed })
  }

  // Warheads: spawn, split, fall, get caught in blasts, hit the ground.
  s.spawnTimer = state.spawnTimer - dt
  s.spawnLeft = state.spawnLeft
  var enemies = state.enemies.slice()
  if (s.spawnTimer <= 0 && s.spawnLeft > 0) {
    var burst = Math.min(s.spawnLeft, 1 + Math.floor(Rng.random() * Math.min(4, 1 + state.wave / 2)))
    for (var k = 0; k < burst; ++k) {
      var w = spawnWarhead(state)
      if (w) enemies.push(w)
    }
    s.spawnLeft -= burst
    s.spawnTimer = Math.max(0.9, 3.2 - state.wave * 0.15) * (0.6 + Rng.random() * 0.8)
  }

  var cities = state.cities.slice()
  var bats = state.batteries.map(function(b) { return { x: b.x, ammo: b.ammo, alive: b.alive } })
  var score = state.score
  var moved = []
  for (var e = 0; e < enemies.length; ++e) {
    var en = enemies[e], ad = advance(en, dt)
    var caught = false
    for (var bi = 0; bi < blasts.length; ++bi) {
      var bl = blasts[bi], r = blastRadius(bl)
      if (Math.hypot(ad.x - bl.x, ad.y - bl.y) < r + 0.004) { caught = true; break }
    }
    if (caught) {
      score += WARHEAD_POINTS * mult
      blasts.push({ x: ad.x, y: ad.y, t: 0, scale: 0.6, enemy: false })
      continue
    }
    if (ad.arrived) {
      blasts.push({ x: en.tx, y: GROUND - 0.01, t: 0, scale: 0.9, enemy: true })
      for (var c = 0; c < cities.length; ++c) if (cities[c] && Math.abs(CITY_X[c] - en.tx) < 0.035) cities[c] = false
      for (var b2 = 0; b2 < bats.length; ++b2) if (bats[b2].alive && Math.abs(BATTERY_X[b2] - en.tx) < 0.035) { bats[b2].alive = false; bats[b2].ammo = 0 }
      continue
    }
    if (en.splitAt > 0 && ad.y >= en.splitAt) {
      var parts = 2 + (Rng.random() < 0.4 ? 1 : 0)
      for (var p = 0; p < parts; ++p) {
        var child = spawnWarhead({ cities: cities, batteries: bats, wave: state.wave }, ad)
        if (child) moved.push(child)
      }
      continue
    }
    moved.push({ sx: en.sx, sy: en.sy, x: ad.x, y: ad.y, tx: en.tx, ty: en.ty, speed: en.speed, splitAt: en.splitAt })
  }

  s.shots = shots
  s.enemies = moved
  s.blasts = blasts
  s.cities = cities
  s.batteries = bats
  s.score = score

  if (score >= s.nextCityAt) { s.spare = state.spare + 1; s.nextCityAt += BONUS_CITY_EVERY }

  // Wave over once the sky is clear.
  if (s.spawnLeft <= 0 && !moved.length && !shots.length && !blasts.length) {
    if (!citiesLeft(s)) { s.alive = false; return s }
    var ammo = 0
    for (var q = 0; q < bats.length; ++q) ammo += bats[q].ammo
    var standing = citiesLeft(s)
    var bonus = (standing * CITY_POINTS + ammo * AMMO_POINTS) * mult
    s.score = score + bonus
    // Rebuild a lost city from the spare pool.
    var rebuilt = false
    if (s.spare > 0 && standing < 6) {
      var cs = s.cities.slice()
      cs[cs.indexOf(false)] = true
      s.cities = cs
      s.spare -= 1
      rebuilt = true
    }
    if (s.score >= s.nextCityAt) { s.spare += 1; s.nextCityAt += BONUS_CITY_EVERY }
    s.phase = "tally"
    s.timer = 0
    s.tally = { cities: standing, ammo: ammo, mult: mult, bonus: bonus, rebuilt: rebuilt }
  } else if (!citiesLeft(s) && !moved.length && s.spawnLeft <= 0) {
    s.alive = false
  }
  return s
}

function serialize(s) {
  return { score: s.score, wave: s.wave, cities: s.cities, spare: s.spare, nextCityAt: s.nextCityAt, alive: s.alive }
}

// Resumes at the start of the saved wave.
function deserialize(o) {
  if (!o || typeof o.score !== "number" || o.alive === false || !o.cities) return null
  var n = 0
  for (var i = 0; i < o.cities.length; ++i) if (o.cities[i]) n++
  if (!n) return null
  return startWave({ score: o.score, wave: o.wave || 1, cities: o.cities, spare: o.spare || 0,
    nextCityAt: o.nextCityAt || BONUS_CITY_EVERY, cross: { x: W / 2, y: 0.45 } })
}
