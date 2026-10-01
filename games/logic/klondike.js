.pragma library
.import "../../engine/Rng.js" as Rng

// Klondike solitaire (draw one), pure logic. Every exported mutator returns
// a brand-new top-level state object — QML's `property var` only notices a
// new reference (see the note atop snake.js).
//
// Keyboard model. The cursor is two rows lined up on the same 7 columns
// the table draws: row 0 is stock (col 0), waste (col 1) and the four
// foundations (cols 3-6; col 2 is the gap and is skipped); row 1 is the
// seven tableau columns. Inside a tableau column, up/down walk `depth`
// through its face-up cards, so a whole run can be picked up; moving up
// past the first face-up card climbs to row 0.
//
// SPACE on a card selects it (plus everything on top of it). SPACE on
// another pile drops it there if legal. SPACE on the SAME card again is
// the smart move: foundation if possible, otherwise the first tableau
// column that takes it. Nothing leaves its pile until a drop succeeds, so
// cancelling never turns a face-down card over early.

var SUITS = ["S", "H", "D", "C"]
var FOUNDATION_COL = { S: 3, H: 4, D: 5, C: 6 }
var UNDO_LIMIT = 250

function isRed(suit) { return suit === "H" || suit === "D" }

function freshDeck() {
  var deck = []
  for (var s = 0; s < SUITS.length; ++s)
    for (var r = 1; r <= 13; ++r) deck.push({ rank: r, suit: SUITS[s] })
  return deck
}

function shuffle(deck) {
  var arr = deck.slice()
  for (var i = arr.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1))
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr
}

function makeState() {
  var deck = shuffle(freshDeck())
  var tableau = []
  var idx = 0
  for (var i = 0; i < 7; ++i) {
    var col = []
    for (var j = 0; j <= i; ++j) {
      var card = deck[idx++]
      col.push({ rank: card.rank, suit: card.suit, faceUp: j === i })
    }
    tableau.push(col)
  }
  return {
    stock: deck.slice(idx).map(function(c) { return { rank: c.rank, suit: c.suit } }),
    waste: [],
    foundations: { S: 0, H: 0, D: 0, C: 0 },
    tableau: tableau,
    cursor: { row: 1, col: 0, depth: 0 },
    selected: null,   // { row, col, depth } of the picked-up card
    history: [],
    moves: 0,
    note: ""
  }
}

function cloneTableau(t) { return t.map(function(col) { return col.slice() }) }

function copy(state) {
  return {
    stock: state.stock, waste: state.waste,
    foundations: { S: state.foundations.S, H: state.foundations.H, D: state.foundations.D, C: state.foundations.C },
    tableau: state.tableau, cursor: state.cursor, selected: state.selected,
    history: state.history, moves: state.moves, note: ""
  }
}

function snapshot(state) {
  return {
    stock: state.stock, waste: state.waste, tableau: state.tableau,
    foundations: { S: state.foundations.S, H: state.foundations.H, D: state.foundations.D, C: state.foundations.C }
  }
}

// Call on the ORIGINAL state before committing a move: returns a copy with
// the pre-move snapshot pushed and the move counted.
function beginMove(state) {
  var next = copy(state)
  var h = state.history.concat([snapshot(state)])
  next.history = h.length > UNDO_LIMIT ? h.slice(h.length - UNDO_LIMIT) : h
  next.moves = state.moves + 1
  next.selected = null
  return next
}

// ---- cursor ----------------------------------------------------------------

function firstFaceUp(col) {
  for (var i = 0; i < col.length; ++i) if (col[i].faceUp) return i
  return col.length
}

function topDepth(state, col) { return Math.max(0, state.tableau[col].length - 1) }

function clampCursor(state, cur) {
  if (cur.row === 0) {
    var c = cur.col === 2 ? 1 : cur.col
    return { row: 0, col: Math.max(0, Math.min(6, c)), depth: 0 }
  }
  var col = Math.max(0, Math.min(6, cur.col))
  var cards = state.tableau[col]
  var lo = Math.min(firstFaceUp(cards), Math.max(0, cards.length - 1))
  var depth = Math.max(lo, Math.min(topDepth(state, col), cur.depth))
  return { row: 1, col: col, depth: depth }
}

// Put the cursor on a spot directly (for the mouse); clamped like the keys.
function setCursor(state, cur) {
  var out = copy(state)
  out.cursor = clampCursor(state, cur)
  return out
}

function moveCursor(state, dx, dy) {
  var cur = state.cursor
  var next
  if (dx !== 0) {
    var col = cur.col + dx
    if (cur.row === 0 && col === 2) col += dx
    if (col < 0 || col > 6) return state
    next = cur.row === 1 ? { row: 1, col: col, depth: topDepth(state, col) } : { row: 0, col: col, depth: 0 }
  } else if (dy < 0) {
    if (cur.row === 0) return state
    var cards = state.tableau[cur.col]
    if (cur.depth > firstFaceUp(cards) && cur.depth > 0) next = { row: 1, col: cur.col, depth: cur.depth - 1 }
    else next = { row: 0, col: cur.col === 2 ? 1 : cur.col, depth: 0 }
  } else if (dy > 0) {
    if (cur.row === 0) next = { row: 1, col: cur.col, depth: topDepth(state, cur.col) }
    else if (cur.depth < topDepth(state, cur.col)) next = { row: 1, col: cur.col, depth: cur.depth + 1 }
    else return state
  } else return state
  var out = copy(state)
  out.cursor = clampCursor(state, next)
  return out
}

// ---- rules -----------------------------------------------------------------

function isRun(cards) {
  if (!cards.length || cards[0].faceUp === false) return false
  for (var i = 0; i + 1 < cards.length; ++i) {
    var a = cards[i], b = cards[i + 1]
    if (b.faceUp === false) return false
    if (b.rank !== a.rank - 1 || isRed(a.suit) === isRed(b.suit)) return false
  }
  return true
}

// The cards a selection refers to (bottom-most first), or [] if invalid.
function selectionCards(state, sel) {
  if (!sel) return []
  if (sel.row === 0) {
    if (sel.col === 1) return state.waste.length ? [state.waste[state.waste.length - 1]] : []
    if (sel.col >= 3) {
      var suit = SUITS[sel.col - 3], rank = state.foundations[suit]
      return rank > 0 ? [{ rank: rank, suit: suit, faceUp: true }] : []
    }
    return []
  }
  var cards = state.tableau[sel.col].slice(sel.depth)
  return isRun(cards) ? cards : []
}

function canDropOnFoundation(state, cards, suit) {
  if (cards.length !== 1) return false
  var c = cards[0]
  return c.suit === suit && c.rank === state.foundations[suit] + 1
}

function canDropOnTableau(state, cards, col) {
  var target = state.tableau[col]
  if (!target.length) return cards[0].rank === 13
  var top = target[target.length - 1]
  return top.faceUp && cards[0].rank === top.rank - 1 && isRed(cards[0].suit) !== isRed(top.suit)
}

// Removes the selection from its source (turning over any card it
// uncovers) and returns the moved cards, working on `next` in place.
function takeSelection(next, sel) {
  if (sel.row === 0 && sel.col === 1) {
    var w = next.waste.slice(); var c = w.pop(); next.waste = w
    return [{ rank: c.rank, suit: c.suit, faceUp: true }]
  }
  if (sel.row === 0) {
    var suit = SUITS[sel.col - 3]
    var rank = next.foundations[suit]
    next.foundations[suit] = rank - 1
    return [{ rank: rank, suit: suit, faceUp: true }]
  }
  var t = cloneTableau(next.tableau)
  var moved = t[sel.col].slice(sel.depth)
  var rest = t[sel.col].slice(0, sel.depth)
  if (rest.length && !rest[rest.length - 1].faceUp) {
    var e = rest[rest.length - 1]
    rest[rest.length - 1] = { rank: e.rank, suit: e.suit, faceUp: true }
  }
  t[sel.col] = rest
  next.tableau = t
  return moved
}

function dropTo(state, sel, dest) {
  var cards = selectionCards(state, sel)
  if (!cards.length) return null
  if (dest.row === 0) {
    if (dest.col < 3) return null
    var suit = SUITS[dest.col - 3]
    if (!canDropOnFoundation(state, cards, suit)) return null
    var n = beginMove(state)
    takeSelection(n, sel)
    n.foundations[suit] = cards[0].rank
    n.cursor = clampCursor(n, state.cursor)
    return n
  }
  if (sel.row === 1 && sel.col === dest.col) return null
  if (!canDropOnTableau(state, cards, dest.col)) return null
  var m = beginMove(state)
  var moved = takeSelection(m, sel)
  var t = cloneTableau(m.tableau)
  t[dest.col] = t[dest.col].concat(moved)
  m.tableau = t
  m.cursor = clampCursor(m, { row: 1, col: dest.col, depth: t[dest.col].length - 1 })
  return m
}

// Foundation first, then the first tableau column that takes it (an empty
// column only for a king that isn't already at the bottom of its pile).
function smartMove(state, sel) {
  var cards = selectionCards(state, sel)
  if (!cards.length) return null
  if (cards.length === 1 && !(sel.row === 0 && sel.col >= 3)) {
    var f = dropTo(state, sel, { row: 0, col: FOUNDATION_COL[cards[0].suit] })
    if (f) return f
  }
  var kingAtBottom = sel.row === 1 && sel.depth === 0
  var start = sel.row === 1 ? sel.col : -1
  for (var i = 1; i <= 7; ++i) {
    var col = (start + i + 7) % 7
    if (sel.row === 1 && col === sel.col) continue
    if (!state.tableau[col].length && kingAtBottom) continue
    var t = dropTo(state, sel, { row: 1, col: col })
    if (t) return t
  }
  return null
}

function draw(state) {
  if (!state.stock.length && !state.waste.length) return state
  var next = beginMove(state)
  if (state.stock.length) {
    var s = state.stock.slice(); var c = s.pop()
    next.stock = s
    next.waste = state.waste.concat([{ rank: c.rank, suit: c.suit }])
  } else {
    next.stock = state.waste.slice().reverse()
    next.waste = []
  }
  return next
}

function withNote(state, note) {
  var n = copy(state)
  n.note = note
  return n
}

function deselect(state) { var n = copy(state); n.selected = null; return n }

function activate(state) {
  var cur = state.cursor
  var sel = state.selected

  if (cur.row === 0 && cur.col === 0) return sel ? deselect(state) : draw(state)

  if (sel) {
    if (sel.row === cur.row && sel.col === cur.col && (cur.row === 0 || sel.depth === cur.depth)) {
      var smart = smartMove(state, sel)
      if (smart) return smart
      var none = deselect(state); none.note = "no move for that"
      return none
    }
    var dropped = dropTo(state, sel, cur)
    if (dropped) return dropped
    if (cur.row === 1 && selectionCards(state, cur).length) {
      // Not a legal drop, but the cursor is on another movable run: switch
      // the selection to it rather than making the player cancel first.
      var re = copy(state); re.selected = { row: 1, col: cur.col, depth: cur.depth }
      return re
    }
    return withNote(state, "can't go there")
  }

  var pick = { row: cur.row, col: cur.col, depth: cur.row === 1 ? cur.depth : 0 }
  if (!selectionCards(state, pick).length)
    return withNote(state, cur.row === 1 && state.tableau[cur.col].length ? "not a run" : "")
  var p = copy(state)
  p.selected = pick
  return p
}

// Sends the card under the cursor (or the selection) straight home.
function sendHome(state) {
  var sel = state.selected || (state.cursor.row === 1
    ? { row: 1, col: state.cursor.col, depth: topDepth(state, state.cursor.col) }
    : { row: 0, col: state.cursor.col, depth: 0 })
  var cards = selectionCards(state, sel)
  if (cards.length !== 1 || (sel.row === 0 && sel.col >= 3)) return withNote(state, "")
  return dropTo(state, sel, { row: 0, col: FOUNDATION_COL[cards[0].suit] }) || withNote(state, "can't go home yet")
}

function undo(state) {
  if (state.selected) return deselect(state)
  if (!state.history.length) return state
  var h = state.history[state.history.length - 1]
  var next = copy(state)
  next.stock = h.stock; next.waste = h.waste; next.tableau = h.tableau
  next.foundations = { S: h.foundations.S, H: h.foundations.H, D: h.foundations.D, C: h.foundations.C }
  next.history = state.history.slice(0, -1)
  next.moves = state.moves + 1
  next.cursor = clampCursor(next, state.cursor)
  return next
}

// ---- endgame ---------------------------------------------------------------

function score(state) {
  return state.foundations.S + state.foundations.H + state.foundations.D + state.foundations.C
}

function isWon(foundations) {
  return foundations.S === 13 && foundations.H === 13 && foundations.D === 13 && foundations.C === 13
}

// Once the stock is spent and nothing is face down, the rest is mechanical.
function canAutoFinish(state) {
  if (state.stock.length || state.waste.length || isWon(state.foundations)) return false
  for (var i = 0; i < 7; ++i)
    for (var j = 0; j < state.tableau[i].length; ++j)
      if (!state.tableau[i][j].faceUp) return false
  return true
}

// One card home per call (the QML side paces it with a timer).
function autoStep(state) {
  var best = -1, bestRank = 99
  for (var i = 0; i < 7; ++i) {
    var col = state.tableau[i]
    if (!col.length) continue
    var top = col[col.length - 1]
    if (top.rank === state.foundations[top.suit] + 1 && top.rank < bestRank) { best = i; bestRank = top.rank }
  }
  if (best < 0) return state
  var top2 = state.tableau[best][state.tableau[best].length - 1]
  var next = dropTo(state, { row: 1, col: best, depth: state.tableau[best].length - 1 },
    { row: 0, col: FOUNDATION_COL[top2.suit] })
  return next || state
}

// ---- persistence -----------------------------------------------------------

function serialize(state) {
  return {
    stock: state.stock, waste: state.waste, foundations: state.foundations, tableau: state.tableau,
    cursor: state.cursor, moves: state.moves, history: state.history.slice(-40)
  }
}

function deserialize(obj) {
  if (!obj || !Array.isArray(obj.tableau) || obj.tableau.length !== 7 || !obj.foundations) return null
  if (!Array.isArray(obj.stock) || !Array.isArray(obj.waste)) return null
  if (!obj.cursor || typeof obj.cursor.row !== "number") return null // pre-rewrite save: deal fresh
  var s = {
    stock: obj.stock, waste: obj.waste,
    foundations: { S: obj.foundations.S || 0, H: obj.foundations.H || 0, D: obj.foundations.D || 0, C: obj.foundations.C || 0 },
    tableau: obj.tableau, cursor: obj.cursor, selected: null,
    history: Array.isArray(obj.history) ? obj.history : [], moves: obj.moves || 0, note: ""
  }
  s.cursor = clampCursor(s, obj.cursor)
  return s
}
