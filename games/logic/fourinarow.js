.pragma library
.import "../../engine/Rng.js" as Rng

// Four in a Row on the classic 7x6 board against a negamax / alpha-beta AI.
// board[y][x], y = 0 is the top row; 1 is the player, 2 the AI. As in
// reversi.js, the player's drop and the AI's reply happen in one call.

var COLS = 7
var ROWS = 6
var LEVELS = [{ name: "EASY", depth: 2 }, { name: "MEDIUM", depth: 4 }, { name: "HARD", depth: 6 }]
// Centre columns first: alpha-beta prunes far more when good moves come early.
var ORDER = [3, 2, 4, 1, 5, 0, 6]

// Two players at the same keyboard instead of the computer (set by the overlay through the game's QML).
var TWO = false
function setTwoPlayer(on) { TWO = !!on }
function isTwoPlayer() { return TWO }

function emptyBoard() {
  var b = []
  for (var y = 0; y < ROWS; ++y) b.push([0, 0, 0, 0, 0, 0, 0])
  return b
}

function makeState(level, wins, losses) {
  return { board: emptyBoard(), cursor: 3, level: level === undefined ? 1 : level, winner: 0, line: null,
           last: null, history: [], wins: wins || 0, losses: losses || 0, turn: 1 }
}

function copy(s) {
  return { board: s.board, cursor: s.cursor, level: s.level, winner: s.winner, line: s.line, last: s.last,
           history: s.history, wins: s.wins, losses: s.losses, turn: s.turn || 1 }
}

function dropRow(b, x) {
  for (var y = ROWS - 1; y >= 0; --y) if (!b[y][x]) return y
  return -1
}

function full(b) {
  for (var x = 0; x < COLS; ++x) if (!b[0][x]) return false
  return true
}

// The four cells of a win through (x, y), or null.
function winLine(b, x, y) {
  var p = b[y][x]
  if (!p) return null
  var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (var d = 0; d < 4; ++d) {
    var cells = [{ x: x, y: y }]
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var cx = x + dirs[d][0] * sgn, cy = y + dirs[d][1] * sgn
      while (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && b[cy][cx] === p) {
        cells.push({ x: cx, y: cy })
        cx += dirs[d][0] * sgn; cy += dirs[d][1] * sgn
      }
    }
    if (cells.length >= 4) return cells
  }
  return null
}

// Heuristic from `p`'s side: every open window of four scores by how
// many of p's discs (and none of the other's) it holds, and vice versa.
function evaluate(b, p) {
  var o = 3 - p, score = 0
  var W = [0, 1, 6, 40]
  var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (var y = 0; y < ROWS; ++y)
    for (var x = 0; x < COLS; ++x)
      for (var d = 0; d < 4; ++d) {
        var ex = x + dirs[d][0] * 3, ey = y + dirs[d][1] * 3
        if (ex < 0 || ex >= COLS || ey < 0 || ey >= ROWS) continue
        var mine = 0, theirs = 0
        for (var i = 0; i < 4; ++i) {
          var v = b[y + dirs[d][1] * i][x + dirs[d][0] * i]
          if (v === p) mine++; else if (v === o) theirs++
        }
        if (!theirs && mine) score += W[mine]
        else if (!mine && theirs) score -= W[theirs]
      }
  for (var r = 0; r < ROWS; ++r) { if (b[r][3] === p) score += 3; else if (b[r][3] === o) score -= 3 }
  return score
}

function negamax(b, p, depth, alpha, beta) {
  if (full(b)) return 0
  if (depth === 0) return evaluate(b, p)
  var best = -1e9
  for (var i = 0; i < COLS; ++i) {
    var x = ORDER[i], y = dropRow(b, x)
    if (y < 0) continue
    b[y][x] = p
    var v = winLine(b, x, y) ? 100000 + depth : -negamax(b, 3 - p, depth - 1, -beta, -alpha)
    b[y][x] = 0
    if (v > best) best = v
    if (v > alpha) alpha = v
    if (alpha >= beta) break
  }
  return best
}

function pickMove(board, depth) {
  var b = board.map(function(r) { return r.slice() })
  var best = -1e9, moves = []
  for (var i = 0; i < COLS; ++i) {
    var x = ORDER[i], y = dropRow(b, x)
    if (y < 0) continue
    b[y][x] = 2
    var v = winLine(b, x, y) ? 1e6 : -negamax(b, 1, depth - 1, -1e9, 1e9)
    b[y][x] = 0
    if (v > best) { best = v; moves = [x] }
    else if (v === best) moves.push(x)
  }
  return moves.length ? moves[Math.floor(Rng.random() * moves.length)] : -1
}

function place(s, x, p) {
  var y = dropRow(s.board, x)
  if (y < 0) return null
  var n = copy(s)
  n.board = s.board.map(function(r) { return r.slice() })
  n.board[y][x] = p
  var line = winLine(n.board, x, y)
  if (line) { n.winner = p; n.line = line }
  else if (full(n.board)) n.winner = 3
  n.last = { x: x, y: y }
  return n
}

function over(s) { return s.winner !== 0 }

// The player drops in the cursor column; the AI answers straight away.
function drop(s) {
  if (over(s)) return s
  var who = TWO ? (s.turn || 1) : 1
  var n = place(s, s.cursor, who)
  if (!n) return s
  n.history = s.history.concat([s.board]).slice(-50)
  if (TWO) { n.turn = 3 - who; return n }
  if (!over(n)) {
    var ax = pickMove(n.board, LEVELS[n.level].depth)
    if (ax >= 0) { var h = n.history; n = place(n, ax, 2); n.history = h }
  }
  if (n.winner === 1) n.wins = s.wins + 1
  else if (n.winner === 2) n.losses = s.losses + 1
  return n
}

function dropAt(s, x) {
  if (over(s) || x < 0 || x >= COLS) return s
  var n = copy(s)
  n.cursor = x
  return drop(n)
}

function undo(s) {
  if (!s.history.length || over(s)) return s
  var n = copy(s)
  n.board = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  n.last = null
  if (TWO) n.turn = 3 - (s.turn || 1)
  return n
}

function moveCursor(s, dx) {
  if (!dx) return s
  var n = copy(s)
  n.cursor = (s.cursor + dx + COLS) % COLS
  return n
}

function serialize(s) {
  return { board: s.board, cursor: s.cursor, level: s.level, wins: s.wins, losses: s.losses, over: over(s) }
}

function deserialize(o) {
  if (!o || !o.board || o.board.length !== ROWS) return null
  var s = makeState(o.level, o.wins, o.losses)
  s.board = o.board
  s.cursor = o.cursor || 3
  if (o.over) s.winner = 3
  return s
}
