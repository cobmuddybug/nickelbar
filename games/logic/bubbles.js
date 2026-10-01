.pragma library
.import "../../engine/Rng.js" as Rng

// Bubble Pop, after Frozen Bubble / Puzzle Bobble. Aim the launcher, fire;
// bubbles bounce off the side walls and stick where they hit. Three or more
// of a colour together pop, and anything left hanging from nothing falls.
// Every few shots the ceiling comes down a row; a bubble past the bottom
// line ends the game. Clear the board for the next level.
//
// Units are bubble diameters. The grid is rows of COLS bubbles, odd rows
// shifted half a bubble right and one shorter, ROWH apart.

var COLS = 8
var ROWH = Math.sqrt(3) / 2
var DEATH_ROW = 12             // a bubble on this row (after ceiling drops) loses
var FIELD_H = DEATH_ROW * ROWH + 1.9
var SHOOT_Y = FIELD_H - 0.6
var SPEED = 16                 // diameters per second
var MIN_ANGLE = 0.14           // radians off horizontal the aim may go

function rowLen(r) { return r % 2 ? COLS - 1 : COLS }
function cellX(r, c) { return c + 0.5 + (r % 2 ? 0.5 : 0) }
function cellY(s, r) { return (r + s.drop) * ROWH + 0.5 }

function neighbours(r, c) {
  var o = r % 2
  var list = [[r, c - 1], [r, c + 1], [r - 1, c - 1 + o], [r - 1, c + o], [r + 1, c - 1 + o], [r + 1, c + o]]
  return list.filter(function(p) { return p[0] >= 0 && p[0] < DEATH_ROW && p[1] >= 0 && p[1] < rowLen(p[0]) })
}

function colorsFor(level) { return Math.min(6, 3 + Math.ceil(level / 2)) }
function shotsPerDrop(level) { return Math.max(4, 8 - level) }

function levelGrid(level) {
  var n = colorsFor(level), rows = Math.min(8, 5 + Math.floor(level / 2)), g = []
  for (var r = 0; r < DEATH_ROW; ++r) {
    var row = []
    for (var c = 0; c < rowLen(r); ++c) {
      if (r >= rows) { row.push(-1); continue }
      // Lean toward a neighbour's colour so there's something to aim for.
      var col = Math.floor(Rng.random() * n)
      if (Rng.random() < 0.45 && c > 0) col = row[c - 1]
      else if (Rng.random() < 0.4 && r > 0) col = g[r - 1][Math.min(c, rowLen(r - 1) - 1)]
      row.push(col)
    }
    g.push(row)
  }
  return g
}

function present(grid) {
  var out = {}
  for (var r = 0; r < grid.length; ++r) for (var c = 0; c < grid[r].length; ++c) if (grid[r][c] >= 0) out[grid[r][c]] = true
  return Object.keys(out).map(Number)
}

function randomColor(grid, level) {
  var p = present(grid)
  if (!p.length) return Math.floor(Rng.random() * colorsFor(level))
  return p[Math.floor(Rng.random() * p.length)]
}

function newLevel(level, score) {
  var g = levelGrid(level)
  return { grid: g, drop: 0, level: level, aim: -Math.PI / 2, shot: null, cur: randomColor(g, level),
           next: randomColor(g, level), shots: 0, score: score || 0, alive: true, falling: [], pops: [],
           cleared: false, clearIn: 0 }
}

function makeState() { return newLevel(1, 0) }

function copy(s) {
  return { grid: s.grid, drop: s.drop, level: s.level, aim: s.aim, shot: s.shot, cur: s.cur, next: s.next,
           shots: s.shots, score: s.score, alive: s.alive, falling: s.falling, pops: s.pops,
           cleared: s.cleared, clearIn: s.clearIn }
}

function turn(state, da) {
  var s = copy(state)
  s.aim = Math.max(-Math.PI + MIN_ANGLE, Math.min(-MIN_ANGLE, state.aim + da))
  return s
}

function fire(state) {
  if (!state.alive || state.shot || state.cleared) return state
  var s = copy(state)
  s.shot = { x: COLS / 2, y: SHOOT_Y, vx: Math.cos(state.aim) * SPEED, vy: Math.sin(state.aim) * SPEED, color: state.cur }
  s.cur = state.next
  s.next = randomColor(state.grid, state.level)
  return s
}

// Nearest empty cell to (x, y) that's touching something (or the ceiling).
function snap(s, grid, x, y) {
  var best = null, bd = 1e9
  var r0 = Math.max(0, Math.round((y - 0.5) / ROWH - s.drop))
  for (var r = Math.max(0, r0 - 2); r <= Math.min(grid.length - 1, r0 + 2); ++r)
    for (var c = 0; c < rowLen(r); ++c) {
      if (grid[r][c] >= 0) continue
      var ok = r === 0
      var nb = neighbours(r, c)
      for (var i = 0; i < nb.length && !ok; ++i) if (grid[nb[i][0]][nb[i][1]] >= 0) ok = true
      if (!ok) continue
      var dx = cellX(r, c) - x, dy = cellY(s, r) - y, d = dx * dx + dy * dy
      if (d < bd) { bd = d; best = [r, c] }
    }
  return best
}

function group(grid, r, c) {
  var col = grid[r][c], seen = {}, out = [], st = [[r, c]]
  seen[r + "," + c] = true
  while (st.length) {
    var p = st.pop()
    out.push(p)
    var nb = neighbours(p[0], p[1])
    for (var i = 0; i < nb.length; ++i) {
      var k = nb[i][0] + "," + nb[i][1]
      if (seen[k] || grid[nb[i][0]][nb[i][1]] !== col) continue
      seen[k] = true
      st.push(nb[i])
    }
  }
  return out
}

// Cells not joined to the ceiling through other bubbles.
function orphans(grid) {
  var seen = {}, st = []
  for (var c = 0; c < rowLen(0); ++c) if (grid[0][c] >= 0) { seen["0," + c] = true; st.push([0, c]) }
  while (st.length) {
    var p = st.pop(), nb = neighbours(p[0], p[1])
    for (var i = 0; i < nb.length; ++i) {
      var k = nb[i][0] + "," + nb[i][1]
      if (seen[k] || grid[nb[i][0]][nb[i][1]] < 0) continue
      seen[k] = true
      st.push(nb[i])
    }
  }
  var out = []
  for (var r = 0; r < grid.length; ++r) for (var cc = 0; cc < grid[r].length; ++cc)
    if (grid[r][cc] >= 0 && !seen[r + "," + cc]) out.push([r, cc])
  return out
}

function land(s, x, y, color) {
  var grid = s.grid.map(function(r) { return r.slice() })
  var at = snap(s, grid, x, y)
  if (!at) { s.alive = false; return }
  grid[at[0]][at[1]] = color
  var popped = 0
  var g = group(grid, at[0], at[1])
  if (g.length >= 3) {
    var pops = s.pops.slice()
    for (var i = 0; i < g.length; ++i) {
      pops.push({ x: cellX(g[i][0], g[i][1]), y: cellY(s, g[i][0]), color: color, life: 0.25 })
      grid[g[i][0]][g[i][1]] = -1
    }
    s.pops = pops
    popped = g.length
    s.score += g.length * 10
    var orph = orphans(grid), falling = s.falling.slice()
    for (var j = 0; j < orph.length; ++j) {
      var o = orph[j]
      falling.push({ x: cellX(o[0], o[1]), y: cellY(s, o[0]), vy: 0, color: grid[o[0]][o[1]] })
      grid[o[0]][o[1]] = -1
    }
    s.falling = falling
    s.score += orph.length * 20 * (orph.length > 4 ? 2 : 1)
  }
  s.grid = grid
  s.shots++
  if (!present(grid).length) { s.cleared = true; s.clearIn = 1.6; s.score += 500 + s.level * 100; return }
  if (!popped && s.shots % shotsPerDrop(s.level) === 0) s.drop++
  for (var r = 0; r < grid.length; ++r)
    for (var c = 0; c < grid[r].length; ++c)
      if (grid[r][c] >= 0 && r + s.drop >= DEATH_ROW) s.alive = false
  // Keep the loaded colours ones that are still on the board.
  var p = present(grid)
  if (p.indexOf(s.cur) < 0) s.cur = randomColor(grid, s.level)
  if (p.indexOf(s.next) < 0) s.next = randomColor(grid, s.level)
}

function step(state, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.pops = state.pops.filter(function(p) { return p.life > dt }).map(function(p) { return { x: p.x, y: p.y, color: p.color, life: p.life - dt } })
  s.falling = state.falling.map(function(f) { return { x: f.x, y: f.y + f.vy * dt, vy: f.vy + 30 * dt, color: f.color } })
    .filter(function(f) { return f.y < FIELD_H + 1 })
  if (state.cleared) {
    s.clearIn = state.clearIn - dt
    if (s.clearIn <= 0) {
      var n = newLevel(state.level + 1, state.score)
      n.aim = state.aim
      return n
    }
    return s
  }
  if (!state.shot) return s

  // Move in small hops so it can't tunnel through a bubble.
  var sh = { x: state.shot.x, y: state.shot.y, vx: state.shot.vx, vy: state.shot.vy, color: state.shot.color }
  var dist = SPEED * dt, hops = Math.ceil(dist / 0.12)
  for (var h = 0; h < hops; ++h) {
    sh.x += sh.vx * dt / hops; sh.y += sh.vy * dt / hops
    if (sh.x < 0.5) { sh.x = 1 - sh.x; sh.vx = -sh.vx }
    if (sh.x > COLS - 0.5) { sh.x = 2 * (COLS - 0.5) - sh.x; sh.vx = -sh.vx }
    var hit = sh.y <= s.drop * ROWH + 0.5
    for (var r = 0; r < s.grid.length && !hit; ++r)
      for (var c = 0; c < s.grid[r].length && !hit; ++c) {
        if (s.grid[r][c] < 0) continue
        var dx = cellX(r, c) - sh.x, dy = cellY(s, r) - sh.y
        if (dx * dx + dy * dy < 0.8 * 0.8) hit = true
      }
    if (hit) { s.shot = null; land(s, sh.x, sh.y, sh.color); return s }
  }
  s.shot = sh
  return s
}

function serialize(s) {
  return { grid: s.grid, drop: s.drop, level: s.level, aim: s.aim, cur: s.cur, next: s.next, shots: s.shots,
           score: s.score, alive: s.alive }
}

function deserialize(o) {
  if (!o || !o.grid || o.alive === false || o.grid.length !== DEATH_ROW) return null
  var s = newLevel(o.level || 1, o.score || 0)
  s.grid = o.grid; s.drop = o.drop || 0; s.aim = o.aim || -Math.PI / 2; s.shots = o.shots || 0
  s.cur = o.cur >= 0 ? o.cur : randomColor(s.grid, s.level)
  s.next = o.next >= 0 ? o.next : randomColor(s.grid, s.level)
  if (!present(s.grid).length) return newLevel(s.level + 1, s.score)
  return s
}
