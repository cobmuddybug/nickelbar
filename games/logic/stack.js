.pragma library
.import "../../engine/Rng.js" as Rng

// Falling-block line clearer. Simplified rotation tables with simple wall
// kicks, and a 7-bag randomizer for fair piece distribution. Every
// function below returns a NEW top-level state object when anything
// changes — see the note in snake.js for why that matters to QML.

var COLS = 10
var ROWS = 18
var TYPES = ["I", "O", "T", "S", "Z", "J", "L"]

var ROTATIONS = {
  I: [
    [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:3,y:1}],
    [{x:2,y:0},{x:2,y:1},{x:2,y:2},{x:2,y:3}],
    [{x:0,y:2},{x:1,y:2},{x:2,y:2},{x:3,y:2}],
    [{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:1,y:3}]
  ],
  O: [
    [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}],
    [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}],
    [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}],
    [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:1}]
  ],
  T: [
    [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
    [{x:1,y:0},{x:1,y:1},{x:2,y:1},{x:1,y:2}],
    [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:1,y:2}],
    [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}]
  ],
  S: [
    [{x:1,y:0},{x:2,y:0},{x:0,y:1},{x:1,y:1}],
    [{x:1,y:0},{x:1,y:1},{x:2,y:1},{x:2,y:2}],
    [{x:1,y:1},{x:2,y:1},{x:0,y:2},{x:1,y:2}],
    [{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}]
  ],
  Z: [
    [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}],
    [{x:2,y:0},{x:1,y:1},{x:2,y:1},{x:1,y:2}],
    [{x:0,y:1},{x:1,y:1},{x:1,y:2},{x:2,y:2}],
    [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:0,y:2}]
  ],
  J: [
    [{x:0,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
    [{x:1,y:0},{x:2,y:0},{x:1,y:1},{x:1,y:2}],
    [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:2,y:2}],
    [{x:1,y:0},{x:1,y:1},{x:0,y:2},{x:1,y:2}]
  ],
  L: [
    [{x:2,y:0},{x:0,y:1},{x:1,y:1},{x:2,y:1}],
    [{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:2,y:2}],
    [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:0,y:2}],
    [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:1,y:2}]
  ]
}

var KICKS = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0]]

function cellsFor(type, rot) {
  return ROTATIONS[type][((rot % 4) + 4) % 4]
}

function shuffledBag() {
  var arr = TYPES.slice()
  for (var i = arr.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1))
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr
}

function draw(bag) {
  var b = bag.slice()
  if (b.length === 0) b = shuffledBag()
  var type = b.shift()
  return { type: type, bag: b }
}

function emptyBoard() {
  var b = []
  for (var r = 0; r < ROWS; ++r) b.push(new Array(COLS).fill(0))
  return b
}

function collides(board, type, rot, px, py) {
  var cells = cellsFor(type, rot)
  for (var i = 0; i < cells.length; ++i) {
    var x = px + cells[i].x, y = py + cells[i].y
    if (x < 0 || x >= COLS || y >= ROWS) return true
    if (y >= 0 && board[y][x] !== 0) return true
  }
  return false
}

function spawnPiece(bag, board) {
  var drawn = draw(bag)
  var px = Math.floor((COLS - 4) / 2)
  var py = 0
  return { current: { type: drawn.type, rot: 0, x: px, y: py }, bag: drawn.bag,
    ok: !collides(board, drawn.type, 0, px, py) }
}

function makeState() {
  var bag = shuffledBag()
  var first = draw(bag)
  var second = draw(first.bag)
  var board = emptyBoard()
  return {
    board: board,
    current: { type: first.type, rot: 0, x: Math.floor((COLS - 4) / 2), y: 0 },
    next: second.type,
    bag: second.bag,
    hold: null,
    holdUsed: false,
    score: 0, lines: 0, level: 0,
    alive: true
  }
}

function shallowCopy(state) {
  return {
    board: state.board, current: state.current, next: state.next, bag: state.bag,
    hold: state.hold, holdUsed: state.holdUsed, score: state.score, lines: state.lines,
    level: state.level, alive: state.alive, grounded: false
  }
}

// Gravity with a one-tick lock delay: the first tick a piece can't fall
// only marks it grounded, giving the player a beat to slide or spin it
// into place; it locks on the next grounded tick. Any successful move
// clears the flag (shallowCopy resets it), up to the natural limit of the
// piece falling again.
function gravity(state) {
  if (!state.alive) return state
  var c = state.current
  if (!collides(state.board, c.type, c.rot, c.x, c.y + 1)) return move(state, 0, 1)
  if (state.grounded) return lockPiece(state)
  var next = shallowCopy(state)
  next.grounded = true
  return next
}

function speedForLevel(level) {
  return Math.max(100, 800 - level * 60)
}

function ghostY(state) {
  var c = state.current
  var y = c.y
  while (!collides(state.board, c.type, c.rot, c.x, y + 1)) y++
  return y
}

function spawnNext(state) {
  var spawn = spawnPiece(state.bag, state.board)
  var next = shallowCopy(state)
  next.current = { type: state.next, rot: 0, x: spawn.current.x, y: spawn.current.y }
  next.next = spawn.current.type
  next.bag = spawn.bag
  next.holdUsed = false
  if (collides(state.board, next.current.type, 0, next.current.x, next.current.y)) next.alive = false
  return next
}

function clearLines(board) {
  var kept = []
  var cleared = 0
  for (var r = 0; r < board.length; ++r) {
    var full = true
    for (var c = 0; c < COLS; ++c) if (board[r][c] === 0) { full = false; break }
    if (full) cleared++
    else kept.push(board[r])
  }
  var out = []
  for (var i = 0; i < cleared; ++i) out.push(new Array(COLS).fill(0))
  return { board: out.concat(kept), cleared: cleared }
}

var LINE_SCORE = [0, 100, 300, 500, 800]

function lockPiece(state) {
  var c = state.current
  var cells = cellsFor(c.type, c.rot)
  var typeIndex = TYPES.indexOf(c.type) + 1
  var board = []
  for (var r = 0; r < state.board.length; ++r) board.push(state.board[r].slice())
  for (var i = 0; i < cells.length; ++i) {
    var x = c.x + cells[i].x, y = c.y + cells[i].y
    if (y >= 0 && y < ROWS) board[y][x] = typeIndex
  }

  var result = clearLines(board)
  var next = shallowCopy(state)
  next.board = result.board
  next.lines = state.lines + result.cleared
  next.level = Math.floor(next.lines / 10)
  next.score = state.score + (LINE_SCORE[result.cleared] || 0) * (state.level + 1)
  return spawnNext(next)
}

// No scoring here — this is also what gravity calls every tick, and a
// piece falling on its own shouldn't score the same as a player racing it
// down. `softDrop()` below is the player-initiated version that does.
function move(state, dx, dy) {
  if (!state.alive) return state
  var c = state.current
  var nx = c.x + dx, ny = c.y + dy
  if (!collides(state.board, c.type, c.rot, nx, ny)) {
    var next = shallowCopy(state)
    next.current = { type: c.type, rot: c.rot, x: nx, y: ny }
    return next
  }
  if (dy > 0) return lockPiece(state) // gravity or soft-drop hit bottom: lock in place
  return state
}

// The player's own down-press: one point per row actually descended,
// standard soft-drop scoring. A piece that was already resting just locks,
// same as gravity would, with no bonus for pressing down on solid ground.
function softDrop(state) {
  var before = state.current.y
  var next = move(state, 0, 1)
  if (next.current && next.current.y > before) next.score = next.score + 1
  return next
}

function rotate(state, dir) {
  if (!state.alive) return state
  var c = state.current
  var newRot = (c.rot + dir + 4) % 4
  for (var k = 0; k < KICKS.length; ++k) {
    var nx = c.x + KICKS[k][0], ny = c.y + KICKS[k][1]
    if (!collides(state.board, c.type, newRot, nx, ny)) {
      var next = shallowCopy(state)
      next.current = { type: c.type, rot: newRot, x: nx, y: ny }
      return next
    }
  }
  return state
}

function hardDrop(state) {
  if (!state.alive) return state
  var y = ghostY(state)
  var c = state.current
  var dropped = shallowCopy(state)
  dropped.current = { type: c.type, rot: c.rot, x: c.x, y: y }
  dropped.score = state.score + (y - c.y) * 2
  return lockPiece(dropped)
}

function hold(state) {
  if (!state.alive || state.holdUsed) return state
  var c = state.current
  var next = shallowCopy(state)
  var px = Math.floor((COLS - 4) / 2)

  if (state.hold === null) {
    var spawn = spawnPiece(state.bag, state.board)
    next.hold = c.type
    next.current = { type: state.next, rot: 0, x: spawn.current.x, y: spawn.current.y }
    next.next = spawn.current.type
    next.bag = spawn.bag
  } else {
    if (collides(state.board, state.hold, 0, px, 0)) return state
    next.hold = c.type
    next.current = { type: state.hold, rot: 0, x: px, y: 0 }
  }
  next.holdUsed = true
  return next
}

function serialize(state) {
  return {
    board: state.board, current: state.current, next: state.next, bag: state.bag,
    hold: state.hold, holdUsed: state.holdUsed, score: state.score, lines: state.lines,
    level: state.level, alive: state.alive
  }
}

function deserialize(obj) {
  if (!obj || !obj.board || !obj.current) return null
  return shallowCopy(obj)
}
