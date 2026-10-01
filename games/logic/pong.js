.pragma library
.import "../../engine/Rng.js" as Rng

// Normalized playfield (0..1 both axes), same reasoning as breakout.js.
// The AI has no separate difficulty picker in the shared keymap, so it
// ramps automatically with the player's own score — sharper the better
// you're doing, rather than a menu nobody would find.

var PADDLE_H = 0.18
var PADDLE_W = 0.018
var PLAYER_X = 0.02
var AI_X = 1 - PLAYER_X - PADDLE_W
var BALL_RADIUS = 0.012
var PADDLE_STEP = 0.07
var PADDLE_SPEED = 1.2 // per second while a direction key is held
var BASE_SPEED = 0.5
var WIN_SCORE = 7

// Two players at the same keyboard instead of the computer (set by the overlay through the game's QML).
var TWO = false
function setTwoPlayer(on) { TWO = !!on }
function isTwoPlayer() { return TWO }

function shallowCopy(state) {
  return {
    playerY: state.playerY, aiY: state.aiY, ballX: state.ballX, ballY: state.ballY,
    ballVX: state.ballVX, ballVY: state.ballVY, playerScore: state.playerScore,
    aiScore: state.aiScore, inPlay: state.inPlay, serveToPlayer: state.serveToPlayer,
    alive: state.alive
  }
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function makeState() {
  return {
    playerY: 0.5 - PADDLE_H / 2, aiY: 0.5 - PADDLE_H / 2,
    ballX: 0.5, ballY: 0.5, ballVX: 0, ballVY: 0,
    playerScore: 0, aiScore: 0, inPlay: false, serveToPlayer: true, alive: true
  }
}

function difficultyFor(state) {
  return Math.min(2, Math.floor(state.playerScore / 2))
}

function movePlayer(state, dy) {
  if (!state.alive) return state
  var next = shallowCopy(state)
  next.playerY = Math.max(0, Math.min(1 - PADDLE_H, state.playerY + dy * PADDLE_STEP))
  return next
}

// The second player's paddle (the right one) in two-player mode.
function movePaddle2(state, dy) {
  if (!state.alive) return state
  var next = shallowCopy(state)
  next.aiY = Math.max(0, Math.min(1 - PADDLE_H, state.aiY + dy * PADDLE_STEP))
  return next
}

function glidePlayer(state, dir, dt) {
  if (!state.alive || dir === 0) return state
  var y = Math.max(0, Math.min(1 - PADDLE_H, state.playerY + dir * PADDLE_SPEED * dt))
  if (y === state.playerY) return state
  var next = shallowCopy(state)
  next.playerY = y
  return next
}

function serve(state) {
  if (!state.alive || state.inPlay) return state
  var next = shallowCopy(state)
  var angle = (Rng.random() - 0.5) * 0.7
  var dir = state.serveToPlayer ? -1 : 1
  next.ballX = 0.5
  next.ballY = 0.5
  next.ballVX = Math.cos(angle) * BASE_SPEED * dir
  next.ballVY = Math.sin(angle) * BASE_SPEED
  next.inPlay = true
  return next
}

function step(state, dt) {
  if (!state.alive || !state.inPlay) return state

  var next = shallowCopy(state)
  var x = state.ballX + state.ballVX * dt
  var y = state.ballY + state.ballVY * dt
  var vx = state.ballVX
  var vy = state.ballVY

  if (y - BALL_RADIUS < 0) { y = BALL_RADIUS; vy = -vy }
  else if (y + BALL_RADIUS > 1) { y = 1 - BALL_RADIUS; vy = -vy }

  // Player paddle (left wall).
  if (vx < 0 && x - BALL_RADIUS <= PLAYER_X + PADDLE_W && x - BALL_RADIUS >= PLAYER_X - 0.02
      && y >= state.playerY - BALL_RADIUS && y <= state.playerY + PADDLE_H + BALL_RADIUS) {
    var pCenter = state.playerY + PADDLE_H / 2
    var pOffset = Math.max(-1, Math.min(1, (y - pCenter) / (PADDLE_H / 2)))
    var speed = Math.sqrt(vx * vx + vy * vy) * 1.03
    vx = Math.abs(Math.cos(pOffset * 1.0)) * speed
    vy = pOffset * speed
    x = PLAYER_X + PADDLE_W + BALL_RADIUS
  }

  // AI paddle (right wall).
  if (vx > 0 && x + BALL_RADIUS >= AI_X && x + BALL_RADIUS <= AI_X + 0.02
      && y >= state.aiY - BALL_RADIUS && y <= state.aiY + PADDLE_H + BALL_RADIUS) {
    var aCenter = state.aiY + PADDLE_H / 2
    var aOffset = Math.max(-1, Math.min(1, (y - aCenter) / (PADDLE_H / 2)))
    var aSpeed = Math.sqrt(vx * vx + vy * vy) * 1.03
    vx = -Math.abs(Math.cos(aOffset * 1.0)) * aSpeed
    vy = aOffset * aSpeed
    x = AI_X - BALL_RADIUS
  }

  // AI tracking. Reaction speed and precision both improve with difficulty.
  var difficulty = difficultyFor(state) + (LEVEL - 1) * 0.6
  var aiSpeed = 0.32 + difficulty * 0.16
  var aiError = (2 - difficulty) * 0.05
  var target = (vx > 0 ? y : 0.5) - PADDLE_H / 2 + (Rng.random() - 0.5) * aiError
  var aiY = state.aiY
  var maxStep = aiSpeed * dt
  if (TWO) target = aiY      // a person holds that paddle
  if (target > aiY) aiY = Math.min(target, aiY + maxStep)
  else if (target < aiY) aiY = Math.max(target, aiY - maxStep)
  next.aiY = Math.max(0, Math.min(1 - PADDLE_H, aiY))

  // A point resets the ball to centre court so it doesn't sit half off
  // screen until the next serve.
  if (x < 0) {
    next.aiScore = state.aiScore + 1
    next.inPlay = false
    next.serveToPlayer = true
    next.ballX = 0.5; next.ballY = 0.5
    next.ballVX = 0; next.ballVY = 0
    if (next.aiScore >= WIN_SCORE) next.alive = false
    return next
  }
  if (x > 1) {
    next.playerScore = state.playerScore + 1
    next.inPlay = false
    next.serveToPlayer = false
    next.ballX = 0.5; next.ballY = 0.5
    next.ballVX = 0; next.ballVY = 0
    if (next.playerScore >= WIN_SCORE) next.alive = false
    return next
  }

  next.ballX = x
  next.ballY = y
  next.ballVX = vx
  next.ballVY = vy
  return next
}

function serialize(state) {
  return {
    playerY: state.playerY, playerScore: state.playerScore, aiScore: state.aiScore, alive: state.alive
  }
}

function deserialize(obj) {
  if (!obj || typeof obj.playerScore !== "number") return null
  var s = makeState()
  s.playerY = obj.playerY || s.playerY
  s.playerScore = obj.playerScore || 0
  s.aiScore = obj.aiScore || 0
  s.alive = obj.alive !== false
  return s
}
