.pragma library
.import "../../engine/Rng.js" as Rng

// Triples (after Threes): a 4x4 board where every slide moves each tile ONE
// step. 1 and 2 join into 3; after that only equal tiles join (3+3=6,
// 6+6=12...). Each slide adds one new tile at the edge you slid away from,
// on a row (or column) that actually moved. The next tile is previewed.
// State is plain data and every function returns a new state.

var SIZE = 4
var DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }

function rnd(rand) { return (rand || Rng.random)() }

function shuffle(a, rand) {
  for (var i = a.length - 1; i > 0; --i) {
    var j = Math.floor(rnd(rand) * (i + 1))
    var t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

function newBag(rand) { return shuffle([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3], rand) }

function maxTile(grid) {
  var m = 0
  for (var y = 0; y < SIZE; ++y) for (var x = 0; x < SIZE; ++x) if (grid[y][x] > m) m = grid[y][x]
  return m
}

// The next tile: from the shuffled bag of twelve (four each of 1, 2, 3),
// or, once a 48 exists and about one time in twenty-one, a bonus tile
// somewhere between 6 and an eighth of the biggest tile.
function draw(bag, grid, rand) {
  var m = maxTile(grid)
  if (m >= 48 && rnd(rand) < 1 / 21) {
    var opts = []
    for (var v = 6; v <= m / 8; v *= 2) opts.push(v)
    if (opts.length) return { value: opts[Math.floor(rnd(rand) * opts.length)], bag: bag, bonus: true }
  }
  var b = bag.length ? bag.slice() : newBag(rand)
  var value = b.pop()
  return { value: value, bag: b, bonus: false }
}

function makeState(rand) {
  var grid = []
  for (var y = 0; y < SIZE; ++y) grid.push([0, 0, 0, 0])
  var bag = newBag(rand)
  var cells = []
  for (var i = 0; i < SIZE * SIZE; ++i) cells.push(i)
  shuffle(cells, rand)
  for (var k = 0; k < 9; ++k) {
    if (!bag.length) bag = newBag(rand)
    grid[Math.floor(cells[k] / SIZE)][cells[k] % SIZE] = bag.pop()
  }
  var nx = draw(bag, grid, rand)
  return { grid: grid, next: nx.value, nextBonus: nx.bonus, bag: nx.bag, moves: 0, over: false, lastMoved: [] }
}

function canJoin(a, b) {
  if (a === 0 || b === 0) return false
  if (a + b === 3 && a !== b) return true
  return a === b && a >= 3
}

// Slide one line toward index 0. Returns { line, moved }.
function slideLine(line) {
  var n = line.length
  var out = line.slice()
  for (var i = 1; i < n; ++i) {
    if (out[i] !== 0 && (out[i - 1] === 0 || canJoin(out[i - 1], out[i]))) {
      out[i - 1] = out[i - 1] === 0 ? out[i] : out[i - 1] + out[i]
      for (var j = i + 1; j < n; ++j) out[j - 1] = out[j]
      out[n - 1] = 0
      return { line: out, moved: true }
    }
  }
  return { line: out, moved: false }
}

// The board as lines all reading "toward the slide": index 0 is the side
// tiles move to. Returns coordinates for each line in that order.
function lineCoords(dir) {
  var lines = []
  for (var a = 0; a < SIZE; ++a) {
    var coords = []
    for (var b = 0; b < SIZE; ++b) {
      if (dir === "left") coords.push([b, a])
      else if (dir === "right") coords.push([SIZE - 1 - b, a])
      else if (dir === "up") coords.push([a, b])
      else coords.push([a, SIZE - 1 - b])
    }
    lines.push(coords)
  }
  return lines
}

function tileScore(v) {
  if (v < 3) return 0
  return Math.pow(3, Math.round(Math.log(v / 3) / Math.LN2) + 1)
}

function score(grid) {
  var s = 0
  for (var y = 0; y < SIZE; ++y) for (var x = 0; x < SIZE; ++x) s += tileScore(grid[y][x])
  return s
}

function movable(grid, dir) {
  var lines = lineCoords(dir)
  for (var l = 0; l < lines.length; ++l) {
    var line = lines[l].map(function(p) { return grid[p[1]][p[0]] })
    if (slideLine(line).moved) return true
  }
  return false
}

function isOver(grid) {
  return !(movable(grid, "left") || movable(grid, "right") || movable(grid, "up") || movable(grid, "down"))
}

function move(state, dir, rand) {
  if (state.over || !DIRS[dir]) return state
  var grid = state.grid.map(function(r) { return r.slice() })
  var lines = lineCoords(dir)
  var movedLines = []
  for (var l = 0; l < lines.length; ++l) {
    var coords = lines[l]
    var line = coords.map(function(p) { return grid[p[1]][p[0]] })
    var res = slideLine(line)
    if (!res.moved) continue
    for (var i = 0; i < coords.length; ++i) grid[coords[i][1]][coords[i][0]] = res.line[i]
    movedLines.push(l)
  }
  if (!movedLines.length) return state
  // The new tile enters at the far end of a random line that moved.
  var pick = movedLines[Math.floor(rnd(rand) * movedLines.length)]
  var far = lines[pick][SIZE - 1]
  grid[far[1]][far[0]] = state.next
  var nx = draw(state.bag, grid, rand)
  return { grid: grid, next: nx.value, nextBonus: nx.bonus, bag: nx.bag, moves: state.moves + 1,
           over: isOver(grid), lastMoved: [far] }
}

function serialize(s) { return s }
function deserialize(o) {
  if (!o || !o.grid || o.grid.length !== SIZE) return null
  return { grid: o.grid, next: o.next || 1, nextBonus: !!o.nextBonus, bag: o.bag || [], moves: o.moves || 0,
           over: !!o.over, lastMoved: [] }
}
