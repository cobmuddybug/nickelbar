.pragma library
.import "../../engine/Rng.js" as Rng

// Blackjack against the house. Four-deck shoe, reshuffled when a quarter
// remains. Dealer stands on all 17s; blackjack pays 3:2 (rounded down);
// double down on any first two cards. No splitting or insurance — the
// keymap stays SPACE hit / S stand / D double.
//
// Phases: "bet" (arrows pick the stake, SPACE deals) -> "player" ->
// "dealer" (the QML side calls dealerStep() on a timer so the draw is
// visible) -> "done" (SPACE goes back to betting, stake kept).

var BETS = [5, 10, 25, 50, 100]
var START_CHIPS = 100
var DECKS = 4

function newShoe() {
  var shoe = []
  var suits = ["S", "H", "D", "C"]
  for (var d = 0; d < DECKS; ++d)
    for (var s = 0; s < 4; ++s)
      for (var r = 1; r <= 13; ++r) shoe.push({ rank: r, suit: suits[s] })
  for (var i = shoe.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1))
    var t = shoe[i]; shoe[i] = shoe[j]; shoe[j] = t
  }
  return shoe
}

function makeState() {
  return { chips: START_CHIPS, peak: START_CHIPS, betIndex: 1, bet: 10, shoe: newShoe(), player: [], dealer: [],
    phase: "bet", holeHidden: true, result: "", net: 0, hands: 0, doubled: false }
}

function copy(s) {
  return { chips: s.chips, peak: s.peak, betIndex: s.betIndex, bet: s.bet, shoe: s.shoe, player: s.player,
    dealer: s.dealer, phase: s.phase, holeHidden: s.holeHidden, result: s.result, net: s.net, hands: s.hands,
    doubled: s.doubled }
}

function value(hand) {
  var total = 0, aces = 0
  for (var i = 0; i < hand.length; ++i) {
    var r = hand[i].rank
    total += r === 1 ? 11 : Math.min(10, r)
    if (r === 1) aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function isSoft(hand) {
  var total = 0, aces = 0
  for (var i = 0; i < hand.length; ++i) { var r = hand[i].rank; total += Math.min(10, r); if (r === 1) aces++ }
  return aces > 0 && total + 10 <= 21
}

function isBlackjack(hand) { return hand.length === 2 && value(hand) === 21 }

function draw(s) {
  if (s.shoe.length < DECKS * 13) s.shoe = newShoe()
  var shoe = s.shoe.slice()
  var c = shoe.pop()
  s.shoe = shoe
  return c
}

function affordable(state) {
  var i = state.betIndex
  while (i > 0 && BETS[i] > state.chips) i--
  return i
}

function changeBet(state, delta) {
  if (state.phase !== "bet") return state
  var i = Math.max(0, Math.min(BETS.length - 1, state.betIndex + delta))
  while (i > 0 && BETS[i] > state.chips) i--
  if (i === state.betIndex) return state
  var s = copy(state); s.betIndex = i; s.bet = BETS[i]
  return s
}

function broke(state) { return state.phase === "bet" && state.chips < BETS[0] }

function settle(s, outcome, mult) {
  // mult: payout multiple of the stake returned on top of the stake
  // (1 = even money, 1.5 = blackjack, 0 = push, -1 = lose).
  var stake = s.bet * (s.doubled ? 2 : 1)
  var net = mult >= 0 ? Math.floor(stake * mult) : -stake
  s.chips = s.chips + stake + net
  s.peak = Math.max(s.peak, s.chips)
  s.net = net
  s.result = outcome
  s.phase = "done"
  s.holeHidden = false
  s.hands = s.hands + 1
  return s
}

function deal(state) {
  if (state.phase !== "bet") return state
  var s = copy(state)
  s.betIndex = affordable(state)
  s.bet = BETS[s.betIndex]
  if (s.chips < s.bet) return state
  s.chips -= s.bet
  s.doubled = false
  s.result = ""; s.net = 0
  s.player = []; s.dealer = []
  s.player = [draw(s)]; s.dealer = [draw(s)]
  s.player = s.player.concat([draw(s)]); s.dealer = s.dealer.concat([draw(s)])
  s.holeHidden = true
  s.phase = "player"
  var pbj = isBlackjack(s.player), dbj = isBlackjack(s.dealer)
  if (pbj || dbj) {
    if (pbj && dbj) return settle(s, "push", 0)
    if (pbj) return settle(s, "blackjack!", 1.5)
    return settle(s, "dealer blackjack", -1)
  }
  return s
}

function hit(state) {
  if (state.phase !== "player") return state
  var s = copy(state)
  s.player = state.player.concat([draw(s)])
  var v = value(s.player)
  if (v > 21) return settle(s, "bust", -1)
  if (v === 21) s.phase = "dealer"
  return s
}

function stand(state) {
  if (state.phase !== "player") return state
  var s = copy(state)
  s.phase = "dealer"
  return s
}

function double(state) {
  if (state.phase !== "player" || state.player.length !== 2 || state.chips < state.bet) return state
  var s = copy(state)
  s.chips -= state.bet
  s.doubled = true
  s.player = state.player.concat([draw(s)])
  if (value(s.player) > 21) return settle(s, "bust", -1)
  s.phase = "dealer"
  return s
}

// One visible dealer action per call: reveal the hole card, then draw to 17.
function dealerStep(state) {
  if (state.phase !== "dealer") return state
  var s = copy(state)
  if (state.holeHidden) { s.holeHidden = false; return s }
  var dv = value(state.dealer)
  if (dv < 17) {
    s.dealer = state.dealer.concat([draw(s)])
    if (value(s.dealer) > 21) return settle(s, "dealer busts", 1)
    return s
  }
  var pv = value(state.player)
  if (pv > dv) return settle(s, "you win", 1)
  if (pv < dv) return settle(s, "dealer wins", -1)
  return settle(s, "push", 0)
}

function nextHand(state) {
  if (state.phase !== "done") return state
  var s = copy(state)
  s.phase = "bet"
  s.betIndex = affordable(state)
  s.bet = BETS[s.betIndex]
  return s
}

function serialize(state) {
  // A hand in progress is forfeited on save/restore only in the sense that
  // the stake is refunded — resume always lands back on the betting screen.
  var chips = state.chips
  if (state.phase === "player" || state.phase === "dealer") chips += state.bet * (state.doubled ? 2 : 1)
  return { chips: chips, peak: state.peak, betIndex: state.betIndex, hands: state.hands }
}

function deserialize(obj) {
  if (!obj || typeof obj.chips !== "number" || obj.chips < BETS[0]) return null
  var s = makeState()
  s.chips = obj.chips; s.peak = obj.peak || obj.chips; s.hands = obj.hands || 0
  s.betIndex = Math.max(0, Math.min(BETS.length - 1, obj.betIndex || 1))
  s.betIndex = affordable(s); s.bet = BETS[s.betIndex]
  return s
}
