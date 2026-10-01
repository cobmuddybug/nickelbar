.pragma library
.import "../../engine/Rng.js" as Rng

// Foosball: eight rods across a 160 x 90 table. Left to right: your goalie,
// your defence, their attack, your midfield, their midfield, your attack,
// their defence, their goalie. You slide one rod at a time and kick it; the
// computer works the other four. First to 5.

var W = 160, H = 90
var GOAL = 32
var BALL_R = 2.4
var MAN_HX = 1.6, MAN_HY = 3.4
var REACH = 9
var WIN = 5
var SUBSTEPS = 6

// index: 0..7 across the table. owner 0 = you (kicks +x), 1 = computer (kicks -x)
var RODS = [
  { x: 10,  owner: 0, offs: [0] },
  { x: 28,  owner: 0, offs: [-15, 15] },
  { x: 46,  owner: 1, offs: [-20, 0, 20] },
  { x: 64,  owner: 0, offs: [-28, -14, 0, 14, 28] },
  { x: 96,  owner: 1, offs: [-28, -14, 0, 14, 28] },
  { x: 114, owner: 0, offs: [-20, 0, 20] },
  { x: 132, owner: 1, offs: [-15, 15] },
  { x: 150, owner: 1, offs: [0] }
]
var MINE = [0, 1, 3, 5]        // your rods, goalie first
var MINE_NAMES = ["GOALIE", "DEFENCE", "MIDFIELD", "ATTACK"]
var THEIRS = [2, 4, 6, 7]

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function slideRange(i) {
  var offs = RODS[i].offs, lo = 1e9, hi = -1e9
  for (var k = 0; k < offs.length; ++k) { lo = Math.min(lo, offs[k]); hi = Math.max(hi, offs[k]) }
  return { min: MAN_HY - lo, max: H - MAN_HY - hi }
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function makeState() {
  var rods = []
  for (var i = 0; i < RODS.length; ++i) rods.push({ y: H / 2, ty: H / 2, vy: 0, k: 0, kd: 0, cool: 0 })
  return { ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, rods: rods, active: 3, playerScore: 0, aiScore: 0,
           inPlay: false, alive: true, lastGoal: 0, stuck: 0, t: 0, ai: { drift: [0, 0, 0, 0], seed: 1 } }
}

function clone(s, patch) {
  var o = { ball: s.ball, rods: s.rods, active: s.active, playerScore: s.playerScore, aiScore: s.aiScore,
            inPlay: s.inPlay, alive: s.alive, lastGoal: s.lastGoal, stuck: s.stuck, t: s.t, ai: s.ai }
  for (var k in patch) o[k] = patch[k]
  return o
}

function withRod(s, i, patch) {
  var rods = s.rods.slice(), r = rods[i], o = {}
  for (var k in r) o[k] = r[k]
  for (var p in patch) o[p] = patch[p]
  rods[i] = o
  return clone(s, { rods: rods })
}

function serve(s) {
  if (s.inPlay || !s.alive) return s
  var dir = s.lastGoal !== 0 ? (s.lastGoal > 0 ? 1 : -1) : (Rng.random() < 0.5 ? -1 : 1)
  return clone(s, { inPlay: true, ball: { x: W / 2, y: H / 2, vx: dir * 45, vy: (Rng.random() - 0.5) * 40 } })
}

function selectRod(s, j) { return clone(s, { active: ((j % 4) + 4) % 4 }) }
function cycleRod(s, d) { return selectRod(s, s.active + d) }

function setSlide(s, i, y) {
  var r = slideRange(i)
  return withRod(s, i, { ty: clamp(y, r.min, r.max) })
}

function kick(s, i) {
  var r = s.rods[i]
  if (r.kd !== 0 || r.cool > 0) return s
  return withRod(s, i, { kd: 1 })
}

// Man positions for a rod: [{x, y, vx, vy}]
function men(s, i, dt) {
  var rod = s.rods[i], def = RODS[i], dir = def.owner === 0 ? 1 : -1, out = []
  var vx = rod.kd > 0 ? dir * REACH * 18 : (rod.kd < 0 ? -dir * REACH * 6 : 0)
  for (var m = 0; m < def.offs.length; ++m)
    out.push({ x: def.x + dir * rod.k * REACH, y: rod.y + def.offs[m], vx: vx, vy: rod.vy })
  return out
}

function collide(b, man) {
  // closest point on the man's rectangle to the ball
  var cx = clamp(b.x, man.x - MAN_HX, man.x + MAN_HX), cy = clamp(b.y, man.y - MAN_HY, man.y + MAN_HY)
  var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy
  if (d2 >= BALL_R * BALL_R) return false
  var nx, ny, d = Math.sqrt(d2)
  if (d > 1e-6) { nx = dx / d; ny = dy / d; b.x = cx + nx * BALL_R; b.y = cy + ny * BALL_R }
  else {   // centre inside the man: push out the shortest way
    var ox = MAN_HX - Math.abs(b.x - man.x), oy = MAN_HY - Math.abs(b.y - man.y)
    if (ox < oy) { nx = b.x >= man.x ? 1 : -1; ny = 0; b.x = man.x + nx * (MAN_HX + BALL_R) }
    else { nx = 0; ny = b.y >= man.y ? 1 : -1; b.y = man.y + ny * (MAN_HY + BALL_R) }
  }
  var rvx = b.vx - man.vx, rvy = b.vy - man.vy
  var vn = rvx * nx + rvy * ny
  if (vn < 0) {
    b.vx = man.vx + rvx - 1.55 * vn * nx
    b.vy = man.vy + rvy - 1.55 * vn * ny
    // a little drag on the tangential part (felt on the man's face)
    b.vx *= 0.985; b.vy *= 0.985
  }
  return true
}

// ---- computer ----------------------------------------------------------------------

function aiSlideSpeed(s) { return 105 + Math.min(4, s.playerScore) * 14 + (LEVEL - 1) * 35 }

// A slide position for rod `i` that keeps every man clear of height `y`
// (a lane for the ball), moving as little as possible from `from`.
function clearLane(i, from, y) {
  var range = slideRange(i), offs = RODS[i].offs, gap = MAN_HY + BALL_R + 1.5
  var best = from, bestD = 1e9
  for (var c = range.min; c <= range.max + 0.001; c += 1) {
    var ok = true
    for (var m = 0; m < offs.length; ++m) if (Math.abs(c + offs[m] - y) < gap) { ok = false; break }
    if (ok && Math.abs(c - from) < bestD) { bestD = Math.abs(c - from); best = c }
  }
  return best
}

function aiControl(s, rods, dt) {
  var b = s.ball, ai = s.ai
  var toward = b.vx > 8            // ball heading for the computer's goal: block it
  var kicker = -1, kd = 1e9
  // the computer rod nearest in front of (goal-side of) the ball, if any, is the one to kick
  for (var q0 = 0; q0 < THEIRS.length; ++q0) {
    var d0 = RODS[THEIRS[q0]].x - b.x
    if (d0 > -3 && d0 < kd) { kd = d0; kicker = THEIRS[q0] }
  }
  for (var q = 0; q < THEIRS.length; ++q) {
    var i = THEIRS[q], def = RODS[i], r = rods[i]
    var best = 0, bestD = 1e9
    for (var m = 0; m < def.offs.length; ++m) {
      var d = Math.abs((r.y + def.offs[m]) - b.y)
      if (d < bestD) { bestD = d; best = m }
    }
    var range = slideRange(i)
    var away = Math.abs(b.x - def.x)
    var aim
    var isGoalie = i === 7
    if (isGoalie) {
      aim = clamp(b.y * 0.8 + (H / 2) * 0.2, H / 2 - GOAL / 2 + 3, H / 2 + GOAL / 2 - 3) - def.offs[0]
    } else if (toward && def.x > b.x) {
      // block: line a man up with the ball, a little loosely until it's close
      aim = b.y - def.offs[best] + ai.drift[q] * (1 + Math.min(3, away / 14))
    } else if (i === kicker) {
      aim = b.y - def.offs[best] + ai.drift[q] * 0.4
    } else if (def.x < b.x) {
      // a rod the ball still has to pass on the way to the player's goal: get out of its way
      aim = clearLane(i, r.y, b.y)
    } else {
      aim = H / 2 - def.offs[best] + ai.drift[q]     // behind the ball: hold the middle
    }
    r.ty = clamp(aim, range.min, range.max)
    if (r.kd === 0 && r.cool <= 0) {
      var mx = def.x - 1.5
      var front = mx - b.x
      if (front > -1 && front < REACH + 1 && Math.abs((r.y + def.offs[best]) - b.y) < MAN_HY + 1.2 && Math.abs(b.vx) < 260) r.kd = 1
    }
  }
}

// ---- step -----------------------------------------------------------------------------

function step(s, dt) {
  if (!s.alive) return s
  var rods = s.rods.map(function(r) { return { y: r.y, ty: r.ty, vy: r.vy, k: r.k, kd: r.kd, cool: r.cool } })
  var b = { x: s.ball.x, y: s.ball.y, vx: s.ball.vx, vy: s.ball.vy }
  var ps = s.playerScore, as = s.aiScore, lastGoal = 0
  var ai = { drift: s.ai.drift.slice(), seed: s.ai.seed }
  // AI aim wobbles a little, re-rolled about twice a second
  if (Rng.random() < dt * 2.5) for (var q = 0; q < 4; ++q) ai.drift[q] = (Rng.random() - 0.5) * [14, 7, 3][LEVEL]
  aiControl({ ball: b, ai: ai, playerScore: s.playerScore }, rods, dt)
  var sub = dt / SUBSTEPS
  var stuck = s.stuck
  for (var n = 0; n < SUBSTEPS; ++n) {
    for (var i = 0; i < rods.length; ++i) {
      var r = rods[i], speed = RODS[i].owner === 0 ? 210 : 105 + Math.min(4, s.playerScore) * 14
      var range = slideRange(i)
      var dy = clamp(r.ty, range.min, range.max) - r.y
      var mv = clamp(dy, -speed * sub, speed * sub)
      r.y += mv; r.vy = mv / sub
      if (r.kd > 0) { r.k += sub * 18; if (r.k >= 1) { r.k = 1; r.kd = -1 } }
      else if (r.kd < 0) { r.k -= sub * 6; if (r.k <= 0) { r.k = 0; r.kd = 0; r.cool = 0.18 } }
      if (r.cool > 0 && r.kd === 0) r.cool -= sub
    }
    if (!s.inPlay) continue
    b.x += b.vx * sub; b.y += b.vy * sub
    var f = 1 - 0.55 * sub
    b.vx *= f; b.vy *= f
    for (var ri = 0; ri < rods.length; ++ri) {
      var ms = men({ rods: rods }, ri, sub)
      for (var m = 0; m < ms.length; ++m) collide(b, ms[m])
    }
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
    if (sp > 420) { b.vx *= 420 / sp; b.vy *= 420 / sp }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * 0.8 }
    if (b.y > H - BALL_R) { b.y = H - BALL_R; b.vy = -Math.abs(b.vy) * 0.8 }
    var inMouth = Math.abs(b.y - H / 2) < GOAL / 2
    if (b.x < BALL_R && !inMouth) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.8 }
    if (b.x > W - BALL_R && !inMouth) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.8 }
    if (b.x < -BALL_R) { as++; lastGoal = -1; break }
    if (b.x > W + BALL_R) { ps++; lastGoal = 1; break }
  }
  if (s.inPlay) {
    var speed2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
    stuck = speed2 < 4 ? stuck + dt : 0
    if (stuck > 2.2) { b.vx = (Rng.random() < 0.5 ? -1 : 1) * 55; b.vy = (Rng.random() - 0.5) * 60; stuck = 0 }
  }
  var next = clone(s, { ball: b, rods: rods, playerScore: ps, aiScore: as, t: s.t + dt, stuck: stuck, ai: ai })
  if (lastGoal !== 0) {
    next.lastGoal = lastGoal
    next.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 }
    next.inPlay = false
    next.stuck = 0
    if (ps >= WIN || as >= WIN) next.alive = false
  }
  return next
}

function serialize(s) { return s }
function deserialize(o) {
  if (!o || !o.ball || !o.rods || o.rods.length !== 8) return null
  return o
}
