.pragma library
.import "../../engine/Rng.js" as Rng

// Light cycles: you against two AI bikes on a walled grid, leaving solid
// trails. Same turn-queue rule as snake.js (no reversing, queued turns play
// one per tick). A round ends when you crash or you're the last bike
// riding; you have three lives and score one point per round survived.
//
// AI: at each step a bike scores its three options by how much open floor
// it would still reach (a bounded flood fill), with a little randomness so
// the two bikes don't mirror each other.

var COLS = 44
var ROWS = 30

function isOpposite(a, b) { return a.x === -b.x && a.y === -b.y }

function emptyGrid() {
  var g = []
  for (var i = 0; i < COLS * ROWS; ++i) g.push(0)
  return g
}

// grid cells: 0 empty, else 1 + bike index
function newRound(state) {
  var grid = emptyGrid()
  var bikes = [
    { x: 6, y: Math.floor(ROWS / 2), dir: { x: 1, y: 0 }, alive: true, ai: false },
    { x: COLS - 7, y: 6, dir: { x: -1, y: 0 }, alive: true, ai: true },
    { x: COLS - 7, y: ROWS - 7, dir: { x: -1, y: 0 }, alive: true, ai: true }
  ]
  for (var i = 0; i < bikes.length; ++i) grid[bikes[i].y * COLS + bikes[i].x] = i + 1
  return {
    grid: grid, bikes: bikes, queue: [], round: (state ? state.round : 0) + 1,
    wins: state ? state.wins : 0, lives: state ? state.lives : 3,
    phase: "ready", // ready -> riding -> ended
    result: "", alive: true
  }
}

function makeState() { return newRound(null) }

function copy(s) {
  return { grid: s.grid, bikes: s.bikes, queue: s.queue, round: s.round, wins: s.wins,
    lives: s.lives, phase: s.phase, result: s.result, alive: s.alive }
}

function turn(state, dx, dy) {
  if (state.phase === "ended" || !state.alive) return state
  var next = { x: dx, y: dy }
  var last = state.queue.length ? state.queue[state.queue.length - 1] : state.bikes[0].dir
  if (state.queue.length >= 3 || isOpposite(next, last) || (next.x === last.x && next.y === last.y)) return state
  var s = copy(state)
  s.queue = state.queue.concat([next])
  if (s.phase === "ready") s.phase = "riding"
  return s
}

function launch(state) {
  if (state.phase !== "ready") return state
  var s = copy(state)
  s.phase = "riding"
  return s
}

function free(grid, x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[y * COLS + x] === 0
}

function reach(grid, x, y, limit) {
  if (!free(grid, x, y)) return 0
  var seen = {}, stack = [y * COLS + x], n = 0
  seen[stack[0]] = true
  while (stack.length && n < limit) {
    var i = stack.pop(); n++
    var cx = i % COLS, cy = Math.floor(i / COLS)
    var ns = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (var k = 0; k < 4; ++k) {
      var nx = cx + ns[k][0], ny = cy + ns[k][1], ni = ny * COLS + nx
      if (!seen[ni] && free(grid, nx, ny)) { seen[ni] = true; stack.push(ni) }
    }
  }
  return n
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function aiDir(grid, bike, player) {
  var opts = [bike.dir, { x: bike.dir.y, y: -bike.dir.x }, { x: -bike.dir.y, y: bike.dir.x }]
  var best = bike.dir, bestScore = -1
  for (var i = 0; i < opts.length; ++i) {
    var d = opts[i], nx = bike.x + d.x, ny = bike.y + d.y
    var sc = reach(grid, nx, ny, [120, 260, 420][LEVEL])
    if (sc === 0) continue
    // Mild aggression: prefer heading toward the player when roomy.
    var toward = Math.abs(nx - player.x) + Math.abs(ny - player.y)
    sc += (i === 0 ? 6 : 0) - toward * 0.15 + Rng.random() * [22, 8, 2][LEVEL]
    if (sc > bestScore) { bestScore = sc; best = d }
  }
  return best
}

function step(state) {
  if (state.phase !== "riding") return state
  var s = copy(state)
  var grid = state.grid.slice()
  var bikes = state.bikes.map(function(b) { return { x: b.x, y: b.y, dir: b.dir, alive: b.alive, ai: b.ai } })

  if (state.queue.length) { bikes[0].dir = state.queue[0]; s.queue = state.queue.slice(1) }
  for (var i = 1; i < bikes.length; ++i) if (bikes[i].alive) bikes[i].dir = aiDir(grid, bikes[i], bikes[0])

  // Move everyone, then resolve crashes (including head-on into the same cell).
  var targets = {}
  for (var b = 0; b < bikes.length; ++b) {
    if (!bikes[b].alive) continue
    var nx = bikes[b].x + bikes[b].dir.x, ny = bikes[b].y + bikes[b].dir.y
    bikes[b].nx = nx; bikes[b].ny = ny
    var key = nx + "," + ny
    targets[key] = (targets[key] || 0) + 1
  }
  for (b = 0; b < bikes.length; ++b) {
    var bk = bikes[b]
    if (!bk.alive) continue
    if (!free(grid, bk.nx, bk.ny) || targets[bk.nx + "," + bk.ny] > 1) { bk.alive = false; continue }
  }
  for (b = 0; b < bikes.length; ++b) {
    var bb = bikes[b]
    if (!bb.alive) continue
    bb.x = bb.nx; bb.y = bb.ny
    grid[bb.y * COLS + bb.x] = b + 1
  }
  for (b = 0; b < bikes.length; ++b) { delete bikes[b].nx; delete bikes[b].ny }
  s.grid = grid
  s.bikes = bikes

  var aiLeft = bikes[1].alive || bikes[2].alive
  if (!bikes[0].alive) {
    s.phase = "ended"; s.result = "crashed"
    s.lives = state.lives - 1
    if (s.lives <= 0) s.alive = false
  } else if (!aiLeft) {
    s.phase = "ended"; s.result = "won"; s.wins = state.wins + 1
  }
  return s
}

function speedFor(state) { return Math.max(55, 95 - state.wins * 4) }

function serialize(state) { return { wins: state.wins, lives: state.lives, round: state.round, alive: state.alive } }

function deserialize(obj) {
  if (!obj || typeof obj.wins !== "number" || obj.alive === false) return null
  var s = newRound({ round: (obj.round || 1) - 1, wins: obj.wins, lives: obj.lives || 3 })
  return s
}
