.pragma library
.import "../../engine/Rng.js" as Rng

// Crazy Eights against two computer players. Play a card that matches the
// top of the pile by suit or rank; eights are wild and name the next suit.
// Can't play, and you draw until you can (or the stock runs out and you
// pass). First to empty their hand takes the round and scores what's left
// in the others' hands: eights 50, court cards 10, aces 1, the rest face
// value. The match ends when someone reaches TARGET.

var PLAYERS = 3
var HAND = 5
var TARGET = 100
var SUITS = ["S", "H", "D", "C"]
var NAMES = ["YOU", "WEST", "EAST"]

function shuffle(a) {
  for (var i = a.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1)), t = a[i]
    a[i] = a[j]; a[j] = t
  }
  return a
}

function freshDeck() {
  var d = []
  for (var s = 0; s < 4; ++s) for (var r = 1; r <= 13; ++r) d.push({ rank: r, suit: SUITS[s] })
  return shuffle(d)
}

function cardPoints(c) { return c.rank === 8 ? 50 : c.rank >= 11 ? 10 : c.rank }

function handPoints(hand) {
  var t = 0
  for (var i = 0; i < hand.length; ++i) t += cardPoints(hand[i])
  return t
}

function sortHand(h) {
  return h.slice().sort(function(a, b) {
    if (a.rank === 8 && b.rank !== 8) return 1
    if (b.rank === 8 && a.rank !== 8) return -1
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.rank - b.rank
  })
}

// A round: deal, flip a starter that isn't an eight.
function deal(scores, dealer) {
  var deck = freshDeck(), hands = []
  for (var p = 0; p < PLAYERS; ++p) hands.push([])
  for (var k = 0; k < HAND; ++k) for (var q = 0; q < PLAYERS; ++q) hands[q].push(deck.pop())
  hands[0] = sortHand(hands[0])
  var i = deck.length - 1
  while (deck[i].rank === 8) i--
  var top = deck.splice(i, 1)[0]
  var first = (dealer + 1) % PLAYERS
  return {
    deck: deck, pile: [top], suit: top.suit, hands: hands, scores: scores, dealer: dealer,
    turn: first, cursor: 0, phase: "play", note: first === 0 ? "" : NAMES[first] + " leads", winner: -1, suitCursor: 0, passes: 0, turns: 0
  }
}

function makeState() { return deal([0, 0, 0], PLAYERS - 1) }

function copy(s) {
  return {
    deck: s.deck.slice(), pile: s.pile.slice(), suit: s.suit, hands: s.hands.map(function(h) { return h.slice() }),
    scores: s.scores.slice(), dealer: s.dealer, turn: s.turn, cursor: s.cursor, phase: s.phase, note: s.note,
    winner: s.winner, suitCursor: s.suitCursor, passes: s.passes || 0, turns: s.turns || 0
  }
}

function top(s) { return s.pile[s.pile.length - 1] }

function playable(s, card) { return card.rank === 8 || card.suit === s.suit || card.rank === top(s).rank }

function anyPlayable(s, hand) {
  for (var i = 0; i < hand.length; ++i) if (playable(s, hand[i])) return true
  return false
}

// Reshuffle the pile (bar its top) into the stock when it runs dry.
function drawOne(s, p) {
  if (!s.deck.length && s.pile.length > 1) {
    var keep = s.pile.pop()
    s.deck = shuffle(s.pile)
    s.pile = [keep]
  }
  if (!s.deck.length) return null
  var c = s.deck.pop()
  s.hands[p].push(c)
  return c
}

// Rounds can churn forever late on (everyone drawing the pile back and
// passing it round); past a sensible length, call it like a blocked round.
var MAX_TURNS = 240

function nextTurn(s) {
  s.turns = (s.turns || 0) + 1
  if (s.turns > MAX_TURNS && s.phase === "play") {
    endRound(s, lightest(s))
    s.note = "Stalemate · " + s.note.replace("goes out", "has the lightest hand").replace("You go out", "You have the lightest hand")
    return
  }
  s.turn = (s.turn + 1) % PLAYERS
  if (s.turn === 0) s.cursor = Math.min(s.cursor, Math.max(0, s.hands[0].length - 1))
}

function endRound(s, p) {
  var pts = 0
  for (var q = 0; q < PLAYERS; ++q) if (q !== p) pts += handPoints(s.hands[q])
  s.scores[p] += pts
  s.winner = p
  s.note = (p === 0 ? "You go out" : NAMES[p] + " goes out") + ": +" + pts
  s.phase = s.scores[p] >= TARGET ? "done" : "round"
}

// Lay card i from player p's hand. Eights ask for a suit (the human picks
// in the "suit" phase; the computer passes one in).
function playCard(state, p, i, suit) {
  if (state.phase !== "play" || state.turn !== p) return state
  var card = state.hands[p][i]
  if (!card || !playable(state, card)) return state
  var s = copy(state)
  s.hands[p].splice(i, 1)
  s.pile.push(card)
  s.suit = card.suit
  s.note = p === 0 ? "" : NAMES[p] + " plays " + label(card)
  s.passes = 0
  if (!s.hands[p].length) { endRound(s, p); return s }
  if (card.rank === 8) {
    if (p === 0 && !suit) { s.phase = "suit"; s.suitCursor = SUITS.indexOf(bestSuit(s.hands[0])); return s }
    s.suit = suit
    if (p !== 0) s.note = NAMES[p] + " plays an 8: " + suitName(suit)
  }
  if (p === 0) s.cursor = Math.min(i, s.hands[0].length - 1)
  nextTurn(s)
  return s
}

function chooseSuit(state, suit) {
  if (state.phase !== "suit") return state
  var s = copy(state)
  s.suit = suit
  s.phase = "play"
  s.cursor = Math.min(s.cursor, s.hands[0].length - 1)
  nextTurn(s)
  return s
}

// Draw until something plays (the drawn card is left for the player to
// choose), or pass when the stock and pile are exhausted.
function drawUntilPlayable(state, p) {
  if (state.phase !== "play" || state.turn !== p) return state
  if (anyPlayable(state, state.hands[p])) return state
  var s = copy(state), n = 0, c
  while ((c = drawOne(s, p))) { n++; if (playable(s, c)) break }
  if (p === 0) {
    s.hands[0] = sortHand(s.hands[0])
    if (c) for (var i = 0; i < s.hands[0].length; ++i) if (s.hands[0][i] === c) s.cursor = i
  }
  if (!c || !playable(s, c)) {
    s.note = (p === 0 ? "You draw " : NAMES[p] + " draws ") + n + " and passes"
    // Nothing left to draw and nobody can play: the round is blocked, and
    // the lightest hand takes it.
    if (++s.passes >= PLAYERS) { endRound(s, lightest(s)); s.note = "Blocked · " + s.note.replace("goes out", "has the lightest hand").replace("You go out", "You have the lightest hand"); return s }
    nextTurn(s)
  } else if (p !== 0) s.note = NAMES[p] + " draws " + n
  else s.note = "Drew " + n
  return s
}

function lightest(s) {
  var b = 0
  for (var i = 1; i < PLAYERS; ++i) if (handPoints(s.hands[i]) < handPoints(s.hands[b])) b = i
  return b
}

function bestSuit(hand) {
  var c = { S: 0, H: 0, D: 0, C: 0 }, best = "S"
  for (var i = 0; i < hand.length; ++i) if (hand[i].rank !== 8) c[hand[i].suit] += 1 + hand[i].rank / 20
  for (var k in c) if (c[k] > c[best]) best = k
  return best
}

// Computer turn: keep eights back, shed the suit it holds most of (and
// high cards first), and when someone's down to one card, change the suit
// on them if it can.
function cpuMove(state) {
  var p = state.turn
  if (p === 0 || state.phase !== "play") return state
  var hand = state.hands[p]
  if (!anyPlayable(state, hand)) {
    var d = drawUntilPlayable(state, p)
    return d.turn === p ? cpuMove(d) : d
  }
  var threat = false
  for (var q = 0; q < PLAYERS; ++q) if (q !== p && state.hands[q].length === 1) threat = true
  var counts = { S: 0, H: 0, D: 0, C: 0 }
  for (var k = 0; k < hand.length; ++k) counts[hand[k].suit]++
  var best = -1, bestV = -1e9
  for (var i = 0; i < hand.length; ++i) {
    var c = hand[i]
    if (!playable(state, c)) continue
    var v = c.rank === 8 ? -20 + (threat ? 30 : 0) + (hand.length === 1 ? 100 : 0) : counts[c.suit] * 3 + cardPoints(c) * 0.3
    if (threat && c.rank !== 8 && c.suit !== state.suit) v += 6
    v += Rng.random()
    if (v > bestV) { bestV = v; best = i }
  }
  var rest = hand.slice(); rest.splice(best, 1)
  return playCard(state, p, best, bestSuit(rest.length ? rest : hand))
}

function nextRound(state) {
  if (state.phase !== "round") return state
  return deal(state.scores.slice(), (state.dealer + 1) % PLAYERS)
}

function moveCursor(state, dx) {
  var s = copy(state)
  if (s.phase === "suit") s.suitCursor = (s.suitCursor + dx + 4) % 4
  else s.cursor = Math.max(0, Math.min(s.hands[0].length - 1, s.cursor + dx))
  return s
}

function leader(s) {
  var b = 0
  for (var i = 1; i < PLAYERS; ++i) if (s.scores[i] > s.scores[b]) b = i
  return b
}

var SUIT_NAMES = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" }
function suitName(s) { return SUIT_NAMES[s] || "" }
var GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" }
function label(c) { return ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[c.rank] || String(c.rank)) + GLYPH[c.suit] }

function serialize(s) { return JSON.parse(JSON.stringify(s)) }
function deserialize(o) {
  if (!o || !o.hands || o.hands.length !== PLAYERS || !o.pile || !o.pile.length) return null
  return copy(o)
}
