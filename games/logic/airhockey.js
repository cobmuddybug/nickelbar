.pragma library
.import "../../engine/Rng.js" as Rng

// Air Hockey: you are the left mallet, the computer the right. The table is
// 200 x 100 units; each goal is a 44-unit gap in the end wall. Mallets are
// confined to their own half. Mallet velocity carries into the puck, so a
// swing hits harder than a nudge. First to 7.

var W = 200, H = 100
var GOAL = 44
var PUCK_R = 4, MALLET_R = 7
var MAX_PUCK = 330
var FRICTION = 0.32          // fraction of speed lost per second
var WIN = 7
var PLAYER_SPEED = 300
var SUBSTEPS = 4

function makeState() {
  return {
    puck: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    player: { x: 24, y: H / 2, vx: 0, vy: 0, tx: 24, ty: H / 2 },
    ai: { x: W - 24, y: H / 2, vx: 0, vy: 0, tx: W - 24, ty: H / 2 },
    playerScore: 0, aiScore: 0, inPlay: false, alive: true, lastGoal: 0, hits: 0, t: 0
  }
}

function clone(s, patch) {
  var o = { puck: s.puck, player: s.player, ai: s.ai, playerScore: s.playerScore, aiScore: s.aiScore,
            inPlay: s.inPlay, alive: s.alive, lastGoal: s.lastGoal, hits: s.hits, t: s.t }
  for (var k in patch) o[k] = patch[k]
  return o
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// The puck drifts gently toward whoever conceded last (or a random side at the start).
function serve(s) {
  if (s.inPlay || !s.alive) return s
  var dir = s.lastGoal !== 0 ? (s.lastGoal > 0 ? 1 : -1) : (Rng.random() < 0.5 ? -1 : 1)
  return clone(s, { inPlay: true, puck: { x: s.puck.x, y: s.puck.y, vx: dir * 30, vy: (Rng.random() - 0.5) * 20 } })
}

function setTarget(s, x, y) {
  var p = s.player
  return clone(s, { player: { x: p.x, y: p.y, vx: p.vx, vy: p.vy,
    tx: clamp(x, MALLET_R, W / 2 - MALLET_R), ty: clamp(y, MALLET_R, H - MALLET_R) } })
}

// Move a mallet toward its target at up to `speed`; records its velocity.
function glide(m, speed, dt, minX, maxX) {
  var dx = m.tx - m.x, dy = m.ty - m.y, d = Math.sqrt(dx * dx + dy * dy)
  var stepLen = Math.min(d, speed * dt)
  var nx = d > 1e-6 ? m.x + dx / d * stepLen : m.x, ny = d > 1e-6 ? m.y + dy / d * stepLen : m.y
  nx = clamp(nx, minX, maxX); ny = clamp(ny, MALLET_R, H - MALLET_R)
  return { x: nx, y: ny, vx: (nx - m.x) / dt, vy: (ny - m.y) / dt, tx: m.tx, ty: m.ty }
}

// Where the puck will cross x = `atX` (bouncing off the side walls), or null.
function predictY(p, atX) {
  if (Math.abs(p.vx) < 1e-3) return null
  var t = (atX - p.x) / p.vx
  if (t < 0 || t > 3) return null
  var y = p.y + p.vy * t
  var span = H - 2 * PUCK_R, u = (y - PUCK_R) % (2 * span)
  if (u < 0) u += 2 * span
  return (u > span ? 2 * span - u : u) + PUCK_R
}

// The computer's aim: defend the goal line, or wind up behind a slow puck.
function aiTarget(s, level) {
  var p = s.puck, m = s.ai
  var home = W - 20
  var midY = H / 2
  var inMyHalf = p.x > W / 2 - 3
  var slow = Math.abs(p.vx) + Math.abs(p.vy) < 90
  if (inMyHalf && slow) {
    if (m.x < p.x - 2) {
      // my mallet is between the puck and the player's goal: swing round behind it
      // rather than push it the wrong way
      return { x: Math.min(W - MALLET_R, p.x + 18), y: clamp(p.y + (p.y < midY ? 15 : -15), MALLET_R, H - MALLET_R) }
    }
    // behind the puck: hit it toward the player's goal
    var gx = 0, gy = midY + (Rng.random() - 0.5) * 10
    var dx = p.x - gx, dy = p.y - gy, d = Math.sqrt(dx * dx + dy * dy) || 1
    var back = PUCK_R + MALLET_R - 2
    return { x: p.x + dx / d * back, y: p.y + dy / d * back, strike: true }
  }
  if (p.vx > 8) {
    var py = predictY(p, home)
    if (py !== null) return { x: home, y: clamp(py, midY - GOAL / 2 + 2, midY + GOAL / 2 - 2) }
  }
  // idle: shadow the puck's height loosely
  return { x: home, y: clamp(midY + (p.y - midY) * 0.55, midY - 22, midY + 22) }
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function aiSpeed(s) { return 150 + Math.min(6, s.playerScore) * 16 + (LEVEL - 1) * 40 }

function collideMallet(p, m) {
  var dx = p.x - m.x, dy = p.y - m.y, d2 = dx * dx + dy * dy, min = PUCK_R + MALLET_R
  if (d2 >= min * min) return false
  var d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d
  p.x = m.x + nx * min; p.y = m.y + ny * min
  var rvx = p.vx - m.vx, rvy = p.vy - m.vy
  var vn = rvx * nx + rvy * ny
  if (vn < 0) {
    p.vx = m.vx + (rvx - 1.9 * vn * nx) * 0.96
    p.vy = m.vy + (rvy - 1.9 * vn * ny) * 0.96
  }
  return true
}

function step(s, dt) {
  if (!s.alive) return s
  var puck = { x: s.puck.x, y: s.puck.y, vx: s.puck.vx, vy: s.puck.vy }
  var player = s.player, ai = s.ai
  var ps = s.playerScore, as = s.aiScore, inPlay = s.inPlay, lastGoal = 0, hits = s.hits
  var target = aiTarget(s)
  if (LEVEL === 0) { target.x += (Rng.random() - 0.5) * 6; target.y += (Rng.random() - 0.5) * 10 }
  var aiM = { x: ai.x, y: ai.y, vx: ai.vx, vy: ai.vy, tx: clamp(target.x, W / 2 + MALLET_R, W - MALLET_R), ty: clamp(target.y, MALLET_R, H - MALLET_R) }
  var sub = dt / SUBSTEPS
  for (var i = 0; i < SUBSTEPS; ++i) {
    player = glide(player, PLAYER_SPEED, sub, MALLET_R, W / 2 - MALLET_R)
    aiM = glide(aiM, inPlay ? aiSpeed(s) : 0, sub, W / 2 + MALLET_R, W - MALLET_R)
    if (!inPlay) continue
    puck.x += puck.vx * sub; puck.y += puck.vy * sub
    var f = 1 - FRICTION * sub
    puck.vx *= f; puck.vy *= f
    if (collideMallet(puck, player) || collideMallet(puck, aiM)) hits++
    var sp = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy)
    if (sp > MAX_PUCK) { puck.vx *= MAX_PUCK / sp; puck.vy *= MAX_PUCK / sp }
    // side walls
    if (puck.y < PUCK_R) { puck.y = PUCK_R; puck.vy = Math.abs(puck.vy) * 0.96 }
    if (puck.y > H - PUCK_R) { puck.y = H - PUCK_R; puck.vy = -Math.abs(puck.vy) * 0.96 }
    // end walls, with the goal gaps
    var inMouth = Math.abs(puck.y - H / 2) < GOAL / 2 - 1
    if (puck.x < PUCK_R && !inMouth) { puck.x = PUCK_R; puck.vx = Math.abs(puck.vx) * 0.96 }
    if (puck.x > W - PUCK_R && !inMouth) { puck.x = W - PUCK_R; puck.vx = -Math.abs(puck.vx) * 0.96 }
    if (puck.x < -PUCK_R) { as++; lastGoal = -1; break }
    if (puck.x > W + PUCK_R) { ps++; lastGoal = 1; break }
  }
  var next = clone(s, { puck: puck, player: player, ai: aiM, inPlay: inPlay, hits: hits, t: s.t + dt,
                        playerScore: ps, aiScore: as })
  if (lastGoal !== 0) {
    next.lastGoal = lastGoal
    next.puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 }
    next.player = { x: 24, y: H / 2, vx: 0, vy: 0, tx: 24, ty: H / 2 }
    next.ai = { x: W - 24, y: H / 2, vx: 0, vy: 0, tx: W - 24, ty: H / 2 }
    next.inPlay = false
    if (ps >= WIN || as >= WIN) next.alive = false
  }
  return next
}

function serialize(s) { return s }
function deserialize(o) {
  if (!o || !o.puck || !o.player || !o.ai) return null
  return o
}
