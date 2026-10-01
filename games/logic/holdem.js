.pragma library
.import "../../engine/Rng.js" as Rng

// Texas Hold'em, no limit, you against three computer players. Blinds 10/20
// and rising, 1000 chips each to start. Side pots are handled, bots have
// different tempers (a rock, a calling station, a maniac). The session ends
// when you bust or when you've taken everyone's chips.

var START = 1000
var NAMES = ["You", "Rook", "Daisy", "Rex"]
var STYLES = [null, { tight: 0.62, aggr: 0.35, bluff: 0.03 }, { tight: 0.36, aggr: 0.2, bluff: 0.04 }, { tight: 0.45, aggr: 0.7, bluff: 0.16 }]
var RAISE_SIZES = ["MIN", "½ POT", "POT", "ALL IN"]

// ---- hand evaluation ---------------------------------------------------------------------

function rk(c) { return c.rank === 1 ? 14 : c.rank }

function eval5(cards) {
  var counts = {}, suits = {}, i
  for (i = 0; i < 5; ++i) { var r = rk(cards[i]); counts[r] = (counts[r] || 0) + 1; suits[cards[i].suit] = true }
  var ranks = Object.keys(counts).map(Number)
  ranks.sort(function(a, b) { return counts[b] - counts[a] || b - a })
  var flush = Object.keys(suits).length === 1, straightTop = 0
  if (ranks.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightTop = ranks[0]
    else if (ranks[0] === 14 && ranks[1] === 5 && ranks[4] === 2) straightTop = 5
  }
  var g = ranks.map(function(r) { return counts[r] }), cat
  if (straightTop && flush) cat = 8
  else if (g[0] === 4) cat = 7
  else if (g[0] === 3 && g[1] === 2) cat = 6
  else if (flush) cat = 5
  else if (straightTop) cat = 4
  else if (g[0] === 3) cat = 3
  else if (g[0] === 2 && g[1] === 2) cat = 2
  else if (g[0] === 2) cat = 1
  else cat = 0
  var order = straightTop ? [straightTop] : ranks
  var v = cat
  for (i = 0; i < 5; ++i) v = v * 15 + (order[i] || 0)
  return v
}

// Best five of five, six or seven cards.
function best(cards) {
  var n = cards.length, top = -1
  if (n === 5) return eval5(cards)
  for (var a = 0; a < n; ++a)
    for (var b = a; b < n; ++b) {
      if ((n === 6) !== (a === b)) continue
      var five = cards.filter(function(c, i) { return i !== a && i !== b })
      var v = eval5(five)
      if (v > top) top = v
    }
  return top
}

var CAT_NAMES = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"]
function category(v) { return Math.floor(v / Math.pow(15, 5)) }
function handName(v) { return CAT_NAMES[category(v)] }

// ---- table -------------------------------------------------------------------------------

function newDeck() {
  var d = [], suits = ["S", "H", "D", "C"]
  for (var s = 0; s < 4; ++s) for (var r = 1; r <= 13; ++r) d.push({ rank: r, suit: suits[s] })
  for (var i = d.length - 1; i > 0; --i) { var j = Math.floor(Rng.random() * (i + 1)); var t = d[i]; d[i] = d[j]; d[j] = t }
  return d
}

function blinds(hand) { var lvl = Math.min(5, Math.floor((hand - 1) / 8)); return [10, 20, 30, 50, 100, 200][lvl] }

function clonePlayer(p) { var o = {}; for (var k in p) o[k] = p[k]; return o }

function makeState() {
  var players = NAMES.map(function(n, i) {
    return { name: n, chips: START, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, out: false, style: STYLES[i], last: "" }
  })
  var s = { players: players, board: [], deck: [], dealer: 3, hand: 0, street: 0, toAct: -1, currentBet: 0, minRaise: 20, bb: 20,
            phase: "idle", wait: 0, msg: "", winners: [], raises: 0, raiseIdx: 1, done: false, result: "", pot: 0, shown: false }
  return startHand(s)
}

function active(s) { return s.players.filter(function(p) { return !p.out }).length }
function nextIdx(s, i, pred) {
  var n = s.players.length
  for (var k = 1; k <= n; ++k) { var j = (i + k) % n; if (pred(s.players[j], j)) return j }
  return -1
}

function post(p, amt) {
  var a = Math.min(p.chips, amt)
  p.chips -= a; p.bet += a; p.total += a
  if (p.chips === 0) p.allIn = true
}

function startHand(prev) {
  var s = {}; for (var k in prev) s[k] = prev[k]
  s.players = prev.players.map(clonePlayer)
  s.hand = prev.hand + 1
  s.bb = blinds(s.hand)
  s.deck = newDeck(); s.board = []; s.street = 0; s.winners = []; s.msg = ""; s.shown = false; s.raises = 0
  s.players.forEach(function(p) { if (p.chips <= 0) p.out = true; p.hole = []; p.bet = 0; p.total = 0; p.folded = p.out; p.allIn = false; p.acted = false; p.last = "" })
  s.dealer = nextIdx(s, prev.dealer, function(p) { return !p.out })
  var heads = active(s) === 2
  var sb = heads ? s.dealer : nextIdx(s, s.dealer, function(p) { return !p.out })
  var bbi = nextIdx(s, sb, function(p) { return !p.out })
  s.players.forEach(function(p) { if (!p.out) p.hole = [s.deck.pop(), s.deck.pop()] })
  post(s.players[sb], s.bb / 2); post(s.players[bbi], s.bb)
  s.currentBet = s.bb; s.minRaise = s.bb
  s.phase = "bet"
  s.toAct = nextIdx(s, bbi, function(p) { return !p.folded && !p.allIn })
  s.wait = s.toAct === 0 ? 0 : 0.8
  s.pot = potSize(s)
  return s
}

function potSize(s) { return s.players.reduce(function(a, p) { return a + p.total }, 0) }
function toCall(s, i) { return Math.min(s.players[i].chips, s.currentBet - s.players[i].bet) }

// Total a raise would take the player's bet to, for the chosen size.
function raiseTo(s, i, idx) {
  var p = s.players[i], maxTo = p.bet + p.chips, pot = potSize(s) + toCall(s, i)
  var minTo = s.currentBet + s.minRaise
  var to = idx === 0 ? minTo : idx === 1 ? s.currentBet + Math.max(s.minRaise, Math.round(pot / 2)) : idx === 2 ? s.currentBet + Math.max(s.minRaise, pot) : maxTo
  return Math.max(Math.min(to, maxTo), Math.min(minTo, maxTo))
}

function canRaise(s, i) { var p = s.players[i]; return p.bet + p.chips > s.currentBet && s.raises < 4 || (p.bet + p.chips > s.currentBet && i === 0 && s.raises < 6) }

function setRaiseSize(s, d) { var o = shallow(s); o.raiseIdx = Math.max(0, Math.min(3, s.raiseIdx + d)); return o }
function shallow(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

function act(prev, i, action, to) {
  if (prev.phase !== "bet" || prev.toAct !== i) return prev
  var s = shallow(prev); s.players = prev.players.map(clonePlayer)
  var p = s.players[i]
  if (action === "fold") { p.folded = true; p.last = "fold" }
  else if (action === "raise" && canRaise(prev, i)) {
    var target = to === undefined ? raiseTo(prev, i, prev.raiseIdx) : to
    post(p, target - p.bet)
    var size = p.bet - prev.currentBet
    if (size >= prev.minRaise) s.minRaise = size
    s.currentBet = Math.max(prev.currentBet, p.bet); s.raises = prev.raises + 1
    s.players.forEach(function(q, j) { if (j !== i && !q.folded && !q.allIn) q.acted = false })
    p.last = p.allIn ? "all in" : "raise " + p.bet
  } else {
    var c = toCall(prev, i)
    post(p, c)
    p.last = c === 0 ? "check" : p.allIn ? "all in" : "call"
  }
  p.acted = true
  return advance(s, i)
}

function advance(s, from) {
  var live = s.players.filter(function(p) { return !p.folded })
  s.pot = potSize(s)
  if (live.length === 1) return award(s)
  var next = nextIdx(s, from, function(p) { return !p.folded && !p.allIn && !(p.acted && p.bet === s.currentBet) })
  if (next >= 0) { s.toAct = next; s.wait = next === 0 ? 0 : 0.7 + Rng.random() * 0.5; return s }
  // Betting round over.
  if (s.street === 3) return showdown(s)
  return nextStreet(s)
}

function nextStreet(s) {
  s.street += 1
  s.players.forEach(function(p) { p.bet = 0; p.acted = false })
  s.currentBet = 0; s.minRaise = s.bb; s.raises = 0
  var n = s.street === 1 ? 3 : 1
  s.board = s.board.concat(s.deck.splice(s.deck.length - n, n))
  var canAct = s.players.filter(function(p) { return !p.folded && !p.allIn })
  if (canAct.length <= 1) {
    if (s.street >= 3) return showdown(s)
    return nextStreet(s)
  }
  s.toAct = nextIdx(s, active(s) === 2 ? s.dealer : s.dealer, function(p) { return !p.folded && !p.allIn })
  s.wait = s.toAct === 0 ? 0 : 0.8
  return s
}

// Everyone else folded.
function award(s) {
  var w = s.players.findIndex(function(p) { return !p.folded })
  var pot = potSize(s)
  s.players[w].chips += pot
  s.winners = [w]; s.msg = s.players[w].name + (w === 0 ? " win " : " wins ") + pot
  return finish(s)
}

function showdown(s) {
  var vals = s.players.map(function(p) { return p.folded ? -1 : best(p.hole.concat(s.board)) })
  var levels = [], i
  s.players.forEach(function(p) { if (p.total > 0 && levels.indexOf(p.total) < 0) levels.push(p.total) })
  levels.sort(function(a, b) { return a - b })
  var prev = 0, winners = {}, won = {}
  levels.forEach(function(L) {
    var slice = 0, elig = []
    s.players.forEach(function(p, j) { slice += Math.max(0, Math.min(p.total, L) - Math.min(p.total, prev)); if (!p.folded && p.total >= L) elig.push(j) })
    prev = L
    if (!elig.length || slice <= 0) return
    var top = Math.max.apply(null, elig.map(function(j) { return vals[j] }))
    var ws = elig.filter(function(j) { return vals[j] === top })
    var share = Math.floor(slice / ws.length), extra = slice - share * ws.length
    ws.forEach(function(j, k) { var amt = share + (k === 0 ? extra : 0); s.players[j].chips += amt; won[j] = (won[j] || 0) + amt; winners[j] = true })
  })
  s.winners = Object.keys(winners).map(Number)
  s.shown = true
  var top = s.winners.slice().sort(function(a, b) { return vals[b] - vals[a] })[0]
  s.msg = s.winners.map(function(j) { return s.players[j].name }).join(" & ") + (s.winners.indexOf(0) >= 0 && s.winners.length === 1 ? " win " : " win ") + "with " + handName(vals[top])
  return finish(s)
}

function finish(s) {
  s.phase = "over"; s.toAct = -1
  s.pot = 0
  var humanOut = s.players[0].chips <= 0
  var rivals = s.players.filter(function(p, i) { return i > 0 && p.chips > 0 }).length
  if (humanOut) { s.done = true; s.result = "BUST" }
  else if (rivals === 0) { s.done = true; s.result = "CLEANED THEM OUT" }
  return s
}

function nextHand(s) { return s.phase === "over" && !s.done ? startHand(s) : s }

// ---- bots --------------------------------------------------------------------------------

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function strength(s, i) {
  var p = s.players[i], h = p.hole
  if (s.board.length === 0) {
    var hi = Math.max(rk(h[0]), rk(h[1])), lo = Math.min(rk(h[0]), rk(h[1]))
    var v = (hi + lo) / 40 + (hi === lo ? 0.3 + hi / 40 : 0) + (h[0].suit === h[1].suit ? 0.05 : 0) + (hi - lo <= 2 && hi !== lo ? 0.04 : 0)
    return Math.min(1, v)
  }
  var val = best(p.hole.concat(s.board)), cat = category(val)
  var base = [0.2, 0.48, 0.72, 0.8, 0.86, 0.9, 0.96, 0.99, 1][cat]
  if (cat === 1) { var pr = Math.floor(val / 15 / 15 / 15 / 15) % 15; base += pr >= 11 ? 0.1 : pr >= 8 ? 0.04 : -0.06 }
  return Math.min(1, base)
}

function bot(s) {
  var i = s.toAct, p = s.players[i], st = p.style
  var str = strength(s, i), c = toCall(s, i), pot = potSize(s)
  var odds = c / (pot + c || 1)
  var raiseOk = canRaise(s, i) && s.raises < 3
  if (c === 0) {
    if (raiseOk && ((str > 0.62 && Rng.random() < ag + 0.2) || Rng.random() < st.bluff)) return act(s, i, "raise", raiseTo(s, i, str > 0.85 ? 2 : 1))
    return act(s, i, "call")
  }
  var need = (odds * 1.1 + st.tight * 0.35 - 0.05) * [0.8, 1, 1.12][LEVEL]
  var ag = st.aggr * [0.5, 1, 1.3][LEVEL]
  if (str < need && !(c <= s.bb && Rng.random() < 0.35 * (1 - st.tight)) && Rng.random() > st.bluff) return act(s, i, "fold")
  if (raiseOk && ((str > 0.78 && Rng.random() < ag + 0.25) || Rng.random() < st.bluff * 0.7)) return act(s, i, "raise", raiseTo(s, i, str > 0.92 ? 3 : str > 0.8 ? 2 : 1))
  return act(s, i, "call")
}

function step(s, dt) {
  if (s.phase !== "bet" || s.toAct <= 0) return s
  var w = s.wait - dt
  if (w > 0) { var o = shallow(s); o.wait = w; return o }
  return bot(s)
}

function serialize(s) { return { chips: s.players.map(function(p) { return p.chips }), hand: s.hand, dealer: s.dealer } }
function deserialize(o) {
  if (!o || !Array.isArray(o.chips) || o.chips.length !== 4 || o.chips[0] <= 0) return null
  var s = makeState()
  s.players.forEach(function(p, i) { p.chips = o.chips[i]; p.out = p.chips <= 0 })
  s.hand = (o.hand || 1) - 1; s.dealer = o.dealer || 0
  s.players.forEach(function(p) { p.bet = 0; p.total = 0 })
  return startHand(shallow(s))
}
