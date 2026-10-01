.pragma library
.import "../../engine/Rng.js" as Rng

// Spider solitaire: two decks, ten columns, one, two or four suits. Build
// down regardless of suit, but only a same-suit run moves as a unit; a
// full King-to-Ace run of one suit is lifted off the table. Eight runs
// wins. D deals a card onto every column (not while one is empty).
//
// Score is the classic 500, minus one per move, plus 100 per finished run.
// Same keyboard model as klondike.js: the cursor sits on a column at a
// depth; up/down pick how much of the column's run to take; SPACE picks
// up, SPACE on another column drops, SPACE twice sends the run to the best
// column it fits.

var SUIT_SETS = { 1: ["S"], 2: ["S", "H"], 4: ["S", "H", "D", "C"] }
var UNDO_LIMIT = 300

function shuffle(a) {
  var arr = a.slice()
  for (var i = arr.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1))
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t
  }
  return arr
}

function makeDeck(suits) {
  var set = SUIT_SETS[suits] || SUIT_SETS[1]
  var cards = []
  // 104 cards: 8 full suits' worth drawn from the chosen set.
  for (var n = 0; n < 8; ++n)
    for (var r = 1; r <= 13; ++r) cards.push({ rank: r, suit: set[n % set.length] })
  return shuffle(cards)
}

function makeState(suits) {
  var deck = makeDeck(suits)
  var tableau = []
  var idx = 0
  for (var c = 0; c < 10; ++c) {
    var n = c < 4 ? 6 : 5
    var col = []
    for (var k = 0; k < n; ++k) {
      var card = deck[idx++]
      col.push({ rank: card.rank, suit: card.suit, faceUp: k === n - 1 })
    }
    tableau.push(col)
  }
  var s = { suits: suits || 1, tableau: tableau, stock: deck.slice(idx), done: [], moves: 0,
    history: [], cursor: { col: 0, depth: 0 }, selected: null, note: "" }
  s.cursor = { col: 0, depth: runStart(tableau[0]) }
  return s
}

function copy(s) {
  return { suits: s.suits, tableau: s.tableau, stock: s.stock, done: s.done, moves: s.moves,
    history: s.history, cursor: s.cursor, selected: s.selected, note: "" }
}

function snapshot(s) { return { tableau: s.tableau, stock: s.stock, done: s.done, moves: s.moves } }

function beginMove(state) {
  var n = copy(state)
  var h = state.history.concat([snapshot(state)])
  n.history = h.length > UNDO_LIMIT ? h.slice(h.length - UNDO_LIMIT) : h
  n.moves = state.moves + 1
  n.selected = null
  return n
}

function score(s) { return Math.max(0, 500 - s.moves + 100 * s.done.length) }
function isWon(s) { return s.done.length === 8 }
function dealsLeft(s) { return Math.floor(s.stock.length / 10) }

// Index where the movable same-suit run at the bottom of `col` starts.
function runStart(col) {
  if (!col.length) return 0
  var i = col.length - 1
  while (i > 0 && col[i - 1].faceUp && col[i - 1].suit === col[i].suit && col[i - 1].rank === col[i].rank + 1) i--
  return i
}

function canLift(col, depth) { return col.length > 0 && depth >= runStart(col) && depth < col.length }

function canDrop(col, card) { return !col.length || col[col.length - 1].rank === card.rank + 1 }

// Flip the new top card and lift off a finished K..A run if there is one.
function settle(tableau, done, i) {
  var col = tableau[i]
  if (col.length && !col[col.length - 1].faceUp) {
    col = col.slice()
    var top = col[col.length - 1]
    col[col.length - 1] = { rank: top.rank, suit: top.suit, faceUp: true }
    tableau[i] = col
  }
  col = tableau[i]
  if (col.length >= 13 && col[col.length - 1].rank === 1) {
    var start = runStart(col)
    if (col.length - start >= 13 && col[col.length - 13].rank === 13) {
      done = done.concat([col[col.length - 1].suit])
      tableau[i] = col.slice(0, col.length - 13)
      return settle(tableau, done, i)
    }
  }
  return done
}

function moveRun(state, from, depth, to) {
  var src = state.tableau[from]
  if (from === to || !canLift(src, depth)) return null
  var run = src.slice(depth)
  if (!canDrop(state.tableau[to], run[0])) return null
  var s = beginMove(state)
  var t = state.tableau.slice()
  t[from] = src.slice(0, depth)
  t[to] = state.tableau[to].concat(run)
  var done = settle(t, state.done, to)
  done = settle(t, done, from)
  s.tableau = t
  s.done = done
  if (done.length > state.done.length) s.note = "run complete"
  s.cursor = { col: to, depth: runStart(t[to]) }
  return s
}

// Best destination: same suit on top first, then any fit, then an empty
// column (only if the run isn't already the whole column).
function smartTarget(state, from, depth) {
  var run = state.tableau[from].slice(depth)
  var anyFit = -1, empty = -1
  for (var k = 1; k < 10; ++k) {
    var c = (from + k) % 10
    var col = state.tableau[c]
    if (!col.length) { if (empty < 0 && depth > 0) empty = c; continue }
    var top = col[col.length - 1]
    if (top.rank !== run[0].rank + 1) continue
    if (top.suit === run[0].suit) return c
    if (anyFit < 0) anyFit = c
  }
  return anyFit >= 0 ? anyFit : empty
}

function deal(state) {
  if (state.stock.length < 10) { var n = copy(state); n.note = "stock is empty"; return n }
  for (var i = 0; i < 10; ++i)
    if (!state.tableau[i].length) { var m = copy(state); m.note = "fill every column first"; return m }
  var s = beginMove(state)
  var t = state.tableau.slice()
  var done = state.done
  for (var c = 0; c < 10; ++c) {
    var card = state.stock[c]
    t[c] = t[c].concat([{ rank: card.rank, suit: card.suit, faceUp: true }])
  }
  for (var d = 0; d < 10; ++d) done = settle(t, done, d)
  s.tableau = t
  s.stock = state.stock.slice(10)
  s.done = done
  s.cursor = { col: state.cursor.col, depth: runStart(t[state.cursor.col]) }
  return s
}

// Put the cursor on a card directly (for the mouse), no higher than the
// first face-up card.
function setCursor(state, col, depth) {
  var cards = state.tableau[col], first = 0
  while (first < cards.length && !cards[first].faceUp) first++
  var s = copy(state)
  s.cursor = { col: col, depth: cards.length ? Math.max(first, Math.min(cards.length - 1, depth)) : 0 }
  return s
}

function moveCursor(state, dx, dy) {
  var cur = state.cursor, s = copy(state)
  if (dx) {
    var col = (cur.col + dx + 10) % 10
    s.cursor = { col: col, depth: runStart(state.tableau[col]) }
    return s
  }
  var cards = state.tableau[cur.col]
  if (!cards.length) return state
  var first = 0
  while (first < cards.length && !cards[first].faceUp) first++
  var depth = Math.max(first, Math.min(cards.length - 1, cur.depth + dy))
  if (depth === cur.depth) return state
  s.cursor = { col: cur.col, depth: depth }
  return s
}

function activate(state) {
  var cur = state.cursor, sel = state.selected
  if (sel) {
    if (sel.col === cur.col) {
      // Second press on the same column: smart move.
      var target = smartTarget(state, sel.col, sel.depth)
      if (target < 0) { var n = copy(state); n.selected = null; n.note = "nowhere to go"; return n }
      return moveRun(state, sel.col, sel.depth, target) || state
    }
    var moved = moveRun(state, sel.col, sel.depth, cur.col)
    if (moved) return moved
    var bad = copy(state)
    bad.selected = null
    bad.note = "doesn't go there"
    return bad
  }
  var col = state.tableau[cur.col]
  if (!col.length) return state
  if (!canLift(col, cur.depth)) {
    var no = copy(state)
    no.note = "only a same-suit run moves together"
    no.cursor = { col: cur.col, depth: runStart(col) }
    return no
  }
  var s = copy(state)
  s.selected = { col: cur.col, depth: cur.depth }
  return s
}

function undo(state) {
  if (!state.history.length) return state
  var prev = state.history[state.history.length - 1]
  var s = copy(state)
  s.tableau = prev.tableau
  s.stock = prev.stock
  s.done = prev.done
  s.moves = prev.moves + 1 // undo still costs a move, as in the original
  s.history = state.history.slice(0, -1)
  s.selected = null
  s.cursor = { col: state.cursor.col, depth: runStart(prev.tableau[state.cursor.col]) }
  return s
}

function serialize(s) {
  return { suits: s.suits, tableau: s.tableau, stock: s.stock, done: s.done, moves: s.moves }
}

function deserialize(o) {
  if (!o || !o.tableau || o.tableau.length !== 10 || !o.stock) return null
  var s = makeState(o.suits || 1)
  s.tableau = o.tableau
  s.stock = o.stock
  s.done = o.done || []
  s.moves = o.moves || 0
  s.cursor = { col: 0, depth: runStart(s.tableau[0]) }
  return s
}
