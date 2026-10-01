.pragma library
.import "../../engine/Rng.js" as Rng

// Pure board logic. `humanMove()` folds the whole turn — black's placement,
// any flips, then white's synchronous AI reply, then re-skipping back to
// black — into one call so Reversi.qml's activate() stays a one-liner; see
// the note in snake.js for why every step below returns a new state object.

var SIZE = 8
var EMPTY = 0
var BLACK = 1
var WHITE = 2

var DIRS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]

// Two players at the same keyboard instead of the computer (set by the overlay through the game's QML).
var TWO = false
function setTwoPlayer(on) { TWO = !!on }
function isTwoPlayer() { return TWO }

function emptyBoard() {
  var board = []
  for (var y = 0; y < SIZE; ++y) board.push(new Array(SIZE).fill(EMPTY))
  return board
}

function makeState() {
  var board = emptyBoard()
  board[3][3] = WHITE; board[4][4] = WHITE
  board[4][3] = BLACK; board[3][4] = BLACK
  return { board: board, turn: BLACK, cursor: { x: 2, y: 3 }, over: false, lastAi: null, history: [], aiPassed: false }
}

function withState(state, patch) {
  var next = { board: state.board, turn: state.turn, cursor: state.cursor, over: state.over,
    lastAi: state.lastAi || null, history: state.history || [], aiPassed: !!state.aiPassed }
  for (var k in patch) next[k] = patch[k]
  return next
}

function cloneBoard(board) {
  return board.map(function(row) { return row.slice() })
}

function inBounds(x, y) {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE
}

function opponent(color) {
  return color === BLACK ? WHITE : BLACK
}

function flipsInDirection(board, x, y, color, dx, dy) {
  var opp = opponent(color)
  var cx = x + dx, cy = y + dy
  var run = []
  while (inBounds(cx, cy) && board[cy][cx] === opp) {
    run.push({ x: cx, y: cy })
    cx += dx; cy += dy
  }
  if (run.length > 0 && inBounds(cx, cy) && board[cy][cx] === color) return run
  return []
}

function flipsForMove(board, x, y, color) {
  if (board[y][x] !== EMPTY) return []
  var all = []
  for (var i = 0; i < DIRS.length; ++i) {
    var f = flipsInDirection(board, x, y, color, DIRS[i][0], DIRS[i][1])
    if (f.length) all = all.concat(f)
  }
  return all
}

function isLegalMove(board, x, y, color) {
  return flipsForMove(board, x, y, color).length > 0
}

function legalMoves(board, color) {
  var moves = []
  for (var y = 0; y < SIZE; ++y)
    for (var x = 0; x < SIZE; ++x)
      if (isLegalMove(board, x, y, color)) moves.push({ x: x, y: y })
  return moves
}

function applyMove(board, x, y, color) {
  var flips = flipsForMove(board, x, y, color)
  var next = cloneBoard(board)
  next[y][x] = color
  for (var i = 0; i < flips.length; ++i) next[flips[i].y][flips[i].x] = color
  return next
}

function countDiscs(board, color) {
  var c = 0
  for (var y = 0; y < SIZE; ++y)
    for (var x = 0; x < SIZE; ++x)
      if (board[y][x] === color) c++
  return c
}

function isCorner(x, y) {
  return (x === 0 || x === SIZE - 1) && (y === 0 || y === SIZE - 1)
}

// Classic positional weights: corners are gold, the squares that hand the
// opponent a corner (X- and C-squares) are poison, edges are good.
var WEIGHTS = [
  [120, -20, 20,  5,  5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [ 20,  -5, 15,  3,  3, 15,  -5,  20],
  [  5,  -5,  3,  3,  3,  3,  -5,   5],
  [  5,  -5,  3,  3,  3,  3,  -5,   5],
  [ 20,  -5, 15,  3,  3, 15,  -5,  20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20,  5,  5, 20, -20, 120]
]

function evaluate(board, color) {
  var opp = opponent(color), score = 0, empties = 0
  for (var y = 0; y < SIZE; ++y)
    for (var x = 0; x < SIZE; ++x) {
      var v = board[y][x]
      if (v === color) score += WEIGHTS[y][x]
      else if (v === opp) score -= WEIGHTS[y][x]
      else empties++
    }
  // Mobility matters most mid-game; raw disc count only at the very end.
  score += 4 * (legalMoves(board, color).length - legalMoves(board, opp).length)
  if (empties < 10) score += 6 * (countDiscs(board, color) - countDiscs(board, opp))
  return score
}

// Two-ply search: pick the move whose worst-case reply (by the player)
// still leaves the best position. Small random jitter so games vary.
// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function pickAiMove(board, color) {
  var moves = legalMoves(board, color)
  if (!moves.length) return null
  if (LEVEL === 0 && Rng.random() < 0.4) return moves[Math.floor(Rng.random() * moves.length)]
  var opp = opponent(color)
  var best = -Infinity, bestMove = moves[0]
  for (var i = 0; i < moves.length; ++i) {
    var m = moves[i]
    var after = applyMove(board, m.x, m.y, color)
    var replies = legalMoves(after, opp)
    var worst
    if (!replies.length) worst = evaluate(after, color) + 15
    else {
      worst = Infinity
      for (var j = 0; j < replies.length; ++j) {
        var r = replies[j]
        worst = Math.min(worst, evaluate(applyMove(after, r.x, r.y, opp), color))
      }
    }
    worst += Rng.random() * (LEVEL === 2 ? 0.3 : 3)
    if (worst > best) { best = worst; bestMove = m }
  }
  return bestMove
}

// Advances turn after a move was just applied: lets white's AI reply
// synchronously, skips a side with no legal move back to the other, and
// stops once it's genuinely black's turn again or nobody can move.
function resolveTurns(state) {
  var s = withState(state, { aiPassed: false })
  var guard = 0
  while (guard++ < 200) {
    var blackMoves = legalMoves(s.board, BLACK)
    var whiteMoves = legalMoves(s.board, WHITE)
    if (!blackMoves.length && !whiteMoves.length) return withState(s, { over: true })

    if (s.turn === BLACK) {
      if (blackMoves.length) return withState(s, { turn: BLACK })
      s = withState(s, { turn: WHITE }) // black stuck, pass
      continue
    }
    if (!whiteMoves.length) { s = withState(s, { turn: BLACK, aiPassed: true }); continue } // white stuck, pass back
    var mv = pickAiMove(s.board, WHITE)
    var board2 = applyMove(s.board, mv.x, mv.y, WHITE)
    s = withState(s, { board: board2, turn: BLACK, lastAi: { x: mv.x, y: mv.y } })
  }
  return s
}

// Whole-turn entry point: no-op (same state reference) unless it's black's
// turn and (x,y) is a legal black move.
function humanMove(state, x, y) {
  var who = TWO ? state.turn : BLACK
  if (state.over || state.turn !== who) return state
  if (!isLegalMove(state.board, x, y, who)) return state
  var board2 = applyMove(state.board, x, y, who)
  if (TWO) {
    var hist = state.history.concat([{ board: state.board, lastAi: state.lastAi, turn: state.turn }]).slice(-60)
    var after = withState(state, { board: board2, history: hist, lastAi: { x: x, y: y } })
    var opp = opponent(who)
    if (legalMoves(board2, opp).length) return withState(after, { turn: opp, aiPassed: false })
    if (legalMoves(board2, who).length) return withState(after, { turn: who, aiPassed: true })      // the other side must pass
    return withState(after, { over: true })
  }
  var history = state.history.concat([{ board: state.board, lastAi: state.lastAi }]).slice(-60)
  return resolveTurns(withState(state, { board: board2, turn: WHITE, history: history }))
}

// Undo takes back the player's last move together with the AI's reply.
function undo(state) {
  if (!state.history.length) return state
  var h = state.history[state.history.length - 1]
  return withState(state, { board: h.board, lastAi: h.lastAi, turn: TWO ? (h.turn || BLACK) : BLACK, over: false,
    aiPassed: false, history: state.history.slice(0, -1) })
}

function moveCursor(state, dx, dy) {
  var x = Math.max(0, Math.min(SIZE - 1, state.cursor.x + dx))
  var y = Math.max(0, Math.min(SIZE - 1, state.cursor.y + dy))
  if (x === state.cursor.x && y === state.cursor.y) return state
  return withState(state, { cursor: { x: x, y: y } })
}

function serialize(state) {
  return { board: state.board, turn: state.turn, cursor: state.cursor, over: state.over,
    lastAi: state.lastAi || null, history: state.history || [] }
}

function deserialize(obj) {
  if (!obj || !obj.board || !obj.board.length) return null
  return {
    board: obj.board,
    turn: obj.turn === WHITE ? WHITE : BLACK,
    cursor: obj.cursor || { x: 0, y: 0 },
    over: !!obj.over,
    lastAi: obj.lastAi || null,
    history: Array.isArray(obj.history) ? obj.history : [],
    aiPassed: false
  }
}
