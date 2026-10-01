.pragma library

// Arcade Stacker: a row of blocks slides back and forth; SPACE stops it.
// Whatever overhangs the row below falls away, so the row narrows. Reach
// the top row to win. The slide quickens every row, and the starting width
// also caps as you climb (2 wide from row 6, 1 wide from row 11), like the
// cabinet. Scoring: 10 per row landed, +5 per block still standing,
// 250 for topping out.

var COLS = 7
var ROWS = 15

function makeState() {
  return { rows: [], current: { left: 2, width: 3, dir: 1 }, row: 0, alive: true, won: false,
    falling: [], clock: 0, stepAccum: 0, score: 0 }
}

function copy(s) {
  return { rows: s.rows, current: s.current, row: s.row, alive: s.alive, won: s.won,
    falling: s.falling, clock: s.clock, stepAccum: s.stepAccum, score: s.score }
}

// Just the tumbling blocks — used to finish the animation after game over.
function settle(state, dt) {
  if (!state.falling.length) return state
  var s = copy(state)
  s.falling = state.falling
    .map(function(f) { return { x: f.x, y: f.y + f.v * dt, v: f.v + 9 * dt } })
    .filter(function(f) { return f.y < ROWS + 2 })
  return s
}

function interval(row) { return Math.max(55, 190 - row * 10) }

function step(state, dt) {
  if (!state.alive || state.won) return state
  var s = copy(state)
  s.clock = state.clock + dt
  s.falling = state.falling
    .map(function(f) { return { x: f.x, y: f.y + f.v * dt, v: f.v + 9 * dt } })
    .filter(function(f) { return f.y < ROWS + 2 })
  s.stepAccum = state.stepAccum + dt * 1000
  var iv = interval(state.row)
  if (s.stepAccum >= iv) {
    s.stepAccum -= iv
    var c = state.current
    var left = c.left + c.dir, dir = c.dir
    if (left < 0 || left + c.width > COLS) { dir = -dir; left = c.left + dir }
    s.current = { left: left, width: c.width, dir: dir }
  }
  return s
}

// Locks the moving row in place.
function stop(state) {
  if (!state.alive || state.won) return state
  var s = copy(state)
  var c = state.current
  var left = c.left, right = c.left + c.width
  var falling = state.falling.slice()
  if (state.row > 0) {
    var below = state.rows[state.row - 1]
    var bl = below.left, br = below.left + below.width
    for (var x = left; x < right; ++x)
      if (x < bl || x >= br) falling.push({ x: x, y: ROWS - 1 - state.row, v: 0 })
    left = Math.max(left, bl)
    right = Math.min(right, br)
  }
  s.falling = falling
  var width = right - left
  if (width <= 0) { s.alive = false; return s }
  s.rows = state.rows.concat([{ left: left, width: width }])
  s.row = state.row + 1
  s.score = state.score + 10 + width * 5
  if (s.row >= ROWS) { s.won = true; s.score += 250; return s }
  var cap = s.row >= 10 ? 1 : (s.row >= 5 ? 2 : 3)
  var w = Math.min(width, cap)
  var startLeft = s.row % 2 === 0 ? 0 : COLS - w
  s.current = { left: startLeft, width: w, dir: startLeft === 0 ? 1 : -1 }
  s.stepAccum = 0
  return s
}
