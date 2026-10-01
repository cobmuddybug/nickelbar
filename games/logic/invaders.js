.pragma library
.import "../../engine/Rng.js" as Rng

// Normalized playfield again. The alien block marches on its own cadence
// (state.alienInterval, quickening as rows thin) while everything else —
// bullets, the player — moves every tick, so shooting stays smooth even
// when only one slow-marching alien is left.

var ROWS = 5
var COLS = 8
var TOTAL = ROWS * COLS
var CELL_W = 0.09
var CELL_H = 0.06
var BLOCK_W = COLS * CELL_W
var START_X = (1 - BLOCK_W) / 2
var START_Y = 0.08
var STEP_X = 0.02
var STEP_Y = 0.045
var PLAYER_Y = 0.90
var PLAYER_W = 0.06
var PLAYER_STEP = 0.05
var PLAYER_SPEED = 0.8 // per second while a direction key is held
var BULLET_SPEED = 1.1
var ALIEN_BULLET_SPEED = 0.45
var MAX_ALIEN_BULLETS = 3
var SHIELD_ROWS = 3
var SHIELD_COLS = 4
var SHIELD_BLOCK = 0.028

function makeAliens() {
  var g = []
  for (var r = 0; r < ROWS; ++r) { var row = []; for (var c = 0; c < COLS; ++c) row.push(true); g.push(row) }
  return g
}

function makeShields() {
  var shields = []
  var centers = [0.2, 0.5, 0.8]
  for (var s = 0; s < centers.length; ++s) {
    var blocks = []
    var left = centers[s] - (SHIELD_COLS * SHIELD_BLOCK) / 2
    for (var r = 0; r < SHIELD_ROWS; ++r) {
      for (var c = 0; c < SHIELD_COLS; ++c) {
        // Notch out the bottom-center block so a shield reads as a bunker.
        if (r === SHIELD_ROWS - 1 && c === Math.floor(SHIELD_COLS / 2)) continue
        blocks.push({ x: left + c * SHIELD_BLOCK, y: 0.74 + r * SHIELD_BLOCK, alive: true })
      }
    }
    shields.push(blocks)
  }
  return shields
}

function countAlive(aliens) {
  var n = 0
  for (var r = 0; r < aliens.length; ++r) for (var c = 0; c < aliens[r].length; ++c) if (aliens[r][c]) n++
  return n
}

function alienInterval(remaining) {
  return Math.max(90, 700 * (remaining / TOTAL))
}

function shallowCopy(state) {
  return {
    aliens: state.aliens, alienX: state.alienX, alienY: state.alienY, alienDir: state.alienDir,
    alienMoveAccum: state.alienMoveAccum, shields: state.shields, playerX: state.playerX,
    playerBullet: state.playerBullet, alienBullets: state.alienBullets,
    score: state.score, lives: state.lives, wave: state.wave, alive: state.alive
  }
}

function makeState() {
  return {
    aliens: makeAliens(), alienX: START_X, alienY: START_Y, alienDir: 1, alienMoveAccum: 0,
    shields: makeShields(), playerX: 0.5 - PLAYER_W / 2,
    playerBullet: null, alienBullets: [],
    score: 0, lives: 3, wave: 1, alive: true
  }
}

function nextWave(state) {
  var next = shallowCopy(state)
  next.aliens = makeAliens()
  next.alienX = START_X
  next.alienY = START_Y
  next.alienDir = 1
  next.alienMoveAccum = 0
  next.shields = makeShields()
  next.playerBullet = null
  next.alienBullets = []
  next.wave = state.wave + 1
  return next
}

function movePlayer(state, dx) {
  if (!state.alive) return state
  var next = shallowCopy(state)
  next.playerX = Math.max(0, Math.min(1 - PLAYER_W, state.playerX + dx * PLAYER_STEP))
  return next
}

function glidePlayer(state, dir, dt) {
  if (!state.alive || dir === 0) return state
  var x = Math.max(0, Math.min(1 - PLAYER_W, state.playerX + dir * PLAYER_SPEED * dt))
  if (x === state.playerX) return state
  var next = shallowCopy(state)
  next.playerX = x
  return next
}

function fire(state) {
  if (!state.alive || state.playerBullet) return state
  var next = shallowCopy(state)
  next.playerBullet = { x: state.playerX + PLAYER_W / 2, y: PLAYER_Y }
  return next
}

function hitShield(shields, x, y) {
  for (var s = 0; s < shields.length; ++s) {
    var blocks = shields[s]
    for (var b = 0; b < blocks.length; ++b) {
      var blk = blocks[b]
      if (!blk.alive) continue
      if (x >= blk.x && x <= blk.x + SHIELD_BLOCK && y >= blk.y && y <= blk.y + SHIELD_BLOCK) {
        var newShields = shields.slice()
        var newBlocks = blocks.slice()
        newBlocks[b] = { x: blk.x, y: blk.y, alive: false }
        newShields[s] = newBlocks
        return newShields
      }
    }
  }
  return null
}

function step(state, dt) {
  if (!state.alive) return state
  var next = shallowCopy(state)

  // Alien march: a slow internal clock, independent of the tick rate.
  var remaining = countAlive(state.aliens)
  next.alienMoveAccum = state.alienMoveAccum + dt * 1000
  var interval = alienInterval(remaining)
  if (next.alienMoveAccum >= interval) {
    next.alienMoveAccum = 0
    var wouldX = state.alienX + STEP_X * state.alienDir
    var blockRight = wouldX + BLOCK_W
    if (wouldX < 0 || blockRight > 1) {
      next.alienDir = -state.alienDir
      next.alienY = state.alienY + STEP_Y
      next.alienX = state.alienX
    } else {
      next.alienX = wouldX
    }
    if (next.alienY + ROWS * CELL_H >= PLAYER_Y) { next.alive = false; return next }

    // Occasional return fire from a random alive column.
    if (next.alienBullets.length < MAX_ALIEN_BULLETS && Rng.random() < 0.5) {
      var cols = []
      for (var c = 0; c < COLS; ++c) {
        for (var r = ROWS - 1; r >= 0; --r) { if (state.aliens[r][c]) { cols.push({ r: r, c: c }); break } }
      }
      if (cols.length > 0) {
        var pick = cols[Math.floor(Rng.random() * cols.length)]
        var bx = next.alienX + pick.c * CELL_W + CELL_W / 2
        var by = next.alienY + pick.r * CELL_H + CELL_H
        next.alienBullets = state.alienBullets.concat([{ x: bx, y: by }])
      }
    }
  }

  // Player bullet.
  if (next.playerBullet) {
    var pb = { x: next.playerBullet.x, y: next.playerBullet.y - BULLET_SPEED * dt }
    if (pb.y < 0) {
      next.playerBullet = null
    } else {
      var col = Math.floor((pb.x - next.alienX) / CELL_W)
      var row = Math.floor((pb.y - next.alienY) / CELL_H)
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS && next.aliens[row] && next.aliens[row][col]) {
        var aliens = next.aliens.slice()
        var newRow = aliens[row].slice()
        newRow[col] = false
        aliens[row] = newRow
        next.aliens = aliens
        next.score = state.score + (ROWS - row) * 10
        next.playerBullet = null
        if (countAlive(aliens) === 0) return nextWave(next)
      } else {
        var afterShield = hitShield(next.shields, pb.x, pb.y)
        if (afterShield) { next.shields = afterShield; next.playerBullet = null }
        else next.playerBullet = pb
      }
    }
  }

  // Alien bullets.
  var survivors = []
  for (var i = 0; i < next.alienBullets.length; ++i) {
    var ab = next.alienBullets[i]
    var ny = ab.y + ALIEN_BULLET_SPEED * dt
    if (ny > 1) continue
    if (ny >= PLAYER_Y && ny <= PLAYER_Y + 0.03 && ab.x >= next.playerX && ab.x <= next.playerX + PLAYER_W) {
      next.lives = next.lives - 1
      if (next.lives <= 0) { next.alive = false }
      continue
    }
    var shieldHit = hitShield(next.shields, ab.x, ny)
    if (shieldHit) { next.shields = shieldHit; continue }
    survivors.push({ x: ab.x, y: ny })
  }
  next.alienBullets = survivors

  return next
}

function serialize(state) {
  return { score: state.score, lives: state.lives, wave: state.wave, alive: state.alive }
}

function deserialize(obj) {
  if (!obj || typeof obj.score !== "number") return null
  var s = makeState()
  s.score = obj.score || 0
  s.lives = obj.lives || 3
  s.wave = obj.wave || 1
  s.alive = obj.alive !== false
  return s
}
