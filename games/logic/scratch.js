.pragma library
.import "../../engine/Rng.js" as Rng

// Scratch cards. Ten cards a game; each has nine covered spots and a bonus
// box. Uncover three of the same symbol to win that symbol's prize, times
// whatever the bonus box shows. Score is the total won.
//
// Every spot's cover is a SUB × SUB grid of flakes, so the mouse can
// scratch it off a bit at a time; a spot counts as revealed once most of
// it is gone. The keyboard just clears a whole spot.

var CARDS = 10
var SPOTS = 9
var SUB = 6
var REVEAL_AT = 0.6
var SYMBOLS = [
  { glyph: "♣", prize: 5 },
  { glyph: "♥", prize: 10 },
  { glyph: "♦", prize: 25 },
  { glyph: "★", prize: 50 },
  { glyph: "7", prize: 100 },
  { glyph: "$", prize: 500 }
]
// Chance a card wins, and which symbol when it does (weights).
var WIN_ODDS = 0.4
var WIN_WEIGHTS = [34, 28, 18, 11, 7, 2]
var BONUS = [1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 5]

function pickWeighted(w) {
  var t = 0
  for (var i = 0; i < w.length; ++i) t += w[i]
  var r = Rng.random() * t
  for (var j = 0; j < w.length; ++j) { r -= w[j]; if (r < 0) return j }
  return w.length - 1
}

function shuffle(a) {
  for (var i = a.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1)), t = a[i]
    a[i] = a[j]; a[j] = t
  }
  return a
}

function fullMask() {
  var m = []
  for (var i = 0; i < SUB * SUB; ++i) m.push(1)
  return m
}

// Nine symbols: a winner has exactly one triple; a loser has at most pairs
// (and usually a teasing pair of something good).
function makeCard() {
  var syms = [], win = Rng.random() < WIN_ODDS ? pickWeighted(WIN_WEIGHTS) : -1
  var counts = [0, 0, 0, 0, 0, 0]
  if (win >= 0) { syms.push(win, win, win); counts[win] = 3 }
  else if (Rng.random() < 0.6) {
    var tease = 3 + Math.floor(Rng.random() * 3)
    syms.push(tease, tease); counts[tease] = 2
  }
  while (syms.length < SPOTS) {
    var k = Math.floor(Rng.random() * SYMBOLS.length)
    if (counts[k] >= 2 || (k === win)) continue
    syms.push(k); counts[k]++
  }
  shuffle(syms)
  var spots = []
  for (var i = 0; i < SPOTS; ++i) spots.push({ sym: syms[i], mask: fullMask(), open: false })
  return { spots: spots, bonus: { mult: BONUS[Math.floor(Rng.random() * BONUS.length)], mask: fullMask(), open: false }, win: win }
}

function makeState() {
  return { card: makeCard(), dealt: 1, score: 0, cursor: 0, settled: false, last: 0, history: [] }
}

function copySpot(p) { return { sym: p.sym, mask: p.mask.slice(), open: p.open } }

function copy(s) {
  return {
    card: { spots: s.card.spots.map(copySpot), bonus: { mult: s.card.bonus.mult, mask: s.card.bonus.mask.slice(), open: s.card.bonus.open }, win: s.card.win },
    dealt: s.dealt, score: s.score, cursor: s.cursor, settled: s.settled, last: s.last, history: s.history.slice()
  }
}

// Cursor over the 3×3 spots (0-8) and the bonus box (9) beneath them.
function moveCursor(state, dx, dy) {
  var s = copy(state), c = state.cursor
  if (c === 9) { if (dy < 0) c = 7 }
  else {
    var col = c % 3, row = Math.floor(c / 3)
    col = Math.max(0, Math.min(2, col + dx))
    row = row + dy
    c = row > 2 ? 9 : Math.max(0, row) * 3 + col
  }
  s.cursor = c
  return s
}

function spotAt(s, i) { return i === 9 ? s.card.bonus : s.card.spots[i] }

function prize(card) { return card.win >= 0 ? SYMBOLS[card.win].prize * card.bonus.mult : 0 }

function allOpen(card) {
  if (!card.bonus.open) return false
  for (var i = 0; i < SPOTS; ++i) if (!card.spots[i].open) return false
  return true
}

function settle(s) {
  if (s.settled || !allOpen(s.card)) return
  s.settled = true
  s.last = prize(s.card)
  s.score += s.last
  s.history.push(s.last)
}

function uncover(state, i) {
  if (state.settled) return state
  var s = copy(state), p = spotAt(s, i)
  if (p.open) return state
  p.mask = p.mask.map(function() { return 0 })
  p.open = true
  settle(s)
  return s
}

function uncoverAll(state) {
  var s = state
  for (var i = 0; i < 10; ++i) s = uncover(s, i)
  return s
}

// Scratch a disc of radius r (in flake units) at flake position (fx, fy)
// inside spot i.
function scratch(state, i, fx, fy, r) {
  if (state.settled) return state
  var p0 = spotAt(state, i)
  if (p0.open) return state
  var s = copy(state), p = spotAt(s, i), changed = false, left = 0
  for (var y = 0; y < SUB; ++y) for (var x = 0; x < SUB; ++x) {
    var k = y * SUB + x
    if (p.mask[k] && (x + 0.5 - fx) * (x + 0.5 - fx) + (y + 0.5 - fy) * (y + 0.5 - fy) <= r * r) { p.mask[k] = 0; changed = true }
    left += p.mask[k]
  }
  if (!changed) return state
  if (1 - left / (SUB * SUB) >= REVEAL_AT) { p.open = true }
  settle(s)
  return s
}

function nextCard(state) {
  if (!state.settled || state.dealt >= CARDS) return state
  var s = copy(state)
  s.card = makeCard()
  s.dealt++
  s.settled = false
  s.cursor = 0
  return s
}

function finished(s) { return s.settled && s.dealt >= CARDS }

function serialize(s) { return JSON.parse(JSON.stringify(s)) }
function deserialize(o) {
  if (!o || !o.card || !o.card.spots || o.card.spots.length !== SPOTS) return null
  return copy(o)
}
