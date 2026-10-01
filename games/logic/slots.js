.pragma library
.import "../../engine/Rng.js" as Rng

// Three-reel slot machine. Each reel is a fixed weighted strip; a spin
// picks each reel's stopping index up front, then the reels spin and stop
// left to right on a timer (the QML side just calls step()). Pays on the
// centre line only.
//
// Symbols: 0 SEVEN, 1 BAR, 2 STAR, 3 DIAMOND, 4 RING, 5 TRIANGLE ("cherry").
// Return to player is about 96% (checked by enumerating every stop) — a
// toy, not a trap, but the house still wins over a long enough evening.

var NAMES = ["7", "BAR", "STAR", "DIAMOND", "RING", "TRI"]
var STRIP = [5, 4, 3, 5, 2, 4, 1, 5, 3, 4, 0, 5, 4, 3, 2, 5, 4, 1, 3, 4, 5, 2]
var TRIPLE = [100, 30, 15, 10, 5, 4] // multiplier on the bet
var MAX_BET = 5
var START_BALANCE = 100

function makeState() {
  return { balance: START_BALANCE, peak: START_BALANCE, bet: 1, reels: [0, 7, 14], spinning: [false, false, false],
    stopAt: [0, 0, 0], targets: [0, 0, 0], clock: 0, lastWin: 0, lastLine: "", spins: 0 }
}

function copy(s) {
  return { balance: s.balance, peak: s.peak, bet: s.bet, reels: s.reels, spinning: s.spinning,
    stopAt: s.stopAt, targets: s.targets, clock: s.clock, lastWin: s.lastWin, lastLine: s.lastLine, spins: s.spins }
}

function busy(state) { return state.spinning[0] || state.spinning[1] || state.spinning[2] }
function broke(state) { return !busy(state) && state.balance < 1 }

function setBet(state, delta) {
  if (busy(state)) return state
  var bet = Math.max(1, Math.min(MAX_BET, Math.min(state.balance || 1, state.bet + delta)))
  if (bet === state.bet) return state
  var s = copy(state); s.bet = bet
  return s
}

function spin(state) {
  if (busy(state) || state.balance < 1) return state
  var s = copy(state)
  var bet = Math.min(state.bet, state.balance)
  s.bet = bet
  s.balance = state.balance - bet
  s.spinning = [true, true, true]
  s.targets = [0, 1, 2].map(function() { return Math.floor(Rng.random() * STRIP.length) })
  s.stopAt = [state.clock + 0.7, state.clock + 1.1, state.clock + 1.5]
  s.lastWin = 0
  s.lastLine = ""
  s.spins = state.spins + 1
  return s
}

function symbolAt(pos) { return STRIP[((Math.round(pos) % STRIP.length) + STRIP.length) % STRIP.length] }

function payout(line, bet) {
  if (line[0] === line[1] && line[1] === line[2]) return TRIPLE[line[0]] * bet
  var tris = 0
  for (var i = 0; i < 3; ++i) if (line[i] === 5) tris++
  if (tris === 2) return 3 * bet
  if (line[0] === 5) return 1 * bet
  if (line[0] <= 1 && line[1] <= 1 && line[2] <= 1) return 10 * bet // any mix of 7s and BARs
  return 0
}

function step(state, dt) {
  var s = copy(state)
  s.clock = state.clock + dt
  if (!busy(state)) return s
  var reels = state.reels.slice(), spinning = state.spinning.slice()
  for (var i = 0; i < 3; ++i) {
    if (!spinning[i]) continue
    if (s.clock >= state.stopAt[i]) { reels[i] = state.targets[i]; spinning[i] = false }
    else reels[i] = (reels[i] + dt * 22) % STRIP.length
  }
  s.reels = reels
  s.spinning = spinning
  if (!spinning[0] && !spinning[1] && !spinning[2]) {
    var line = [symbolAt(reels[0]), symbolAt(reels[1]), symbolAt(reels[2])]
    var win = payout(line, state.bet)
    s.lastWin = win
    s.balance = state.balance + win
    s.peak = Math.max(state.peak, s.balance)
    s.lastLine = win > 0 ? "WIN " + win : "no win"
  }
  return s
}

function serialize(state) {
  return { balance: state.balance, peak: state.peak, bet: state.bet, reels: state.reels.map(Math.round), spins: state.spins }
}

function deserialize(obj) {
  if (!obj || typeof obj.balance !== "number" || obj.balance < 1) return null
  var s = makeState()
  s.balance = obj.balance; s.peak = obj.peak || obj.balance; s.bet = obj.bet || 1
  s.reels = Array.isArray(obj.reels) && obj.reels.length === 3 ? obj.reels : s.reels
  s.spins = obj.spins || 0
  return s
}
