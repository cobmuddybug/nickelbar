.pragma library
.import "../../engine/Rng.js" as Rng

// Bounce, after KBounce / JezzBall. Balls bounce around the field; build
// walls to fence off space without them. A wall grows both ways from where
// you start it; if a ball touches a wall still growing, that half is lost
// and so is a life. Once walls are done, any area with no ball in it fills
// in. Fill 75% to finish the level; each level adds a ball.
//
// grid[y * W + x]: 1 filled (border or finished wall), 0 open. Balls live
// in cell units, radius R.

var W = 32
var H = 20
var R = 0.42
var TARGET = 0.75
var GROW = 14       // wall cells per second
var SPEED = 7       // ball speed, cells per second

function makeGrid() {
  var g = []
  for (var y = 0; y < H; ++y) for (var x = 0; x < W; ++x) g.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 1 : 0)
  return g
}

function makeBalls(n, grid) {
  var out = []
  while (out.length < n) {
    var x = 2 + Rng.random() * (W - 4), y = 2 + Rng.random() * (H - 4)
    if (grid[Math.floor(y) * W + Math.floor(x)]) continue
    out.push({ x: x, y: y, vx: (Rng.random() < 0.5 ? -1 : 1) * SPEED, vy: (Rng.random() < 0.5 ? -1 : 1) * SPEED })
  }
  return out
}

function level(n, score, lives) {
  var g = makeGrid()
  return { grid: g, balls: makeBalls(n + 1, g), level: n, score: score || 0, lives: lives === undefined ? n + 2 : lives,
           cursor: { x: Math.floor(W / 2), y: Math.floor(H / 2) }, vertical: false, arms: [], alive: true, flash: 0,
           clearIn: 0 }
}

function makeState() { return level(1, 0) }

function copy(s) {
  return { grid: s.grid, balls: s.balls, level: s.level, score: s.score, lives: s.lives, cursor: s.cursor,
           vertical: s.vertical, arms: s.arms, alive: s.alive, flash: s.flash, clearIn: s.clearIn }
}

function openArea(s) {
  var inner = (W - 2) * (H - 2), filled = 0
  for (var y = 1; y < H - 1; ++y) for (var x = 1; x < W - 1; ++x) if (s.grid[y * W + x]) filled++
  return filled / inner
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.cursor = { x: Math.max(1, Math.min(W - 2, s.cursor.x + dx)), y: Math.max(1, Math.min(H - 2, s.cursor.y + dy)) }
  return n
}

function turn(s) { var n = copy(s); n.vertical = !s.vertical; return n }

// Start a wall at the cursor: two arms growing apart.
function build(s) {
  if (!s.alive || s.arms.length || s.clearIn > 0) return s
  var c = s.cursor
  if (s.grid[c.y * W + c.x]) return s
  var n = copy(s), d = s.vertical ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]
  n.arms = [{ x: c.x, y: c.y, dx: d[0][0], dy: d[0][1], cells: [], grow: 0, done: false, start: true },
            { x: c.x, y: c.y, dx: d[1][0], dy: d[1][1], cells: [], grow: 0, done: false, start: false }]
  return n
}

function cellHit(grid, cells, x, y) {
  var cx = Math.floor(x), cy = Math.floor(y)
  if (grid[cy * W + cx]) return 1
  for (var i = 0; i < cells.length; ++i) if (cells[i] === cy * W + cx) return 2
  return 0
}

// Areas without a ball fill in.
function fillEmpty(grid, balls) {
  var g = grid.slice(), seen = {}
  for (var b = 0; b < balls.length; ++b) {
    var st = [Math.floor(balls[b].y) * W + Math.floor(balls[b].x)]
    while (st.length) {
      var i = st.pop()
      if (seen[i] || g[i]) continue
      seen[i] = true
      st.push(i + 1, i - 1, i + W, i - W)
    }
  }
  var gained = 0
  for (var k = 0; k < g.length; ++k) if (!g[k] && !seen[k]) { g[k] = 1; gained++ }
  return { grid: g, gained: gained }
}

function step(state, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.flash = Math.max(0, state.flash - dt)
  if (state.clearIn > 0) {
    s.clearIn = state.clearIn - dt
    if (s.clearIn <= 0) return level(state.level + 1, state.score, undefined)
    return s
  }
  var grid = state.grid
  // Growing arms (every cell in them so far counts as "building").
  var arms = [], building = []
  for (var a = 0; a < state.arms.length; ++a) {
    var arm = state.arms[a]
    var na = { x: arm.x, y: arm.y, dx: arm.dx, dy: arm.dy, cells: arm.cells, grow: arm.grow + GROW * dt, done: arm.done, start: arm.start }
    while (!na.done && na.grow >= 1) {
      na.grow -= 1
      // Next cell: the start arm owns the cursor cell, the other begins beside it.
      var k = na.cells.length + (na.start ? 0 : 1)
      var cx = arm.x + na.dx * k, cy = arm.y + na.dy * k
      if (grid[cy * W + cx]) { na.done = true; break }
      na.cells = na.cells.concat([cy * W + cx])
    }
    arms.push(na)
    if (!na.done) building = building.concat(na.cells)
  }

  // Balls: move each axis separately and bounce off anything solid.
  var balls = [], lostArm = {}
  for (var b = 0; b < state.balls.length; ++b) {
    var bl = { x: state.balls[b].x, y: state.balls[b].y, vx: state.balls[b].vx, vy: state.balls[b].vy }
    var allCells = []
    for (var q = 0; q < arms.length; ++q) allCells = allCells.concat(arms[q].cells)
    var nx = bl.x + bl.vx * dt, hx = cellHit(grid, allCells, nx + Math.sign(bl.vx) * R, bl.y)
    if (hx) { bl.vx = -bl.vx; if (hx === 2) markArm(arms, Math.floor(bl.y) * W + Math.floor(nx + Math.sign(state.balls[b].vx) * R), lostArm) }
    else bl.x = nx
    var ny = bl.y + bl.vy * dt, hy = cellHit(grid, allCells, bl.x, ny + Math.sign(bl.vy) * R)
    if (hy) { bl.vy = -bl.vy; if (hy === 2) markArm(arms, Math.floor(ny + Math.sign(state.balls[b].vy) * R) * W + Math.floor(bl.x), lostArm) }
    else bl.y = ny
    balls.push(bl)
  }
  s.balls = balls

  // A ball touching an unfinished arm destroys it and costs a life.
  var kept = []
  for (var r = 0; r < arms.length; ++r) {
    if (lostArm[r] && !arms[r].done) { s.lives--; s.flash = 0.5; continue }
    kept.push(arms[r])
  }
  if (s.lives <= 0) { s.alive = false; s.arms = []; return s }
  // Finished arms turn solid; when none are left growing, fill empty areas.
  var still = []
  var g2 = grid
  for (var f = 0; f < kept.length; ++f) {
    if (!kept[f].done) { still.push(kept[f]); continue }
    if (g2 === grid) g2 = grid.slice()
    for (var c2 = 0; c2 < kept[f].cells.length; ++c2) g2[kept[f].cells[c2]] = 1
  }
  s.arms = still
  if (g2 !== grid) {
    if (!still.length) {
      var fe = fillEmpty(g2, balls)
      g2 = fe.grid
      s.score += fe.gained * 5
    }
    s.grid = g2
    if (openArea(s) >= TARGET) {
      s.score += 1000 * state.level + s.lives * 500
      s.clearIn = 1.5
    }
  }
  return s
}

// Which arm holds cell `i`?
function markArm(arms, i, lost) {
  for (var a = 0; a < arms.length; ++a) if (arms[a].cells.indexOf(i) >= 0) lost[a] = true
}

function serialize(s) { return { grid: s.grid, level: s.level, score: s.score, lives: s.lives, alive: s.alive } }

function deserialize(o) {
  if (!o || !o.grid || o.grid.length !== W * H || o.alive === false) return null
  var s = level(o.level || 1, o.score || 0, o.lives)
  s.grid = o.grid
  s.balls = makeBalls(s.level + 1, s.grid)
  return s
}
