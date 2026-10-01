.pragma library
.import "../../engine/Rng.js" as Rng

// Pure puzzle logic. The hidden solution grid never changes after
// makeState() — only the player's marks and cursor move — but every
// mutator still returns a brand-new top-level state object (see the note
// in snake.js for why QML's `property var` needs that).

var SIZE = 10
var FILL_PROB = 0.45

var BLANK = 0
var FILLED = 1
var MARK = 2

function emptyPlayerGrid(size) {
  var grid = []
  for (var y = 0; y < size; ++y) grid.push(new Array(size).fill(BLANK))
  return grid
}

function lineSum(line) {
  var sum = 0
  for (var i = 0; i < line.length; ++i) sum += line[i]
  return sum
}

// Rerolls whole-empty/whole-full lines so every clue is meaningful — a row
// or column of all-0 or all-1 gives the player nothing to reason about.
function isDegenerate(grid, size) {
  for (var y = 0; y < size; ++y) {
    var s = lineSum(grid[y])
    if (s === 0 || s === size) return true
  }
  for (var x = 0; x < size; ++x) {
    var colSum = 0
    for (var y = 0; y < size; ++y) colSum += grid[y][x]
    if (colSum === 0 || colSum === size) return true
  }
  return false
}

// Every placement of `clue` in a line that fits `known` (-1 unknown, 0
// empty, 1 filled), folded into what they all agree on (-1 where they
// differ). Null if nothing fits.
function lineAgree(clue, known) {
  var n = known.length, agree = null, cur = []
  if (clue.length === 1 && clue[0] === 0) clue = []
  function place(b, pos) {
    if (b === clue.length) {
      for (var k = pos; k < n; ++k) { if (known[k] === 1) return; cur[k] = 0 }
      if (!agree) agree = cur.slice()
      else for (k = 0; k < n; ++k) if (agree[k] !== cur[k]) agree[k] = -1
      return
    }
    var len = clue[b], rest = 0
    for (var r = b + 1; r < clue.length; ++r) rest += clue[r] + 1
    for (var start = pos; start + len + rest <= n; ++start) {
      if (start > pos && known[start - 1] === 1) break
      var ok = true
      for (k = start; k < start + len && ok; ++k) if (known[k] === 0) ok = false
      if (!ok || (start + len < n && known[start + len] === 1)) continue
      for (k = pos; k < start; ++k) cur[k] = 0
      for (k = start; k < start + len; ++k) cur[k] = 1
      var next = start + len
      if (next < n) cur[next] = 0
      place(b + 1, next + 1)
    }
  }
  place(0, 0)
  return agree
}

// Solves line by line, the way a person does: fill or cross out whatever
// every fitting arrangement of a row's (or column's) clue agrees on, and
// repeat. True if that finishes the grid — then the answer is unique and
// no step needed a guess.
function lineSolvable(rowClues, colClues, size) {
  var g = []
  for (var y = 0; y < size; ++y) g.push(new Array(size).fill(-1))
  var changed = true, left = size * size
  while (changed && left) {
    changed = false
    for (var isRow = 0; isRow < 2; ++isRow) {
      for (var i = 0; i < size; ++i) {
        var known = []
        for (var k = 0; k < size; ++k) known.push(isRow ? g[i][k] : g[k][i])
        if (known.indexOf(-1) < 0) continue
        var agree = lineAgree(isRow ? rowClues[i] : colClues[i], known)
        if (!agree) return false
        for (k = 0; k < size; ++k) {
          if (known[k] !== -1 || agree[k] === -1) continue
          if (isRow) g[i][k] = agree[k]; else g[k][i] = agree[k]
          changed = true; left--
        }
      }
    }
  }
  return left === 0
}

// Random grids until one is solvable line by line (a few dozen tries at
// 10x10, each well under a millisecond).
function generateSolution(size) {
  var grid
  var guard = 0
  do {
    grid = []
    for (var y = 0; y < size; ++y) {
      var row = []
      for (var x = 0; x < size; ++x) row.push(Rng.random() < FILL_PROB ? 1 : 0)
      grid.push(row)
    }
    guard++
  } while ((isDegenerate(grid, size) || !lineSolvable(computeRowClues(grid), computeColClues(grid), size)) && guard < 5000)
  return grid
}

// Standard nonogram clue: consecutive filled-run lengths along a line.
function deriveClues(line) {
  var clues = []
  var run = 0
  for (var i = 0; i < line.length; ++i) {
    if (line[i]) { run++ }
    else if (run > 0) { clues.push(run); run = 0 }
  }
  if (run > 0) clues.push(run)
  return clues.length ? clues : [0]
}

function computeRowClues(solution) {
  return solution.map(deriveClues)
}

function computeColClues(solution) {
  var size = solution.length
  var clues = []
  for (var x = 0; x < size; ++x) {
    var col = []
    for (var y = 0; y < size; ++y) col.push(solution[y][x])
    clues.push(deriveClues(col))
  }
  return clues
}

function makeState(size) {
  size = size || SIZE
  var solution = generateSolution(size)
  return {
    size: size,
    solution: solution,
    player: emptyPlayerGrid(size),
    rowClues: computeRowClues(solution),
    colClues: computeColClues(solution),
    cursor: { x: 0, y: 0 },
    solved: false
  }
}

function withPatch(state, patch) {
  var next = {
    size: state.size, solution: state.solution, player: state.player,
    rowClues: state.rowClues, colClues: state.colClues,
    cursor: state.cursor, solved: state.solved
  }
  for (var k in patch) next[k] = patch[k]
  return next
}

function clonePlayer(player) {
  return player.map(function(row) { return row.slice() })
}

function moveCursor(state, dx, dy) {
  var x = Math.max(0, Math.min(state.size - 1, state.cursor.x + dx))
  var y = Math.max(0, Math.min(state.size - 1, state.cursor.y + dy))
  if (x === state.cursor.x && y === state.cursor.y) return state
  return withPatch(state, { cursor: { x: x, y: y } })
}

// Solved means every row and column matches its CLUE — not the stored
// solution grid. Dealt puzzles are line-solvable, so the two agree, but
// checking the clues is the rule the player actually sees.
function sameClue(a, b) {
  if (a.length !== b.length) return false
  for (var i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false
  return true
}

function playerRow(state, y) {
  return state.player[y].map(function(v) { return v === FILLED ? 1 : 0 })
}

function playerCol(state, x) {
  var col = []
  for (var y = 0; y < state.size; ++y) col.push(state.player[y][x] === FILLED ? 1 : 0)
  return col
}

function checkWin(state) {
  for (var i = 0; i < state.size; ++i)
    if (!rowSatisfied(state, i) || !colSatisfied(state, i)) return false
  return true
}

// Toggles fill/blank at the cursor. Landing on a marked-empty cell fills it
// (fill always wins over a mark) rather than requiring a mark-clear first.
function toggleFill(state) {
  var c = state.cursor
  var player = clonePlayer(state.player)
  player[c.y][c.x] = (player[c.y][c.x] === FILLED) ? BLANK : FILLED
  var next = withPatch(state, { player: player })
  next.solved = checkWin(next)
  return next
}

// The second nonogram tool: mark a cell as "definitely not filled". Filled
// cells are left alone — there is nothing to cross out once painted in.
function toggleMark(state) {
  var c = state.cursor
  var current = state.player[c.y][c.x]
  if (current === FILLED) return state
  var player = clonePlayer(state.player)
  player[c.y][c.x] = (current === MARK) ? BLANK : MARK
  return withPatch(state, { player: player })
}

function correctFilledCount(state) {
  var c = 0
  for (var y = 0; y < state.size; ++y)
    for (var x = 0; x < state.size; ++x)
      if (state.player[y][x] === FILLED && state.solution[y][x]) c++
  return c
}

function totalSolutionFilled(state) {
  var c = 0
  for (var y = 0; y < state.size; ++y) c += lineSum(state.solution[y])
  return c
}

// Correct fills minus wrong ones — capped exactly at totalSolutionFilled,
// and only reaches that cap when the board matches the solution, so the
// solved score is unambiguously the best attainable value.
function computeScore(state) {
  if (state.solved) return totalSolutionFilled(state)
  var score = 0
  for (var y = 0; y < state.size; ++y)
    for (var x = 0; x < state.size; ++x)
      if (state.player[y][x] === FILLED) score += state.solution[y][x] ? 1 : -1
  return score
}

function rowSatisfied(state, y) {
  return sameClue(deriveClues(playerRow(state, y)), state.rowClues[y])
}

function colSatisfied(state, x) {
  return sameClue(deriveClues(playerCol(state, x)), state.colClues[x])
}

function filledCount(state) {
  var n = 0
  for (var y = 0; y < state.size; ++y)
    for (var x = 0; x < state.size; ++x)
      if (state.player[y][x] === FILLED) n++
  return n
}

function serialize(state) {
  return {
    size: state.size, solution: state.solution, player: state.player,
    cursor: state.cursor, solved: state.solved
  }
}

function deserialize(obj) {
  if (!obj || !obj.solution || !obj.solution.length || !obj.player || !obj.player.length) return null
  var solution = obj.solution
  return {
    size: solution.length,
    solution: solution,
    player: obj.player,
    rowClues: computeRowClues(solution),
    colClues: computeColClues(solution),
    cursor: obj.cursor || { x: 0, y: 0 },
    solved: !!obj.solved
  }
}
