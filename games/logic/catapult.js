.pragma library
.import "meter.js" as Meter

// Catapult (after Angry Birds). Fling stones from the sling at forts of
// glass, wood and stone, and knock out every target inside. A fast stone
// smashes through what it can and loses speed doing it; anything left
// hanging with nothing under it falls, crushing targets beneath, and
// targets that fall far enough are done for too. Clear a fort with stones
// to spare for a bonus; run out with targets standing and it's over.
//
// Units: the world is W × H with y down and the ground at GROUND. Forts
// live on a grid of CELL-sized squares (GW × GH cells).

var W = 32
var H = 18
var GROUND = 16.5
var CELL = 0.5
var GW = Math.round(W / CELL)
var GH = Math.round(GROUND / CELL)
var G = 20
var MAX_SPEED = 25
var BALL_R = 0.3
var SLING = { x: 3.2, y: GROUND - 2.2 }

var MATS = {
  g: { name: "glass", hp: 1, breakAt: 4, loss: 0.12, pts: 50 },
  w: { name: "wood", hp: 2, breakAt: 7, loss: 0.3, pts: 100 },
  s: { name: "stone", hp: 2, breakAt: 12, loss: 0.5, pts: 200 },
  T: { name: "target", hp: 1, breakAt: 1.5, loss: 0.2, pts: 5000 }
}

// Forts, top row first; the bottom row stands on the ground.
var LEVELS = [
  { birds: 3, at: 42, map: [
    ".gggggg.",
    ".w....w.",
    ".w....w.",
    ".w.TT.w." ] },
  { birds: 5, at: 38, map: [
    ".ww.......ww.",
    ".wT.......wT.",
    ".ww.......ww.",
    ".w.........w.",
    ".wwwwwwwwwww.",
    ".w.........w.",
    ".w...TTT...w." ] },
  { birds: 6, at: 40, map: [
    "...ssss...",
    "...sTTs...",
    "..ssssss..",
    "..w....w..",
    "..w.TT.w..",
    ".gggggggg.",
    ".w......w.",
    ".w..TT..w." ] },
  { birds: 7, at: 38, map: [
    ".....T.....",
    "....www....",
    "...wwTww...",
    "..ggggggg..",
    ".www.T.www.",
    "wwwssssswww",
    "w.T.....T.s" ] },
  { birds: 4, at: 36, map: [
    ".TTT..........",
    ".sss......T...",
    ".s.s.....www..",
    ".s.s.....w.w..",
    ".s.s.....w.w..",
    ".s.s..gg.w.w..",
    ".s.s..gT.w.w.." ] },
  { birds: 8, at: 38, map: [
    "s.s.s.s.s.s",
    "wwwwsssssss",
    "w..T...T..s",
    "g.........s",
    "wgggggggggs",
    "g.T.T.T.T.s",
    "wwwwwwwwwww" ] }
]

function idx(c, r) { return r * GW + c }

function buildLevel(n) {
  var L = LEVELS[n % LEVELS.length], grid = []
  for (var i = 0; i < GW * GH; ++i) grid.push(null)
  var rows = L.map.length
  for (var r = 0; r < rows; ++r) for (var c = 0; c < L.map[r].length; ++c) {
    var ch = L.map[r][c]
    if (ch === ".") continue
    grid[idx(L.at + c, GH - rows + r)] = { m: ch, hp: MATS[ch].hp, fall: 0 }
  }
  return grid
}

function countTargets(grid) {
  var n = 0
  for (var i = 0; i < grid.length; ++i) if (grid[i] && grid[i].m === "T") n++
  return n
}

function startLevel(s) {
  var L = LEVELS[s.level % LEVELS.length]
  s.grid = buildLevel(s.level)
  // Later laps round the forts give one stone fewer.
  s.birds = Math.max(2, L.birds - Math.floor(s.level / LEVELS.length))
  s.ball = null
  s.phase = "aim"
  s.angle = 0.7; s.power = 0; s.powerDir = 1; s.charging = false
  s.fallT = 0
  s.msg = "FORT " + (s.level + 1); s.msgT = 1.5
}

function makeState() {
  var s = { level: 0, score: 0, t: 0, trail: [], lastTrail: [], dead: false, msg: "", msgT: 0, pops: [], clearT: 0 }
  startLevel(s)
  return s
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

function pop(s, x, y, text) { s.pops = s.pops.concat([{ x: x, y: y, text: text, t: 1 }]) }

function breakCell(s, c, r) {
  var cell = s.grid[idx(c, r)]
  s.grid[idx(c, r)] = null
  var pts = MATS[cell.m].pts
  s.score += pts
  if (cell.m === "T") pop(s, (c + 0.5) * CELL, r * CELL, String(pts))
}

// Cells not joined (through solid neighbours) to one resting on the
// ground are unsupported.
function unsupported(grid) {
  var seen = new Array(grid.length), stack = []
  for (var c = 0; c < GW; ++c) { var i = idx(c, GH - 1); if (grid[i] && !grid[i].falling) { seen[i] = true; stack.push(i) } }
  while (stack.length) {
    var k = stack.pop(), cc = k % GW, rr = Math.floor(k / GW)
    var nb = [[cc + 1, rr], [cc - 1, rr], [cc, rr + 1], [cc, rr - 1]]
    for (var j = 0; j < 4; ++j) {
      var x = nb[j][0], y = nb[j][1]
      if (x < 0 || x >= GW || y < 0 || y >= GH) continue
      var n = idx(x, y)
      if (!seen[n] && grid[n]) { seen[n] = true; stack.push(n) }
    }
  }
  var out = []
  for (var q = 0; q < grid.length; ++q) if (grid[q] && !seen[q]) out.push(q)
  return out
}

// Drop every unsupported cell one row (bottom rows first). A falling cell
// that meets a target crushes it; one that meets anything else stops.
function fallStep(s) {
  var loose = unsupported(s.grid)
  if (!loose.length) return false
  var isLoose = {}
  for (var i = 0; i < loose.length; ++i) isLoose[loose[i]] = true
  loose.sort(function(a, b) { return b - a })
  var moved = false
  for (var k = 0; k < loose.length; ++k) {
    var from = loose[k], c = from % GW, r = Math.floor(from / GW), cell = s.grid[from]
    if (!cell) continue
    if (r + 1 >= GH) { land(s, c, r); continue }
    var below = idx(c, r + 1), under = s.grid[below]
    if (under && under.m === "T" && !isLoose[below]) { breakCell(s, c, r + 1); under = null }
    if (!under) {
      s.grid[below] = { m: cell.m, hp: cell.hp, fall: cell.fall + 1 }
      s.grid[from] = null
      isLoose[below] = true
      moved = true
    } else land(s, c, r)
  }
  // Cells that just came to rest after a long drop take damage.
  if (!moved) for (var q = 0; q < s.grid.length; ++q) if (s.grid[q] && s.grid[q].fall) land(s, q % GW, Math.floor(q / GW))
  return moved
}

function land(s, c, r) {
  var cell = s.grid[idx(c, r)]
  if (!cell || !cell.fall) return
  var f = cell.fall
  s.grid[idx(c, r)] = { m: cell.m, hp: cell.hp - (f >= 3 ? 1 : 0), fall: 0 }
  if ((cell.m === "T" && f >= 2) || s.grid[idx(c, r)].hp <= 0) breakCell(s, c, r)
}

function launch(state) {
  if (state.phase !== "aim" || state.birds <= 0) return state
  var s = shallow(state), sp = MAX_SPEED * Math.max(0.1, s.power)
  s.ball = { x: SLING.x, y: SLING.y, vx: Math.cos(s.angle) * sp, vy: -Math.sin(s.angle) * sp, rest: 0, age: 0 }
  s.birds--
  s.phase = "flight"
  s.lastTrail = s.trail
  s.trail = []
  s.charging = false; s.power = 0
  return s
}

// input: { dy (aim), hold }.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.pops = s.pops.map(function(o) { return { x: o.x, y: o.y - dt, text: o.text, t: o.t - dt } }).filter(function(o) { return o.t > 0 })

  // Loose pieces tumble a row at a time.
  s.fallT += dt
  var settling = false
  if (s.fallT >= 0.045) {
    s.fallT = 0
    s.grid = s.grid.slice()
    settling = fallStep(s)
  } else settling = unsupported(s.grid).length > 0
  s.settling = settling

  if (s.clearT > 0) {
    s.clearT -= dt
    if (s.clearT <= 0) { s.level++; startLevel(s) }
    return s
  }

  if (s.phase === "aim") {
    if (input.dy) s.angle = Math.max(-0.4, Math.min(1.45, s.angle - input.dy * 0.9 * dt))
    if (input.hold) {
      s.charging = true
      var pm = Meter.swing(s.power, s.powerDir, dt, 0.75, 0.1, 1)
      s.power = pm.v; s.powerDir = pm.dir
    } else if (s.charging) return launch(s)
  } else if (s.phase === "flight") {
    var b = shallow(s.ball), n = 8, h = dt / n
    s.grid = s.grid.slice()
    for (var k = 0; k < n; ++k) {
      b.vy += G * h
      b.x += b.vx * h; b.y += b.vy * h
      if (b.y + BALL_R > GROUND) { b.y = GROUND - BALL_R; b.vy = -Math.abs(b.vy) * 0.3; b.vx *= 0.85 }
      // Cells the ball overlaps.
      var c0 = Math.floor((b.x - BALL_R) / CELL), c1 = Math.floor((b.x + BALL_R) / CELL)
      var r0 = Math.floor((b.y - BALL_R) / CELL), r1 = Math.floor((b.y + BALL_R) / CELL)
      for (var r = r0; r <= r1; ++r) for (var c = c0; c <= c1; ++c) {
        if (c < 0 || c >= GW || r < 0 || r >= GH) continue
        var cell = s.grid[idx(c, r)]
        if (!cell) continue
        // Circle vs cell box.
        var cx = Math.max(c * CELL, Math.min(b.x, (c + 1) * CELL)), cy = Math.max(r * CELL, Math.min(b.y, (r + 1) * CELL))
        var dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy
        if (d2 >= BALL_R * BALL_R) continue
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy), mat = MATS[cell.m]
        if (sp >= mat.breakAt) {
          breakCell(s, c, r)
          b.vx *= 1 - mat.loss; b.vy *= 1 - mat.loss
          continue
        }
        if (sp > mat.breakAt * 0.45) {
          var hp = cell.hp - 1
          if (hp <= 0) { breakCell(s, c, r); b.vx *= 0.5; b.vy *= 0.5; continue }
          s.grid[idx(c, r)] = { m: cell.m, hp: hp, fall: 0 }
        }
        // Bounce off it.
        var d = Math.sqrt(d2) || 1e-6, nx = d2 ? dx / d : 0, ny = d2 ? dy / d : -1
        b.x = cx + nx * BALL_R; b.y = cy + ny * BALL_R
        var vn = b.vx * nx + b.vy * ny
        if (vn < 0) { b.vx -= 1.3 * vn * nx; b.vy -= 1.3 * vn * ny; b.vx *= 0.85; b.vy *= 0.85 }
      }
    }
    b.age += dt
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
    b.rest = speed < 0.6 ? b.rest + dt : 0
    if (!s.trail.length || Math.abs(s.trail[s.trail.length - 1][0] - b.x) + Math.abs(s.trail[s.trail.length - 1][1] - b.y) > 0.6)
      s.trail = s.trail.concat([[b.x, b.y]])
    s.ball = b
    if (b.rest > 0.8 || b.x > W + 1 || b.x < -1 || b.age > 9) { s.ball = null; s.phase = "wait"; s.waitT = 0.6 }
  } else if (s.phase === "wait") {
    s.waitT -= dt
    if (s.waitT <= 0 && !settling) {
      if (!countTargets(s.grid)) {
        var bonus = s.birds * 10000
        s.score += bonus
        s.msg = "FORT DOWN" + (bonus ? "  +" + bonus : ""); s.msgT = 1.8
        s.clearT = 1.8
      } else if (s.birds <= 0) {
        s.dead = true
        s.msg = "OUT OF STONES"; s.msgT = 3
      } else { s.phase = "aim"; s.angle = state.angle }
    }
  }
  return s
}

// The sling's launch vector for aim angle/power, for the preview dots.
function preview(s, steps) {
  var sp = MAX_SPEED * Math.max(0.1, s.power || 0.5), x = SLING.x, y = SLING.y, vx = Math.cos(s.angle) * sp, vy = -Math.sin(s.angle) * sp
  var out = [], h = 1 / 30
  for (var i = 0; i < steps; ++i) { vy += G * h; x += vx * h; y += vy * h; if (i % 2) out.push([x, y]) }
  return out
}
