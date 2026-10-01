.pragma library
.import "../../engine/Rng.js" as Rng

// Centipede. The centipede winds down through a field of mushrooms,
// turning at every wall and mushroom; shoot a segment and it becomes a
// mushroom and the chain splits, the piece behind growing a head of its
// own. A spider zigzags through your patch at the bottom and a flea drops
// straight down, seeding mushrooms, when that patch is thin. Clear the
// centipede for the next, faster one. Three lives.
//
// Grid: COLS × ROWS cells; the player lives in the bottom ZONE rows and
// moves freely (fractional cells). Positions below are in cells.

var COLS = 25
var ROWS = 30
var ZONE = 6
var LEN = 11
var LIVES = 3
var PLAYER_SPEED = 13
var BULLET_SPEED = 55
var MUSH_HP = 4

function key(c, r) { return r * COLS + c }

function makeMushrooms(n) {
  var m = {}
  for (var i = 0; i < n; ++i) {
    var c = Math.floor(Rng.random() * COLS), r = 1 + Math.floor(Rng.random() * (ROWS - ZONE - 2))
    m[key(c, r)] = MUSH_HP
  }
  return m
}

// A new centipede enters at the top: one long chain, and from wave 2 some
// lone heads dropping in elsewhere too.
function makeCentipede(wave) {
  var segs = [], id = 0
  var heads = Math.min(4, wave - 1), body = LEN - heads
  var dir = Rng.random() < 0.5 ? 1 : -1
  var c0 = Math.floor(COLS / 2)
  for (var i = 0; i < body; ++i) segs.push({ id: id++, c: c0 - dir * i, r: 0, dir: dir, vdir: 1, lead: i ? id - 2 : -1, pc: c0 - dir * i, pr: 0 })
  for (var h = 0; h < heads; ++h) {
    var hc = Math.floor(Rng.random() * COLS)
    segs.push({ id: id++, c: hc, r: 0, dir: Rng.random() < 0.5 ? 1 : -1, vdir: 1, lead: -1, pc: hc, pr: 0 })
  }
  return { segs: segs, nextId: id }
}

function makeState() {
  var s = {
    mush: makeMushrooms(42), wave: 1, lives: LIVES, score: 0,
    p: { x: COLS / 2, y: ROWS - 1.5 }, bullet: null, cool: 0,
    moveT: 0, moveEvery: 0.075, spider: null, spiderT: 4, flea: null,
    dying: 0, dead: false, pops: [], extraAt: 12000
  }
  var c = makeCentipede(1)
  s.segs = c.segs; s.nextId = c.nextId
  return s
}

function shallow(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

function blocked(s, c, r) { return c < 0 || c >= COLS || (s.mush[key(c, r)] > 0) }

// One grid step for every segment. Each follows the same rule, so a chain
// traces its head's path: carry on sideways unless the next cell is a
// wall or mushroom, in which case drop (or climb) a row and turn round.
function stepSegs(s) {
  var segs = []
  for (var i = 0; i < s.segs.length; ++i) {
    var g = s.segs[i], n = { id: g.id, c: g.c, r: g.r, dir: g.dir, vdir: g.vdir, lead: g.lead, pc: g.c, pr: g.r }
    var nc = g.c + g.dir
    if (blocked(s, nc, g.r) || nc < 0 || nc >= COLS) {
      if (g.r + g.vdir >= ROWS) n.vdir = -1
      else if (g.r + g.vdir < ROWS - ZONE && g.vdir < 0) n.vdir = 1
      n.r = g.r + n.vdir
      n.dir = -g.dir
    } else n.c = nc
    segs.push(n)
  }
  s.segs = segs
}

function pop(s, x, y, text) { s.pops = s.pops.concat([{ x: x, y: y, text: text, t: 0.8 }]) }

function addScore(s, n) {
  s.score += n
  if (s.score >= s.extraAt) { s.lives++; s.extraAt += 12000 }
}

function hitMushroom(s, k) {
  s.mush = shallow(s.mush)
  s.mush[k]--
  if (s.mush[k] <= 0) { delete s.mush[k]; addScore(s, 1) }
}

function loseLife(s) {
  s.lives--
  s.dying = 1.2
  s.bullet = null
  if (s.lives <= 0) { s.dead = true; return }
  // Heal the damaged mushrooms (5 each), bring the centipede back up top.
  var m = {}
  for (var k in s.mush) { if (s.mush[k] < MUSH_HP) addScore(s, 5); m[k] = MUSH_HP }
  s.mush = m
  var c = makeCentipede(s.wave)
  s.segs = c.segs; s.nextId = c.nextId
  s.spider = null; s.flea = null; s.spiderT = 3
  s.p = { x: COLS / 2, y: ROWS - 1.5 }
}

function touches(px, py, x, y, r) { return Math.abs(px - x) < r && Math.abs(py - y) < r }

// input: { dx, dy, fire }.
function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.pops = s.pops.map(function(p) { return { x: p.x, y: p.y - dt * 2, text: p.text, t: p.t - dt } }).filter(function(p) { return p.t > 0 })
  if (s.dying > 0) { s.dying = Math.max(0, s.dying - dt); return s }

  // Player: free movement in the zone, blocked by mushrooms.
  var p = { x: s.p.x, y: s.p.y }
  var len = Math.sqrt(input.dx * input.dx + input.dy * input.dy) || 1
  var nx = Math.max(0.5, Math.min(COLS - 0.5, p.x + input.dx / len * PLAYER_SPEED * dt))
  var ny = Math.max(ROWS - ZONE + 0.5, Math.min(ROWS - 0.5, p.y + input.dy / len * PLAYER_SPEED * dt))
  if (!s.mush[key(Math.floor(nx), Math.floor(p.y))] && !s.mush[key(Math.floor(nx + (input.dx > 0 ? 0.4 : -0.4)), Math.floor(p.y))]) p.x = nx
  if (!s.mush[key(Math.floor(p.x), Math.floor(ny))] && !s.mush[key(Math.floor(p.x), Math.floor(ny + (input.dy > 0 ? 0.4 : -0.4)))]) p.y = ny
  s.p = p

  // One shot on screen at a time; holding fire keeps shooting.
  s.cool = Math.max(0, s.cool - dt)
  if (input.fire && !s.bullet && s.cool <= 0) { s.bullet = { x: p.x, y: p.y - 0.5 }; s.cool = 0.05 }

  if (s.bullet) {
    var b = { x: s.bullet.x, y: s.bullet.y }, dist = BULLET_SPEED * dt, stepLen = 0.4, done = false
    for (var d = 0; d < dist && !done; d += stepLen) {
      b.y -= Math.min(stepLen, dist - d)
      if (b.y < 0) { done = true; break }
      var bc = Math.floor(b.x), br = Math.floor(b.y)
      // Segments.
      for (var i = 0; i < s.segs.length; ++i) {
        var g = s.segs[i]
        if (g.c === bc && g.r === br) {
          var head = g.lead < 0 || !s.segs.some(function(o) { return o.id === g.lead })
          addScore(s, head ? 100 : 10)
          pop(s, g.c + 0.5, g.r, head ? "100" : "10")
          s.segs = s.segs.filter(function(o) { return o.id !== g.id }).map(function(o) {
            return o.lead === g.id ? { id: o.id, c: o.c, r: o.r, dir: o.dir, vdir: o.vdir, lead: -1, pc: o.pc, pr: o.pr } : o
          })
          s.mush = shallow(s.mush)
          if (g.r < ROWS - 1) s.mush[key(g.c, g.r)] = MUSH_HP
          done = true
          break
        }
      }
      if (done) break
      var mk = key(bc, br)
      if (s.mush[mk] > 0) { hitMushroom(s, mk); done = true; break }
      if (s.spider && touches(b.x, b.y, s.spider.x, s.spider.y, 0.9)) {
        var dy = p.y - s.spider.y, pts = dy < 2 ? 900 : dy < 4 ? 600 : 300
        addScore(s, pts); pop(s, s.spider.x, s.spider.y, String(pts))
        s.spider = null; s.spiderT = 3 + Rng.random() * 4
        done = true; break
      }
      if (s.flea && touches(b.x, b.y, s.flea.x, s.flea.y, 0.7)) {
        s.flea.hp--
        if (s.flea.hp <= 0) { addScore(s, 200); pop(s, s.flea.x, s.flea.y, "200"); s.flea = null }
        done = true; break
      }
    }
    s.bullet = done ? null : b
  }

  // Centipede steps on a clock that quickens with each wave.
  s.moveT += dt
  var every = Math.max(0.035, s.moveEvery - (s.wave - 1) * 0.006)
  s.frac = 0
  while (s.moveT >= every) { s.moveT -= every; stepSegs(s) }
  s.frac = s.moveT / every

  if (!s.segs.length) {
    s.wave++
    var c = makeCentipede(s.wave)
    s.segs = c.segs; s.nextId = c.nextId
  }

  // Spider: bounces diagonally about the zone, nibbling mushrooms.
  if (!s.spider) {
    s.spiderT -= dt
    if (s.spiderT <= 0) {
      var fromLeft = Rng.random() < 0.5
      s.spider = { x: fromLeft ? -0.5 : COLS + 0.5, y: ROWS - ZONE + 1, vx: (fromLeft ? 1 : -1) * (4 + s.wave * 0.3), vy: 7 }
    }
  } else {
    var sp = { x: s.spider.x + s.spider.vx * dt, y: s.spider.y + s.spider.vy * dt, vx: s.spider.vx, vy: s.spider.vy }
    if (sp.y > ROWS - 0.5) { sp.y = ROWS - 0.5; sp.vy = -Math.abs(sp.vy) }
    if (sp.y < ROWS - ZONE - 1) { sp.y = ROWS - ZONE - 1; sp.vy = Math.abs(sp.vy) * (0.6 + Rng.random() * 0.8) }
    if (Rng.random() < dt * 0.8) sp.vy = -sp.vy
    var sk = key(Math.floor(sp.x), Math.floor(sp.y))
    if (s.mush[sk] && Rng.random() < dt * 4) { s.mush = shallow(s.mush); delete s.mush[sk] }
    s.spider = sp.x < -1.5 || sp.x > COLS + 1.5 ? null : sp
    if (!s.spider) s.spiderT = 2 + Rng.random() * 4
  }

  // Flea: when the player's patch has few mushrooms, drops and seeds more.
  if (!s.flea && s.wave >= 2) {
    var inZone = 0
    for (var mk2 in s.mush) if (Math.floor(mk2 / COLS) >= ROWS - ZONE) inZone++
    if (inZone < 5 && Rng.random() < dt * 0.5) s.flea = { x: Math.floor(Rng.random() * COLS) + 0.5, y: -0.5, hp: 2 }
  } else if (s.flea) {
    var f = { x: s.flea.x, y: s.flea.y + dt * 14, hp: s.flea.hp }
    if (Math.floor(f.y) !== Math.floor(s.flea.y) && f.y < ROWS - 1 && Rng.random() < 0.3) { s.mush = shallow(s.mush); s.mush[key(Math.floor(f.x), Math.floor(f.y))] = MUSH_HP }
    s.flea = f.y > ROWS + 1 ? null : f
  }

  // Anything touching the player.
  var hit = false
  for (var j = 0; j < s.segs.length && !hit; ++j) if (touches(p.x, p.y, s.segs[j].c + 0.5, s.segs[j].r + 0.5, 0.8)) hit = true
  if (s.spider && touches(p.x, p.y, s.spider.x, s.spider.y, 0.9)) hit = true
  if (s.flea && touches(p.x, p.y, s.flea.x, s.flea.y, 0.7)) hit = true
  if (hit) loseLife(s)
  return s
}

