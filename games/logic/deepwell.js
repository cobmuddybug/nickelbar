.pragma library
.import "../../engine/Rng.js" as Rng

// Deep Well (after Downwell). Fall down an endless shaft. Your gunboots
// fire straight down when you jump in mid-air: each shot kicks you up a
// little and costs a charge, and landing on anything reloads them. Stomp
// bats and blobs from above (that reloads too); the red spiky ones have
// to be shot. Breakable blocks crumble when shot. Four hits and you're
// done. Score is metres fallen plus gems (kills drop them; a chain of
// kills without landing pays extra).
//
// Units are tiles: the shaft is COLS wide including its walls; y grows
// downward without end. Rows are generated as the camera goes down and
// dropped once they're well above it.

var COLS = 11
var VIEW_H = 15
var PW = 0.7, PH = 0.85          // player box
var GRAV = 34, MAX_FALL = 13
var RUN = 6.5
var JUMP_V = 12
var SHOT_KICK = 3.2
var AMMO = 8
var HP = 4
var BULLET_V = 26, BULLET_RANGE = 9
var INVULN = 1.2

var EMPTY = 0, WALL = 1, SOLID = 2, CRUMBLE = 3

function rnd(a, b) { return a + Rng.random() * (b - a) }

// A row of tiles for depth y. Early rows are open; deeper ones get busier.
function genRow(y) {
  var r = []
  for (var c = 0; c < COLS; ++c) r.push(c === 0 || c === COLS - 1 ? WALL : EMPTY)
  if (y === 4) { for (var k = 1; k < COLS - 1; ++k) if (k < 4 || k > 6) r[k] = SOLID; return r }
  if (y < 8 || y % 2) return r
  var busy = Math.min(0.75, 0.35 + y / 900)
  if (Rng.random() > busy) return r
  // One or two ledges, jutting from a wall or floating, with a gap kept.
  var ledges = Rng.random() < 0.4 ? 2 : 1
  for (var l = 0; l < ledges; ++l) {
    var len = 1 + Math.floor(Rng.random() * 3), start
    var from = Rng.random()
    if (from < 0.3) start = 1
    else if (from < 0.6) start = COLS - 1 - len
    else start = 2 + Math.floor(Rng.random() * (COLS - 4 - len))
    var kind = Rng.random() < 0.35 ? CRUMBLE : SOLID
    for (var i = start; i < start + len && i < COLS - 1; ++i) r[i] = kind
  }
  // Never seal the shaft: at least three open cells side by side.
  var run = 0, best = 0
  for (var j = 1; j < COLS - 1; ++j) { run = r[j] === EMPTY ? run + 1 : 0; best = Math.max(best, run) }
  if (best < 3) for (var m = 4; m < 7; ++m) r[m] = EMPTY
  return r
}

function makeState() {
  var s = {
    rows: {}, genTo: -1, top: 0,
    p: { x: 5 - PW / 2 + 0.5, y: 4 - PH, vx: 0, vy: 0, ground: true, face: 1 },
    hp: HP, ammo: AMMO, gems: 0, depth: 0, bestDepth: 0, combo: 0, comboShow: 0, inv: 0,
    enemies: [], bullets: [], pops: [], camY: 0, t: 0, dead: false, prevJump: false, healAt: 200, msg: "", msgT: 0
  }
  ensureRows(s)
  return s
}

function tile(s, c, r) {
  if (c < 0 || c >= COLS) return WALL
  var row = s.rows[r]
  return row ? row[c] : EMPTY
}

function solid(t) { return t !== EMPTY }

function spawnFor(s, y, row) {
  if (y < 10) return
  var chance = Math.min(0.5, 0.12 + y / 1200)
  if (Rng.random() > chance) return
  var kinds = y < 40 ? ["bat", "blob"] : ["bat", "blob", "spike"]
  var kind = kinds[Math.floor(Rng.random() * kinds.length)]
  if (kind === "bat") { s.enemies.push({ kind: "bat", x: rnd(1.5, COLS - 2.5), y: y + 0.2, w: 0.7, h: 0.5, vx: 0, vy: 0, hp: 1 }); return }
  // Blobs and spikes stand on a ledge in this row.
  var tops = []
  for (var c = 1; c < COLS - 1; ++c) if (solid(row[c]) && row[c] !== WALL) tops.push(c)
  if (!tops.length) return
  var c0 = tops[Math.floor(Rng.random() * tops.length)]
  s.enemies.push({ kind: kind, x: c0 + 0.1, y: y - 0.7, w: 0.8, h: 0.7, vx: Rng.random() < 0.5 ? -1.4 : 1.4, vy: 0, hp: 2 })
}

function ensureRows(s) {
  var need = Math.floor(s.camY) + VIEW_H + 12
  while (s.genTo < need) {
    s.genTo++
    var row = genRow(s.genTo)
    s.rows[s.genTo] = row
    spawnFor(s, s.genTo, row)
  }
  var drop = Math.floor(s.camY) - 6
  while (s.top < drop) { delete s.rows[s.top]; s.top++ }
  s.enemies = s.enemies.filter(function(e) { return e.y > s.camY - 4 })
}

function boxHits(s, x, y, w, h) {
  var c0 = Math.floor(x), c1 = Math.floor(x + w - 1e-6), r0 = Math.floor(y), r1 = Math.floor(y + h - 1e-6)
  for (var r = r0; r <= r1; ++r) for (var c = c0; c <= c1; ++c) if (solid(tile(s, c, r))) return true
  return false
}

// Move a box by (dx, dy) against the tiles, one axis at a time. Returns
// which sides touched.
function moveBox(s, b, dx, dy) {
  var hit = { x: false, down: false, up: false }
  if (dx) {
    b.x += dx
    if (boxHits(s, b.x, b.y, b.w, b.h)) {
      b.x = dx > 0 ? Math.floor(b.x + b.w) - b.w - 1e-4 : Math.floor(b.x) + 1 + 1e-4
      hit.x = true
    }
  }
  if (dy) {
    b.y += dy
    if (boxHits(s, b.x, b.y, b.w, b.h)) {
      if (dy > 0) { b.y = Math.floor(b.y + b.h) - b.h - 1e-4; hit.down = true }
      else { b.y = Math.floor(b.y) + 1 + 1e-4; hit.up = true }
    }
  }
  return hit
}

function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function shallow(s) {
  var o = {}
  for (var k in s) o[k] = s[k]
  return o
}

function kill(s, e, how) {
  e.dead = true
  s.combo++
  var gems = 3 + (s.combo >= 4 ? s.combo * 2 : 0)
  s.gems += gems
  s.pops.push({ x: e.x + e.w / 2, y: e.y, text: "+" + gems + (s.combo >= 3 ? "  ×" + s.combo : ""), t: 0.8 })
}

function hurt(s) {
  if (s.inv > 0) return
  s.hp--
  s.inv = INVULN
  s.combo = 0
  if (s.hp <= 0) s.dead = true
}

// input: { dx: -1/0/1, jump: bool held }.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state)
  var p = { x: state.p.x, y: state.p.y, vx: 0, vy: state.p.vy, ground: state.p.ground, face: state.p.face, w: PW, h: PH }
  s.t += dt
  s.inv = Math.max(0, s.inv - dt)
  s.msgT = Math.max(0, s.msgT - dt)
  s.comboShow = Math.max(0, s.comboShow - dt)

  // Jump on the ground; in the air, each fresh press fires the boots.
  var pressed = input.jump && !s.prevJump
  s.prevJump = input.jump
  s.bullets = s.bullets.slice()
  if (pressed) {
    if (p.ground) { p.vy = -JUMP_V; p.ground = false }
    else if (s.ammo > 0) {
      s.ammo--
      p.vy = Math.min(p.vy, 0) - SHOT_KICK
      if (p.vy < -SHOT_KICK) p.vy = -SHOT_KICK
      s.bullets.push({ x: p.x + PW / 2 - 0.1, y: p.y + PH, w: 0.2, h: 0.45, travelled: 0 })
    }
  }
  // Holding jump after a jump gives a little more height.
  var g = GRAV * (input.jump && p.vy < 0 ? 0.6 : 1)
  p.vy = Math.min(MAX_FALL, p.vy + g * dt)
  if (input.dx) p.face = input.dx
  var hit = moveBox(s, p, input.dx * RUN * dt, 0)
  hit = moveBox(s, p, 0, p.vy * dt)
  if (hit.down) {
    if (!p.ground && s.combo >= 3) { s.msg = s.combo + " COMBO"; s.msgT = 1.2 }
    if (!p.ground) s.combo = 0
    p.vy = 0; p.ground = true; s.ammo = AMMO
  } else {
    p.ground = boxHits(s, p.x, p.y + 0.02, PW, PH) && p.vy >= 0
    if (!p.ground && p.vy === 0) p.vy = 0.01
  }
  if (hit.up) p.vy = 0
  s.p = p

  // Bullets: fall fast, break crumbly blocks, stop at solid ones.
  var keep = []
  for (var bi = 0; bi < s.bullets.length; ++bi) {
    var b = { x: s.bullets[bi].x, y: s.bullets[bi].y + BULLET_V * dt, w: 0.2, h: 0.45, travelled: s.bullets[bi].travelled + BULLET_V * dt }
    var c = Math.floor(b.x + 0.1), r = Math.floor(b.y + b.h)
    var t = tile(s, c, r)
    if (t === CRUMBLE) { s.rows[r] = s.rows[r].slice(); s.rows[r][c] = EMPTY; s.gems += 1; continue }
    if (solid(t)) continue
    var used = false
    for (var ei = 0; ei < s.enemies.length && !used; ++ei) {
      var e = s.enemies[ei]
      if (!e.dead && overlap(b, e)) { used = true; e.hp--; if (e.hp <= 0) kill(s, e, "shot") }
    }
    if (!used && b.travelled < BULLET_RANGE) keep.push(b)
  }
  s.bullets = keep

  // Enemies.
  var list = []
  for (var i = 0; i < s.enemies.length; ++i) {
    var e0 = s.enemies[i]
    if (e0.dead) continue
    var en = { kind: e0.kind, x: e0.x, y: e0.y, w: e0.w, h: e0.h, vx: e0.vx, vy: e0.vy, hp: e0.hp }
    if (Math.abs(en.y - p.y) < VIEW_H) {
      if (en.kind === "bat") {
        var dx = p.x - en.x, dy = p.y - en.y, d = Math.sqrt(dx * dx + dy * dy) || 1
        if (d < 8) { en.vx += dx / d * 6 * dt; en.vy += dy / d * 6 * dt }
        var sp = Math.sqrt(en.vx * en.vx + en.vy * en.vy)
        if (sp > 2.6) { en.vx *= 2.6 / sp; en.vy *= 2.6 / sp }
        moveBox(s, en, en.vx * dt, en.vy * dt)
      } else {
        // Walkers pace their ledge and turn at its edge or a wall.
        if (!solid(tile(s, Math.floor(en.x + en.w / 2), Math.floor(en.y + en.h + 0.05)))) { en.y += 6 * dt; list.push(en); continue }
        var nx = en.x + en.vx * dt
        var ahead = en.vx > 0 ? nx + en.w : nx
        if (!solid(tile(s, Math.floor(ahead), Math.floor(en.y + en.h + 0.1))) || solid(tile(s, Math.floor(ahead), Math.floor(en.y + en.h / 2)))) en.vx = -en.vx
        else en.x = nx
      }
    }
    // Touching the player: from above (falling onto a stompable) kills it.
    if (overlap(p, en)) {
      var stomp = p.vy > 0 && p.y + PH - en.y < 0.45 && en.kind !== "spike"
      if (stomp) {
        kill(s, en, "stomp")
        p.vy = -JUMP_V * 0.75; s.ammo = AMMO
        continue
      }
      hurt(s)
    }
    list.push(en)
  }
  s.enemies = list

  // Camera eases to keep the player a third of the way down.
  var target = p.y - VIEW_H * 0.33
  s.camY = Math.max(state.camY, state.camY + (target - state.camY) * Math.min(1, dt * 6))
  s.depth = Math.max(state.depth, Math.floor(p.y - 4))
  if (s.depth >= s.healAt) { s.healAt += 200; if (s.hp < HP) { s.hp++; s.msg = "+1 HP"; s.msgT = 1.5 } }
  s.pops = s.pops.map(function(o) { return { x: o.x, y: o.y - dt * 1.5, text: o.text, t: o.t - dt } }).filter(function(o) { return o.t > 0 })
  s.rows = s.rows
  ensureRows(s)
  // Falling off the top of the view isn't possible; being left above it is.
  if (p.y + PH < s.camY - 1) hurt(s)
  return s
}

function score(s) { return s.depth + s.gems }

