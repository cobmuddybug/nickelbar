.pragma library
.import "../../engine/Rng.js" as Rng

// Swarm (after Galaga). A formation hangs at the top of the screen,
// swaying; every so often a few peel off, loop over and dive at you,
// shooting, then come round again from the top. The bosses on the back
// row take two hits. Divers are worth double (bosses more). Clear the
// formation for the next stage. Three ships; an extra one at 20,000.
//
// Units: W × H, y down.

var W = 14
var H = 18
var PLAYER_Y = H - 1.2
var PLAYER_SPEED = 9
var SHOT_SPEED = 22
var MAX_SHOTS = 2
var ENEMY_SHOT = 8
var LIVES = 3
var ROWS = [
  { kind: "boss", n: 4, pts: 150, dive: 400, hp: 2 },
  { kind: "moth", n: 8, pts: 80, dive: 160, hp: 1 },
  { kind: "moth", n: 8, pts: 80, dive: 160, hp: 1 },
  { kind: "bee", n: 10, pts: 50, dive: 100, hp: 1 },
  { kind: "bee", n: 10, pts: 50, dive: 100, hp: 1 }
]

function slotOf(e, t) {
  // The formation sways side to side, and breathes a little.
  var sway = Math.sin(t * 0.7) * 1.2
  var breathe = 1 + Math.sin(t * 1.3) * 0.04
  return { x: W / 2 + (e.sx - W / 2) * breathe + sway, y: e.sy }
}

function makeEnemies(stage) {
  var out = [], id = 0
  for (var r = 0; r < ROWS.length; ++r) {
    var row = ROWS[r], gap = 1.15
    for (var c = 0; c < row.n; ++c) {
      var sx = W / 2 + (c - (row.n - 1) / 2) * gap, sy = 1.6 + r * 1.05
      // Everyone flies in from above, a column at a time.
      out.push({ id: id++, kind: row.kind, row: r, hp: row.hp, sx: sx, sy: sy, mode: "return",
                 x: sx + (c % 2 ? 3 : -3), y: -1 - r * 0.6 - (c % 4) * 0.5, th: 0, side: 1, tx: 0, fired: 0 })
    }
  }
  return out
}

function makeState() {
  return {
    stage: 1, score: 0, lives: LIVES, px: W / 2, shots: [], bombs: [], enemies: makeEnemies(1),
    t: 0, diveT: 3, dead: false, respawn: 0, cool: 0, prevFire: false, pops: [], booms: [],
    extraAt: 20000, stageMsg: 2, hits: 0, fired: 0
  }
}

function shallow(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

function copyE(e) { var o = {}; for (var k in e) o[k] = e[k]; return o }

function addScore(s, n) { s.score += n; if (s.score >= s.extraAt) { s.lives++; s.extraAt += 30000 } }

function startDive(s, e) {
  e.mode = "loop"; e.th = 0; e.side = e.sx < W / 2 ? -1 : 1
  var sl = slotOf(e, s.t)
  e.cx = sl.x + e.side * 1.1; e.cy = sl.y
  e.fired = 0
}

// input: { dx, fire (held) }.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.t += dt
  s.stageMsg = Math.max(0, s.stageMsg - dt)
  s.pops = s.pops.map(function(p) { return { x: p.x, y: p.y - dt, text: p.text, t: p.t - dt } }).filter(function(p) { return p.t > 0 })
  s.booms = s.booms.map(function(b) { return { x: b.x, y: b.y, t: b.t - dt, c: b.c } }).filter(function(b) { return b.t > 0 })

  var alive = s.respawn <= 0
  if (!alive) {
    s.respawn -= dt
    // Wait for the divers to clear before bringing the next ship on.
    if (s.respawn <= 0 && s.enemies.some(function(e) { return e.mode === "dive" && e.y > H * 0.5 })) s.respawn = 0.2
  }

  if (alive) {
    s.px = Math.max(0.6, Math.min(W - 0.6, s.px + input.dx * PLAYER_SPEED * dt))
    var pressed = input.fire && !s.prevFire
    s.cool = Math.max(0, s.cool - dt)
    if ((pressed || (input.fire && s.cool <= 0)) && s.shots.length < MAX_SHOTS) {
      s.shots = s.shots.concat([{ x: s.px, y: PLAYER_Y - 0.6 }])
      s.cool = 0.25; s.fired++
    }
  }
  s.prevFire = input.fire

  s.shots = s.shots.map(function(b) { return { x: b.x, y: b.y - SHOT_SPEED * dt } }).filter(function(b) { return b.y > -0.5 })
  s.bombs = s.bombs.map(function(b) { return { x: b.x + b.vx * dt, y: b.y + ENEMY_SHOT * dt, vx: b.vx } }).filter(function(b) { return b.y < H + 0.5 })

  // Launch a dive now and then: one to three at a time, more as stages go.
  s.diveT -= dt
  var inForm = s.enemies.filter(function(e) { return e.mode === "form" })
  if (s.diveT <= 0 && inForm.length) {
    var n = Math.min(inForm.length, 1 + Math.floor(Rng.random() * Math.min(3, 1 + s.stage / 2)))
    var list = s.enemies.map(copyE)
    for (var d = 0; d < n; ++d) {
      var pick = inForm[Math.floor(Rng.random() * inForm.length)]
      for (var q = 0; q < list.length; ++q) if (list[q].id === pick.id && list[q].mode === "form") startDive(s, list[q])
    }
    s.enemies = list
    s.diveT = Math.max(0.7, 2.6 - s.stage * 0.2) * (0.6 + Rng.random() * 0.8)
  }

  // Move enemies.
  var speed = 6.5 + s.stage * 0.4
  var enemies = []
  for (var i = 0; i < s.enemies.length; ++i) {
    var e = copyE(s.enemies[i]), sl = slotOf(e, s.t)
    if (e.mode === "form") { e.x = sl.x; e.y = sl.y }
    else if (e.mode === "return") {
      var dx = sl.x - e.x, dy = sl.y - e.y, dd = Math.sqrt(dx * dx + dy * dy)
      if (dd < speed * dt) { e.mode = "form"; e.x = sl.x; e.y = sl.y }
      else { e.x += dx / dd * speed * dt; e.y += dy / dd * speed * dt }
    } else if (e.mode === "loop") {
      e.th += dt * 4.2
      e.x = e.cx - e.side * Math.cos(e.th) * 1.1
      e.y = e.cy - Math.sin(e.th) * 1.1
      if (e.th >= Math.PI) { e.mode = "dive"; e.tx = s.px }
    } else if (e.mode === "dive") {
      e.tx += (s.px - e.tx) * dt * 0.8
      e.x += Math.max(-5, Math.min(5, (e.tx - e.x) * 1.6)) * dt + Math.sin(s.t * 3 + e.id) * 2.2 * dt
      e.y += speed * dt
      if (alive && e.fired < 2 && e.y > 4 && e.y < H * 0.65 && Rng.random() < dt * 1.4) {
        e.fired++
        s.bombs = s.bombs.concat([{ x: e.x, y: e.y + 0.4, vx: (s.px - e.x) * 0.15 }])
      }
      if (e.y > H + 1) { e.mode = "return"; e.y = -1; e.x = sl.x }
    }
    enemies.push(e)
  }

  // Shots against enemies.
  var shots = []
  for (var b = 0; b < s.shots.length; ++b) {
    var sh = s.shots[b], used = false
    for (var j = 0; j < enemies.length && !used; ++j) {
      var en = enemies[j]
      if (en.dead) continue
      if (Math.abs(en.x - sh.x) < 0.5 && Math.abs(en.y - sh.y) < 0.45) {
        used = true; s.hits++
        en.hp--
        if (en.hp <= 0) {
          en.dead = true
          var row = ROWS[en.row], pts = en.mode === "form" || en.mode === "return" ? row.pts : row.dive
          addScore(s, pts)
          if (pts >= 150) s.pops = s.pops.concat([{ x: en.x, y: en.y, text: String(pts), t: 0.9 }])
          s.booms = s.booms.concat([{ x: en.x, y: en.y, t: 0.35, c: en.kind }])
        }
      }
    }
    if (!used) shots.push(sh)
  }
  s.shots = shots
  s.enemies = enemies.filter(function(e) { return !e.dead })

  // Anything hitting the ship.
  if (alive) {
    var hit = false
    for (var k = 0; k < s.bombs.length; ++k) if (Math.abs(s.bombs[k].x - s.px) < 0.45 && Math.abs(s.bombs[k].y - PLAYER_Y) < 0.5) hit = true
    var rest = []
    for (var m = 0; m < s.enemies.length; ++m) {
      var ee = s.enemies[m]
      if (ee.mode === "dive" && Math.abs(ee.x - s.px) < 0.75 && Math.abs(ee.y - PLAYER_Y) < 0.7) {
        hit = true
        addScore(s, ROWS[ee.row].dive)
        s.booms = s.booms.concat([{ x: ee.x, y: ee.y, t: 0.35, c: ee.kind }])
        continue
      }
      rest.push(ee)
    }
    s.enemies = rest
    if (hit) {
      s.lives--
      s.booms = s.booms.concat([{ x: s.px, y: PLAYER_Y, t: 0.8, c: "ship" }])
      s.bombs = []; s.shots = []
      if (s.lives <= 0) { s.dead = true; return s }
      s.respawn = 1.6; s.px = W / 2
    }
  }

  if (!s.enemies.length) {
    s.stage++
    s.enemies = makeEnemies(s.stage)
    s.stageMsg = 2
    s.diveT = 3
    s.bombs = []
  }
  return s
}
