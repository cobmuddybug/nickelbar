.pragma library
.import "meter.js" as Meter
.import "../../engine/Rng.js" as Rng

// Kitty Launch (after Kitten Cannon, with Toss the Turtle's shop). Fire
// the kitty from the cannon and see how far it gets. Along the way:
//   TNT      blasts it on, up and forward
//   spring   throws it high
//   balloon  a bounce in mid-air
//   trap     snaps shut: the flight ends there (a shield saves you once)
// In the air, SPACE fires a rocket boost while you have any left.
// Coins from each flight buy upgrades between launches: a bigger cannon,
// more boosts, bouncier fur, a shield. Ten launches; score is the best.
//
// World: metres, x forward, y up; the ground is y = 0.

var LAUNCHES = 10
var G = 16
var R = 0.5
var SHOP = [
  { id: "power", name: "CANNON", max: 6, cost: [60, 120, 220, 380, 600, 900], desc: "+15% launch speed" },
  { id: "boosts", name: "ROCKETS", max: 5, cost: [50, 110, 200, 330, 500], desc: "+1 mid-air boost" },
  { id: "bounce", name: "BOUNCY FUR", max: 4, cost: [80, 180, 320, 520], desc: "keeps more speed on each bounce" },
  { id: "shield", name: "SHIELD", max: 3, cost: [100, 250, 450], desc: "shrug off one trap per flight" }
]

function makeState() {
  return {
    phase: "aim", launch: 1, coins: 0, best: 0, last: 0, total: 0,
    up: { power: 0, boosts: 0, bounce: 0, shield: 0 },
    angle: 0.75, power: 0, powerDir: 1, charging: false,
    kitty: null, objects: [], genX: 0, cam: { x: 0, y: 0 }, t: 0, spin: 0,
    boostsLeft: 0, shieldLeft: 0, pops: [], shopCursor: 0, msg: "LAUNCH 1", msgT: 1.5, done: false, stopT: 0, trapped: false, booms: [], prevBoost: false
  }
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

function launchSpeed(s) { return 22 * (1 + 0.15 * s.up.power) }

// Things along the ground ahead, placed as the kitty goes.
function gen(s, upto) {
  while (s.genX < upto) {
    s.genX += 14 + Rng.random() * 26
    var r = Rng.random(), kind = r < 0.3 ? "tnt" : r < 0.55 ? "spring" : r < 0.75 ? "balloon" : "trap"
    if (s.genX < 30 && kind === "trap") kind = "spring"
    s.objects.push({ kind: kind, x: s.genX, y: kind === "balloon" ? 5 + Rng.random() * 10 : 0, used: false })
  }
}

function fire(state) {
  if (state.phase !== "aim") return state
  var s = shallow(state), v = launchSpeed(s) * Math.max(0.2, s.power)
  var mx = 1.6 + Math.cos(s.angle) * 1.8, my = 1.4 + Math.sin(s.angle) * 1.8
  s.kitty = { x: mx, y: my, vx: Math.cos(s.angle) * v, vy: Math.sin(s.angle) * v }
  s.phase = "flight"
  s.objects = []; s.genX = 20
  gen(s, 200)
  s.boostsLeft = 1 + s.up.boosts
  s.shieldLeft = s.up.shield
  s.charging = false; s.power = 0
  s.spin = 0; s.stopT = 0; s.trapped = false; s.trapT = 0
  s.booms = [{ x: mx, y: my, t: 0.4 }]
  return s
}

function pop(s, x, y, text) { s.pops = s.pops.concat([{ x: x, y: y, text: text, t: 1 }]) }

function land(s) {
  var dist = Math.max(0, Math.floor(s.kitty.x))
  s.last = dist
  s.best = Math.max(s.best, dist)
  s.total += dist
  var coins = Math.floor(dist / 2)
  s.coins += coins
  s.phase = "landed"
  s.msg = dist + " m" + (dist >= s.best && dist > 0 ? "  NEW BEST!" : "") + "  ·  +" + coins + " coins"; s.msgT = 99
}

// input: { dy (aim), hold, boost }.
function step(state, input, dt) {
  if (state.done) return state
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.pops = s.pops.map(function(p) { return { x: p.x, y: p.y + dt * 2, text: p.text, t: p.t - dt } }).filter(function(p) { return p.t > 0 })
  s.booms = s.booms.map(function(b) { return { x: b.x, y: b.y, t: b.t - dt } }).filter(function(b) { return b.t > 0 })

  if (s.phase === "aim") {
    if (input.dy) s.angle = Math.max(0.15, Math.min(1.45, s.angle - input.dy * 1.2 * dt))
    if (input.hold) {
      s.charging = true
      var pm = Meter.swing(s.power, s.powerDir, dt, 0.9, 0.2, 1)
      s.power = pm.v; s.powerDir = pm.dir
    } else if (s.charging) return fire(s)
    s.cam = { x: 0, y: 0 }
    return s
  }
  if (s.phase !== "flight") return s

  var k = shallow(s.kitty)
  // Rocket boost: each fresh press.
  if (input.boost && !s.prevBoost && s.boostsLeft > 0 && k.y > 0.6) {
    s.boostsLeft--
    k.vx += 7; k.vy = Math.max(k.vy, 0) + 8
    s.booms = s.booms.concat([{ x: k.x - 0.6, y: k.y, t: 0.3 }])
    pop(s, k.x, k.y + 1, "WHOOSH")
  }
  s.prevBoost = input.boost

  var n = 4, h = dt / n
  for (var i = 0; i < n; ++i) {
    k.vy -= G * h
    k.vx -= k.vx * 0.02 * h
    k.x += k.vx * h; k.y += k.vy * h
    if (k.y < R) {
      k.y = R
      var e = 0.42 + 0.08 * s.up.bounce
      if (k.vy < -2) { k.vy = -k.vy * e; k.vx *= 0.78 + 0.04 * s.up.bounce }
      else { k.vy = 0; k.vx *= Math.pow(0.2, h) }
    }
  }
  s.spin += k.vx * dt * 0.8

  // Objects.
  var objs = s.objects
  for (var j = 0; j < objs.length; ++j) {
    var o = objs[j]
    if (o.used || Math.abs(o.x - k.x) > 2) continue
    var hit = o.kind === "balloon" ? (o.x - k.x) * (o.x - k.x) + (o.y - k.y) * (o.y - k.y) < 1.3 * 1.3 : Math.abs(o.x - k.x) < (o.kind === "spring" ? 1.3 : 0.9) && k.y < 1.4
    if (!hit) continue
    objs = objs.slice(); o = shallow(o); o.used = true; objs[j] = o
    if (o.kind === "tnt") { k.vx += 9; k.vy = Math.max(k.vy, 0) + 15; s.booms = s.booms.concat([{ x: o.x, y: 0.5, t: 0.5 }]); s.coins += 10; pop(s, o.x, 2, "BOOM +10") }
    else if (o.kind === "spring") { k.vy = Math.max(Math.abs(k.vy) * 1.1, 16); k.vx = Math.max(k.vx, 6); pop(s, o.x, 2, "BOING") }
    else if (o.kind === "balloon") { k.vy = Math.max(k.vy, 0) + 9; k.vx += 2; s.coins += 5; pop(s, o.x, o.y + 1, "POP +5") }
    else if (o.kind === "trap") {
      if (s.shieldLeft > 0) { s.shieldLeft--; pop(s, o.x, 2, "SHIELD!") }
      else { k.vx = 0; k.vy = 0; k.y = R; s.trapped = true; pop(s, o.x, 2, "SNAP!") }
    }
  }
  s.objects = objs
  s.kitty = k
  gen(s, k.x + 150)
  // Drop objects well behind.
  if (s.objects.length > 60) s.objects = s.objects.filter(function(o) { return o.x > k.x - 40 })

  // Camera: follow, a little ahead.
  s.cam = { x: Math.max(0, k.x - 6), y: Math.max(0, k.y - 6) }

  var speed = Math.sqrt(k.vx * k.vx + k.vy * k.vy)
  s.stopT = speed < 0.5 && k.y <= R + 0.01 ? s.stopT + dt : 0
  // A snapped trap holds the kitty a moment before the flight's scored.
  if (s.trapped) { s.trapT += dt; if (s.trapT > 0.8) land(s) }
  else if (s.stopT > 0.5) land(s)
  return s
}

// After a flight: to the shop, or finished.
function next(state) {
  if (state.phase !== "landed") return state
  var s = shallow(state)
  if (s.launch >= LAUNCHES) { s.phase = "done"; s.done = true; s.msg = ""; return s }
  s.phase = "shop"; s.msg = ""; s.msgT = 0
  return s
}

function buy(state, i) {
  if (state.phase !== "shop") return state
  if (i >= SHOP.length) {
    // The last row is "launch".
    var s0 = shallow(state)
    s0.launch++; s0.phase = "aim"; s0.kitty = null; s0.msg = "LAUNCH " + s0.launch; s0.msgT = 1.5
    return s0
  }
  var item = SHOP[i], lvl = state.up[item.id]
  if (lvl >= item.max || state.coins < item.cost[lvl]) return state
  var s = shallow(state)
  s.up = shallow(s.up); s.up[item.id] = lvl + 1
  s.coins -= item.cost[lvl]
  return s
}

function shopMove(state, d) {
  var s = shallow(state)
  s.shopCursor = (s.shopCursor + d + SHOP.length + 1) % (SHOP.length + 1)
  return s
}
