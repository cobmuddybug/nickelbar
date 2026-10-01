.pragma library
.import "../../engine/Rng.js" as Rng

// Pure board logic — no QML, so it can be driven from the dev harness or a
// future test script without a shell around it. Walls wrap by default;
// Snake.qml is what decides `wrap`, this module just honors the flag.

function isOpposite(a, b) {
  return a.x === -b.x && a.y === -b.y
}

function placeFood(state) {
  var occupied = {}
  for (var i = 0; i < state.snake.length; ++i)
    occupied[state.snake[i].x + "," + state.snake[i].y] = true

  var free = state.cols * state.rows - state.snake.length
  if (free <= 0) return null

  for (var attempt = 0; attempt < 500; ++attempt) {
    var x = Math.floor(Rng.random() * state.cols)
    var y = Math.floor(Rng.random() * state.rows)
    if (!occupied[x + "," + y]) return { x: x, y: y }
  }
  return null
}

function makeState(cols, rows) {
  var startX = Math.floor(cols / 2)
  var startY = Math.floor(rows / 2)
  var state = {
    cols: cols,
    rows: rows,
    snake: [{ x: startX, y: startY }, { x: startX - 1, y: startY }, { x: startX - 2, y: startY }],
    dir: { x: 1, y: 0 },
    pendingDir: [],
    food: null,
    score: 0,
    alive: true
  }
  state.food = placeFood(state)
  return state
}

// Queues a direction; ignored if it would reverse straight into the body
// or if nothing has actually changed. Each step() consumes one queued turn,
// so a quick UP-LEFT while heading right plays out as two turns over two
// ticks — with a single pending slot the LEFT used to overwrite the UP and
// get validated against it rather than the actual heading, which turned
// the snake straight back into its own neck.
//
// Always returns a NEW object rather than mutating `state` in place: QML's
// `property var` only re-evaluates bindings (and Connections handlers) when
// the property is assigned a genuinely different value, and for an object
// that means a different reference. Mutating and handing back the same
// object is a no-op as far as QML can tell — the board would tick
// internally but never repaint.
function setDirection(state, dx, dy) {
  if (!state.alive || (dx === 0 && dy === 0)) return state
  var next = { x: dx, y: dy }
  var queue = state.pendingDir || []
  var last = queue.length ? queue[queue.length - 1] : state.dir
  if (queue.length >= 3) return state
  if (isOpposite(next, last) || (next.x === last.x && next.y === last.y)) return state
  return {
    cols: state.cols, rows: state.rows, snake: state.snake, dir: state.dir,
    pendingDir: queue.concat([next]), food: state.food, score: state.score, alive: state.alive
  }
}

function step(state, wrap) {
  if (!state.alive) return state

  var queue = state.pendingDir || []
  var dir = queue.length ? queue[0] : state.dir
  var rest = queue.slice(1)
  var head = state.snake[0]
  var nx = head.x + dir.x
  var ny = head.y + dir.y

  if (wrap) {
    nx = (nx + state.cols) % state.cols
    ny = (ny + state.rows) % state.rows
  } else if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) {
    return { cols: state.cols, rows: state.rows, snake: state.snake, dir: dir,
      pendingDir: [], food: state.food, score: state.score, alive: false }
  }

  var ateFood = !!(state.food && nx === state.food.x && ny === state.food.y)

  // Growing keeps the tail cell in place for this tick, so a bite one cell
  // ahead of the tail isn't a false self-collision.
  var bodyToCheck = ateFood ? state.snake : state.snake.slice(0, state.snake.length - 1)
  for (var i = 0; i < bodyToCheck.length; ++i) {
    if (bodyToCheck[i].x === nx && bodyToCheck[i].y === ny) {
      return { cols: state.cols, rows: state.rows, snake: state.snake, dir: dir,
        pendingDir: [], food: state.food, score: state.score, alive: false }
    }
  }

  var newSnake = [{ x: nx, y: ny }].concat(state.snake)
  if (!ateFood) newSnake.pop()

  var next = {
    cols: state.cols, rows: state.rows, snake: newSnake, dir: dir, pendingDir: rest,
    food: state.food, score: state.score, alive: true
  }

  if (ateFood) {
    next.score = state.score + 1
    next.food = placeFood(next)
    if (!next.food) next.alive = false // board filled — nothing left to place
  }

  return next
}

function speedForScore(score) {
  var base = 160
  var floor = 70
  return Math.max(floor, base - score * 4)
}

function serialize(state) {
  return {
    cols: state.cols, rows: state.rows, snake: state.snake, dir: state.dir,
    food: state.food, score: state.score, alive: state.alive
  }
}

function deserialize(obj) {
  if (!obj || !obj.snake || !obj.snake.length) return null
  return {
    cols: obj.cols, rows: obj.rows, snake: obj.snake, dir: obj.dir || { x: 1, y: 0 },
    pendingDir: [], food: obj.food || null, score: obj.score || 0,
    alive: obj.alive !== false
  }
}
