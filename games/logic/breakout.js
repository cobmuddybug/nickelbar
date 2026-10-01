.pragma library
.import "../../engine/Rng.js" as Rng

// Normalized playfield: x and y both run 0..1. Keeps physics independent of
// the card's actual pixel size, which the QML side just scales up to draw.
//
// Every exported function that changes anything returns a NEW top-level
// state object rather than mutating the one it was given — Snake shipped a
// bug from doing the opposite (QML's `property var` change detection is
// reference-based, so mutate-and-reassign is invisible to it). Nested
// arrays (bricks) are mutated in place internally; that's fine, since only
// the top-level `state` reference needs to change for QML to notice and
// repaint, and the Canvas reads bricks fresh on every paint regardless.

var COLS = 10
var ROWS = 6
var PADDLE_Y = 0.92
var PADDLE_HEIGHT = 0.018
var BALL_RADIUS = 0.012
var BRICK_TOP = 0.10
var BRICK_BOTTOM = 0.50
var BRICK_ROW_H = (BRICK_BOTTOM - BRICK_TOP) / ROWS
var BASE_SPEED = 0.55
var PADDLE_STEP = 0.06
var PADDLE_SPEED = 1.15 // per second while a direction key is held

function layoutFull() {
  var g = []
  for (var r = 0; r < ROWS; ++r) { var row = []; for (var c = 0; c < COLS; ++c) row.push(1); g.push(row) }
  return g
}

function layoutPyramid() {
  var g = []
  for (var r = 0; r < ROWS; ++r) {
    var row = []
    var margin = r
    for (var c = 0; c < COLS; ++c) row.push((c >= margin && c < COLS - margin) ? 1 : 0)
    g.push(row)
  }
  return g
}

function layoutChecker() {
  var g = []
  for (var r = 0; r < ROWS; ++r) {
    var row = []
    for (var c = 0; c < COLS; ++c) row.push(((r + c) % 2 === 0) ? 2 : 0)
    g.push(row)
  }
  return g
}

var LAYOUTS = [layoutFull, layoutPyramid, layoutChecker]

function cloneBricks(bricks) {
  var out = []
  for (var r = 0; r < bricks.length; ++r) out.push(bricks[r].slice())
  return out
}

function bricksRemaining(bricks) {
  var n = 0
  for (var r = 0; r < bricks.length; ++r)
    for (var c = 0; c < bricks[r].length; ++c)
      if (bricks[r][c] > 0) n++
  return n
}

function paddleWidthFor(level) {
  return Math.max(0.10, 0.20 - level * 0.01)
}

function serveVelocity(level) {
  var speed = BASE_SPEED + level * 0.05
  var angle = -Math.PI / 2 + (Rng.random() - 0.5) * 0.9
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed }
}

function shallowCopy(state) {
  return {
    cols: state.cols, rows: state.rows, level: state.level, lives: state.lives, score: state.score,
    bricks: state.bricks, paddleX: state.paddleX, paddleWidth: state.paddleWidth,
    ballX: state.ballX, ballY: state.ballY, ballVX: state.ballVX, ballVY: state.ballVY,
    attached: state.attached, alive: state.alive, cleared: state.cleared
  }
}

function makeState(level) {
  var lvl = level || 0
  var paddleWidth = paddleWidthFor(lvl)
  var bricks = LAYOUTS[lvl % LAYOUTS.length]()
  return {
    cols: COLS, rows: ROWS, level: lvl, lives: 3, score: 0,
    bricks: bricks,
    paddleX: 0.5 - paddleWidth / 2, paddleWidth: paddleWidth,
    ballX: 0.5, ballY: PADDLE_Y - BALL_RADIUS - 0.001, ballVX: 0, ballVY: 0,
    attached: true, alive: true, cleared: false
  }
}

function movePaddle(state, dx) {
  if (!state.alive) return state
  var next = shallowCopy(state)
  next.paddleX = Math.max(0, Math.min(1 - state.paddleWidth, state.paddleX + dx * PADDLE_STEP))
  if (state.attached) next.ballX = next.paddleX + next.paddleWidth / 2
  return next
}

// Held-key motion: the overlay reports which way is held and every tick
// slides the paddle by speed * dt, so movement is smooth rather than
// paced by the keyboard's autorepeat.
function glidePaddle(state, dir, dt) {
  if (!state.alive || dir === 0) return state
  var x = Math.max(0, Math.min(1 - state.paddleWidth, state.paddleX + dir * PADDLE_SPEED * dt))
  if (x === state.paddleX) return state
  var next = shallowCopy(state)
  next.paddleX = x
  if (state.attached) next.ballX = x + next.paddleWidth / 2
  return next
}

function launch(state) {
  if (!state.alive || !state.attached) return state
  var next = shallowCopy(state)
  var v = serveVelocity(state.level)
  next.attached = false
  next.ballVX = v.vx
  next.ballVY = v.vy
  return next
}

// One physics tick. `dt` in seconds.
function step(state, dt) {
  if (!state.alive || state.attached) return state

  var next = shallowCopy(state)
  next.cleared = false
  var x = state.ballX + state.ballVX * dt
  var y = state.ballY + state.ballVY * dt
  var vx = state.ballVX
  var vy = state.ballVY

  if (x - BALL_RADIUS < 0) { x = BALL_RADIUS; vx = -vx }
  else if (x + BALL_RADIUS > 1) { x = 1 - BALL_RADIUS; vx = -vx }
  if (y - BALL_RADIUS < 0) { y = BALL_RADIUS; vy = -vy }

  // Paddle. Only when falling into it, and only near the bounce band —
  // stops a fast ball re-bouncing after it has already passed underneath.
  var paddleTop = PADDLE_Y
  if (vy > 0 && y + BALL_RADIUS >= paddleTop && y - BALL_RADIUS <= paddleTop + PADDLE_HEIGHT
      && x >= state.paddleX - BALL_RADIUS && x <= state.paddleX + state.paddleWidth + BALL_RADIUS) {
    var center = state.paddleX + state.paddleWidth / 2
    var offset = Math.max(-1, Math.min(1, (x - center) / (state.paddleWidth / 2)))
    var speed = Math.sqrt(vx * vx + vy * vy)
    var angle = -Math.PI / 2 + offset * (Math.PI * 0.37)
    vx = Math.cos(angle) * speed
    vy = Math.sin(angle) * speed
    y = paddleTop - BALL_RADIUS
  } else if (y - BALL_RADIUS > 1) {
    // Missed. Lose a life and re-serve, or end the game.
    next.lives = state.lives - 1
    if (next.lives <= 0) {
      next.alive = false
      next.ballX = x; next.ballY = y
      return next
    }
    next.attached = true
    next.paddleX = state.paddleX
    next.ballX = next.paddleX + next.paddleWidth / 2
    next.ballY = paddleTop - BALL_RADIUS - 0.001
    next.ballVX = 0; next.ballVY = 0
    return next
  }

  // Bricks. Single-cell check against the ball's new center — simple, and
  // fast enough at this tick rate that a ball never visibly skips a row.
  if (y >= BRICK_TOP && y <= BRICK_BOTTOM) {
    var row = Math.floor((y - BRICK_TOP) / BRICK_ROW_H)
    var col = Math.floor(x * state.cols)
    if (row >= 0 && row < state.rows && col >= 0 && col < state.cols && state.bricks[row][col] > 0) {
      var bricks = cloneBricks(state.bricks)
      var hp = bricks[row][col] - 1
      bricks[row][col] = hp
      next.bricks = bricks
      next.score = state.score + 10 * (state.level + 1)
      // Came in through a side face (same row as last tick, different
      // column)? Bounce horizontally; otherwise it hit a top/bottom face.
      var prevRow = Math.floor((state.ballY - BRICK_TOP) / BRICK_ROW_H)
      var prevCol = Math.floor(state.ballX * state.cols)
      if (prevRow === row && prevCol !== col) { vx = -vx; x = state.ballX }
      else { vy = -vy; y = state.ballY }
      if (bricksRemaining(bricks) === 0) {
        var nextLevel = state.level + 1
        var paddleWidth = paddleWidthFor(nextLevel)
        next.level = nextLevel
        next.bricks = LAYOUTS[nextLevel % LAYOUTS.length]()
        next.paddleWidth = paddleWidth
        next.paddleX = Math.max(0, Math.min(1 - paddleWidth, x - paddleWidth / 2))
        next.attached = true
        next.ballX = next.paddleX + paddleWidth / 2
        next.ballY = paddleTop - BALL_RADIUS - 0.001
        next.ballVX = 0; next.ballVY = 0
        next.cleared = true
        return next
      }
    }
  }

  next.ballX = x
  next.ballY = y
  next.ballVX = vx
  next.ballVY = vy
  return next
}

function serialize(state) {
  return {
    cols: state.cols, rows: state.rows, level: state.level, lives: state.lives, score: state.score,
    bricks: state.bricks, paddleX: state.paddleX, paddleWidth: state.paddleWidth,
    ballX: state.ballX, ballY: state.ballY, ballVX: 0, ballVY: 0, attached: true, alive: state.alive
  }
}

function deserialize(obj) {
  if (!obj || !obj.bricks) return null
  return {
    cols: obj.cols || COLS, rows: obj.rows || ROWS, level: obj.level || 0, lives: obj.lives || 3,
    score: obj.score || 0, bricks: obj.bricks,
    paddleX: obj.paddleX || 0.4, paddleWidth: obj.paddleWidth || paddleWidthFor(obj.level || 0),
    ballX: obj.paddleX || 0.5, ballY: PADDLE_Y - BALL_RADIUS - 0.001, ballVX: 0, ballVY: 0,
    attached: true, alive: obj.alive !== false, cleared: false
  }
}
