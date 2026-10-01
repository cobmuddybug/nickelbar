.pragma library
.import "physics.js" as Phys
.import "../../engine/Rng.js" as Rng

// Eight-ball against the computer, on a 2 x 1 table with six pockets. Plain
// rules: the table is open until someone pots a ball, then you shoot your
// group (solids 1-7 or stripes 9-15), then the 8. A scratch, a missed first
// contact or hitting the wrong group first is a foul and gives the other
// player the cue ball in hand. Pot the 8 early, or foul while potting it,
// and you lose. No spin; the cue ball just rolls.

var TW = 2
var TH = 1
var R = 0.034
var POCKETS = [{ x: 0, y: 0, r: 0.062 }, { x: 1, y: 0, r: 0.05 }, { x: 2, y: 0, r: 0.062 }, { x: 0, y: 1, r: 0.062 }, { x: 1, y: 1, r: 0.05 }, { x: 2, y: 1, r: 0.062 }]
var MAX_SPEED = 4.2

function groupOf(id) { return id >= 1 && id <= 7 ? "solid" : id >= 9 ? "stripe" : id === 8 ? "eight" : "cue" }

function rack() {
  var balls = [{ id: 0, x: 0.5, y: 0.5, vx: 0, vy: 0, in: false }]
  var order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15], k = 0
  // Triangle: the 8 sits in the middle of the third row (index 4 of the order above).
  for (var c = 0; c < 5; ++c)
    for (var r = 0; r <= c; ++r)
      balls.push({ id: order[k++], x: 1.4 + c * R * 1.75, y: 0.5 + (r - c / 2) * R * 2.05, vx: 0, vy: 0, in: false })
  return balls
}

function makeState() {
  return { balls: rack(), turn: 0, groups: [null, null], phase: "aim", aim: Math.PI, power: 0.55, first: -1, potted: [], rails: 0,
           msg: "Your break", winner: -1, foulBy: -1, shots: 0, score: 0, done: false, hand: false }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function cue(s) { return s.balls[0] }
function setAim(s, a) { if (s.phase !== "aim") return s; var o = copy(s); o.aim = a; return o }
function setPower(s, p) { if (s.phase !== "aim") return s; var o = copy(s); o.power = clamp(p, 0.08, 1); return o }

function free(s, x, y) {
  for (var i = 1; i < s.balls.length; ++i) { var b = s.balls[i]; if (!b.in && Math.hypot(b.x - x, b.y - y) < R * 2.1) return false }
  return x > R && x < TW - R && y > R && y < TH - R
}

// Ball in hand: put the cue ball down.
function place(s, x, y) {
  if (s.phase !== "place") return s
  var px = clamp(x, R, TW - R), py = clamp(y, R, TH - R)
  if (!free(s, px, py)) return s
  var o = copy(s)
  o.balls = s.balls.map(function(b) { var c = {}; for (var k in b) c[k] = b[k]; return c })
  o.balls[0].x = px; o.balls[0].y = py; o.balls[0].in = false
  o.phase = "aim"; o.hand = false
  return o
}

function shoot(s) {
  if (s.phase !== "aim") return s
  var o = copy(s), v = MAX_SPEED * s.power * s.power * 0.85 + 0.35
  o.balls = s.balls.map(function(b) { var c = {}; for (var k in b) c[k] = b[k]; return c })
  o.balls[0].vx = Math.cos(s.aim) * v; o.balls[0].vy = Math.sin(s.aim) * v
  o.phase = "roll"; o.first = -1; o.potted = []; o.rails = 0; o.shots = s.shots + 1; o.msg = ""
  o.ev = ["clack"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function targetGroup(s, p) {
  var g = s.groups[p]
  if (!g) return null
  var left = s.balls.some(function(b) { return !b.in && groupOf(b.id) === g })
  return left ? g : "eight"
}

function pocketed(b) {
  for (var i = 0; i < POCKETS.length; ++i) { var p = POCKETS[i]; if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) return true }
  return false
}

function step(state, dt) {
  if (state.phase !== "roll") return state
  var s = copy(state)
  var balls = state.balls.map(function(b) { var c = {}; for (var k in b) c[k] = b[k]; return c })
  var first = state.first, potted = state.potted.slice(), rails = state.rails
  var left = dt, moving = false, evs = []
  while (left > 1e-9) {
    var h = Math.min(1 / 300, left); left -= h
    var i, j
    for (i = 0; i < balls.length; ++i) {
      var b = balls[i]
      if (b.in) continue
      b.x += b.vx * h; b.y += b.vy * h
      var sp = Math.hypot(b.vx, b.vy)
      if (sp > 0) {
        var ns = Math.max(0, sp - 0.5 * h - sp * 0.18 * h)
        b.vx *= ns / sp; b.vy *= ns / sp
        if (ns < 0.02) { b.vx = 0; b.vy = 0 }
      }
      if (pocketed(b)) { b.in = true; b.vx = 0; b.vy = 0; potted.push(b.id); evs.push("thud"); continue }
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.8; rails++; if (Math.abs(b.vx) + Math.abs(b.vy) > 0.5) evs.push("tick") }
      if (b.x > TW - R) { b.x = TW - R; b.vx = -Math.abs(b.vx) * 0.8; rails++; if (Math.abs(b.vx) + Math.abs(b.vy) > 0.5) evs.push("tick") }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.8; rails++; if (Math.abs(b.vx) + Math.abs(b.vy) > 0.5) evs.push("tick") }
      if (b.y > TH - R) { b.y = TH - R; b.vy = -Math.abs(b.vy) * 0.8; rails++; if (Math.abs(b.vx) + Math.abs(b.vy) > 0.5) evs.push("tick") }
    }
    for (i = 0; i < balls.length; ++i) {
      if (balls[i].in) continue
      for (j = i + 1; j < balls.length; ++j) {
        if (balls[j].in) continue
        var a = balls[i], c2 = balls[j]
        var closing = Phys.collide(a, R, 1, c2, R, 1, 0.95)
        if (closing < 0) continue
        if (closing > 0.12) evs.push("clack")
        if (first < 0 && i === 0) first = c2.id
      }
    }
  }
  for (var m = 0; m < balls.length; ++m) if (!balls[m].in && (balls[m].vx || balls[m].vy)) moving = true
  s.balls = balls; s.first = first; s.potted = potted; s.rails = rails
  if (evs.length) { s.ev = evs; s.evSeq = (state.evSeq || 0) + 1 }
  return moving ? s : resolve(s)
}

function resolve(s) {
  var o = copy(s), me = s.turn, other = 1 - me
  var pots = s.potted, scratch = pots.indexOf(0) >= 0
  var legalPots = pots.filter(function(id) { return id !== 0 })
  var tg = targetGroup(s, me)
  var foul = scratch, why = scratch ? "SCRATCH" : ""
  if (s.first < 0) { foul = true; why = why || "NO BALL HIT" }
  else if (tg && groupOf(s.first) !== tg) { foul = true; why = why || "WRONG BALL FIRST" }
  else if (!tg && groupOf(s.first) === "eight") { foul = true; why = why || "8-BALL FIRST" }
  var eightIn = legalPots.indexOf(8) >= 0
  o.groups = s.groups.slice()
  if (eightIn) {
    var ok = !foul && tg === "eight"
    o.phase = "over"; o.winner = ok ? me : other; o.done = true
    o.msg = ok ? (me === 0 ? "YOU SANK THE 8" : "THE COMPUTER SANK THE 8") : (me === 0 ? "YOU POTTED THE 8 EARLY" : "THE COMPUTER POTTED THE 8 EARLY")
    return fin(o, s)
  }
  var mine = 0
  if (!o.groups[me] && !foul && legalPots.length) {
    var g = groupOf(legalPots[0])
    o.groups[me] = g; o.groups[other] = g === "solid" ? "stripe" : "solid"
    tg = g
  }
  legalPots.forEach(function(id) { if (tg && groupOf(id) === tg) mine++ })
  if (!o.groups[me] && !foul) mine = legalPots.length
  if (me === 0) o.score = s.score + legalPots.filter(function(id) { return !o.groups[0] || groupOf(id) === o.groups[0] }).length * 10
  // Put a scratched cue ball back (in hand for whoever is next), and any 8 spotted back is not needed (8 ends the game).
  if (foul) {
    o.ev = ["buzz"]; o.evSeq = (s.evSeq || 0) + 1
    o.turn = other; o.phase = "place"; o.hand = true; o.msg = why + " — " + (other === 0 ? "ball in hand" : "the computer has ball in hand")
    o.balls = s.balls.map(function(b) { var c = {}; for (var k in b) c[k] = b[k]; return c })
    if (scratch) { o.balls[0].in = false; o.balls[0].x = 0.5; o.balls[0].y = 0.5 }
  } else if (mine > 0) {
    o.phase = "aim"; o.msg = "Nice — again"
  } else {
    o.turn = other; o.phase = "aim"; o.msg = ""
  }
  return fin(o, s)
}

function fin(o, s) {
  if (o.phase === "aim") {
    var c = o.balls[0]
    if (c.in) { o.balls = o.balls.map(function(b) { var d = {}; for (var k in b) d[k] = b[k]; return d }); o.balls[0].in = false; o.balls[0].x = 0.5; o.balls[0].y = 0.5 }
    var cb = o.balls[0], t = nearestTarget(o, o.turn)
    if (t) o.aim = Math.atan2(t.y - cb.y, t.x - cb.x)
  }
  if (o.phase === "over" && o.winner === 0) o.score += 100
  return o
}

function nearestTarget(s, p) {
  var tg = targetGroup(s, p), best = null, bd = 9, c = s.balls[0]
  s.balls.forEach(function(b) {
    if (b.in || b.id === 0) return
    var g = groupOf(b.id)
    if (tg ? g !== tg : g === "eight") return
    var d = Math.hypot(b.x - c.x, b.y - c.y)
    if (d < bd) { bd = d; best = b }
  })
  return best
}

// ---- the computer ------------------------------------------------------------------------

function clear(balls, a, b, skipIds) {
  var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
  for (var i = 0; i < balls.length; ++i) {
    var o = balls[i]
    if (o.in || skipIds.indexOf(o.id) >= 0) continue
    var t = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / (len * len), 0, 1)
    if (Math.hypot(a.x + dx * t - o.x, a.y + dy * t - o.y) < R * 2.05) return false
  }
  return true
}

// Best shot from cue position (cx, cy): { angle, power, score }.
function bestShot(s, cx, cy, p) {
  var tg = targetGroup(s, p), best = null, from = { x: cx, y: cy }
  s.balls.forEach(function(b) {
    if (b.in || b.id === 0) return
    var g = groupOf(b.id)
    if (tg ? g !== tg : g === "eight") return
    POCKETS.forEach(function(pk) {
      var tx = pk.x + (pk.x === 0 ? 0.015 : pk.x === TW ? -0.015 : 0), ty = pk.y + (pk.y === 0 ? 0.015 : pk.y === TH ? -0.015 : 0)
      var dx = tx - b.x, dy = ty - b.y, dl = Math.hypot(dx, dy)
      var gx = b.x - dx / dl * R * 2, gy = b.y - dy / dl * R * 2
      var cdx = gx - cx, cdy = gy - cy, cl = Math.hypot(cdx, cdy)
      if (cl < 0.01) return
      var cut = (cdx * dx + cdy * dy) / (cl * dl)
      if (cut < 0.25) return
      if (!clear(s.balls, from, { x: gx, y: gy }, [0, b.id]) || !clear(s.balls, b, { x: tx, y: ty }, [0, b.id])) return
      var score = cut * 2 - (cl + dl) * 0.5
      if (!best || score > best.score) best = { angle: Math.atan2(cdy, cdx), power: clamp(0.35 + (cl + dl) * 0.28, 0.35, 0.95), score: score }
    })
  })
  return best
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function cpuPlace(s) {
  var best = null, spots = []
  for (var i = 0; i < 24; ++i) spots.push({ x: 0.2 + Rng.random() * 1.6, y: 0.1 + Rng.random() * 0.8 })
  spots.push({ x: 0.5, y: 0.5 })
  spots.forEach(function(sp) {
    if (!free(s, sp.x, sp.y)) return
    var b = bestShot(s, sp.x, sp.y, s.turn), sc = b ? b.score : -9
    if (!best || sc > best.sc) best = { x: sp.x, y: sp.y, sc: sc }
  })
  return best || { x: 0.5, y: 0.5 }
}

// The computer takes whatever turn phase it's in (placing, then aiming and shooting).
function cpuTurn(s) {
  var o = s
  if (o.phase === "place") { var pl = cpuPlace(o); o = place(o, pl.x, pl.y); if (o.phase === "place") o = place(o, 0.5, 0.5) }
  if (o.phase !== "aim") return o
  var c = o.balls[0], shot = bestShot(o, c.x, c.y, o.turn)
  var angle, power
  if (shot) { angle = shot.angle + (Rng.random() - 0.5) * [0.22, 0.03, 0.008][LEVEL]; power = shot.power + (LEVEL === 0 ? (Rng.random() - 0.5) * 0.3 : 0) }
  else {
    var t = nearestTarget(o, o.turn) || { x: 1, y: 0.5 }
    angle = Math.atan2(t.y - c.y, t.x - c.x) + (Rng.random() - 0.5) * [0.25, 0.04, 0.01][LEVEL]; power = 0.4
  }
  if (o.shots === 0) power = 1
  return shoot(setPower(setAim(o, angle), power))
}

function serialize(s) { return JSON.parse(JSON.stringify(s)) }
function deserialize(o) {
  if (!o || !Array.isArray(o.balls) || o.balls.length !== 16 || o.done) return null
  var s = JSON.parse(JSON.stringify(o))
  s.ev = []
  if (s.phase === "roll") { s.phase = "aim"; s.balls.forEach(function(b) { b.vx = 0; b.vy = 0 }) }   // resume at rest
  return s
}
