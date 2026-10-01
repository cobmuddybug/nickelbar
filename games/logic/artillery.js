.pragma library
.import "meter.js" as Meter
.import "../../engine/Rng.js" as Rng

// Artillery (after Worms). Three of yours against three of the computer's
// on a hill of destructible ground, taking turns. On your turn you can
// shuffle a little way, then aim and fire: the bazooka flies with the
// wind and bursts on contact; the grenade ignores the wind, bounces, and
// goes off after three seconds. Explosions dig craters, and anything that
// ends up off the island or under the water is gone.
//
// Score is damage dealt, plus 50 per kill and 200 for winning.
//
// Units: W × H, y down. The ground is a height map: ground[i] is the
// surface's y at x = i × STEP.

var W = 44
var H = 26
var STEP = 0.25
var COLS = Math.round(W / STEP) + 1
var WATER = H - 2
var G = 15
var MAX_SPEED = 30
var WORM_R = 0.55
var MOVE_BUDGET = 4
var WALK = 3.2
var PER_TEAM = 3
var WEAPONS = [
  { name: "BAZOOKA", radius: 2.6, damage: 48, wind: true, fuse: 0 },
  { name: "GRENADE", radius: 2.4, damage: 44, wind: false, fuse: 3 }
]

// Rolling island: a few summed sines, pinched down to the water at both
// ends.
function makeGround() {
  var g = [], a = Rng.random() * 6, b = Rng.random() * 6, c = Rng.random() * 6
  for (var i = 0; i < COLS; ++i) {
    var x = i * STEP, t = x / W
    var y = H * 0.55 + Math.sin(t * 6 + a) * 2.6 + Math.sin(t * 11 + b) * 1.4 + Math.sin(t * 23 + c) * 0.5
    var edge = Math.min(t, 1 - t)
    if (edge < 0.08) y += (0.08 - edge) * 80
    g.push(Math.min(H + 2, y))
  }
  return g
}

function groundAt(g, x) {
  if (x < 0 || x > W) return H + 5
  var f = x / STEP, i = Math.floor(f), t = f - i
  if (i >= COLS - 1) return g[COLS - 1]
  return g[i] + (g[i + 1] - g[i]) * t
}

function makeState() {
  var g = makeGround(), worms = []
  // Alternate the teams along the ridge, each on dry land.
  var slots = []
  for (var k = 0; k < PER_TEAM * 2; ++k) slots.push(W * (0.14 + 0.72 * k / (PER_TEAM * 2 - 1)) + (Rng.random() - 0.5) * 3)
  for (var j = 0; j < slots.length; ++j) {
    var x = slots[j]
    worms.push({ team: j % 2, x: x, y: groundAt(g, x) - WORM_R, hp: 100, alive: true, face: x < W / 2 ? 1 : -1 })
  }
  var s = {
    ground: g, worms: worms, turnTeam: 0, next: [0, 0], cur: 0, phase: "aim",
    angle: 0.6, power: 0, powerDir: 1, charging: false, moved: 0, weapon: 0,
    wind: 0, shot: null, blasts: [], t: 0, settleT: 0, dealt: 0, kills: 0, lost: 0,
    msg: "", msgT: 0, cpuT: 0, cpuPlan: null, winner: -1
  }
  s.cur = pickWorm(s, 0)
  newWind(s)
  return s
}

function newWind(s) { s.wind = Math.round((Rng.random() * 2 - 1) * 10) / 10 }

// The next living worm of a team, round-robin.
function pickWorm(s, team) {
  for (var k = 0; k < s.worms.length; ++k) {
    var idx = (s.next[team] + k) % s.worms.length
    var w = s.worms[idx]
    if (w.alive && w.team === team) { s.next[team] = idx + 1; return idx }
  }
  return -1
}

function alive(s, team) {
  var n = 0
  for (var i = 0; i < s.worms.length; ++i) if (s.worms[i].alive && s.worms[i].team === team) n++
  return n
}

function copyWorm(w) { return { team: w.team, x: w.x, y: w.y, hp: w.hp, alive: w.alive, face: w.face } }

function copy(s) {
  var o = {}
  for (var k in s) o[k] = s[k]
  o.worms = s.worms.map(copyWorm)
  o.next = s.next.slice()
  return o
}

function say(s, m) { s.msg = m; s.msgT = 1.8 }

// Direction the shot leaves in, from facing and the aim angle (up is +).
function aimVector(w, angle) { return { x: Math.cos(angle) * w.face, y: -Math.sin(angle) } }

function fire(state) {
  if (state.phase !== "aim") return state
  var s = copy(state), w = s.worms[s.cur], d = aimVector(w, s.angle), sp = MAX_SPEED * Math.max(0.08, s.power)
  s.shot = { x: w.x + d.x * (WORM_R + 0.3), y: w.y + d.y * (WORM_R + 0.3), vx: d.x * sp, vy: d.y * sp, weapon: s.weapon, fuse: WEAPONS[s.weapon].fuse, owner: s.cur }
  s.phase = "flight"
  s.charging = false; s.power = 0
  return s
}

function crater(g, cx, cy, r) {
  var i0 = Math.max(0, Math.floor((cx - r) / STEP)), i1 = Math.min(COLS - 1, Math.ceil((cx + r) / STEP))
  for (var i = i0; i <= i1; ++i) {
    var dx = i * STEP - cx
    if (Math.abs(dx) > r) continue
    var bottom = cy + Math.sqrt(r * r - dx * dx)
    if (g[i] < bottom) g[i] = Math.min(H + 2, bottom)
  }
}

function explode(s, x, y, weapon) {
  var wp = WEAPONS[weapon]
  s.ground = s.ground.slice()
  crater(s.ground, x, y, wp.radius)
  s.blasts = s.blasts.concat([{ x: x, y: y, r: wp.radius, t: 0.45 }])
  for (var i = 0; i < s.worms.length; ++i) {
    var w = s.worms[i]
    if (!w.alive) continue
    var d = Math.sqrt((w.x - x) * (w.x - x) + (w.y - y) * (w.y - y))
    var reach = wp.radius + WORM_R + 0.6
    if (d >= reach) continue
    var dmg = Math.round(wp.damage * (1 - d / reach) + 6)
    dmg = Math.min(dmg, w.hp)
    w.hp -= dmg
    // Knocked a little way from the blast.
    w.x += (w.x >= x ? 1 : -1) * (reach - d) * 0.6
    if (w.team === 1) s.dealt += dmg
    else s.lost += dmg
    s.pops = (s.pops || []).concat([{ x: w.x, y: w.y - 1.2, text: "-" + dmg, team: w.team, t: 1.2 }])
  }
}

// Drop worms onto the ground; kill any that are out of hp, in the water,
// or off the island.
function settleWorms(s) {
  for (var i = 0; i < s.worms.length; ++i) {
    var w = s.worms[i]
    if (!w.alive) continue
    var gy = groundAt(s.ground, w.x) - WORM_R
    w.y = gy
    if (w.hp <= 0 || w.y > WATER - WORM_R * 0.5 || w.x < 0 || w.x > W) {
      w.alive = false; w.hp = 0
      if (w.team === 1) s.kills++
      say(s, (w.team === 0 ? "One of yours" : "Theirs") + (w.y > WATER - WORM_R * 0.5 ? " drowned" : " is down"))
    }
  }
}

function hitsWorm(s, x, y, owner, age) {
  for (var i = 0; i < s.worms.length; ++i) {
    var w = s.worms[i]
    if (!w.alive || (i === owner && age < 0.25)) continue
    if ((w.x - x) * (w.x - x) + (w.y - y) * (w.y - y) < (WORM_R + 0.15) * (WORM_R + 0.15)) return true
  }
  return false
}

function nextTurn(s) {
  settleWorms(s)
  var a0 = alive(s, 0), a1 = alive(s, 1)
  if (!a0 || !a1) { s.phase = "done"; s.winner = a0 ? 0 : a1 ? 1 : -1; return }
  s.turnTeam = 1 - s.turnTeam
  s.cur = pickWorm(s, s.turnTeam)
  s.phase = "aim"; s.moved = 0; s.power = 0; s.powerDir = 1; s.charging = false
  s.angle = 0.6; s.cpuT = 0; s.cpuPlan = null
  newWind(s)
}

// input: { dx (walk), dy (aim: -1 up), hold (charge) }.
function step(state, input, dt) {
  if (state.phase === "done") return state
  var s = copy(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.blasts = s.blasts.map(function(b) { return { x: b.x, y: b.y, r: b.r, t: b.t - dt } }).filter(function(b) { return b.t > 0 })
  s.pops = (s.pops || []).map(function(p) { return { x: p.x, y: p.y - dt, text: p.text, team: p.team, t: p.t - dt } }).filter(function(p) { return p.t > 0 })

  if (s.phase === "aim") {
    if (s.turnTeam === 1) return s   // cpuStep drives the computer's turn
    var w = s.worms[s.cur]
    if (input.dx) {
      w.face = input.dx
      var room = MOVE_BUDGET - s.moved
      if (room > 0) {
        var nx = w.x + input.dx * Math.min(room, WALK * dt)
        var ny = groundAt(s.ground, nx) - WORM_R
        // Too steep to climb: stay put.
        if (ny - w.y > -WALK * dt * 1.6 && nx > 0.5 && nx < W - 0.5) { s.moved += Math.abs(nx - w.x); w.x = nx; w.y = ny }
      }
    }
    if (input.dy) s.angle = Math.max(-1.3, Math.min(1.5, s.angle - input.dy * 1.2 * dt))
    if (input.hold) {
      s.charging = true
      var pm = Meter.swing(s.power, s.powerDir, dt, 0.8, 0.05, 1)
      s.power = pm.v; s.powerDir = pm.dir
    } else if (s.charging) return fire(s)
    return s
  }

  if (s.phase === "flight") {
    var sh = { x: s.shot.x, y: s.shot.y, vx: s.shot.vx, vy: s.shot.vy, weapon: s.shot.weapon, fuse: s.shot.fuse, owner: s.shot.owner, age: (s.shot.age || 0) + dt }
    var wp = WEAPONS[sh.weapon], n = 6, h = dt / n
    for (var k = 0; k < n; ++k) {
      sh.vy += G * h
      if (wp.wind) sh.vx += s.wind * 7 * h
      var ox = sh.x, oy = sh.y
      sh.x += sh.vx * h; sh.y += sh.vy * h
      var gy = groundAt(s.ground, sh.x)
      if (wp.fuse) {
        if (sh.y > gy) {
          // Bounce off the local slope.
          var sl = (groundAt(s.ground, sh.x + 0.2) - groundAt(s.ground, sh.x - 0.2)) / 0.4
          var nl = Math.sqrt(1 + sl * sl), nx2 = sl / nl, ny2 = -1 / nl
          var vn = sh.vx * nx2 + sh.vy * ny2
          if (vn < 0) { sh.vx -= 1.45 * vn * nx2; sh.vy -= 1.45 * vn * ny2 }
          sh.vx *= 0.8; sh.vy *= 0.8
          sh.x = ox; sh.y = Math.min(oy, groundAt(s.ground, ox) - 0.05)
        }
      } else if (sh.y > gy || hitsWorm(s, sh.x, sh.y, sh.owner, sh.age)) {
        explode(s, sh.x, Math.min(sh.y, gy), sh.weapon)
        s.shot = null; s.phase = "settle"; s.settleT = 0.9
        settleWorms(s)
        return s
      }
      if (sh.y > H + 2 || sh.x < -8 || sh.x > W + 8) { s.shot = null; s.phase = "settle"; s.settleT = 0.5; say(s, "Splash"); return s }
    }
    if (wp.fuse) {
      sh.fuse -= dt
      if (sh.fuse <= 0) {
        explode(s, sh.x, sh.y, sh.weapon)
        s.shot = null; s.phase = "settle"; s.settleT = 0.9
        settleWorms(s)
        return s
      }
    }
    s.shot = sh
    return s
  }

  if (s.phase === "settle") {
    s.settleT -= dt
    if (s.settleT <= 0) nextTurn(s)
  }
  return s
}

// ---- computer player -------------------------------------------------------

// Simulate a shot from worm w at (angle, power, face) and report where it
// bursts (ignores worms in the way; good enough for aiming).
function simulate(s, w, face, angle, power, weapon) {
  var d = { x: Math.cos(angle) * face, y: -Math.sin(angle) }, sp = MAX_SPEED * power
  var x = w.x + d.x * (WORM_R + 0.3), y = w.y + d.y * (WORM_R + 0.3), vx = d.x * sp, vy = d.y * sp
  var h = 1 / 60, wp = WEAPONS[weapon]
  for (var t = 0; t < 8; t += h) {
    vy += G * h
    if (wp.wind) vx += s.wind * 7 * h
    x += vx * h; y += vy * h
    if (y > groundAt(s.ground, x)) return { x: x, y: y }
    if (y > H + 2) return { x: x, y: H + 5 }
  }
  return { x: x, y: y }
}

// Pick a shot: try a spread of angles and powers at each of your worms and
// keep the one that lands nearest, then wobble it a little.
// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function cpuPlan(s) {
  var w = s.worms[s.cur], best = null, bestD = 1e9
  for (var i = 0; i < s.worms.length; ++i) {
    var t = s.worms[i]
    if (!t.alive || t.team === w.team) continue
    var face = t.x > w.x ? 1 : -1
    for (var a = -0.2; a <= 1.4; a += 0.1) for (var p = 0.25; p <= 1.0; p += 0.05) {
      var hit = simulate(s, w, face, a, p, 0)
      var d = Math.sqrt((hit.x - t.x) * (hit.x - t.x) + (hit.y - t.y) * (hit.y - t.y))
      // Don't blow yourself up.
      if (Math.abs(hit.x - w.x) < 3) d += 20
      if (d < bestD) { bestD = d; best = { face: face, angle: a, power: p } }
    }
  }
  if (!best) best = { face: 1, angle: 0.8, power: 0.6 }
  best.angle += (Rng.random() - 0.5) * [0.35, 0.14, 0.05][LEVEL]
  best.power = Math.max(0.1, Math.min(1, best.power + (Rng.random() - 0.5) * [0.25, 0.1, 0.03][LEVEL]))
  return best
}

// Advance the computer's turn: think, swing the aim over, fire.
function cpuStep(state, dt) {
  if (state.phase !== "aim" || state.turnTeam !== 1) return state
  var s = copy(state)
  s.cpuT += dt
  if (!s.cpuPlan) { s.cpuPlan = cpuPlan(s); s.weapon = 0 }
  var w = s.worms[s.cur], plan = s.cpuPlan
  w.face = plan.face
  if (s.cpuT < 0.6) return s
  var da = plan.angle - s.angle
  s.angle += Math.max(-1.5 * dt, Math.min(1.5 * dt, da))
  if (Math.abs(da) > 0.01) return s
  s.power = Math.min(plan.power, s.power + dt * 0.8)
  s.charging = true
  if (s.power >= plan.power) { s.power = plan.power; return fire(s) }
  return s
}

function points(s) { return s.dealt + s.kills * 50 + (s.winner === 0 ? 200 : 0) }
