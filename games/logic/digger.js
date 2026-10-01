.pragma library
.import "../../engine/Rng.js" as Rng

// Digger (after Dig Dug). Tunnel through the dirt; everywhere you go
// becomes a passage. Your pump shoots a hose a few cells ahead through
// open tunnel: hook a monster and keep pumping until it pops. Round ones
// (Pookas) wander the tunnels; dragons (Fygars) breathe fire along their
// row, through dirt. Either kind can turn to a ghost and drift through
// the dirt toward you. Dig under a rock and it drops, flattening whatever
// is beneath. Clear every monster for the next level. Three lives.
//
// Grid COLS × ROWS; row 0 is sky, row 1 the surface you can walk along.
// Positions are in cells (the player's are fractional; he moves on the
// grid like a maze game, turning only on cell centres).

var COLS = 14
var ROWS = 16
var LIVES = 3
var SPEED = 4.2
var ENEMY_SPEED = 2.4
var HOSE_LEN = 3.2
var HOSE_SPEED = 16

function idx(c, r) { return r * COLS + c }
function inGrid(c, r) { return c >= 0 && c < COLS && r >= 1 && r < ROWS }

function depthPoints(r) { return r < 5 ? 200 : r < 9 ? 300 : r < 12 ? 400 : 500 }

function makeLevel(s) {
  var dug = []
  for (var i = 0; i < COLS * ROWS; ++i) dug.push(i < COLS * 2 ? 1 : 0)
  // The starting shaft down the middle.
  var mid = Math.floor(COLS / 2)
  for (var r = 1; r <= 7; ++r) dug[idx(mid, r)] = 1
  s.dug = dug
  s.p = { x: mid, y: 1, dir: [0, 1], face: 1, moving: false }
  // Monsters in short pre-dug tunnels, away from the shaft.
  var n = Math.min(8, 3 + Math.floor(s.level / 2) + 1)
  s.enemies = []
  var tries = 0
  while (s.enemies.length < n && tries++ < 400) {
    var horiz = Rng.random() < 0.6, len = 3 + Math.floor(Rng.random() * 2)
    var c0 = 1 + Math.floor(Rng.random() * (COLS - 2 - (horiz ? len : 0)))
    var r0 = 4 + Math.floor(Rng.random() * (ROWS - 5 - (horiz ? 0 : len)))
    if (Math.abs(c0 - mid) < 3 && r0 < 9) continue
    var clash = false
    for (var k = 0; k < len; ++k) {
      var cc = c0 + (horiz ? k : 0), rr = r0 + (horiz ? 0 : k)
      if (dug[idx(cc, rr)] || (cc > 0 && dug[idx(cc - 1, rr)] && !horiz) || (rr + 1 < ROWS && dug[idx(cc, rr + 1)] && horiz)) clash = true
    }
    if (clash) continue
    for (var j = 0; j < len; ++j) dug[idx(c0 + (horiz ? j : 0), r0 + (horiz ? 0 : j))] = 1
    var kind = s.enemies.length % 3 === 2 ? "fygar" : "pooka"
    var sc = c0 + (horiz ? 1 : 0), sr = r0 + (horiz ? 0 : 1)
    s.enemies.push(makeEnemy(kind, sc, sr, s.enemies.length))
  }
  // Rocks: in solid dirt with solid dirt beneath.
  s.rocks = []
  var nr = 3 + Math.min(3, Math.floor(s.level / 3))
  tries = 0
  while (s.rocks.length < nr && tries++ < 400) {
    var rc = Math.floor(Rng.random() * COLS), rr2 = 3 + Math.floor(Rng.random() * (ROWS - 6))
    if (dug[idx(rc, rr2)] || dug[idx(rc, rr2 + 1)] || rc === mid) continue
    if (s.rocks.some(function(o) { return Math.abs(o.c - rc) < 2 && Math.abs(o.r - rr2) < 2 })) continue
    s.rocks.push({ c: rc, r: rr2, y: rr2, state: "rest", t: 0, kills: 0 })
  }
  s.hose = null
  s.fires = []
  s.startT = 1.2
  s.msg = "LEVEL " + s.level; s.msgT = 1.5
}

function makeEnemy(kind, c, r, id) {
  return { id: id, face: 1, kind: kind, c: c, r: r, fc: c, fr: r, t: 1, dir: [1, 0], inflate: 0, ghost: false, ghostT: 6 + Rng.random() * 8, fireT: 2 + Rng.random() * 3, charging: 0, gx: c, gy: r, dead: false }
}

function makeState() {
  var s = { level: 1, score: 0, lives: LIVES, t: 0, dead: false, dying: 0, pops: [], msg: "", msgT: 0, clearT: 0 }
  makeLevel(s)
  return s
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }
function copyE(e) { var o = shallow(e); o.dir = e.dir.slice(); return o }

function isDug(s, c, r) { return inGrid(c, r) && s.dug[idx(c, r)] === 1 }
function rockAt(s, c, r) {
  for (var i = 0; i < s.rocks.length; ++i) if (s.rocks[i].c === c && Math.round(s.rocks[i].y) === r && s.rocks[i].state !== "gone") return true
  return false
}

function digAt(s, x, y) {
  var c0 = Math.floor(x + 0.02), c1 = Math.ceil(x - 0.02), r0 = Math.floor(y + 0.02), r1 = Math.ceil(y - 0.02)
  for (var c = c0; c <= c1; ++c) for (var r = r0; r <= r1; ++r) if (inGrid(c, r) && !s.dug[idx(c, r)]) {
    if (s.dug === s._dugShared) { s.dug = s.dug.slice(); s._dugShared = null }
    s.dug[idx(c, r)] = 1
    s.digs = (s.digs || 0) + 1
  }
}

function pop(s, c, r, text) { s.pops = s.pops.concat([{ c: c, r: r, text: text, t: 1 }]) }

function killPlayer(s) {
  if (s.dying > 0) return
  s.lives--
  s.dying = 1.6
  s.hose = null
  if (s.lives <= 0) s.dead = true
}

// Enemy's current drawn position.
function epos(e) { return { x: e.fc + (e.c - e.fc) * e.t, y: e.fr + (e.r - e.fr) * e.t } }

// Pick an enemy's next cell: along tunnels, preferring to close in.
function enemyNext(s, e) {
  var opts = [], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (var i = 0; i < 4; ++i) {
    var nc = e.c + dirs[i][0], nr = e.r + dirs[i][1]
    if (!isDug(s, nc, nr) || rockAt(s, nc, nr) || nr < 2) continue
    opts.push(dirs[i])
  }
  if (!opts.length) return null
  // Mostly keep going, don't reverse unless stuck; lean toward the player.
  var best = null, bv = -1e9
  for (var k = 0; k < opts.length; ++k) {
    var d = opts[k], v = Rng.random() * 2
    if (d[0] === -e.dir[0] && d[1] === -e.dir[1] && opts.length > 1) v -= 3
    if (d[0] === e.dir[0] && d[1] === e.dir[1]) v += 1
    var dx = s.p.x - (e.c + d[0]), dy = s.p.y - (e.r + d[1])
    v -= Math.sqrt(dx * dx + dy * dy) * 0.25
    if (v > bv) { bv = v; best = d }
  }
  return best
}

// input: { dx, dy, pump (held), pumpPress (this tick) }.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s._dugShared = state.dug
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.pops = s.pops.map(function(o) { return { c: o.c, r: o.r - dt, text: o.text, t: o.t - dt } }).filter(function(o) { return o.t > 0 })

  if (s.dying > 0) {
    s.dying -= dt
    if (s.dying <= 0 && !s.dead) {
      // Back to the start; monsters return to their dens.
      var mid = Math.floor(COLS / 2)
      s.p = { x: mid, y: 1, dir: [0, 1], face: 1, moving: false }
      s.enemies = s.enemies.map(function(e) { var n = copyE(e); n.c = n.fc = e.gx; n.r = n.fr = e.gy; n.t = 1; n.inflate = 0; n.ghost = false; return n })
      s.fires = []
      s.startT = 1
    }
    return s
  }
  if (s.clearT > 0) {
    s.clearT -= dt
    if (s.clearT <= 0) { s.level++; makeLevel(s) }
    return s
  }
  if (s.startT > 0) s.startT -= dt

  // ---- player movement (maze-style: turn only on centres) ----
  var p = { x: s.p.x, y: s.p.y, dir: s.p.dir, face: s.p.face, moving: false }
  var hooked = s.hose && s.hose.target >= 0
  var dx = input.dx, dy = dx ? 0 : input.dy
  if ((dx || dy) && !hooked) {
    var mv = SPEED * dt * (isDug(s, Math.round(p.x + dx * 0.6), Math.round(p.y + dy * 0.6)) ? 1 : 0.7)
    if (dx) {
      var ry = Math.round(p.y)
      if (Math.abs(p.y - ry) > 1e-3) { p.y += Math.sign(ry - p.y) * Math.min(mv, Math.abs(ry - p.y)); p.dir = [0, Math.sign(ry - p.y) || 1] }
      else { p.y = ry; p.x = Math.max(0, Math.min(COLS - 1, p.x + dx * mv)); p.dir = [dx, 0]; p.face = dx }
    } else {
      var rx = Math.round(p.x)
      if (Math.abs(p.x - rx) > 1e-3) { p.x += Math.sign(rx - p.x) * Math.min(mv, Math.abs(rx - p.x)); p.dir = [Math.sign(rx - p.x) || 1, 0] }
      else { p.x = rx; p.y = Math.max(1, Math.min(ROWS - 1, p.y + dy * mv)); p.dir = [0, dy] }
    }
    // Rocks are solid.
    var bc = Math.round(p.x + p.dir[0] * 0.45), br = Math.round(p.y + p.dir[1] * 0.45)
    if (rockAt(s, bc, br) && (bc !== Math.round(s.p.x) || br !== Math.round(s.p.y))) { p.x = s.p.x; p.y = s.p.y }
    p.moving = p.x !== s.p.x || p.y !== s.p.y
    if (p.moving) s.hose = null
    digAt(s, p.x, p.y)
  }
  s.p = p

  // ---- pump hose ----
  if (input.pumpPress && !s.hose) s.hose = { len: 0, dir: p.dir.slice(), target: -1, pumpT: 0, out: true }
  if (s.hose) {
    var h = shallow(s.hose)
    if (h.target < 0) {
      h.len += HOSE_SPEED * dt
      // Stops at dirt or a rock; hooks the first monster it reaches.
      var tipX = p.x + h.dir[0] * h.len, tipY = p.y + h.dir[1] * h.len
      var tc = Math.round(tipX), tr = Math.round(tipY)
      for (var i = 0; i < s.enemies.length; ++i) {
        var ep = epos(s.enemies[i])
        if (!s.enemies[i].dead && Math.abs(ep.x - tipX) < 0.6 && Math.abs(ep.y - tipY) < 0.6) { h.target = s.enemies[i].id; h.len = Math.max(0.5, Math.abs(ep.x - p.x) + Math.abs(ep.y - p.y)); break }
      }
      if (h.target < 0 && (h.len >= HOSE_LEN || !isDug(s, tc, tr) || rockAt(s, tc, tr))) h = null
    } else {
      var ti = -1
      for (var f0 = 0; f0 < s.enemies.length; ++f0) if (s.enemies[f0].id === h.target) ti = f0
      var te = ti >= 0 ? s.enemies[ti] : null
      if (!te || te.dead) h = null
      else {
        // Each press (or a steady hold) puffs it up; four and it bursts.
        h.pumpT -= dt
        var puff = input.pumpPress ? 1 : (input.pump && h.pumpT <= 0 ? 1 : 0)
        if (puff) {
          h.pumpT = 0.28
          s.enemies = s.enemies.slice()
          var ne = copyE(te)
          ne.inflate = Math.min(4, ne.inflate + 1)
          s.enemies[ti] = ne
          if (ne.inflate >= 4) {
            ne.dead = true
            var pts = depthPoints(Math.round(epos(ne).y))
            if (ne.kind === "fygar" && h.dir[1] === 0) pts *= 2
            s.score += pts
            pop(s, epos(ne).x, epos(ne).y, String(pts))
            h = null
          }
        }
      }
    }
    s.hose = h
  }

  // ---- rocks ----
  var rocks = []
  for (var q = 0; q < s.rocks.length; ++q) {
    var rk = shallow(s.rocks[q])
    if (rk.state === "rest") {
      var below = isDug(s, rk.c, rk.r + 1)
      var under = Math.abs(p.x - rk.c) < 0.6 && p.y > rk.r && p.y < rk.r + 1.6
      if (below && !under) { rk.state = "wobble"; rk.t = 0.6 }
    } else if (rk.state === "wobble") {
      rk.t -= dt
      if (rk.t <= 0) rk.state = "fall"
    } else if (rk.state === "fall") {
      rk.y += 7 * dt
      var cr = Math.floor(rk.y + 0.5)
      // Crush what's under.
      if (Math.abs(p.x - rk.c) < 0.7 && Math.abs(p.y - rk.y) < 0.7) killPlayer(s)
      for (var m = 0; m < s.enemies.length; ++m) {
        var en = s.enemies[m], eq = epos(en)
        if (!en.dead && Math.abs(eq.x - rk.c) < 0.7 && Math.abs(eq.y - rk.y) < 0.7) {
          s.enemies = s.enemies.slice()
          var dead = copyE(en); dead.dead = true; s.enemies[m] = dead
          rk.kills++
          var bonus = [0, 1000, 2500, 4000, 6000, 8000][Math.min(5, rk.kills)] - [0, 0, 1000, 2500, 4000, 6000][Math.min(5, rk.kills)]
          s.score += bonus
          pop(s, rk.c, rk.y, String(bonus))
        }
      }
      if (!isDug(s, rk.c, cr + 1) || cr + 1 >= ROWS) { rk.state = "gone"; rk.t = 0.4 }
    } else if (rk.state === "gone") { rk.t -= dt; if (rk.t <= 0) continue }
    rocks.push(rk)
  }
  s.rocks = rocks

  // ---- monsters ----
  var list = []
  var speed = ENEMY_SPEED + s.level * 0.12
  for (var e0 = 0; e0 < s.enemies.length; ++e0) {
    var e = copyE(s.enemies[e0])
    if (e.dead) continue
    var held = s.hose && s.hose.target === e.id
    if (e.inflate > 0 && !held) e.inflate = Math.max(0, e.inflate - dt * 0.8)
    if (e.inflate > 0 || s.startT > 0) { list.push(e); continue }

    if (e.ghost) {
      // Drift through the dirt toward the player; settle in a tunnel.
      var g = epos(e), vx = p.x - g.x, vy = p.y - g.y, vl = Math.sqrt(vx * vx + vy * vy) || 1
      var gx = g.x + vx / vl * speed * 0.55 * dt, gy = g.y + vy / vl * speed * 0.55 * dt
      e.fc = gx; e.fr = gy; e.c = gx; e.r = gy; e.t = 1
      e.ghostT -= dt
      var rc2 = Math.round(gx), rr3 = Math.round(gy)
      if (e.ghostT < 0 && isDug(s, rc2, rr3) && rr3 >= 2 && Math.abs(gx - rc2) < 0.15 && Math.abs(gy - rr3) < 0.15) {
        e.ghost = false; e.c = e.fc = rc2; e.r = e.fr = rr3; e.ghostT = 7 + Rng.random() * 8
      }
    } else {
      e.t = Math.min(1, e.t + speed * dt)
      if (e.t >= 1) {
        e.ghostT -= dt * 4
        if (e.ghostT <= 0) { e.ghost = true; e.ghostT = 1.2 }
        else {
          var nd = enemyNext(s, e)
          if (nd) { e.fc = e.c; e.fr = e.r; e.c += nd[0]; e.r += nd[1]; e.dir = nd; e.t = 0 }
        }
      }
      // Dragons breathe along their row when you're in it and close.
      if (e.kind === "fygar") {
        e.fireT -= dt
        var ep2 = epos(e)
        if (e.charging > 0) {
          e.charging -= dt
          if (e.charging <= 0) s.fires = s.fires.concat([{ x: ep2.x, y: Math.round(ep2.y), dir: e.face || 1, t: 0.7 }])
        } else if (e.fireT <= 0 && Math.abs(Math.round(ep2.y) - p.y) < 0.5 && Math.abs(p.x - ep2.x) < 4.5) {
          e.face = p.x > ep2.x ? 1 : -1
          e.charging = 0.6
          e.fireT = 3 + Rng.random() * 2
          e.t = 1
        }
        if (e.dir[0]) e.face = e.dir[0]
      }
    }
    // Touching the player.
    var ep3 = epos(e)
    if (!e.ghost && Math.abs(ep3.x - p.x) < 0.65 && Math.abs(ep3.y - p.y) < 0.65) killPlayer(s)
    if (e.ghost && Math.abs(ep3.x - p.x) < 0.45 && Math.abs(ep3.y - p.y) < 0.45) killPlayer(s)
    list.push(e)
  }
  if (s.hose && s.hose.target >= 0 && !list.some(function(x) { return x.id === s.hose.target })) s.hose = null
  s.enemies = list

  // Fire: reaches three cells out, through dirt.
  s.fires = s.fires.map(function(f) { return { x: f.x, y: f.y, dir: f.dir, t: f.t - dt } }).filter(function(f) { return f.t > 0 })
  for (var fi = 0; fi < s.fires.length; ++fi) {
    var f = s.fires[fi], reach = 3 * Math.min(1, (0.7 - f.t) * 4)
    var lo = Math.min(f.x, f.x + f.dir * reach), hi = Math.max(f.x, f.x + f.dir * reach)
    if (Math.abs(p.y - f.y) < 0.5 && p.x > lo - 0.4 && p.x < hi + 0.4) killPlayer(s)
  }

  if (!s.enemies.length && s.dying <= 0) {
    s.score += 1000
    s.msg = "CLEAR  +1000"; s.msgT = 1.5
    s.clearT = 1.5
  }
  return s
}
