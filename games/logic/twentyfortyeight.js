.pragma library
.import "../../engine/Rng.js" as Rng

// Classic 2048. Every mutator returns a brand-new top-level state object
// (see the note in snake.js for why QML needs that) — the board array
// itself is only ever rebuilt via cloneBoard, never mutated in place once
// it's attached to a state object that's already been handed to QML.

var SIZE = 4

function emptyBoard() {
  var b = []
  for (var r = 0; r < SIZE; ++r) b.push(new Array(SIZE).fill(0))
  return b
}

function cloneBoard(b) {
  return b.map(function(row) { return row.slice() })
}

function emptyCells(board) {
  var out = []
  for (var r = 0; r < SIZE; ++r)
    for (var c = 0; c < SIZE; ++c)
      if (board[r][c] === 0) out.push({ x: c, y: r })
  return out
}

function spawnTile(board) {
  var empties = emptyCells(board)
  if (empties.length === 0) return board
  var pick = empties[Math.floor(Rng.random() * empties.length)]
  var b = cloneBoard(board)
  b[pick.y][pick.x] = Rng.random() < 0.9 ? 2 : 4
  return b
}

function makeState() {
  var board = spawnTile(spawnTile(emptyBoard()))
  return { board: board, score: 0, prev: null }
}

// Slides one row/column toward index 0, merging equal neighbours once each.
function slideLine(line) {
  var vals = line.filter(function(v) { return v !== 0 })
  var gained = 0
  var out = []
  var i = 0
  while (i < vals.length) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
      var merged = vals[i] * 2
      out.push(merged)
      gained += merged
      i += 2
    } else {
      out.push(vals[i])
      i += 1
    }
  }
  while (out.length < SIZE) out.push(0)
  return { line: out, gained: gained }
}

function arraysEqual(a, b) {
  for (var i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false
  return true
}

function getLine(board, index, dir) {
  var line = []
  for (var i = 0; i < SIZE; ++i)
    line.push(dir === "left" || dir === "right" ? board[index][i] : board[i][index])
  if (dir === "right" || dir === "down") line.reverse()
  return line
}

function setLine(board, index, dir, line) {
  var l = line.slice()
  if (dir === "right" || dir === "down") l.reverse()
  for (var i = 0; i < SIZE; ++i) {
    if (dir === "left" || dir === "right") board[index][i] = l[i]
    else board[i][index] = l[i]
  }
}

function moveDir(state, dir) {
  var board = cloneBoard(state.board)
  var changed = false
  var gained = 0
  for (var idx = 0; idx < SIZE; ++idx) {
    var before = getLine(state.board, idx, dir)
    var result = slideLine(before)
    if (!arraysEqual(before, result.line)) changed = true
    gained += result.gained
    setLine(board, idx, dir, result.line)
  }
  // A move that changes nothing is a no-op: no spawn, no score, no undo entry.
  if (!changed) return state

  return {
    board: spawnTile(board),
    score: state.score + gained,
    prev: { board: state.board, score: state.score }
  }
}

// dx/dy come straight from the shared keymap, where only one axis is ever
// nonzero at a time, so there's no diagonal case to resolve.
function move(state, dx, dy) {
  var dir = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : dy > 0 ? "down" : null
  if (!dir) return state
  return moveDir(state, dir)
}

// Single-level undo: restores the one snapshot taken before the last move,
// then clears it so a second undo can't go further back.
function undo(state) {
  if (!state.prev) return state
  return { board: state.prev.board, score: state.prev.score, prev: null }
}

function hasMoves(board) {
  for (var r = 0; r < SIZE; ++r) {
    for (var c = 0; c < SIZE; ++c) {
      if (board[r][c] === 0) return true
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return true
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return true
    }
  }
  return false
}

function maxTile(board) {
  var m = 0
  for (var r = 0; r < SIZE; ++r)
    for (var c = 0; c < SIZE; ++c)
      if (board[r][c] > m) m = board[r][c]
  return m
}

function serialize(state) {
  return { board: state.board, score: state.score, prev: state.prev }
}

function deserialize(obj) {
  if (!obj || !obj.board || obj.board.length !== SIZE) return null
  for (var r = 0; r < SIZE; ++r) if (!obj.board[r] || obj.board[r].length !== SIZE) return null
  return {
    board: cloneBoard(obj.board),
    score: obj.score | 0,
    prev: (obj.prev && obj.prev.board) ? { board: cloneBoard(obj.prev.board), score: obj.prev.score | 0 } : null
  }
}
