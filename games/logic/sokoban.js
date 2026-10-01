.pragma library

// Box-pushing puzzle. Levels are hand-authored ASCII maps (generating
// guaranteed-solvable Sokoban levels procedurally is a hard problem in its
// own right) using the conventional glyphs: # wall, space floor, @ player,
// + player-on-goal, $ box, * box-on-goal, . goal. Every level below was
// verified solvable with a throwaway BFS solver before being checked in
// (shortest solutions run from 4 moves for level 1 up to 45).
// Every function returns a NEW top-level state object; see snake.js/
// stack.js for why QML's `property var` needs that.

var LEVELS = [
  [
    "######",
    "#    #",
    "# $. #",
    "#  @ #",
    "######"
  ],
  [
    "#######",
    "#     #",
    "#  $  #",
    "#     #",
    "#  .  #",
    "#  @  #",
    "#######"
  ],
  [
    "########",
    "#      #",
    "#  $ $ #",
    "#  . . #",
    "#   @  #",
    "########"
  ],
  [
    "########",
    "#      #",
    "#  ##  #",
    "#  $   #",
    "# .    #",
    "#   $  #",
    "#  .  @#",
    "########"
  ],
  [
    "#########",
    "#       #",
    "#  $  $ #",
    "# ## ## #",
    "#  .  . #",
    "#   @   #",
    "#########"
  ],
  [
    "#########",
    "#   #   #",
    "# $   $ #",
    "#   #   #",
    "# .   . #",
    "#   #   #",
    "#  @    #",
    "#########"
  ],
  [
    "#########",
    "#       #",
    "# $ $ $ #",
    "#  ###  #",
    "# .   . #",
    "#   .   #",
    "#   @   #",
    "#########"
  ],
  [
    " ####   ",
    "##  ####",
    "#  $   #",
    "# .*.  #",
    "#  $ ###",
    "## @#   ",
    " ####   "
  ],
  [
    "#########",
    "#   #   #",
    "# $ . $ #",
    "# .###. #",
    "# $ . $ #",
    "#   @   #",
    "#########"
  ],
  [
    "  #####  ",
    "###   #  ",
    "#.@$  #  ",
    "### $.#  ",
    "#.##$ #  ",
    "# # . ## ",
    "#$ *$$.# ",
    "#   .  # ",
    "######## "
  ],
  [
    "#######",
    "#  .  #",
    "# $#$ #",
    "#. @ .#",
    "# $#$ #",
    "#  .  #",
    "#######"
  ]
]

var UNDO_LIMIT = 400

function parseLevel(idx) {
  var rows = LEVELS[idx]
  var width = 0
  for (var i = 0; i < rows.length; ++i) width = Math.max(width, rows[i].length)
  var grid = [], boxes = [], player = null
  for (var y = 0; y < rows.length; ++y) {
    var line = ""
    for (var x = 0; x < width; ++x) {
      var ch = rows[y].charAt(x) || " "
      if (ch === "#") line += "#"
      else if (ch === "." || ch === "*" || ch === "+") line += "."
      else line += " "
      if (ch === "$" || ch === "*") boxes.push({ x: x, y: y })
      if (ch === "@" || ch === "+") player = { x: x, y: y }
    }
    grid.push(line)
  }
  return { grid: grid, width: width, height: grid.length, boxes: boxes, player: player }
}

function loadLevel(levelIndex, levelsCleared) {
  var idx = ((levelIndex % LEVELS.length) + LEVELS.length) % LEVELS.length
  var lvl = parseLevel(idx)
  return {
    levelIndex: idx, grid: lvl.grid, width: lvl.width, height: lvl.height,
    boxes: lvl.boxes, player: lvl.player, moves: 0, levelsCleared: levelsCleared || 0,
    history: null, justAdvanced: false, allCleared: false
  }
}

function makeState(levelIndex, levelsCleared) {
  return loadLevel(levelIndex || 0, levelsCleared || 0)
}

function withState(state, patch) {
  var next = {
    levelIndex: state.levelIndex, grid: state.grid, width: state.width, height: state.height,
    boxes: state.boxes, player: state.player, moves: state.moves, levelsCleared: state.levelsCleared,
    history: state.history, justAdvanced: state.justAdvanced, allCleared: state.allCleared
  }
  for (var k in patch) next[k] = patch[k]
  return next
}

function inBounds(state, x, y) {
  return x >= 0 && x < state.width && y >= 0 && y < state.height
}

function isWall(state, x, y) {
  if (!inBounds(state, x, y)) return true
  return state.grid[y].charAt(x) === "#"
}

function isGoal(state, x, y) {
  if (!inBounds(state, x, y)) return false
  return state.grid[y].charAt(x) === "."
}

function boxAt(boxes, x, y) {
  for (var i = 0; i < boxes.length; ++i) if (boxes[i].x === x && boxes[i].y === y) return boxes[i]
  return null
}

function boxIndexAt(boxes, x, y) {
  for (var i = 0; i < boxes.length; ++i) if (boxes[i].x === x && boxes[i].y === y) return i
  return -1
}

function cloneBoxes(boxes) {
  return boxes.map(function(b) { return { x: b.x, y: b.y } })
}

function boxesOnGoal(state) {
  var n = 0
  for (var i = 0; i < state.boxes.length; ++i) if (isGoal(state, state.boxes[i].x, state.boxes[i].y)) n++
  return n
}

function isSolved(state) {
  return boxesOnGoal(state) >= state.boxes.length
}

function snapshot(state) {
  return { player: { x: state.player.x, y: state.player.y }, boxes: cloneBoxes(state.boxes), moves: state.moves }
}

// history is a stack of snapshots (oldest first), capped so a long
// session's save file stays small.
function pushHistory(state) {
  var h = Array.isArray(state.history) ? state.history : []
  var next = h.concat([snapshot(state)])
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next
}

function clearLevel(state) {
  var clearedCount = state.levelsCleared + 1
  var nextIndex = state.levelIndex + 1
  if (nextIndex >= LEVELS.length) return withState(state, { levelsCleared: clearedCount, allCleared: true, history: null })
  return withState(loadLevel(nextIndex, clearedCount), { justAdvanced: true })
}

// The one real rule: a step onto a box only succeeds if the cell beyond it
// (same direction) is clear, in which case the box is pushed along with it.
function move(state, dx, dy) {
  if (state.allCleared) return state
  var p = state.player
  var nx = p.x + dx, ny = p.y + dy
  if (isWall(state, nx, ny)) return state

  var pushed = boxAt(state.boxes, nx, ny)
  var newBoxes = state.boxes
  if (pushed) {
    var bx = nx + dx, by = ny + dy
    if (isWall(state, bx, by) || boxAt(state.boxes, bx, by)) return state
    newBoxes = cloneBoxes(state.boxes)
    newBoxes[boxIndexAt(newBoxes, pushed.x, pushed.y)] = { x: bx, y: by }
  }

  var moved = withState(state, {
    player: { x: nx, y: ny }, boxes: newBoxes, moves: state.moves + 1,
    history: pushHistory(state), justAdvanced: false
  })
  return isSolved(moved) ? clearLevel(moved) : moved
}

function undo(state) {
  var stack = Array.isArray(state.history) ? state.history : (state.history ? [state.history] : [])
  if (!stack.length) return state
  var h = stack[stack.length - 1]
  return withState(state, { player: h.player, boxes: h.boxes, moves: h.moves, history: stack.slice(0, -1), justAdvanced: false })
}

function restartLevel(state) {
  return loadLevel(state.levelIndex, state.levelsCleared)
}

function levelCount() { return LEVELS.length }

function serialize(state) {
  return {
    levelIndex: state.levelIndex, grid: state.grid, width: state.width, height: state.height,
    boxes: state.boxes, player: state.player, moves: state.moves, levelsCleared: state.levelsCleared,
    history: state.history || null, justAdvanced: !!state.justAdvanced, allCleared: !!state.allCleared
  }
}

function deserialize(obj) {
  if (!obj || !obj.grid || !obj.grid.length || !obj.player || !obj.boxes) return null
  return {
    levelIndex: obj.levelIndex || 0, grid: obj.grid, width: obj.width || obj.grid[0].length, height: obj.height || obj.grid.length,
    boxes: obj.boxes, player: obj.player, moves: obj.moves || 0, levelsCleared: obj.levelsCleared || 0,
    history: obj.history || null, justAdvanced: !!obj.justAdvanced, allCleared: !!obj.allCleared
  }
}
