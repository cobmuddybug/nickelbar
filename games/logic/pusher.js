.pragma library
.import "../../engine/Rng.js" as Rng

// Coin pusher, seen from above. A shelf slides back and forth at the back
// of the table; drop a coin and it lands in front of it, to be shoved into
// the coins already there. Coins pushed over the front edge are won; over
// the sides, lost. Now and then a bonus token (worth 10) sits in the pile.
// Winnings drop into your tray to play again. You start with 25 coins;
// score is everything you win before your tray runs dry.
//
// Table x 0..1, y 0 (back) .. 1 (front edge). Coins only move when pushed
// (by the shelf or each other), which is how the real thing feels anyway.

var R = 0.034
var START = 25
var SHELF_MIN = 0.14
var SHELF_MAX = 0.38
var PERIOD = 2.4

// A packed table: a jittered hex layout, a little looser than touching,
// so the next push has something to push.
function randomCoins() {
  var out = [], row = 0
  for (var y = 0.42; y < 0.985 - R; y += R * 1.85, ++row)
    for (var x = 0.05 + (row % 2 ? R : 0); x < 0.95; x += R * 2.15)
      if (Rng.random() < 0.9) out.push({ x: x + (Rng.random() - 0.5) * 0.01, y: y + (Rng.random() - 0.5) * 0.01, bonus: false })
  for (var b = 0; b < 3; ++b) out[Math.floor(Rng.random() * out.length)].bonus = true
  return out
}

function makeState() {
  return { coins: randomCoins(), hand: START, dropX: 0.5, t: 0, shelf: SHELF_MIN, won: 0, lost: 0, score: 0,
           cooldown: 0, idle: 0, falls: [], done: false }
}

function copy(s) {
  return { coins: s.coins, hand: s.hand, dropX: s.dropX, t: s.t, shelf: s.shelf, won: s.won, lost: s.lost,
           score: s.score, cooldown: s.cooldown, idle: s.idle, falls: s.falls, done: s.done }
}

function slide(state, x) {
  var s = copy(state)
  s.dropX = Math.max(0.08, Math.min(0.92, x))
  return s
}

function drop(state) {
  if (state.done || state.hand <= 0 || state.cooldown > 0) return state
  var s = copy(state)
  s.coins = state.coins.concat([{ x: state.dropX + (Rng.random() - 0.5) * 0.02, y: state.shelf + R + 0.01, bonus: Rng.random() < 0.04 }])
  s.hand = state.hand - 1
  s.cooldown = 0.35
  s.idle = 0
  return s
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.t = state.t + dt
  s.cooldown = Math.max(0, state.cooldown - dt)
  s.shelf = SHELF_MIN + (SHELF_MAX - SHELF_MIN) * (0.5 - 0.5 * Math.cos(s.t / PERIOD * Math.PI * 2))
  s.falls = state.falls.filter(function(f) { return f.life > dt }).map(function(f) { return { x: f.x, y: f.y, won: f.won, bonus: f.bonus, life: f.life - dt } })
  var coins = state.coins.map(function(c) { return { x: c.x, y: c.y, bonus: c.bonus } }), moved = 0
  for (var it = 0; it < 4; ++it) {
    for (var i = 0; i < coins.length; ++i) {
      var c = coins[i]
      if (c.y - R < s.shelf) { moved += s.shelf + R - c.y; c.y = s.shelf + R }
    }
    // Neighbours via a coarse grid (cell = one coin across), not all pairs.
    var G = Math.ceil(1 / (R * 2)), grid = {}
    for (var g = 0; g < coins.length; ++g) {
      var key = Math.floor(coins[g].x * G) + "," + Math.floor(coins[g].y * G)
      ;(grid[key] = grid[key] || []).push(g)
    }
    for (var a = 0; a < coins.length; ++a) {
      var gx = Math.floor(coins[a].x * G), gy = Math.floor(coins[a].y * G)
      for (var ox = -1; ox <= 1; ++ox) for (var oy = -1; oy <= 1; ++oy) {
        var cell = grid[(gx + ox) + "," + (gy + oy)]
        if (!cell) continue
        for (var ci = 0; ci < cell.length; ++ci) {
          var b = cell[ci]
          if (b <= a) continue
          var A = coins[a], B = coins[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy)
          if (d >= R * 2 || d === 0) continue
          var push = (R * 2 - d) / 2, nx = dx / d, ny = dy / d
          // Push mostly forward: whoever is further back gives way less.
          var wa = A.y < B.y ? 0.15 : 0.85, wb = 1 - wa
          A.x -= nx * push * 2 * wa; A.y -= ny * push * 2 * wa
          B.x += nx * push * 2 * wb; B.y += ny * push * 2 * wb
          if (A.y - R < s.shelf) A.y = s.shelf + R
          if (B.y - R < s.shelf) B.y = s.shelf + R
          moved += push
        }
      }
    }
  }
  var keep = [], falls = s.falls.slice()
  for (var k = 0; k < coins.length; ++k) {
    var q = coins[k]
    if (q.y > 1) { s.won++; s.score += q.bonus ? 10 : 1; s.hand += q.bonus ? 10 : 1; falls.push({ x: q.x, y: 1, won: true, bonus: q.bonus, life: 0.8 }); continue }
    if (q.x < 0 || q.x > 1) { s.lost++; falls.push({ x: q.x, y: q.y, won: false, bonus: q.bonus, life: 0.8 }); continue }
    keep.push(q)
  }
  s.coins = keep
  s.falls = falls
  // Out of coins: finish once the table has had a few strokes to settle.
  s.idle = state.hand > 0 ? 0 : state.idle + dt
  if (state.hand <= 0 && s.idle > PERIOD * 3) s.done = true
  return s
}
