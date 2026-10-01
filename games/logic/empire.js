.pragma library
.import "../../engine/Rng.js" as Rng

// Empire (after Empire Attack, 2008). You and three computer empires on a
// hex map. Population is both money and armour: it pours into your pool
// over time, and you spend it onto hexes, either reinforcing your own,
// claiming empty land next to yours (any amount will do), or attacking a
// neighbour, where attack and defence simply cancel out. Surrounding a
// hex makes attacks on it stronger. Take a rival's capital and its whole
// empire is yours; lose your own and you're finished. Coins on the map
// pay out a burst of population to whoever takes their hex. When the
// clock runs out, the largest empire by area wins.
//
// The original's exact multipliers, coin values and terrain costs didn't
// survive; the numbers here are our own:
//   attack strength = amount × (1 + 0.5 per extra side you touch it from)
//   mountains defend at double and capitals at 1.5×; mountains cost 10
//   more to claim; lakes are impassable; a capital's garrison grows by 1
//   a second on its own; coins are worth 30 plus 1 per 2 seconds played.
//
// Grid: COLS × ROWS pointy-top hexes in odd-row-offset layout (odd rows
// are shifted half a hex right).

var COLS = 15
var ROWS = 11
var MATCH = 300              // seconds
var EMPIRES = 4              // 0 is you
var NAMES = ["YOU", "RED", "GOLD", "VIOLET"]
var AMOUNTS = [0, 0.1, 0.25, 0.5, 1]   // 0 = a single person
var AMOUNT_NAMES = ["1", "10%", "25%", "50%", "ALL"]
var START_POOL = 25
var MOUNTAIN_COST = 10

function idx(c, r) { return r * COLS + c }
function inGrid(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS }

function neighbours(c, r) {
  var odd = r % 2, out = []
  var d = odd ? [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
  for (var i = 0; i < 6; ++i) { var nc = c + d[i][0], nr = r + d[i][1]; if (inGrid(nc, nr)) out.push(idx(nc, nr)) }
  return out
}
var NB = []
for (var r0 = 0; r0 < ROWS; ++r0) for (var c0 = 0; c0 < COLS; ++c0) NB.push(neighbours(c0, r0))

// ---- map ------------------------------------------------------------------

function makeMap() {
  var tiles = []
  for (var i = 0; i < COLS * ROWS; ++i) tiles.push({ owner: -1, pop: 0, terrain: "plain", coin: 0, capital: false })
  // A few lakes and mountain ranges, grown as small blobs.
  function blob(kind, n, size) {
    for (var b = 0; b < n; ++b) {
      var at = Math.floor(Rng.random() * tiles.length)
      for (var k = 0; k < size; ++k) {
        if (tiles[at].terrain === "plain") tiles[at].terrain = kind
        var nb = NB[at]
        at = nb[Math.floor(Rng.random() * nb.length)]
      }
    }
  }
  blob("lake", 3, 3)
  blob("mountain", 4, 4)
  // Capitals near the four corners, on plain ground, with a clear ring.
  var corners = [[1, ROWS - 2], [COLS - 2, 1], [COLS - 2, ROWS - 2], [1, 1]]
  for (var e = 0; e < EMPIRES; ++e) {
    var ci = idx(corners[e][0], corners[e][1])
    tiles[ci] = { owner: e, pop: 60, terrain: "plain", coin: 0, capital: true }
    for (var j = 0; j < NB[ci].length; ++j) { var t = tiles[NB[ci][j]]; if (t.terrain === "lake") t.terrain = "plain" }
  }
  // Make sure every capital can reach every other over land.
  if (!connected(tiles)) return makeMap()
  return tiles
}

function connected(tiles) {
  var start = -1
  for (var i = 0; i < tiles.length; ++i) if (tiles[i].capital) { start = i; break }
  var seen = {}, stack = [start]
  seen[start] = true
  while (stack.length) {
    var k = stack.pop()
    for (var j = 0; j < NB[k].length; ++j) {
      var n = NB[k][j]
      if (!seen[n] && tiles[n].terrain !== "lake") { seen[n] = true; stack.push(n) }
    }
  }
  for (var q = 0; q < tiles.length; ++q) if (tiles[q].capital && !seen[q]) return false
  return true
}

function makeState() {
  var tiles = makeMap(), caps = []
  for (var i = 0; i < tiles.length; ++i) if (tiles[i].capital) caps[tiles[i].owner] = i
  var empires = []
  for (var e = 0; e < EMPIRES; ++e) empires.push({ pool: START_POOL, alive: true, capital: caps[e], style: e === 0 ? null : ["thin", "thick", "balanced"][e - 1] })
  return {
    tiles: tiles, empires: empires, t: 0, cursor: caps[0], amount: 2, coinT: 4, aiT: 0,
    done: false, result: "", capsTaken: 0, log: [], flashes: [], lost: false
  }
}

// ---- rules ------------------------------------------------------------------

function area(s, e) {
  var n = 0
  for (var i = 0; i < s.tiles.length; ++i) if (s.tiles[i].owner === e) n++
  return n
}

function growth(s, e) { return 2 + area(s, e) * 0.3 }

// Sides of hex i touched by empire e.
function sides(s, e, i) {
  var n = 0
  for (var j = 0; j < NB[i].length; ++j) if (s.tiles[NB[i][j]].owner === e) n++
  return n
}

function multiplier(s, e, i) { return 1 + 0.5 * Math.max(0, sides(s, e, i) - 1) }

function spendFor(s, e, amountIdx) {
  var pool = Math.floor(s.empires[e].pool)
  if (pool < 1) return 0
  var f = AMOUNTS[amountIdx]
  return f === 0 ? 1 : Math.max(1, Math.floor(pool * f))
}

// What spending `amt` from empire e on hex i would do, without doing it.
// kind: "reinforce" | "claim" | "attack" | "none"; ok: whether it takes
// (or holds) the hex.
function preview(s, e, i, amt) {
  var t = s.tiles[i]
  if (t.terrain === "lake" || amt < 1) return { kind: "none" }
  if (t.owner === e) return { kind: "reinforce", gain: Math.round(amt * (1 + 0.1 * sides(s, e, i))) }
  if (!sides(s, e, i)) return { kind: "none" }
  if (t.owner < 0) {
    var need = t.terrain === "mountain" ? MOUNTAIN_COST + 1 : 1
    return { kind: "claim", ok: amt >= need, left: Math.max(0, amt - (need - 1)), need: need }
  }
  var strength = amt * multiplier(s, e, i), def = t.pop * defFactor(t)
  return { kind: "attack", ok: strength > def, strength: strength, def: def, mult: multiplier(s, e, i),
           left: strength > def ? Math.min(amt, strength - def) : (def - strength) / defFactor(t) }
}

function defFactor(t) { return t.terrain === "mountain" ? 2 : t.capital ? 1.5 : 1 }

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }
function copyTiles(tiles) { return tiles.map(function(t) { return { owner: t.owner, pop: t.pop, terrain: t.terrain, coin: t.coin, capital: t.capital } }) }
function copyEmpires(es) { return es.map(function(x) { return { pool: x.pool, alive: x.alive, capital: x.capital, style: x.style } }) }

function note(s, text) { s.log = [text].concat(s.log).slice(0, 4) }

// Spend on hex i. Mutates a fresh copy and returns it.
function act(state, e, i, amt) {
  if (state.done || !state.empires[e].alive) return state
  var pv = preview(state, e, i, amt)
  if (pv.kind === "none" || amt > state.empires[e].pool) return state
  var s = shallow(state)
  s.tiles = copyTiles(state.tiles); s.empires = copyEmpires(state.empires)
  s.empires[e].pool -= amt
  var t = s.tiles[i]
  if (pv.kind === "reinforce") { t.pop += pv.gain; return s }
  if (pv.kind === "claim") {
    if (!pv.ok) return state
    t.owner = e; t.pop = pv.left
    takeCoin(s, e, t)
    return s
  }
  // Attack.
  s.flashes = s.flashes.concat([{ i: i, t: 0.4, by: e }])
  if (!pv.ok) { t.pop = Math.max(0, Math.floor(pv.left)); return s }
  var loser = t.owner
  t.owner = e; t.pop = Math.max(1, Math.floor(pv.left))
  takeCoin(s, e, t)
  if (t.capital) absorb(s, e, loser, i)
  return s
}

function takeCoin(s, e, t) {
  if (!t.coin) return
  s.empires[e].pool += t.coin
  if (e === 0) note(s, "Coin: +" + t.coin)
  t.coin = 0
}

// Capital taken: the loser's whole empire (and its pool) changes hands.
function absorb(s, winner, loser, capIdx) {
  s.tiles[capIdx].capital = false
  for (var i = 0; i < s.tiles.length; ++i) if (s.tiles[i].owner === loser) s.tiles[i].owner = winner
  s.empires[winner].pool += Math.max(0, s.empires[loser].pool)
  s.empires[loser].pool = 0
  s.empires[loser].alive = false
  note(s, NAMES[winner] + " took " + NAMES[loser] + "'s capital")
  if (winner === 0) s.capsTaken++
  if (loser === 0) { s.done = true; s.lost = true; s.result = "YOUR CAPITAL FELL" }
}

// ---- computer empires -----------------------------------------------------

// One move for empire e: weigh every hex it could spend on and pick the
// best. Thin empires sprawl; thick ones fortify and strike hard.
// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function aiMove(s, e) {
  var emp = s.empires[e], pool = Math.floor(emp.pool)
  if (pool < 1) return s
  var best = null, bv = 0, saveFor = 0
  var capRing = {}
  for (var q = 0; q < NB[emp.capital].length; ++q) capRing[NB[emp.capital][q]] = true
  for (var i = 0; i < s.tiles.length; ++i) {
    var t = s.tiles[i]
    if (t.terrain === "lake") continue
    if (t.owner === e) {
      // Reinforce hexes facing a stronger enemy, the capital most of all.
      var threat = 0
      for (var j = 0; j < NB[i].length; ++j) { var n = s.tiles[NB[i][j]]; if (n.owner >= 0 && n.owner !== e) threat = Math.max(threat, n.pop + s.empires[n.owner].pool * 0.3) }
      if (!threat) continue
      var gap = threat - t.pop
      if (gap <= 0) continue
      var v = 2 + Math.min(6, gap / 20) + (t.capital ? 8 : capRing[i] ? 3 : 0) + (emp.style === "thick" ? 2 : 0)
      var amt = Math.min(pool, Math.ceil(gap * 1.1))
      if (v > bv) { bv = v; best = { i: i, amt: amt } }
      continue
    }
    if (!sides(s, e, i)) continue
    if (t.owner < 0) {
      var cost = t.terrain === "mountain" ? MOUNTAIN_COST + 1 : 1
      var give = emp.style === "thin" ? cost : cost + Math.floor(pool * (emp.style === "thick" ? 0.15 : 0.06))
      if (give > pool) continue
      var vc = 3 + (t.coin ? 3 + t.coin / 20 : 0) + (emp.style === "thin" ? 2 : 0) + sides(s, e, i) * 0.4 - (t.terrain === "mountain" ? 2 : 0)
      if (vc > bv) { bv = vc; best = { i: i, amt: give } }
      continue
    }
    // Attack: only when the pool can take it outright.
    var m = multiplier(s, e, i), def = t.pop * defFactor(t)
    var need = Math.floor(def / m) + 1 + Math.ceil(pool * 0.05)
    if (t.capital) saveFor = saveFor ? Math.min(saveFor, need) : need
    if (need > pool * (emp.style === "thin" ? 0.6 : 0.9)) continue
    var va = 4 + sides(s, e, i) * 1.2 + (t.capital ? 20 : 0) + (t.owner === 0 ? 1 : 0) - need / Math.max(1, pool) * 3
    if (va > bv) { bv = va; best = { i: i, amt: need } }
  }
  // A rival capital in reach but not yet affordable: save up for it.
  if (saveFor && saveFor > pool && saveFor < pool * 3 && !(best && best.i === emp.capital)) return s
  if (!best) return s
  return act(s, e, best.i, best.amt)
}

// ---- clock ------------------------------------------------------------------

function step(state, dt) {
  if (state.done) return state
  var s = shallow(state)
  s.t += dt
  s.empires = copyEmpires(state.empires)
  for (var e = 0; e < EMPIRES; ++e) {
    if (!s.empires[e].alive) continue
    s.empires[e].pool += growth(state, e) * dt
  }
  var capsGrow = false
  for (var ce = 0; ce < EMPIRES; ++ce) if (s.empires[ce].alive) capsGrow = true
  if (capsGrow) {
    s.tiles = copyTiles(s.tiles)
    for (var ci = 0; ci < EMPIRES; ++ci) if (s.empires[ci].alive) s.tiles[s.empires[ci].capital].pop += 1 * dt
  }
  s.flashes = s.flashes.map(function(f) { return { i: f.i, t: f.t - dt, by: f.by } }).filter(function(f) { return f.t > 0 })

  // Coins turn up on free land now and then, worth more as the game goes.
  s.coinT -= dt
  if (s.coinT <= 0) {
    s.coinT = 5 + Rng.random() * 5
    var free = []
    for (var i = 0; i < s.tiles.length; ++i) if (s.tiles[i].terrain !== "lake" && !s.tiles[i].coin && !s.tiles[i].capital) free.push(i)
    if (free.length) {
      s.tiles = copyTiles(s.tiles)
      s.tiles[free[Math.floor(Rng.random() * free.length)]].coin = Math.round(30 + s.t / 2)
    }
  }

  // Computer empires take turns making a move every so often.
  s.aiT -= dt
  if (s.aiT <= 0) {
    s.aiT = 0.7
    for (var k = 1; k < EMPIRES; ++k) if (s.empires[k].alive && Rng.random() < [0.5, 0.8, 1.0][LEVEL]) s = aiMove(s, k)
  }

  if (!s.done) {
    var aliveRivals = 0
    for (var a = 1; a < EMPIRES; ++a) if (s.empires[a].alive) aliveRivals++
    if (!aliveRivals) { s.done = true; s.result = "EMPIRE OF THE WORLD" }
    else if (s.t >= MATCH) { s.done = true; s.result = placing(s) === 1 ? "LARGEST EMPIRE" : ordinal(placing(s)) + " BY AREA" }
  }
  return s
}

// Your place by area among the empires still standing (1 = largest).
function placing(s) {
  var mine = area(s, 0), place = 1
  for (var e = 1; e < EMPIRES; ++e) if (s.empires[e].alive && area(s, e) > mine) place++
  return place
}

function ordinal(n) { return n === 1 ? "1ST" : n === 2 ? "2ND" : n === 3 ? "3RD" : n + "TH" }

// Score: area counts most, capitals taken and winning add bonuses.
function score(s) {
  if (s.lost) return 0
  var pts = area(s, 0) * 10 + s.capsTaken * 250
  if (s.done && placing(s) === 1) pts += 500
  if (s.done && s.result === "EMPIRE OF THE WORLD") pts += Math.round((MATCH - s.t) * 5)
  return pts
}

// ---- cursor -----------------------------------------------------------------

// LEFT/RIGHT step sideways; UP/DOWN go to the hex straight above/below in
// the stored grid, which zigzags naturally in an offset layout.
function moveCursor(state, dx, dy) {
  var c = state.cursor % COLS, r = Math.floor(state.cursor / COLS)
  c = Math.max(0, Math.min(COLS - 1, c + dx))
  r = Math.max(0, Math.min(ROWS - 1, r + dy))
  var s = shallow(state)
  s.cursor = idx(c, r)
  return s
}
