.pragma library
.import "../../engine/Rng.js" as Rng

// Muncher: a maze chase after Pac-Man, on an original 19x21 maze. Eat every
// pellet; the four ghosts each chase their own way (after the arcade game:
// one heads straight for you, one aims ahead of you, one flanks off the
// first, one wanders off when close), taking breaks to scatter to their
// corners. A power pellet turns them round and edible for a few seconds.
//
// Movement is tile to tile: every actor has a tile (x, y), a direction and
// progress t (0..1) toward the next tile, and only picks a new direction on
// arriving at a tile centre. Your turn is queued, so pressing a direction a
// little early takes the next opening that way. Row 9 wraps (the tunnel).

var MAZE = [
  "###################",
  "#........#........#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.### # ###.####",
  "####.#       #.####",
  "####.# ##-## #.####",
  "    .  #GGG#  .    ",
  "####.# ##### #.####",
  "####.#       #.####",
  "####.# ##### #.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o.#.....P.....#.o#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "#.................#",
  "###################"
]
var W = 19
var H = 21
var DOOR = { x: 9, y: 8 }
var EXIT = { x: 9, y: 7 }      // just outside the door
var HOME = { x: 9, y: 9 }      // inside the house
var START = { x: 9, y: 15 }
var DIRS = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]   // up, left, down, right: arcade tie-break order
var SCATTER = [{ x: 17, y: -2 }, { x: 1, y: -2 }, { x: 18, y: 22 }, { x: 0, y: 22 }]
// Scatter/chase phases in seconds; the last chase runs forever.
var PHASES = [7, 20, 7, 20, 5, 20, 5]
var RELEASE = [0, 1, 5, 9]     // seconds before each ghost leaves the house

function wall(x, y) {
  if (y < 0 || y >= H) return true
  var c = MAZE[y][((x % W) + W) % W]
  return c === "#" || c === "G" || c === "-"
}

function pelletGrid() {
  var p = []
  for (var y = 0; y < H; ++y) {
    var row = []
    for (var x = 0; x < W; ++x) row.push(MAZE[y][x] === "." ? 1 : MAZE[y][x] === "o" ? 2 : 0)
    p.push(row)
  }
  return p
}

function countPellets(p) {
  var n = 0
  for (var y = 0; y < H; ++y) for (var x = 0; x < W; ++x) if (p[y][x]) n++
  return n
}

function freshActors(level) {
  var ghosts = []
  for (var i = 0; i < 4; ++i)
    ghosts.push({ x: i === 0 ? EXIT.x : 8 + (i - 1), y: i === 0 ? EXIT.y : HOME.y, dir: i === 0 ? 1 : 0, t: 0,
                  mode: i === 0 ? "out" : "house", release: RELEASE[i] })
  return { pac: { x: START.x, y: START.y, dir: 1, want: 1, t: 0, moving: true }, ghosts: ghosts }
}

function makeState() {
  var a = freshActors(1)
  return { pac: a.pac, ghosts: a.ghosts, pellets: pelletGrid(), left: countPellets(pelletGrid()), score: 0,
           lives: 3, level: 1, clock: 0, phaseClock: 0, fright: 0, chain: 0, ready: 2, dying: 0, alive: true,
           nextLife: 10000, pops: [], mouth: 0 }
}

function copy(s) {
  return { pac: s.pac, ghosts: s.ghosts, pellets: s.pellets, left: s.left, score: s.score, lives: s.lives,
           level: s.level, clock: s.clock, phaseClock: s.phaseClock, fright: s.fright, chain: s.chain,
           ready: s.ready, dying: s.dying, alive: s.alive, nextLife: s.nextLife, pops: s.pops, mouth: s.mouth }
}

function speeds(level) {
  var f = Math.min(1.25, 1 + (level - 1) * 0.06)
  return { pac: 7.2 * f, ghost: 6.8 * f, fright: 4.2, eyes: 15, frightTime: Math.max(1.5, 7 - (level - 1)) }
}

function chasing(s) {
  var t = s.phaseClock
  for (var i = 0; i < PHASES.length; ++i) {
    if (t < PHASES[i]) return i % 2 === 1
    t -= PHASES[i]
  }
  return true
}

function wrapX(x) { return ((x % W) + W) % W }

// Where each ghost is headed while chasing.
function chaseTarget(s, i) {
  var p = s.pac, d = DIRS[p.dir]
  if (i === 0) return { x: p.x, y: p.y }
  if (i === 1) return { x: p.x + d.x * 4, y: p.y + d.y * 4 }
  if (i === 2) {
    var a = { x: p.x + d.x * 2, y: p.y + d.y * 2 }, b = s.ghosts[0]
    return { x: a.x * 2 - b.x, y: a.y * 2 - b.y }
  }
  var g = s.ghosts[3]
  var dist = (g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y)
  return dist > 64 ? { x: p.x, y: p.y } : SCATTER[3]
}

// At a tile centre: the open direction (not straight back) closest to target.
function steer(g, target, canDoor) {
  var best = -1, bestD = 1e9
  for (var k = 0; k < 4; ++k) {
    if (k === (g.dir + 2) % 4) continue
    var nx = g.x + DIRS[k].x, ny = g.y + DIRS[k].y
    var door = wrapX(nx) === DOOR.x && ny === DOOR.y
    if (door ? !canDoor : wall(nx, ny)) continue
    var dd = (nx - target.x) * (nx - target.x) + (ny - target.y) * (ny - target.y)
    if (dd < bestD) { bestD = dd; best = k }
  }
  return best < 0 ? (g.dir + 2) % 4 : best
}

function randomTurn(g) {
  var opts = []
  for (var k = 0; k < 4; ++k) {
    if (k === (g.dir + 2) % 4) continue
    if (!wall(g.x + DIRS[k].x, g.y + DIRS[k].y)) opts.push(k)
  }
  return opts.length ? opts[Math.floor(Rng.random() * opts.length)] : (g.dir + 2) % 4
}

function stepPac(s, p, dt) {
  var sp = speeds(s.level).pac
  var n = { x: p.x, y: p.y, dir: p.dir, want: p.want, t: p.t, moving: p.moving }
  // Reversing is allowed at any moment.
  if (n.want === (n.dir + 2) % 4 && n.moving && n.t > 0) {
    n.x = wrapX(n.x + DIRS[n.dir].x); n.y += DIRS[n.dir].y
    n.dir = n.want; n.t = 1 - n.t
  }
  if (!n.moving) {
    if (!wall(n.x + DIRS[n.want].x, n.y + DIRS[n.want].y)) { n.dir = n.want; n.moving = true }
    else return n
  }
  n.t += sp * dt
  while (n.t >= 1) {
    n.t -= 1
    n.x = wrapX(n.x + DIRS[n.dir].x); n.y += DIRS[n.dir].y
    s.eat.push({ x: n.x, y: n.y })
    if (!wall(n.x + DIRS[n.want].x, n.y + DIRS[n.want].y)) n.dir = n.want
    if (wall(n.x + DIRS[n.dir].x, n.y + DIRS[n.dir].y)) { n.t = 0; n.moving = false; break }
  }
  return n
}

function stepGhost(s, i, g, dt) {
  var sp = speeds(s.level)
  var n = { x: g.x, y: g.y, dir: g.dir, t: g.t, mode: g.mode, release: g.release }
  if (n.mode === "house") {
    n.release -= dt
    if (n.release <= 0) { n.mode = "leaving"; n.dir = n.x < HOME.x ? 3 : n.x > HOME.x ? 1 : 0 }
    return n
  }
  var v = n.mode === "eyes" ? sp.eyes : n.mode === "fright" ? sp.fright : n.mode === "leaving" || n.mode === "entering" ? 3 : sp.ghost
  if (n.y === 9 && (n.x < 4 || n.x > 14) && n.mode !== "eyes") v *= 0.55   // tunnel drag
  n.t += v * dt
  while (n.t >= 1) {
    n.t -= 1
    n.x = wrapX(n.x + DIRS[n.dir].x); n.y += DIRS[n.dir].y
    if (n.mode === "leaving") {
      // Slide to the middle column, then straight up and out.
      if (n.x !== HOME.x) n.dir = n.x < HOME.x ? 3 : 1
      else if (n.y > EXIT.y) n.dir = 0
      else { n.mode = "out"; n.dir = 1 }
      continue
    }
    if (n.mode === "entering") {
      if (n.y < HOME.y) n.dir = 2
      else { n.mode = "leaving"; n.dir = 0 }
      continue
    }
    if (n.mode === "eyes") {
      if (n.x === EXIT.x && n.y === EXIT.y) { n.mode = "entering"; n.dir = 2; continue }
      n.dir = steer(n, EXIT, false)
      continue
    }
    if (n.mode === "fright") { n.dir = randomTurn(n); continue }
    n.dir = steer(n, chasing(s) ? chaseTarget(s, i) : SCATTER[i], false)
  }
  // Nothing checks walls while moving: steer() never picks one, and the
  // house moves are scripted.
  return n
}

// input: { dir: -1 or 0..3 } — the latest direction pressed.
function step(state, input, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.mouth = (state.mouth + dt * 9) % (Math.PI * 2)
  s.pops = state.pops.filter(function(p) { return p.life > dt }).map(function(p) { return { x: p.x, y: p.y, v: p.v, life: p.life - dt } })
  if (state.ready > 0) { s.ready = Math.max(0, state.ready - dt); return s }
  if (state.dying > 0) {
    s.dying = Math.max(0, state.dying - dt)
    if (s.dying === 0) {
      if (s.lives <= 0) { s.alive = false; return s }
      var a = freshActors(s.level)
      s.pac = a.pac; s.ghosts = a.ghosts; s.ready = 1.5; s.phaseClock = 0; s.fright = 0
    }
    return s
  }

  s.clock = state.clock + dt
  if (state.fright > 0) s.fright = Math.max(0, state.fright - dt)
  else s.phaseClock = state.phaseClock + dt

  var pac = { x: state.pac.x, y: state.pac.y, dir: state.pac.dir, want: input.dir >= 0 ? input.dir : state.pac.want,
              t: state.pac.t, moving: state.pac.moving }
  s.eat = []
  s.pac = stepPac(s, pac, dt)

  // Pellets under the tiles just entered.
  var pellets = state.pellets, changed = false
  for (var e = 0; e < s.eat.length; ++e) {
    var c = s.eat[e]
    if (c.y < 0 || c.y >= H || !pellets[c.y][c.x]) continue
    if (!changed) { pellets = pellets.map(function(r) { return r.slice() }); changed = true }
    var kind = pellets[c.y][c.x]
    pellets[c.y][c.x] = 0
    s.left--
    s.score += kind === 2 ? 50 : 10
    if (kind === 2) {
      s.fright = speeds(s.level).frightTime
      s.chain = 0
      // Everyone out in the maze turns straight round (mid-tile, that
      // means the tile ahead becomes the one it's "at").
      s.ghosts = s.ghosts.map(function(g) {
        if (g.mode !== "out" && g.mode !== "fright") return g
        var back = (g.dir + 2) % 4
        if (g.t > 0) return { x: wrapX(g.x + DIRS[g.dir].x), y: g.y + DIRS[g.dir].y, dir: back, t: 1 - g.t, mode: "fright", release: 0 }
        return { x: g.x, y: g.y, dir: back, t: 0, mode: "fright", release: 0 }
      })
    }
  }
  s.pellets = pellets
  delete s.eat

  if (state.fright > 0 && s.fright === 0)
    s.ghosts = s.ghosts.map(function(g) { return g.mode === "fright" ? { x: g.x, y: g.y, dir: g.dir, t: g.t, mode: "out", release: 0 } : g })

  var ghosts = []
  for (var i = 0; i < s.ghosts.length; ++i) ghosts.push(stepGhost(s, i, s.ghosts[i], dt))
  s.ghosts = ghosts

  // Collisions, by actual position so passing through each other counts.
  var px = s.pac.x + DIRS[s.pac.dir].x * s.pac.t, py = s.pac.y + DIRS[s.pac.dir].y * s.pac.t
  for (var j = 0; j < ghosts.length; ++j) {
    var g = ghosts[j]
    if (g.mode === "house" || g.mode === "eyes" || g.mode === "entering") continue
    var gx = g.x + DIRS[g.dir].x * g.t, gy = g.y + DIRS[g.dir].y * g.t
    var dx = Math.abs(gx - px); dx = Math.min(dx, W - dx)
    if (dx + Math.abs(gy - py) > 0.7) continue
    if (g.mode === "fright") {
      s.chain++
      var pts = 100 * Math.pow(2, s.chain)
      s.score += pts
      s.pops = s.pops.concat([{ x: gx, y: gy, v: pts, life: 1 }])
      var ng = s.ghosts.slice()
      ng[j] = { x: g.x, y: g.y, dir: g.dir, t: g.t, mode: "eyes", release: 0 }
      s.ghosts = ng
    } else if (g.mode === "out" || g.mode === "leaving") {
      s.lives--
      s.dying = 1.4
      return s
    }
  }

  if (s.score >= s.nextLife) { s.lives++; s.nextLife += 10000 }

  if (s.left <= 0) {
    s.level++
    s.pellets = pelletGrid()
    s.left = countPellets(s.pellets)
    var a2 = freshActors(s.level)
    s.pac = a2.pac; s.ghosts = a2.ghosts; s.ready = 2; s.phaseClock = 0; s.fright = 0
  }
  return s
}

// Smooth positions for drawing.
function pos(a) {
  return { x: a.x + DIRS[a.dir].x * a.t, y: a.y + DIRS[a.dir].y * a.t }
}

function serialize(s) {
  return { score: s.score, lives: s.lives, level: s.level, pellets: s.pellets, left: s.left, nextLife: s.nextLife, alive: s.alive }
}

// Resumes the same board and score with everyone back at the start.
function deserialize(o) {
  if (!o || !o.pellets || o.alive === false || o.pellets.length !== H) return null
  var s = makeState()
  s.score = o.score || 0; s.lives = o.lives || 3; s.level = o.level || 1
  s.pellets = o.pellets; s.left = countPellets(o.pellets); s.nextLife = o.nextLife || 10000
  if (s.left === 0) { s.pellets = pelletGrid(); s.left = countPellets(s.pellets) }
  return s
}
