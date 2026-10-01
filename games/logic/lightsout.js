.pragma library
.import "../../engine/Rng.js" as Rng

// Classic 5x5 Lights Out. A puzzle scrambled by applying legal toggle-moves
// to the solved (all-off) board is always solvable by definition — no
// separate solver needed, we just replay moves backwards in spirit.
// Every function returns a NEW top-level state object; see snake.js/
// stack.js for why QML's `property var` needs that.

var SIZE = 5
var MIN_SCRAMBLE = 15
var MAX_SCRAMBLE = 25

function makeGrid(size) {
  var g = []
  for (var y = 0; y < size; ++y) g.push(new Array(size).fill(false))
  return g
}

function cloneGrid(grid) {
  return grid.map(function(row) { return row.slice() })
}

// The move: toggle (x,y) and its orthogonal neighbours. Used both to
// scramble (from solved) and to play (from the player) — same operation.
function applyToggle(grid, x, y, size) {
  var g = cloneGrid(grid)
  var pts = [{x:x,y:y}, {x:x+1,y:y}, {x:x-1,y:y}, {x:x,y:y+1}, {x:x,y:y-1}]
  for (var i = 0; i < pts.length; ++i) {
    var p = pts[i]
    if (p.x >= 0 && p.x < size && p.y >= 0 && p.y < size) g[p.y][p.x] = !g[p.y][p.x]
  }
  return g
}

function isSolved(grid) {
  for (var y = 0; y < grid.length; ++y)
    for (var x = 0; x < grid[y].length; ++x)
      if (grid[y][x]) return false
  return true
}

function withGrid(state, grid, patch) {
  var next = { size: state.size, grid: grid, cursor: state.cursor, moves: state.moves, won: state.won, history: state.history || [] }
  for (var k in patch) next[k] = patch[k]
  return next
}

function makeState(size) {
  size = size || SIZE
  var grid = makeGrid(size)
  var scrambleMoves = MIN_SCRAMBLE + Math.floor(Rng.random() * (MAX_SCRAMBLE - MIN_SCRAMBLE + 1))
  for (var i = 0; i < scrambleMoves; ++i) {
    var x = Math.floor(Rng.random() * size)
    var y = Math.floor(Rng.random() * size)
    grid = applyToggle(grid, x, y, size)
  }
  if (isSolved(grid)) grid = applyToggle(grid, Math.floor(Rng.random() * size), Math.floor(Rng.random() * size), size)
  return { size: size, grid: grid, cursor: { x: Math.floor(size / 2), y: Math.floor(size / 2) }, moves: 0, won: false, history: [] }
}

function moveCursor(state, dx, dy) {
  var x = Math.max(0, Math.min(state.size - 1, state.cursor.x + dx))
  var y = Math.max(0, Math.min(state.size - 1, state.cursor.y + dy))
  return withGrid(state, state.grid, { cursor: { x: x, y: y } })
}

function toggleAtCursor(state) {
  if (state.won) return state
  var c = state.cursor
  var grid = applyToggle(state.grid, c.x, c.y, state.size)
  return withGrid(state, grid, { moves: state.moves + 1, won: isSolved(grid),
    history: (state.history || []).concat([{ x: c.x, y: c.y }]) })
}

// A toggle is its own inverse, so undo just re-applies the last press
// (and puts the cursor back there so it's obvious what was undone).
function undo(state) {
  var h = state.history || []
  if (!h.length || state.won) return state
  var last = h[h.length - 1]
  var grid = applyToggle(state.grid, last.x, last.y, state.size)
  return withGrid(state, grid, { moves: state.moves + 1, cursor: { x: last.x, y: last.y }, history: h.slice(0, -1) })
}

function litCount(state) {
  var n = 0
  for (var y = 0; y < state.size; ++y) for (var x = 0; x < state.size; ++x) if (state.grid[y][x]) n++
  return n
}

function serialize(state) {
  return { size: state.size, grid: state.grid, cursor: state.cursor, moves: state.moves, won: state.won, history: state.history || [] }
}

function deserialize(obj) {
  if (!obj || !obj.grid || !obj.grid.length) return null
  return {
    size: obj.size || obj.grid.length, grid: obj.grid,
    cursor: obj.cursor || { x: 0, y: 0 }, moves: obj.moves || 0, won: !!obj.won,
    history: Array.isArray(obj.history) ? obj.history : []
  }
}
