.pragma library
.import "../../engine/Rng.js" as Rng

// Tempest. You ride the near rim of a tube and fire down its lanes.
// Flippers climb toward you, hopping lanes as they come, and once on the
// rim they chase you round it. Tankers split into two flippers when hit;
// spikers lay spikes down the lanes. Clear a level and you warp down the
// tube to the next shape; a spike in your lane on the way is fatal, so
// shoot them short. One superzapper per level clears the screen.
//
// Geometry: a shape is a list of rim points in unit coordinates (open
// shapes have one more point than lanes). Depth z runs from 0 (the far,
// small end) to 1 (the rim you stand on); scale(z) is the perspective.

var LIVES = 3
var SHOT_SPEED = 2.4
var ENEMY_SHOT_SPEED = 0.55
var MAX_SHOTS = 6

function ring(n, fn) { var p = []; for (var i = 0; i < n; ++i) p.push(fn(i, n)); return p }

var SHAPES = [
  { name: "CIRCLE", closed: true, pts: ring(16, function(i, n) { var a = -Math.PI / 2 + i / n * Math.PI * 2; return [Math.cos(a), Math.sin(a)] }) },
  { name: "SQUARE", closed: true, pts: (function() {
      var p = [], s = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      for (var e = 0; e < 4; ++e) for (var k = 0; k < 4; ++k) {
        var a = s[e], b = s[(e + 1) % 4]
        p.push([a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4])
      }
      return p.map(function(q) { return [q[0] * 0.85, q[1] * 0.85] })
    })() },
  { name: "PLUS", closed: true, pts: [[-0.33, -1], [0.33, -1], [0.33, -0.33], [1, -0.33], [1, 0.33], [0.33, 0.33], [0.33, 1], [-0.33, 1], [-0.33, 0.33], [-1, 0.33], [-1, -0.33], [-0.33, -0.33]].reduce(function(acc, q, i, arr) {
      var r = arr[(i + 1) % arr.length]
      acc.push(q)
      if (Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 1) acc.push([(q[0] + r[0]) / 2, (q[1] + r[1]) / 2])
      return acc
    }, []) },
  { name: "VEE", closed: false, pts: ring(15, function(i, n) { var t = i / (n - 1) * 2 - 1; return [t * 1.05, -0.55 + Math.abs(t) * 1.1 - 0.25] }).reverse() },
  { name: "STAR", closed: true, pts: ring(16, function(i, n) { var a = -Math.PI / 2 + i / n * Math.PI * 2, r = i % 2 ? 0.62 : 1; return [Math.cos(a) * r, Math.sin(a) * r] }) },
  { name: "STEPS", closed: false, pts: ring(15, function(i, n) { var t = i / (n - 1) * 2 - 1; return [t, 0.55 - Math.round(Math.abs(t) * 3) / 3 * 0.9] }).reverse() }
]

function lanes(shape) { return shape.closed ? shape.pts.length : shape.pts.length - 1 }

function scale(z) { return 1 / (1 + (1 - z) * 4.5) }

function lanePoint(shape, lane, t, z) {
  var n = shape.pts.length, a = shape.pts[lane % n], b = shape.pts[(lane + 1) % n], k = scale(z)
  return [(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k]
}

function wrapLane(shape, l) {
  var n = lanes(shape)
  if (shape.closed) return ((l % n) + n) % n
  return Math.max(0, Math.min(n - 1, l))
}

function makeLevel(s) {
  s.shape = SHAPES[(s.level - 1) % SHAPES.length]
  var n = 8 + s.level * 2
  s.queue = []
  for (var i = 0; i < n; ++i) {
    var r = Rng.random(), kind = s.level >= 3 && r < 0.2 ? "spiker" : s.level >= 2 && r < 0.45 ? "tanker" : "flipper"
    s.queue.push(kind)
  }
  s.spawnT = 1.2
  s.enemies = []; s.shots = []; s.eshots = []
  s.spikes = []
  for (var k = 0; k < lanes(s.shape); ++k) s.spikes.push(0)
  s.zapper = true
  s.phase = "play"
  s.warp = 1
  s.lane = Math.floor(lanes(s.shape) / 2)
  s.msg = "LEVEL " + s.level + " · " + s.shape.name; s.msgT = 2
}

function makeState() {
  var s = { level: 1, score: 0, lives: LIVES, t: 0, moveAcc: 0, prevFire: false, cool: 0, respawn: 0, dead: false, flash: 0, booms: [], extraAt: 20000 }
  makeLevel(s)
  return s
}

function shallow(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function copyE(e) { var o = {}; for (var k in e) o[k] = e[k]; return o }

function addScore(s, n) { s.score += n; if (s.score >= s.extraAt) { s.lives++; s.extraAt += 20000 } }

function boom(s, lane, z) { s.booms = s.booms.concat([{ lane: lane, z: z, t: 0.4 }]) }

// Move the claw one lane toward screen direction (dx, dy).
function neighbour(s, dx, dy) {
  var best = s.lane, bestV = 0.02
  var cur = lanePoint(s.shape, s.lane, 0.5, 1)
  for (var d = -1; d <= 1; d += 2) {
    var l = wrapLane(s.shape, s.lane + d)
    if (l === s.lane) continue
    var p = lanePoint(s.shape, l, 0.5, 1), v = (p[0] - cur[0]) * dx + (p[1] - cur[1]) * dy
    if (v > bestV) { bestV = v; best = l }
  }
  return best
}

function killPlayer(s) {
  s.lives--
  boom(s, s.lane, 1)
  s.flash = 0.5
  if (s.lives <= 0) { s.dead = true; return }
  // The enemies on screen go back in the queue; start the level over.
  for (var i = 0; i < s.enemies.length; ++i) s.queue.push(s.enemies[i].kind)
  s.enemies = []; s.shots = []; s.eshots = []
  s.respawn = 1.5
  s.phase = "play"; s.warp = 1
}

function zap(state) {
  if (!state.zapper || state.phase !== "play" || state.respawn > 0) return state
  var s = shallow(state)
  s.zapper = false
  for (var i = 0; i < s.enemies.length; ++i) { boom(s, s.enemies[i].lane, s.enemies[i].z); addScore(s, 50) }
  s.enemies = []; s.eshots = []
  s.flash = 0.3
  return s
}

// input: { dx, dy, fire, lane (mouse: a lane to head for, or -1) }.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state), sh = s.shape, n = lanes(sh)
  s.t += dt
  s.msgT = Math.max(0, (s.msgT || 0) - dt)
  s.flash = Math.max(0, s.flash - dt)
  s.booms = s.booms.map(function(b) { return { lane: b.lane, z: b.z, t: b.t - dt } }).filter(function(b) { return b.t > 0 })

  if (s.respawn > 0) { s.respawn -= dt; return s }

  // Claw: slides a lane at a time while a direction is held.
  var want = input.dx || input.dy
  s.moveAcc = want ? s.moveAcc + dt : 0.09
  if (want && s.moveAcc >= 0.08) { s.moveAcc = 0; s.lane = neighbour(s, input.dx, input.dy) }
  if (input.lane >= 0 && input.lane !== s.lane) {
    s.moveAcc += dt
    if (s.moveAcc >= 0.06) {
      s.moveAcc = 0
      var fwd = sh.closed ? ((input.lane - s.lane + n) % n <= n / 2 ? 1 : -1) : (input.lane > s.lane ? 1 : -1)
      s.lane = wrapLane(sh, s.lane + fwd)
    }
  }

  // Firing (hold for a stream).
  s.cool = Math.max(0, s.cool - dt)
  if (input.fire && s.cool <= 0 && s.shots.length < MAX_SHOTS) {
    s.shots = s.shots.concat([{ lane: s.lane, z: s.phase === "warp" ? s.warp : 1 }])
    s.cool = 0.11
  }
  s.prevFire = input.fire

  // Warp: fly down the tube; spikes in your lane are deadly.
  if (s.phase === "warp") {
    s.warp -= dt * 0.45
    s.shots = moveShots(s, dt)
    if (s.spikes[s.lane] > 0 && s.warp <= s.spikes[s.lane]) { killPlayer(s); if (!s.dead) { s.level++; makeLevel(s) } return s }
    if (s.warp <= 0) { addScore(s, s.level * 500); s.level++; makeLevel(s) }
    return s
  }

  // Spawn from the far end.
  s.spawnT -= dt
  if (s.spawnT <= 0 && s.queue.length) {
    s.queue = s.queue.slice()
    var kind = s.queue.shift()
    s.enemies = s.enemies.concat([{ kind: kind, lane: Math.floor(Rng.random() * n), z: 0, flipT: 0.6 + Rng.random(), rimT: 0.5, down: false }])
    s.spawnT = Math.max(0.35, 1.3 - s.level * 0.07) * (0.5 + Rng.random())
  }

  var climb = 0.12 + s.level * 0.02
  var list = [], eshots = s.eshots.slice()
  for (var i = 0; i < s.enemies.length; ++i) {
    var e = copyE(s.enemies[i])
    if (e.kind === "spiker") {
      // Climbs part way leaving a spike, then retreats and vanishes.
      if (!e.down) { e.z += climb * dt; s.spikes = s.spikes.slice(); s.spikes[e.lane] = Math.max(s.spikes[e.lane], e.z); if (e.z > 0.55 + Rng.random() * 0.002) e.down = true }
      else { e.z -= climb * 1.5 * dt; if (e.z <= 0) { s.queue = s.queue.concat(["flipper"]); continue } }
    } else if (e.z < 1) {
      e.z = Math.min(1, e.z + climb * (e.kind === "tanker" ? 0.7 : 1) * dt)
      if (e.kind === "flipper") {
        e.flipT -= dt
        if (e.flipT <= 0) { e.lane = wrapLane(sh, e.lane + (Rng.random() < 0.5 ? -1 : 1)); e.flipT = 0.7 + Rng.random() * 1.2 }
      }
      if (e.kind === "tanker" && e.z >= 1) {
        // A tanker reaching the rim bursts into two flippers.
        list.push({ kind: "flipper", lane: wrapLane(sh, e.lane - 1), z: 1, flipT: 1, rimT: 0.5, down: false })
        e.kind = "flipper"; e.lane = wrapLane(sh, e.lane + 1)
      }
      if (Rng.random() < dt * (0.2 + s.level * 0.04) && e.z > 0.15 && e.z < 0.8) eshots.push({ lane: e.lane, z: e.z })
    } else {
      // On the rim: chase the claw round.
      e.rimT -= dt
      if (e.rimT <= 0) {
        e.rimT = Math.max(0.18, 0.5 - s.level * 0.03)
        if (e.lane !== s.lane) {
          var dir = sh.closed ? ((s.lane - e.lane + n) % n <= n / 2 ? 1 : -1) : (s.lane > e.lane ? 1 : -1)
          e.lane = wrapLane(sh, e.lane + dir)
        }
      }
    }
    list.push(e)
  }
  s.enemies = list

  s.eshots = eshots.map(function(b) { return { lane: b.lane, z: b.z + ENEMY_SHOT_SPEED * dt } })
  s.shots = moveShots(s, dt)

  // Collisions.
  for (var k = 0; k < s.enemies.length; ++k) if (s.enemies[k].z >= 1 && s.enemies[k].lane === s.lane && s.enemies[k].kind !== "spiker") { killPlayer(s); return s }
  var kept = []
  for (var q = 0; q < s.eshots.length; ++q) {
    var es = s.eshots[q]
    if (es.z >= 1) { if (es.lane === s.lane) { killPlayer(s); return s } continue }
    kept.push(es)
  }
  s.eshots = kept

  if (!s.queue.length && !s.enemies.length) { s.phase = "warp"; s.warp = 1; s.shots = []; s.eshots = []; s.msg = "WARP"; s.msgT = 1 }
  return s
}

// Shots fly down their lane and stop at the first thing they meet.
function moveShots(s, dt) {
  var out = []
  for (var i = 0; i < s.shots.length; ++i) {
    var b = { lane: s.shots[i].lane, z: s.shots[i].z - SHOT_SPEED * dt }, from = s.shots[i].z, hit = false
    for (var k = 0; k < s.enemies.length && !hit; ++k) {
      var e = s.enemies[k]
      if (e.lane !== b.lane || e.dead) continue
      if (e.z <= from + 0.03 && e.z >= b.z - 0.03) {
        hit = true
        if (e.kind === "tanker") {
          addScore(s, 100)
          s.enemies = s.enemies.slice(0, k).concat([
            { kind: "flipper", lane: wrapLane(s.shape, e.lane - 1), z: e.z, flipT: 1, rimT: 0.5, down: false },
            { kind: "flipper", lane: wrapLane(s.shape, e.lane + 1), z: e.z, flipT: 1.3, rimT: 0.5, down: false }
          ]).concat(s.enemies.slice(k + 1))
        } else {
          addScore(s, e.kind === "spiker" ? 50 : 150)
          s.enemies = s.enemies.slice(0, k).concat(s.enemies.slice(k + 1))
        }
        boom(s, e.lane, e.z)
      }
    }
    for (var q = 0; q < s.eshots.length && !hit; ++q) {
      var es = s.eshots[q]
      if (es.lane === b.lane && es.z <= from + 0.03 && es.z >= b.z - 0.03) { hit = true; s.eshots = s.eshots.slice(0, q).concat(s.eshots.slice(q + 1)) }
    }
    // Spike tips get whittled down.
    if (!hit && s.spikes[b.lane] > 0 && b.z <= s.spikes[b.lane]) {
      hit = true
      s.spikes = s.spikes.slice()
      s.spikes[b.lane] = Math.max(0, s.spikes[b.lane] - 0.1)
      addScore(s, 3)
    }
    if (!hit && b.z > 0) out.push(b)
  }
  return out
}

// Nearest lane (by rim midpoint) to a point in unit coordinates.
function laneAt(s, x, y) {
  var best = 0, bd = 1e9
  for (var i = 0; i < lanes(s.shape); ++i) {
    var p = lanePoint(s.shape, i, 0.5, 1), d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y)
    if (d < bd) { bd = d; best = i }
  }
  return best
}
