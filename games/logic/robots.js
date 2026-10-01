.pragma library
.import "../../engine/Rng.js" as Rng

// Robots, after the BSD game and GNOME Robots. Every move you make, each
// robot takes one step straight at you. Robots that bump into each other
// (or into a wreck) become a junk heap. You can't fight; you can only
// dodge, teleport (random: might land you somewhere awful), or use a safe
// teleport (limited; one extra per level). "Wait out" stands still until
// the robots are gone or one's next to you, for a bonus per robot.
// Moves straight into a robot's reach are refused ("safe moves").

var W = 24
var H = 16
var DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 0]]

function key(x, y) { return x + "," + y }

function level(n, score, safe) {
  var robots = [], taken = {}
  var px = Math.floor(W / 2), py = Math.floor(H / 2)
  taken[key(px, py)] = true
  var count = Math.min(W * H / 3, 6 + n * 8)
  while (robots.length < count) {
    var x = Math.floor(Rng.random() * W), y = Math.floor(Rng.random() * H)
    if (taken[key(x, y)] || (Math.abs(x - px) < 2 && Math.abs(y - py) < 2)) continue
    taken[key(x, y)] = true
    robots.push({ x: x, y: y })
  }
  return { player: { x: px, y: py }, robots: robots, heaps: {}, level: n, score: score || 0,
           safe: safe === undefined ? 3 : safe, alive: true, note: "", bonus: 0 }
}

function makeState() { return level(1, 0, 3) }

function copy(s) {
  return { player: s.player, robots: s.robots, heaps: s.heaps, level: s.level, score: s.score, safe: s.safe,
           alive: s.alive, note: "", bonus: 0 }
}

// Robots advance on the player at (px, py): returns new robots and heaps,
// and points for every robot wrecked.
function advance(robots, heaps, px, py) {
  var moved = [], at = {}, h = {}
  for (var k in heaps) h[k] = true
  for (var i = 0; i < robots.length; ++i) {
    var r = robots[i]
    var nx = r.x + Math.sign(px - r.x), ny = r.y + Math.sign(py - r.y)
    moved.push({ x: nx, y: ny })
    var kk = key(nx, ny)
    at[kk] = (at[kk] || 0) + 1
  }
  var alive = [], wrecked = 0
  for (var j = 0; j < moved.length; ++j) {
    var m = moved[j], mk = key(m.x, m.y)
    if (h[mk] || at[mk] > 1) { wrecked++; continue }
    alive.push(m)
  }
  for (var q = 0; q < moved.length; ++q) {
    var mm = moved[q], k2 = key(mm.x, mm.y)
    if (at[k2] > 1) h[k2] = true
  }
  return { robots: alive, heaps: h, wrecked: wrecked }
}

function robotAt(robots, x, y) {
  for (var i = 0; i < robots.length; ++i) if (robots[i].x === x && robots[i].y === y) return true
  return false
}

// Would standing at (x, y) get you caught on the robots' next step?
function deadly(s, x, y) {
  for (var i = 0; i < s.robots.length; ++i)
    if (Math.abs(s.robots[i].x - x) <= 1 && Math.abs(s.robots[i].y - y) <= 1) return true
  return false
}

function finishTurn(s, n) {
  var a = advance(s.robots, s.heaps, n.player.x, n.player.y)
  n.robots = a.robots; n.heaps = a.heaps
  n.score = s.score + a.wrecked * 10 + n.bonus
  if (robotAt(n.robots, n.player.x, n.player.y)) { n.alive = false; return n }
  if (!n.robots.length) return level(s.level + 1, n.score, Math.min(10, n.safe + 1))
  return n
}

// d: index into DIRS (8 = stay put).
function move(s, d) {
  if (!s.alive) return s
  var x = s.player.x + DIRS[d][0], y = s.player.y + DIRS[d][1]
  var n = copy(s)
  if (x < 0 || y < 0 || x >= W || y >= H) { n.note = "that's the edge"; return n }
  if (s.heaps[key(x, y)]) {
    // Push the heap one further, if there's room (as GNOME Robots does).
    var hx = x + DIRS[d][0], hy = y + DIRS[d][1]
    if (d === 8 || hx < 0 || hy < 0 || hx >= W || hy >= H || s.heaps[key(hx, hy)] || robotAt(s.robots, hx, hy)) { n.note = "can't push that heap"; return n }
    var heaps = {}
    for (var k in s.heaps) if (k !== key(x, y)) heaps[k] = true
    heaps[key(hx, hy)] = true
    n.heaps = heaps
  }
  if (robotAt(s.robots, x, y) || deadly(s, x, y)) { n.note = "a robot would get you there"; return n }
  n.player = { x: x, y: y }
  return finishTurn(s, n)
}

function teleport(s, safe) {
  if (!s.alive) return s
  if (safe && s.safe <= 0) { var z = copy(s); z.note = "no safe teleports left"; return z }
  var spots = []
  for (var y = 0; y < H; ++y)
    for (var x = 0; x < W; ++x) {
      if (s.heaps[key(x, y)] || robotAt(s.robots, x, y)) continue
      if (safe && deadly(s, x, y)) continue
      spots.push({ x: x, y: y })
    }
  var n = copy(s)
  if (!spots.length) { n.note = "nowhere to go"; return n }
  n.player = spots[Math.floor(Rng.random() * spots.length)]
  if (safe) n.safe = s.safe - 1
  return finishTurn(s, n)
}

// Stand still until something changes: no robots left, or one adjacent.
function waitOut(s) {
  var cur = s, bonus = 0, guard = 0
  while (cur.alive && guard++ < 200) {
    if (deadly(cur, cur.player.x, cur.player.y)) break
    var before = cur.level, n = copy(cur)
    var next = finishTurn(cur, n)
    if (next.level !== before) { next.score += bonus; return next }
    bonus += (cur.robots.length - next.robots.length) * 5
    cur = next
  }
  var out = copy(cur)
  out.score += bonus
  out.note = cur.alive ? "a robot's next to you" : ""
  return out
}

function serialize(s) {
  return { player: s.player, robots: s.robots, heaps: Object.keys(s.heaps), level: s.level, score: s.score, safe: s.safe, alive: s.alive }
}

function deserialize(o) {
  if (!o || !o.player || !o.robots || o.alive === false) return null
  var h = {}
  for (var i = 0; i < (o.heaps || []).length; ++i) h[o.heaps[i]] = true
  return { player: o.player, robots: o.robots, heaps: h, level: o.level || 1, score: o.score || 0, safe: o.safe || 0,
           alive: true, note: "", bonus: 0 }
}
