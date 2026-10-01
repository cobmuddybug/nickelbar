.pragma library
.import "../../engine/Rng.js" as Rng

// Bingo: 75-ball, you against two computer players. You hold two cards and
// each rival holds two of their own; balls are called every couple of
// seconds, you find and mark your numbers yourself, and the rivals mark
// theirs instantly. Complete the game's pattern and call BINGO before
// either of them does. Your score is how many games you win in a row: the
// first loss ends the run. Calling it with no finished pattern locks you
// out for a few balls. Rivals get quicker to call as your streak grows.
//
// Cursor coordinates are on the 10x5 layout of your two cards side by side.

var INTERVAL = 2.2       // seconds between balls
var RIVALS = ["Bea", "Gus"]
var PATTERNS = [
  { id: "line",    name: "ANY LINE" },
  { id: "corners", name: "FOUR CORNERS" },
  { id: "x",       name: "LETTER X" },
  { id: "plus",    name: "PLUS SIGN" },
  { id: "black",   name: "BLACKOUT" }
]
var LETTERS = "BINGO"

function rnd(rand) { return (rand || Rng.random)() }
function shuffle(a, rand) {
  for (var i = a.length - 1; i > 0; --i) {
    var j = Math.floor(rnd(rand) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

function makeCard(rand) {
  var cols = []
  for (var c = 0; c < 5; ++c) {
    var pool = []
    for (var n = c * 15 + 1; n <= c * 15 + 15; ++n) pool.push(n)
    cols.push(shuffle(pool, rand).slice(0, 5))
  }
  var nums = [], marks = []
  for (var r = 0; r < 5; ++r) {
    var row = [], mrow = []
    for (var cc = 0; cc < 5; ++cc) { row.push(cols[cc][r]); mrow.push(false) }
    nums.push(row); marks.push(mrow)
  }
  nums[2][2] = 0; marks[2][2] = true     // free space
  return { nums: nums, marks: marks }
}

function cellsOf(patternId) {
  var out = [], r, c
  if (patternId === "corners") return [[0, 0], [0, 4], [4, 0], [4, 4]]
  if (patternId === "x") { for (r = 0; r < 5; ++r) { out.push([r, r]); out.push([r, 4 - r]) } return out }
  if (patternId === "plus") { for (r = 0; r < 5; ++r) { out.push([r, 2]); out.push([2, r]) } return out }
  if (patternId === "black") { for (r = 0; r < 5; ++r) for (c = 0; c < 5; ++c) out.push([r, c]); return out }
  return null
}

function complete(card, patternId) {
  var need = cellsOf(patternId), i, r, c, ok
  if (need) {
    for (i = 0; i < need.length; ++i) if (!card.marks[need[i][0]][need[i][1]]) return false
    return true
  }
  for (r = 0; r < 5; ++r) { ok = true; for (c = 0; c < 5; ++c) if (!card.marks[r][c]) ok = false; if (ok) return true }
  for (c = 0; c < 5; ++c) { ok = true; for (r = 0; r < 5; ++r) if (!card.marks[r][c]) ok = false; if (ok) return true }
  ok = true; for (r = 0; r < 5; ++r) if (!card.marks[r][r]) ok = false
  if (ok) return true
  ok = true; for (r = 0; r < 5; ++r) if (!card.marks[r][4 - r]) ok = false
  return ok
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function startGame(prev, rand) {
  var streak = prev ? prev.streak : 0
  var weights = [3, 2, 2, 2, 1], total = 10, r = rnd(rand) * total, pi = 0
  for (var w = 0; w < weights.length; ++w) { r -= weights[w]; if (r <= 0) { pi = w; break } }
  var cards = [makeCard(rand), makeCard(rand)]
  var rivals = RIVALS.map(function(name) {
    return { name: name, cards: [makeCard(rand), makeCard(rand)], claimAt: -1, react: Math.max(0.3, 1.5 - 0.05 * streak) * (0.7 + rnd(rand) * 0.6) * [1.6, 1, 0.6][LEVEL] }
  })
  var pool = []
  for (var n = 1; n <= 75; ++n) pool.push(n)
  return { game: (prev ? prev.game : 0) + 1, pattern: PATTERNS[pi].id, cards: cards, rivals: rivals,
           pool: shuffle(pool, rand), called: [], timer: 1.2, clock: 0, lockout: 0, interval: PATTERNS[pi].id === "black" ? 1.3 : INTERVAL,
           phase: "play", cursor: { x: 0, y: 0 }, streak: streak, note: "", winner: "", over: false }
}

function makeState(rand) { return startGame(null, rand) }

function clone(s, patch) {
  var o = {}
  for (var k in s) o[k] = s[k]
  for (var p in patch) o[p] = patch[p]
  return o
}

function isCalled(s, n) { return s.called.indexOf(n) >= 0 }

function markRival(r, n) {
  r.cards.forEach(function(card) {
    for (var y = 0; y < 5; ++y) for (var x = 0; x < 5; ++x) if (card.nums[y][x] === n) card.marks[y][x] = true
  })
}

function anyComplete(cards, pattern) {
  for (var i = 0; i < cards.length; ++i) if (complete(cards[i], pattern)) return true
  return false
}

function step(s, dt, rand) {
  if (s.phase !== "play") return s
  var timer = s.timer - dt, clock = s.clock + dt
  var called = s.called, pool = s.pool, lockout = s.lockout, note = s.note
  var rivals = s.rivals.map(function(r) {
    return { name: r.name, react: r.react, claimAt: r.claimAt, cards: r.cards.map(function(card) { return { nums: card.nums, marks: card.marks.map(function(row) { return row.slice() }) } }) }
  })
  if (timer <= 0 && pool.length) {
    pool = pool.slice(); var ball = pool.pop()
    called = called.concat([ball]); timer += s.interval
    if (lockout > 0) lockout--
    for (var i = 0; i < rivals.length; ++i) {
      markRival(rivals[i], ball)
      if (rivals[i].claimAt < 0 && anyComplete(rivals[i].cards, s.pattern)) rivals[i].claimAt = clock + rivals[i].react
    }
    note = ""
  }
  var phase = "play", winner = ""
  for (var j = 0; j < rivals.length; ++j) if (rivals[j].claimAt >= 0 && clock >= rivals[j].claimAt) { phase = "lost"; winner = rivals[j].name; break }
  if (!pool.length && phase === "play" && timer <= 0) { phase = "lost"; winner = "nobody" }
  var next = clone(s, { timer: timer, clock: clock, called: called, pool: pool, rivals: rivals, lockout: lockout, phase: phase, note: note, winner: winner })
  if (phase === "lost") next.note = winner === "nobody" ? "NO ONE GOT BINGO" : winner.toUpperCase() + " CALLED BINGO"
  return next
}

// Mark (or unmark) the number under cursor cell (x, y) on the 10x5 layout.
function daub(s, x, y) {
  if (s.phase !== "play" || x < 0 || y < 0 || x > 9 || y > 4) return s
  var ci = x >= 5 ? 1 : 0, r = y, c = x % 5
  var card = s.cards[ci], n = card.nums[r][c]
  if (n === 0) return s
  if (!isCalled(s, n) && !card.marks[r][c]) return clone(s, { note: "NOT CALLED YET" })
  var cards = s.cards.slice()
  var marks = card.marks.map(function(row) { return row.slice() })
  marks[r][c] = !marks[r][c]
  cards[ci] = { nums: card.nums, marks: marks }
  return clone(s, { cards: cards, note: "" })
}

function moveCursor(s, dx, dy) {
  var x = Math.max(0, Math.min(9, s.cursor.x + dx)), y = Math.max(0, Math.min(4, s.cursor.y + dy))
  return clone(s, { cursor: { x: x, y: y } })
}

function claim(s) {
  if (s.phase !== "play") return s
  if (s.lockout > 0) return clone(s, { note: "LOCKED OUT FOR " + s.lockout + " MORE BALLS" })
  if (anyComplete(s.cards, s.pattern)) return clone(s, { phase: "won", streak: s.streak + 1, winner: "you", note: "BINGO!  STREAK " + (s.streak + 1) })
  return clone(s, { lockout: 3, note: "FALSE CALL  ·  LOCKED OUT FOR 3 BALLS" })
}

// After a game ends: the next game after a win; after a loss the run is over.
function advance(s, rand) {
  if (s.phase === "play") return s
  if (s.phase === "lost") return clone(s, { over: true })
  return startGame(s, rand)
}

// How many of this pattern's cells are marked on the best of these cards.
function bestOf(cards, pattern) {
  var need = cellsOf(pattern), top = 0
  for (var i = 0; i < cards.length; ++i) {
    var m = cards[i].marks, have = 0
    if (need) { for (var k = 0; k < need.length; ++k) if (m[need[k][0]][need[k][1]]) have++ }
    else {
      var lines = []
      for (var r = 0; r < 5; ++r) { lines.push(m[r]); lines.push([m[0][r], m[1][r], m[2][r], m[3][r], m[4][r]]) }
      lines.push([m[0][0], m[1][1], m[2][2], m[3][3], m[4][4]]); lines.push([m[0][4], m[1][3], m[2][2], m[3][1], m[4][0]])
      for (var l = 0; l < lines.length; ++l) { var c = lines[l].filter(function(v) { return v }).length; if (c > have) have = c }
    }
    if (have > top) top = have
  }
  return { have: top, need: need ? need.length : 5 }
}

function best(s) { return bestOf(s.cards, s.pattern) }

function serialize(s) { return s }
function deserialize(o) {
  if (!o || !o.cards || !o.rivals || !o.pool) return null
  return o
}
