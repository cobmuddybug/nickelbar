.pragma library
.import "../../engine/Rng.js" as Rng

// European roulette: one zero, thirty-six numbers, the usual inside and
// outside bets. Chips only; the game ends when you can't cover a bet.

var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
var CHIPS = [1, 5, 25, 100]
var START = 500

function isRed(n) { return REDS.indexOf(n) >= 0 }

// id -> payout multiplier (profit per chip) and the test for a winning number.
function bet(id) {
  if (id[0] === "n") { var k = Number(id.slice(1)); return { mult: 35, wins: function(n) { return n === k } } }
  var t = {
    dz1: [2, function(n) { return n >= 1 && n <= 12 }], dz2: [2, function(n) { return n >= 13 && n <= 24 }], dz3: [2, function(n) { return n >= 25 && n <= 36 }],
    col1: [2, function(n) { return n > 0 && n % 3 === 1 }], col2: [2, function(n) { return n > 0 && n % 3 === 2 }], col3: [2, function(n) { return n > 0 && n % 3 === 0 }],
    low: [1, function(n) { return n >= 1 && n <= 18 }], high: [1, function(n) { return n >= 19 }],
    even: [1, function(n) { return n > 0 && n % 2 === 0 }], odd: [1, function(n) { return n % 2 === 1 }],
    red: [1, function(n) { return n > 0 && isRed(n) }], black: [1, function(n) { return n > 0 && !isRed(n) }]
  }[id]
  return t ? { mult: t[0], wins: t[1] } : null
}

function makeState() {
  return { chips: START, bets: {}, chip: 1, phase: "bet", result: -1, spinT: 0, spinFor: 3.2, history: [], lastBets: {}, win: 0, done: false }
}

function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }
function staked(s) { var t = 0; for (var k in s.bets) t += s.bets[k]; return t }

function place(s, id, amt) {
  if (s.phase !== "bet" || !bet(id)) return s
  var a = Math.min(amt || CHIPS[s.chip], s.chips)
  if (a <= 0) return s
  var o = copy(s); o.bets = copy(s.bets); o.bets[id] = (s.bets[id] || 0) + a; o.chips = s.chips - a; o.win = 0
  o.ev = ["click"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function take(s, id) {
  if (s.phase !== "bet" || !s.bets[id]) return s
  var a = Math.min(s.bets[id], CHIPS[s.chip]), o = copy(s)
  o.bets = copy(s.bets); o.bets[id] -= a; if (o.bets[id] <= 0) delete o.bets[id]
  o.chips = s.chips + a
  o.ev = ["click"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function clear(s) { if (s.phase !== "bet") return s; var o = copy(s); o.chips = s.chips + staked(s); o.bets = {}; return o }
function setChip(s, d) { var o = copy(s); o.chip = Math.max(0, Math.min(CHIPS.length - 1, s.chip + d)); return o }

// Put last round's bets back if they can be covered.
function rebet(s) {
  if (s.phase !== "bet" || staked(s) > 0) return s
  var t = 0; for (var k in s.lastBets) t += s.lastBets[k]
  if (t === 0 || t > s.chips) return s
  var o = copy(s); o.bets = copy(s.lastBets); o.chips = s.chips - t
  return o
}

function spin(s, forced) {
  if (s.phase !== "bet" || staked(s) === 0) return s
  var o = copy(s)
  o.phase = "spin"; o.spinT = 0; o.result = forced !== undefined ? forced : Math.floor(Rng.random() * 37)
  o.lastBets = copy(s.bets)
  o.ev = ["tick"]; o.evSeq = (s.evSeq || 0) + 1
  return o
}

function payout(bets, n) {
  var total = 0
  for (var id in bets) { var b = bet(id); if (b && b.wins(n)) total += bets[id] * (b.mult + 1) }
  return total
}

function step(s, dt) {
  if (s.phase !== "spin") return s
  var o = copy(s)
  o.spinT = s.spinT + dt
  if (Math.floor(o.spinT * 9) !== Math.floor(s.spinT * 9) && o.spinT < s.spinFor) { o.ev = ["tick"]; o.evSeq = (s.evSeq || 0) + 1 }
  if (o.spinT < s.spinFor) return o
  var won = payout(s.bets, s.result)
  o.chips = s.chips + won; o.win = won - staked(s)
  o.history = [s.result].concat(s.history).slice(0, 12)
  o.bets = {}; o.phase = "bet"
  o.ev = [won > 0 ? "coin" : "thud"]; o.evSeq = (s.evSeq || 0) + 1
  if (o.chips <= 0) o.done = true
  return o
}

function serialize(s) { return { chips: s.chips + staked(s), chip: s.chip, history: s.history, lastBets: s.lastBets } }
function deserialize(o) {
  if (!o || typeof o.chips !== "number" || o.chips <= 0) return null
  var s = makeState()
  s.chips = o.chips; s.chip = o.chip || 0; s.history = o.history || []; s.lastBets = o.lastBets || {}
  return s
}
