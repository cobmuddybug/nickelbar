.pragma library
.import "../../engine/Rng.js" as Rng

// Pure board logic. Mines are placed on the first reveal rather than at
// makeState() so the opening move (and its neighbours) can never be a bomb.

function makeState(cols, rows, mines) {
  var board = []
  for (var y = 0; y < rows; ++y) {
    var row = []
    for (var x = 0; x < cols; ++x) row.push({ mine: false, adjacent: 0, revealed: false, flagged: false })
    board.push(row)
  }
  return {
    cols: cols, rows: rows, mines: mines, board: board,
    cursor: { x: 0, y: 0 }, revealed: 0, flags: 0,
    started: false, alive: true, won: false
  }
}

function neighbors(state, x, y) {
  var out = []
  for (var dy = -1; dy <= 1; ++dy) {
    for (var dx = -1; dx <= 1; ++dx) {
      if (dx === 0 && dy === 0) continue
      var nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < state.cols && ny >= 0 && ny < state.rows) out.push({ x: nx, y: ny })
    }
  }
  return out
}

function cloneBoard(board) {
  return board.map(function(row) { return row.map(function(c) { return { mine: c.mine, adjacent: c.adjacent, revealed: c.revealed, flagged: c.flagged } }) })
}

function withBoard(state, board, patch) {
  var next = { cols: state.cols, rows: state.rows, mines: state.mines, board: board,
    cursor: state.cursor, revealed: state.revealed, flags: state.flags,
    started: state.started, alive: state.alive, won: state.won, boom: state.boom || null }
  for (var k in patch) next[k] = patch[k]
  return next
}

// Guarantees the clicked cell and its neighbours are safe, matching what
// most players expect from a first click.
function placeMines(state, safeX, safeY) {
  var safe = { }
  safe[safeX + "," + safeY] = true
  neighbors(state, safeX, safeY).forEach(function(n) { safe[n.x + "," + n.y] = true })

  var board = cloneBoard(state.board)
  var placed = 0, guard = 0
  while (placed < state.mines && guard < 10000) {
    guard++
    var x = Math.floor(Rng.random() * state.cols)
    var y = Math.floor(Rng.random() * state.rows)
    if (safe[x + "," + y] || board[y][x].mine) continue
    board[y][x].mine = true
    placed++
  }
  for (var y2 = 0; y2 < state.rows; ++y2) {
    for (var x2 = 0; x2 < state.cols; ++x2) {
      if (board[y2][x2].mine) continue
      var count = 0
      neighbors(state, x2, y2).forEach(function(n) { if (board[n.y][n.x].mine) count++ })
      board[y2][x2].adjacent = count
    }
  }
  return withBoard(state, board, { started: true })
}

function floodReveal(board, state, x, y) {
  var stack = [{ x: x, y: y }]
  var revealedNow = 0
  while (stack.length) {
    var p = stack.pop()
    var cell = board[p.y][p.x]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    revealedNow++
    if (cell.adjacent === 0 && !cell.mine) {
      neighbors(state, p.x, p.y).forEach(function(n) {
        if (!board[n.y][n.x].revealed && !board[n.y][n.x].flagged) stack.push(n)
      })
    }
  }
  return revealedNow
}

function checkWin(state, board) {
  var safeTotal = state.cols * state.rows - state.mines
  var revealedSafe = 0
  for (var y = 0; y < state.rows; ++y)
    for (var x = 0; x < state.cols; ++x)
      if (board[y][x].revealed && !board[y][x].mine) revealedSafe++
  return revealedSafe >= safeTotal
}

// On a loss, show every mine the player hadn't flagged (correct flags stay
// flags). On a win, flag every mine instead — the board ends fully marked.
function revealAllMines(board) {
  board.forEach(function(row) { row.forEach(function(c) { if (c.mine && !c.flagged) c.revealed = true }) })
}

function flagAllMines(board) {
  board.forEach(function(row) { row.forEach(function(c) { if (c.mine) c.flagged = true }) })
}

function reveal(state, x, y) {
  if (!state.alive || state.won) return state
  var cell = state.board[y][x]
  if (cell.flagged || cell.revealed) return state

  var afterMines = state.started ? state : placeMines(state, x, y)
  var board = cloneBoard(afterMines.board)

  if (board[y][x].mine) {
    revealAllMines(board)
    board[y][x].revealed = true
    return withBoard(afterMines, board, { alive: false, boom: { x: x, y: y } })
  }

  var gained = floodReveal(board, afterMines, x, y)
  var won = checkWin(afterMines, board)
  if (won) flagAllMines(board)
  return withBoard(afterMines, board, { revealed: afterMines.revealed + gained, won: won, flags: won ? state.mines : afterMines.flags })
}

// Reveals every unflagged neighbour when the flag count already matches the
// number on a revealed cell — the classic "chord" shortcut.
function chord(state, x, y) {
  if (!state.alive || state.won) return state
  var cell = state.board[y][x]
  if (!cell.revealed || cell.adjacent === 0) return state

  var around = neighbors(state, x, y)
  var flagged = around.filter(function(n) { return state.board[n.y][n.x].flagged }).length
  if (flagged !== cell.adjacent) return state

  var result = state
  for (var i = 0; i < around.length; ++i) {
    var n = around[i]
    if (!result.board[n.y][n.x].flagged && !result.board[n.y][n.x].revealed) {
      result = reveal(result, n.x, n.y)
      if (!result.alive) return result
    }
  }
  return result
}

function toggleFlag(state, x, y) {
  if (!state.alive || state.won) return state
  var cell = state.board[y][x]
  if (cell.revealed) return state
  var board = cloneBoard(state.board)
  board[y][x].flagged = !board[y][x].flagged
  var delta = board[y][x].flagged ? 1 : -1
  return withBoard(state, board, { flags: state.flags + delta })
}

function moveCursor(state, dx, dy) {
  var x = Math.max(0, Math.min(state.cols - 1, state.cursor.x + dx))
  var y = Math.max(0, Math.min(state.rows - 1, state.cursor.y + dy))
  return withBoard(state, state.board, { cursor: { x: x, y: y } })
}

// Interacting with the cursor cell: reveal if untouched, chord if already
// revealed and satisfied.
function activateCursor(state) {
  var c = state.cursor
  var cell = state.board[c.y][c.x]
  if (cell.revealed) return chord(state, c.x, c.y)
  return reveal(state, c.x, c.y)
}

function flagCursor(state) {
  var c = state.cursor
  return toggleFlag(state, c.x, c.y)
}

function serialize(state) {
  return {
    cols: state.cols, rows: state.rows, mines: state.mines, board: state.board,
    cursor: state.cursor, revealed: state.revealed, flags: state.flags,
    started: state.started, alive: state.alive, won: state.won
  }
}

function deserialize(obj) {
  if (!obj || !obj.board || !obj.board.length) return null
  return {
    cols: obj.cols, rows: obj.rows, mines: obj.mines, board: obj.board,
    cursor: obj.cursor || { x: 0, y: 0 }, revealed: obj.revealed || 0, flags: obj.flags || 0,
    started: !!obj.started, alive: obj.alive !== false, won: !!obj.won
  }
}
