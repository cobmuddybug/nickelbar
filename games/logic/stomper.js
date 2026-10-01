.pragma library

// Stomper: a side-scrolling platformer in the classic mould, with original
// pieces. Run and jump (hold for height), bonk prize blocks from below,
// stomp Gribbles and Shellbacks, grab a Super Berry to grow, and reach the
// flagpole before the clock runs out. Levels are generated from their number,
// so there are endless ones, each a little harder; every piece the generator
// uses (gaps up to 3 wide, pipes up to 3 tall) can be jumped.
//
// Units are tiles; y grows downward. Ground's top surface is row G.

var H = 14
var G = 11
var SOLID = { "#": true, B: true, "?": true, M: true, E: true, p: true }
var RUN = 6.2
var JUMP = 14.5
var GRAV_HELD = 30
var GRAV = 62
var MAXFALL = 22
var LIVES = 3
var TIME = 240
var SMALL = 0.95
var BIG = 1.85
var PW = 0.78

function rng(seed) {
  var a = seed >>> 0
  return function() {
    a = (a + 0x6D2B79F5) >>> 0
    var t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- level generation --------------------------------------------------------------------

function generate(level) {
  var r = rng(level * 7919 + 13)
  var W = Math.min(250, 100 + level * 14), x, y
  var t = []
  for (y = 0; y < H; ++y) { var row = []; for (x = 0; x < W; ++x) row.push(y >= G ? "#" : "."); t.push(row) }
  var spawns = [], col = 10, first = true
  function put(cx, cy, ch) { if (cx >= 0 && cx < W && cy >= 0 && cy < H) t[cy][cx] = ch }
  function enemy(cx, shell) { spawns.push({ type: shell ? "shell" : "gribble", x: cx, y: G - 0.95 }) }
  var gribbleP = Math.min(0.9, 0.5 + 0.05 * level), shellP = level >= 2 ? Math.min(0.5, 0.15 + 0.05 * level) : 0
  while (col < W - 22) {
    var k = r()
    if (first) {                              // an early row of blocks with the first berry
      first = false
      col += 3
      var pat = ["B", "?", "M", "?", "B"]
      for (var i = 0; i < 5; ++i) put(col + i, G - 4, pat[i])
      col += 8
      continue
    }
    if (k < 0.3) {                            // flat run, sometimes with company
      var len = 4 + Math.floor(r() * 4)
      if (r() < gribbleP) enemy(col + 1 + r() * (len - 2), false)
      if (r() < shellP) enemy(col + 2 + r() * (len - 3), true)
      if (r() < 0.3) for (var c = 0; c < 3; ++c) put(col + 1 + c, G - 2, "c")
      col += len
    } else if (k < 0.48) {                    // a gap, jumpable
      var w = 2 + Math.floor(r() * 2)
      for (var gx = 0; gx < w; ++gx) for (y = G; y < H; ++y) put(col + gx, y, ".")
      for (var cc = 0; cc < w; ++cc) put(col + cc, G - 3, "c")
      col += w + 3
    } else if (k < 0.62) {                    // a pipe
      var ph = 2 + Math.floor(r() * 2)
      for (var py = G - ph; py < G; ++py) { put(col, py, "p"); put(col + 1, py, "p") }
      col += 5
    } else if (k < 0.74) {                    // a hill of steps
      var n = 2 + Math.floor(r() * 2)
      for (var s = 0; s < n; ++s) for (var h = 0; h <= s; ++h) put(col + s, G - 1 - h, "#")
      for (var f = 0; f < 2; ++f) for (var h2 = 0; h2 < n; ++h2) put(col + n + f, G - 1 - h2, "#")
      for (var d = 0; d < n; ++d) for (var h3 = 0; h3 < n - 1 - d; ++h3) put(col + n + 2 + d, G - 1 - h3, "#")
      if (r() < 0.5) enemy(col + n + 2.5 + n, false)
      col += n * 2 + 5
    } else if (k < 0.9) {                     // a row of blocks over a flat
      var bl = 3 + Math.floor(r() * 3), chars = ["B", "?", "B", "?", "B"]
      for (var b = 0; b < bl; ++b) put(col + 1 + b, G - 4, r() < 0.1 ? "M" : chars[b % 5])
      if (r() < gribbleP) enemy(col + 2 + r() * bl, false)
      if (r() < 0.4) enemy(col + 1 + r() * bl, level >= 2)
      col += bl + 4
    } else {                                  // a coin arc
      for (var a = 0; a < 5; ++a) put(col + 1 + a, G - 2 - Math.round(Math.sin(a / 4 * Math.PI) * 2), "c")
      col += 8
    }
  }
  // Stairs up to the flagpole.
  var sx = W - 18
  for (var st = 0; st < 4; ++st) for (var sh = 0; sh <= st; ++sh) put(sx + st, G - 1 - sh, "#")
  var fx = W - 9
  for (var fy = G - 9; fy < G; ++fy) put(fx, fy, "F")
  return { tiles: t, W: W, spawns: spawns, flagX: fx }
}

// ---- state ---------------------------------------------------------------------------------

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function mkEnt(sp) {
  return { type: sp.type, x: sp.x, y: sp.y, vx: -(sp.type === "shell" ? 1.3 : 1.6), vy: 0, w: 0.85, h: sp.type === "shell" ? 1.2 : 0.9, mode: "walk", dead: 0, ground: false }
}

function makeState(level, carry) {
  level = level || 1
  var lv = generate(level), c = carry || {}
  return {
    level: level, tiles: lv.tiles, W: lv.W, flagX: lv.flagX,
    p: { x: 2, y: G - SMALL, vx: 0, vy: 0, big: false, ground: true, dir: 1, inv: 0, coyote: 0, dead: false, anim: 0, h: SMALL, w: PW },
    ents: lv.spawns.map(mkEnt), pops: [], bits: [], ev: [],
    coins: c.coins || 0, score: c.score || 0, lives: c.lives === undefined ? [5, 3, 2][LEVEL] : c.lives,
    time: [300, TIME, 200][LEVEL], cam: 0, t: 0, jumpBuf: 0, jumpHeld: false,
    status: "play", timer: 0, flagBonus: 0, view: 16, rev: 0, done: false
  }
}

function solidAt(s, tx, ty) {
  if (tx < 0 || tx >= s.W) return true
  if (ty < 0 || ty >= H) return false
  return !!SOLID[s.tiles[ty][tx]]
}

// Moves a box with the tile collisions; returns { wall, floor, ceil: {tx, ty} }.
function move(s, e, dt) {
  var res = { wall: false, floor: false, ceil: null }, eps = 0.001, tx, ty
  e.x += e.vx * dt
  var y0 = Math.floor(e.y), y1 = Math.floor(e.y + e.h - eps)
  if (e.vx > 0) {
    tx = Math.floor(e.x + e.w)
    for (ty = y0; ty <= y1; ++ty) if (solidAt(s, tx, ty)) { e.x = tx - e.w - eps; e.vx = 0; res.wall = true; break }
  } else if (e.vx < 0) {
    tx = Math.floor(e.x)
    for (ty = y0; ty <= y1; ++ty) if (solidAt(s, tx, ty)) { e.x = tx + 1 + eps; e.vx = 0; res.wall = true; break }
  }
  e.y += e.vy * dt
  var x0 = Math.floor(e.x), x1 = Math.floor(e.x + e.w - eps)
  if (e.vy > 0) {
    ty = Math.floor(e.y + e.h)
    for (tx = x0; tx <= x1; ++tx) if (solidAt(s, tx, ty)) { e.y = ty - e.h - eps; e.vy = 0; res.floor = true; break }
  } else if (e.vy < 0) {
    ty = Math.floor(e.y)
    var best = -1, bd = 9
    for (tx = x0; tx <= x1; ++tx) if (solidAt(s, tx, ty)) { var d = Math.abs(tx + 0.5 - (e.x + e.w / 2)); if (d < bd) { bd = d; best = tx } }
    if (best >= 0) { e.y = ty + 1 + eps; e.vy = 0; res.ceil = { tx: best, ty: ty } }
  }
  return res
}

function approach(v, target, a) { return v < target ? Math.min(target, v + a) : Math.max(target, v - a) }
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }

function setBig(s, big) {
  var p = s.p
  if (p.big === big) return
  p.big = big
  var nh = big ? BIG : SMALL
  p.y += p.h - nh; p.h = nh
}

function pop(s, x, y, text) { s.pops.push({ x: x, y: y, text: text, life: 0.8 }) }
function addScore(s, n, x, y) { s.score += n; if (x !== undefined) pop(s, x, y, String(n)) }

function bump(s, tx, ty) {
  var ch = s.tiles[ty][tx]
  if (ch === "?") {
    s.tiles[ty][tx] = "E"; s.coins++; addScore(s, 100, tx + 0.5, ty - 0.2); s.ev.push("coin")
    if (s.coins >= 100) { s.coins -= 100; s.lives++; s.ev.push("power") }
  } else if (ch === "M") {
    s.tiles[ty][tx] = "E"
    s.ents.push({ type: "berry", x: tx + 0.1, y: ty - 0.9, vx: 2.6, vy: -5, w: 0.8, h: 0.8, mode: "walk", dead: 0, ground: false })
    s.ev.push("bump")
  } else if (ch === "B") {
    if (s.p.big) {
      s.tiles[ty][tx] = "."; addScore(s, 50); s.ev.push("bump")
      for (var i = 0; i < 4; ++i) s.bits.push({ x: tx + 0.5, y: ty + 0.5, vx: (i % 2 ? 1 : -1) * (2 + i), vy: -8 - (i >> 1) * 3, life: 1 })
    } else s.ev.push("bump")
  } else return
  // Anything standing on the bumped block takes a knock.
  s.ents.forEach(function(e) {
    if (e.dead || e.type === "berry") return
    if (Math.abs(e.x + e.w / 2 - tx - 0.5) < 0.9 && Math.abs(e.y + e.h - ty) < 0.25) { e.dead = 0.6; e.mode = "knocked"; e.vy = -6; addScore(s, 100, e.x, e.y) }
  })
}

function hurt(s) {
  var p = s.p
  if (p.inv > 0 || s.status !== "play") return
  if (p.big) { setBig(s, false); p.inv = 1.6; s.ev.push("bump"); return }
  die(s)
}

function die(s) {
  s.status = "dead"; s.timer = 0; s.p.dead = true; s.p.vy = -12; s.p.vx = 0; s.ev.push("die")
}

function jump(s) { s.jumpBuf = 0.13; return s }

function updatePlayer(s, dt, dx) {
  var p = s.p
  p.inv = Math.max(0, p.inv - dt)
  var target = dx * RUN
  p.vx = approach(p.vx, target, (dx ? (p.ground ? 42 : 24) : (p.ground ? 38 : 6)) * dt)
  if (dx) p.dir = dx
  if (p.ground) p.coyote = 0.1; else p.coyote -= dt
  s.jumpBuf -= dt
  if (s.jumpBuf > 0 && (p.ground || p.coyote > 0)) { p.vy = -JUMP; p.ground = false; p.coyote = 0; s.jumpBuf = 0; s.ev.push("jump") }
  p.vy = Math.min(MAXFALL, p.vy + ((p.vy < 0 && s.jumpHeld) ? GRAV_HELD : GRAV) * dt)
  var res = move(s, p, dt)
  p.ground = res.floor
  if (res.ceil) bump(s, res.ceil.tx, res.ceil.ty)
  if (p.x < s.cam) { p.x = s.cam; if (p.vx < 0) p.vx = 0 }
  p.anim += Math.abs(p.vx) * dt
  // Coins and the flagpole.
  var x0 = Math.floor(p.x), x1 = Math.floor(p.x + PW), y0 = Math.floor(p.y), y1 = Math.floor(p.y + p.h - 0.01)
  for (var ty = y0; ty <= y1; ++ty) for (var tx = x0; tx <= x1; ++tx) {
    if (ty < 0 || ty >= H || tx < 0 || tx >= s.W) continue
    var ch = s.tiles[ty][tx]
    if (ch === "c") { s.tiles[ty][tx] = "."; s.coins++; addScore(s, 100, tx + 0.5, ty); s.ev.push("coin") }
    else if (ch === "F" && s.status === "play") {
      s.status = "clear"; s.timer = 0; s.flagBonus = Math.max(100, Math.round((G - p.y) * 200 / 100) * 100)
      addScore(s, s.flagBonus, p.x, p.y - 1); p.vx = 0; p.vy = 0; s.ev.push("flag")
      p.x = s.flagX - 0.3
    }
  }
  if (p.y > H + 1) die(s)
}

function updateEnts(s, dt) {
  var p = s.p, alive = []
  s.ents.forEach(function(e) {
    if (e.dead > 0) {                              // knocked off: tumbles away
      e.dead -= dt; e.vy += GRAV * dt; e.y += e.vy * dt; e.x += (e.vx || 1) * dt * 0.5
      if (e.dead > 0) alive.push(e)
      return
    }
    if (Math.abs(e.x - p.x) > 18 && e.type !== "berry" && e.mode !== "slide") { alive.push(e); return }
    e.vy = Math.min(MAXFALL, e.vy + GRAV * 0.8 * dt)
    var wasSliding = e.mode === "slide"
    var res = move(s, e, dt)
    if (res.wall) { e.vx = -Math.sign(e.lastVx || -1) * Math.abs(e.mode === "slide" ? 9 : e.type === "berry" ? 2.6 : e.type === "shell" ? 1.3 : 1.6); if (e.mode === "slide") s.ev.push("bump") }
    e.lastVx = e.vx || e.lastVx
    e.ground = res.floor
    if (e.y > H + 2) return
    // Sliding shells flatten what they touch.
    if (wasSliding) s.ents.forEach(function(o) {
      if (o !== e && !o.dead && o.type !== "berry" && overlap(e, o)) { o.dead = 0.7; o.mode = "knocked"; o.vy = -7; o.vx = e.vx; addScore(s, 200, o.x, o.y); s.ev.push("stomp") }
    })
    // Meeting the player.
    if (s.status === "play" && overlap(p, e)) {
      if (e.type === "berry") { e.dead = 0.001; e.gone = true; addScore(s, 1000, e.x, e.y - 0.5); setBig(s, true); s.ev.push("power"); return }
      var feet = p.y + p.h - e.y
      if (e.mode === "shellstill") {
        e.mode = "slide"; e.vx = (p.x + PW / 2 < e.x + e.w / 2 ? 1 : -1) * 9; e.lastVx = e.vx; s.ev.push("stomp"); addScore(s, 400, e.x, e.y); e.kickCool = 0.25
      } else if (p.vy > 0 && feet < 0.75) {
        p.vy = -9; s.ev.push("stomp")
        if (e.type === "gribble") { e.dead = 0.5; e.mode = "squashed"; e.h = 0.35; e.y += 0.55; e.vx = 0; addScore(s, 100, e.x, e.y - 0.4) }
        else if (e.mode === "slide") { e.mode = "shellstill"; e.vx = 0; addScore(s, 100, e.x, e.y) }
        else { e.mode = "shellstill"; e.vx = 0; e.h = 0.8; e.y += 0.4; addScore(s, 100, e.x, e.y - 0.4) }
      } else if (!(e.kickCool > 0)) hurt(s)
    }
    if (e.kickCool > 0) e.kickCool -= dt
    if (e.gone) return
    if (e.mode === "squashed") { e.dead = 0.4; alive.push(e); return }
    alive.push(e)
  })
  s.ents = alive
}

function step(state, dt, inp) {
  var s = state
  inp = inp || {}
  s.ev = []
  s.view = inp.view || s.view
  s.jumpHeld = !!inp.jump
  s.t += dt; s.rev++
  s.pops = s.pops.filter(function(q) { q.life -= dt; q.y -= dt * 1.2; return q.life > 0 })
  s.bits = s.bits.filter(function(b) { b.vy += 40 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; return b.life > 0 })
  if (s.status === "play") {
    s.time -= dt
    if (s.time <= 0) { s.time = 0; die(s) }
    else { updatePlayer(s, dt, inp.dx || 0); if (s.status === "play") updateEnts(s, dt) }
  } else if (s.status === "dead") {
    s.timer += dt
    s.p.vy += GRAV * dt; s.p.y += s.p.vy * dt
    if (s.timer > 2.2) {
      if (s.lives <= 1) { s.lives = 0; s.status = "over"; s.done = true }
      else { var n = makeState(s.level, { score: s.score, coins: s.coins, lives: s.lives - 1 }); n.view = s.view; return n }
    }
  } else if (s.status === "clear") {
    s.timer += dt
    var p = s.p
    if (s.timer < 0.9) p.y = Math.min(G - p.h, p.y + 7 * dt)
    else { p.dir = 1; p.vx = 3.5; var res = move(s, p, dt); p.ground = res.floor; p.vy = Math.min(MAXFALL, p.vy + GRAV * dt); p.anim += 3.5 * dt }
    if (s.timer > 2.6) {
      var bonus = Math.round(s.time) * 10
      var nx = makeState(s.level + 1, { score: s.score + bonus, coins: s.coins, lives: s.lives })
      nx.view = s.view; nx.bonus = bonus; nx.ev = ["flag"]
      return nx
    }
  }
  // Camera: follows the hero, never scrolls back.
  var want = Math.min(s.W - s.view, Math.max(0, s.p.x - s.view * 0.4))
  if (want > s.cam) s.cam = want
  return s
}

function serialize(s) { return { level: s.level, score: s.score, coins: s.coins, lives: s.lives } }
function deserialize(o) {
  if (!o || typeof o.level !== "number" || typeof o.lives !== "number" || o.lives <= 0) return null
  return makeState(o.level, { score: o.score || 0, coins: o.coins || 0, lives: o.lives })
}
