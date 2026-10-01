.pragma library
.import "../../engine/Rng.js" as Rng

// Cube Hop (after Q*bert). Hop diagonally about a pyramid of cubes,
// turning each top to the target colour. From level 2 a top needs two
// visits; from level 3 a second visit turns it back. Red balls bounce
// down the pyramid; the purple one hatches into a snake at the bottom and
// hunts you. Green balls freeze everything for a moment if you catch
// one. Hop off the edge onto a floating disc and it carries you to the
// top; a snake close behind follows you over the edge. Anywhere else off
// the edge is a fall. Three lives.
//
// Cubes are (r, c) with 0 <= c <= r < ROWS; (0, 0) is the apex.

var ROWS = 7
var LIVES = 3
var HOP = 0.26                 // seconds a hop takes
var DIRS = { ul: [-1, -1], ur: [-1, 0], dl: [1, 0], dr: [1, 1] }

function onPyramid(r, c) { return r >= 0 && r < ROWS && c >= 0 && c <= r }

// Rule for a level: how many visits a top needs, and whether over-visiting
// wraps back.
function rule(level) {
  var k = (level - 1) % 3
  return k === 0 ? { need: 1, wrap: false } : k === 1 ? { need: 2, wrap: false } : { need: 1, wrap: true }
}

function makeLevel(s) {
  s.tops = []
  for (var r = 0; r < ROWS; ++r) { var row = []; for (var c = 0; c <= r; ++c) row.push(0); s.tops.push(row) }
  // Two discs, one each side, on random rows.
  var rl = 2 + Math.floor(Rng.random() * 4), rr = 2 + Math.floor(Rng.random() * 4)
  s.discs = [{ r: rl, c: -1, used: false }, { r: rr, c: rr + 1, used: false }]
  resetRound(s)
  s.msg = "LEVEL " + s.level; s.msgT = 1.6
}

function resetRound(s) {
  s.p = { r: 0, c: 0, fr: 0, fc: 0, t: 1, state: "idle" }
  s.enemies = []
  s.spawnT = 1.6
  s.freeze = 0
  s.ride = null
  s.dying = 0
  s.queued = null
  s.lure = null
}

function makeState() {
  var s = { level: 1, score: 0, lives: LIVES, t: 0, dead: false, msg: "", msgT: 0, pops: [], cleared: 0 }
  makeLevel(s)
  return s
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

function doneTops(s) {
  var need = rule(s.level).need
  for (var r = 0; r < ROWS; ++r) for (var c = 0; c <= r; ++c) if (s.tops[r][c] !== need) return false
  return true
}

function landPlayer(s) {
  var p = s.p, ru = rule(s.level)
  s.tops = s.tops.map(function(row) { return row.slice() })
  var v = s.tops[p.r][p.c]
  if (v < ru.need) { s.tops[p.r][p.c] = v + 1; s.score += 25 }
  else if (ru.wrap) s.tops[p.r][p.c] = v - 1
}

function hopPlayer(state, dir) {
  var s = shallow(state), p = s.p
  if (s.dead || s.dying > 0 || s.ride) return state
  if (p.t < 1) { s.queued = dir; return s }
  var d = DIRS[dir]
  var nr = p.r + d[0], nc = p.c + d[1]
  s.p = { r: nr, c: nc, fr: p.r, fc: p.c, t: 0, state: "hop", dir: dir }
  s.queued = null
  return s
}

// Where an enemy hops next.
function enemyHop(s, e) {
  if (e.kind === "snake") {
    // Chase: the hop that gets closest to the player (or where they were
    // when they took a disc).
    var tr = s.lure ? s.lure.r : s.p.r, tc = s.lure ? s.lure.c : s.p.c
    var best = null, bd = 1e9
    for (var k in DIRS) {
      var nr = e.r + DIRS[k][0], nc = e.c + DIRS[k][1]
      var dist = Math.abs(nr - tr) + Math.abs((nc - nr / 2) - (tc - tr / 2)) * 2
      var ok = onPyramid(nr, nc) || (s.lure && nr === s.lure.r && nc === s.lure.c)
      if (!ok) continue
      if (dist < bd) { bd = dist; best = [nr, nc] }
    }
    return best || [e.r + 1, e.c]
  }
  return Rng.random() < 0.5 ? [e.r + 1, e.c] : [e.r + 1, e.c + 1]
}

function pop(s, r, c, text) { s.pops = s.pops.concat([{ r: r, c: c, text: text, t: 1 }]) }

function die(s) {
  s.lives--
  s.dying = 1.4
  if (s.lives <= 0) s.dead = true
}

function step(state, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.pops = s.pops.map(function(o) { return { r: o.r, c: o.c, text: o.text, t: o.t - dt } }).filter(function(o) { return o.t > 0 })

  if (s.dying > 0) {
    s.dying -= dt
    if (s.dying <= 0 && !s.dead) resetRound(s)
    return s
  }
  if (s.cleared > 0) {
    s.cleared -= dt
    if (s.cleared <= 0) { s.level++; makeLevel(s) }
    return s
  }

  // Disc ride to the top.
  if (s.ride) {
    var ride = shallow(s.ride)
    ride.t += dt / 1.3
    s.ride = ride
    if (ride.t >= 1) {
      s.ride = null
      s.p = { r: 0, c: 0, fr: 0, fc: 0, t: 1, state: "idle" }
    }
  } else {
    // Player hop.
    var p = shallow(s.p)
    if (p.t < 1) {
      p.t = Math.min(1, p.t + dt / HOP)
      if (p.t >= 1) {
        if (onPyramid(p.r, p.c)) { s.p = p; landPlayer(s); p = s.p }
        else {
          var disc = null
          for (var j = 0; j < s.discs.length; ++j) if (!s.discs[j].used && s.discs[j].r === p.r && s.discs[j].c === p.c) disc = j
          if (disc !== null) {
            s.discs = s.discs.map(function(d, k) { return k === disc ? { r: d.r, c: d.c, used: true } : d })
            s.ride = { r: p.r, c: p.c, t: 0 }
            s.lure = { r: p.r, c: p.c }
            s.p = p
          } else { s.p = p; s.p.state = "fall"; die(s); return s }
        }
      }
      if (!s.ride) s.p = p
    } else if (s.queued) s = hopPlayer(s, s.queued)
  }

  if (!s.ride && s.p.t >= 1 && doneTops(s)) {
    var bonus = 1000 + 250 * s.level
    for (var dd = 0; dd < s.discs.length; ++dd) if (!s.discs[dd].used) bonus += 50
    s.score += bonus
    s.msg = "BONUS " + bonus; s.msgT = 1.6
    s.cleared = 1.6
    s.enemies = []
    return s
  }

  // Enemies drop in from above the second row.
  s.freeze = Math.max(0, s.freeze - dt)
  if (s.freeze <= 0) {
    s.spawnT -= dt
    var hasCoily = s.enemies.some(function(e) { return e.kind === "purple" || e.kind === "snake" })
    if (s.spawnT <= 0) {
      var r = Rng.random(), kind = !hasCoily && r < 0.35 ? "purple" : r < 0.85 ? "red" : "green"
      var c0 = Rng.random() < 0.5 ? 0 : 1
      s.enemies = s.enemies.concat([{ kind: kind, r: 1, c: c0, fr: -1, fc: c0, t: 0, wait: 0.2 }])
      s.spawnT = Math.max(1.4, 3.4 - s.level * 0.2) * (0.7 + Rng.random() * 0.6)
    }
    var interval = Math.max(0.42, 0.78 - s.level * 0.04)
    var list = []
    for (var e0 = 0; e0 < s.enemies.length; ++e0) {
      var e = shallow(s.enemies[e0])
      if (e.t < 1) {
        e.t = Math.min(1, e.t + dt / HOP)
        if (e.t >= 1) {
          if (!onPyramid(e.r, e.c)) {
            if (e.kind === "snake") { s.score += 500; pop(s, e.r, e.c, "500"); s.lure = null }
            continue
          }
          e.wait = interval
          if (e.kind === "purple" && e.r === ROWS - 1) { e.kind = "snake"; e.wait = interval * 1.5 }
        }
      } else {
        e.wait -= dt
        if (e.wait <= 0) {
          var to = enemyHop(s, e)
          e.fr = e.r; e.fc = e.c; e.r = to[0]; e.c = to[1]; e.t = 0
        }
      }
      list.push(e)
    }
    s.enemies = list
  }

  if (s.lure && !s.enemies.some(function(e) { return e.kind === "snake" || e.kind === "purple" })) s.lure = null

  // Contact: when both are (nearly) on the same cube.
  if (!s.ride) {
    var pr = s.p.t >= 0.5 ? s.p.r : s.p.fr, pc = s.p.t >= 0.5 ? s.p.c : s.p.fc
    var keep = []
    for (var q = 0; q < s.enemies.length; ++q) {
      var en = s.enemies[q]
      var er = en.t >= 0.5 ? en.r : en.fr, ec = en.t >= 0.5 ? en.c : en.fc
      if (er === pr && ec === pc && onPyramid(pr, pc)) {
        if (en.kind === "green") { s.freeze = 2.5; s.score += 100; pop(s, er, ec, "100"); continue }
        die(s)
        return s
      }
      keep.push(en)
    }
    s.enemies = keep
  }
  return s
}
