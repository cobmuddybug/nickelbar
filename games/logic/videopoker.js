.pragma library
.import "../../engine/Rng.js" as Rng

// Jacks or Better video poker, one 52-card deck reshuffled every hand.
// Standard 9/6 full-pay table; a royal flush on five coins pays 800 a coin
// instead of 250.
//
// Phases: "bet" (up/down pick the coins, SPACE deals) -> "hold" (left/right
// walk the cards, SPACE or 1-5 toggle a hold, D draws) -> "done" (SPACE
// deals the next hand at the same bet). Score is the highest credit count
// reached; running dry at the betting stage ends the session.

var START_CREDITS = 100
var MAX_BET = 5

// Highest first, so the first hit is the one that pays.
var HANDS = [
  { id: "royal",    name: "Royal Flush",     pays: 250 },
  { id: "sflush",   name: "Straight Flush",  pays: 50 },
  { id: "quads",    name: "Four of a Kind",  pays: 25 },
  { id: "full",     name: "Full House",      pays: 9 },
  { id: "flush",    name: "Flush",           pays: 6 },
  { id: "straight", name: "Straight",        pays: 4 },
  { id: "trips",    name: "Three of a Kind", pays: 3 },
  { id: "twopair",  name: "Two Pair",        pays: 2 },
  { id: "jacks",    name: "Jacks or Better", pays: 1 }
]

function payout(handId, bet) {
  if (!handId) return 0
  if (handId === "royal" && bet === MAX_BET) return 4000
  for (var i = 0; i < HANDS.length; ++i) if (HANDS[i].id === handId) return HANDS[i].pays * bet
  return 0
}

function handName(handId) {
  for (var i = 0; i < HANDS.length; ++i) if (HANDS[i].id === handId) return HANDS[i].name
  return ""
}

function newDeck() {
  var deck = []
  var suits = ["S", "H", "D", "C"]
  for (var s = 0; s < 4; ++s)
    for (var r = 1; r <= 13; ++r) deck.push({ rank: r, suit: suits[s] })
  for (var i = deck.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1))
    var t = deck[i]; deck[i] = deck[j]; deck[j] = t
  }
  return deck
}

// The best paying hand in five cards, or "" for nothing.
function evaluate(cards) {
  if (cards.length !== 5) return ""
  var counts = {}, suits = {}
  var ranks = []
  for (var i = 0; i < 5; ++i) {
    counts[cards[i].rank] = (counts[cards[i].rank] || 0) + 1
    suits[cards[i].suit] = true
    ranks.push(cards[i].rank)
  }
  var flush = Object.keys(suits).length === 1
  var groups = Object.keys(counts).map(function(k) { return counts[k] }).sort(function(a, b) { return b - a })
  ranks.sort(function(a, b) { return a - b })
  var distinct = groups.length === 5
  var straight = distinct && (ranks[4] - ranks[0] === 4)
  var broadway = distinct && ranks[0] === 1 && ranks[1] === 10 && ranks[4] === 13 // A-10-J-Q-K
  if (flush && broadway) return "royal"
  if (flush && straight) return "sflush"
  if (groups[0] === 4) return "quads"
  if (groups[0] === 3 && groups[1] === 2) return "full"
  if (flush) return "flush"
  if (straight || broadway) return "straight"
  if (groups[0] === 3) return "trips"
  if (groups[0] === 2 && groups[1] === 2) return "twopair"
  if (groups[0] === 2) {
    for (var r in counts)
      if (counts[r] === 2 && (Number(r) === 1 || Number(r) >= 11)) return "jacks"
  }
  return ""
}

function makeState() {
  return { credits: START_CREDITS, peak: START_CREDITS, bet: MAX_BET, deck: [], hand: [],
    held: [false, false, false, false, false], cursor: 0, phase: "bet", result: "", win: 0, hands: 0 }
}

function copy(s) {
  return { credits: s.credits, peak: s.peak, bet: s.bet, deck: s.deck, hand: s.hand, held: s.held,
    cursor: s.cursor, phase: s.phase, result: s.result, win: s.win, hands: s.hands }
}

function broke(s) { return s.phase !== "hold" && s.credits <= 0 }

function changeBet(state, delta) {
  if (state.phase === "hold") return state
  var s = copy(state)
  s.bet = Math.max(1, Math.min(MAX_BET, Math.min(state.credits, state.bet + delta)))
  if (s.bet === state.bet) return state
  return s
}

function deal(state) {
  if (state.phase === "hold" || state.credits <= 0) return state
  var s = copy(state)
  var bet = Math.min(state.bet, state.credits)
  var deck = newDeck()
  s.bet = bet
  s.credits = state.credits - bet
  s.hand = deck.slice(0, 5)
  s.deck = deck.slice(5)
  s.held = [false, false, false, false, false]
  s.phase = "hold"
  s.result = evaluate(s.hand) // shown as a nudge while choosing holds
  s.win = 0
  s.cursor = 0
  return s
}

function moveCursor(state, dx) {
  if (state.phase !== "hold" || !dx) return state
  var s = copy(state)
  s.cursor = (state.cursor + dx + 5) % 5
  return s
}

function toggleHold(state, i) {
  if (state.phase !== "hold") return state
  var idx = i === undefined ? state.cursor : i
  if (idx < 0 || idx > 4) return state
  var s = copy(state)
  s.held = state.held.slice()
  s.held[idx] = !s.held[idx]
  s.cursor = idx
  return s
}

function setHold(state, value) {
  if (state.phase !== "hold" || state.held[state.cursor] === value) return state
  return toggleHold(state)
}

function draw(state) {
  if (state.phase !== "hold") return state
  var s = copy(state)
  var deck = state.deck.slice()
  s.hand = state.hand.map(function(c, i) { return state.held[i] ? c : deck.shift() })
  s.deck = deck
  s.result = evaluate(s.hand)
  s.win = payout(s.result, state.bet)
  s.credits = state.credits + s.win
  s.peak = Math.max(state.peak, s.credits)
  s.phase = "done"
  s.hands = state.hands + 1
  return s
}

function serialize(s) {
  // A hand in progress is folded back into credits: reopening never
  // replays a deal the player has already seen.
  var credits = s.phase === "hold" ? s.credits + s.bet : s.credits
  return { credits: credits, peak: s.peak, bet: s.bet, hands: s.hands }
}

function deserialize(obj) {
  if (!obj || typeof obj.credits !== "number" || obj.credits <= 0) return null
  var s = makeState()
  s.credits = obj.credits
  s.peak = Math.max(obj.peak || 0, obj.credits)
  s.bet = Math.max(1, Math.min(MAX_BET, obj.bet || MAX_BET))
  s.hands = obj.hands || 0
  return s
}
