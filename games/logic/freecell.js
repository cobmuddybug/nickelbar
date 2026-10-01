.pragma library
.import "../../engine/Rng.js" as Rng

// FreeCell, pure logic. Every exported mutator returns a brand-new
// top-level state object (see the note at the top of snake.js).
//
// Keyboard model, same shape as klondike.js: row 0 is the four free cells
// (cols 0-3) and four foundations (cols 4-7); row 1 is the eight tableau
// columns, where up/down choose how deep into a run to grab. SPACE
// selects, SPACE elsewhere drops, SPACE on the same card again is the
// smart move (foundation, else a tableau column, else a free cell).
//
// Runs move as a "supermove": the standard limit of
// (free cells + 1) * 2^(empty columns) cards, halved-exponent when the
// destination itself is an empty column. After every move, cards that can
// no longer be useful on the tableau play themselves to the foundations.

var SUITS = ["S", "H", "D", "C"]
var COL_COUNTS = [7, 7, 7, 7, 6, 6, 6, 6]
var UNDO_LIMIT = 250

function isRed(suit) { return suit === "H" || suit === "D" }

function makeState() {
  var deck = []
  for (var s = 0; s < SUITS.length; ++s)
    for (var r = 1; r <= 13; ++r) deck.push({ rank: r, suit: SUITS[s] })
  for (var i = deck.length - 1; i > 0; --i) {
    var j = Math.floor(Rng.random() * (i + 1))
    var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp
  }
  var tableau = [[], [], [], [], [], [], [], []]
  var idx = 0
  for (var c = 0; c < 8; ++c)
    for (var k = 0; k < COL_COUNTS[c]; ++k) tableau[c].push(deck[idx++])
  return {
    freeCells: [null, null, null, null],
    foundations: { S: 0, H: 0, D: 0, C: 0 },
    tableau: tableau,
    cursor: { row: 1, col: 0, depth: 6 },
    selected: null,
    history: [],
    moves: 0,
    note: ""
  }
}

function copy(state) {
  return {
    freeCells: state.freeCells,
    foundations: { S: state.foundations.S, H: state.foundations.H, D: state.foundations.D, C: state.foundations.C },
    tableau: state.tableau, cursor: state.cursor, selected: state.selected,
    history: state.history, moves: state.moves, note: ""
  }
}

function beginMove(state) {
  var next = copy(state)
  var h = state.history.concat([{ freeCells: state.freeCells, tableau: state.tableau,
    foundations: { S: state.foundations.S, H: state.foundations.H, D: state.foundations.D, C: state.foundations.C } }])
  next.history = h.length > UNDO_LIMIT ? h.slice(h.length - UNDO_LIMIT) : h
  next.moves = state.moves + 1
  next.selected = null
  return next
}

// ---- cursor ----------------------------------------------------------------

function topDepth(state, col) { return Math.max(0, state.tableau[col].length - 1) }

// Lowest depth that still starts a valid run ending at the top card.
function runStart(state, col) {
  var c = state.tableau[col]
  if (!c.length) return 0
  var d = c.length - 1
  while (d > 0 && c[d].rank === c[d - 1].rank - 1 && isRed(c[d].suit) !== isRed(c[d - 1].suit)) d--
  return d
}

function clampCursor(state, cur) {
  var col = Math.max(0, Math.min(7, cur.col))
  if (cur.row === 0) return { row: 0, col: col, depth: 0 }
  var depth = Math.max(runStart(state, col), Math.min(topDepth(state, col), cur.depth))
  return { row: 1, col: col, depth: depth }
}

// Put the cursor on a spot directly (for the mouse); clamped like the keys.
function setCursor(state, cur) {
  var out = copy(state)
  out.cursor = clampCursor(state, cur)
  return out
}

function moveCursor(state, dx, dy) {
  var cur = state.cursor, next
  if (dx !== 0) {
    var col = cur.col + dx
    if (col < 0 || col > 7) return state
    next = cur.row === 1 ? { row: 1, col: col, depth: topDepth(state, col) } : { row: 0, col: col, depth: 0 }
  } else if (dy < 0) {
    if (cur.row === 0) return state
    if (cur.depth > runStart(state, cur.col)) next = { row: 1, col: cur.col, depth: cur.depth - 1 }
    else next = { row: 0, col: cur.col, depth: 0 }
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
  for (var i = 0; i + 1 < cards.length; ++i)
    if (cards[i + 1].rank !== cards[i].rank - 1 || isRed(cards[i].suit) === isRed(cards[i + 1].suit)) return false
  return cards.length > 0
}

function selectionCards(state, sel) {
  if (!sel) return []
  if (sel.row === 0) {
    if (sel.col < 4) return state.freeCells[sel.col] ? [state.freeCells[sel.col]] : []
    var suit = SUITS[sel.col - 4], rank = state.foundations[suit]
    return rank > 0 ? [{ rank: rank, suit: suit }] : []
  }
  var cards = state.tableau[sel.col].slice(sel.depth)
  return isRun(cards) ? cards : []
}

function freeCellCount(state) {
  var n = 0
  for (var i = 0; i < 4; ++i) if (!state.freeCells[i]) n++
  return n
}

function emptyColumnCount(state, except) {
  var n = 0
  for (var i = 0; i < 8; ++i) if (i !== except && !state.tableau[i].length) n++
  return n
}

function maxMovable(state, toEmptyColumn, sourceCol) {
  var empties = emptyColumnCount(state, sourceCol)
  if (toEmptyColumn) empties = Math.max(0, empties - 1)
  return (freeCellCount(state) + 1) * Math.pow(2, empties)
}

function take(next, sel) {
  if (sel.row === 0 && sel.col < 4) {
    var fc = next.freeCells.slice(); var c = fc[sel.col]; fc[sel.col] = null; next.freeCells = fc
    return [c]
  }
  if (sel.row === 0) {
    var suit = SUITS[sel.col - 4], rank = next.foundations[suit]
    next.foundations[suit] = rank - 1
    return [{ rank: rank, suit: suit }]
  }
  var t = next.tableau.slice()
  var moved = t[sel.col].slice(sel.depth)
  t[sel.col] = t[sel.col].slice(0, sel.depth)
  next.tableau = t
  return moved
}

function dropTo(state, sel, dest) {
  var cards = selectionCards(state, sel)
  if (!cards.length) return null
  if (sel.row === dest.row && sel.col === dest.col) return null
  var next

  if (dest.row === 0 && dest.col < 4) {
    if (cards.length !== 1 || state.freeCells[dest.col]) return null
    next = beginMove(state)
    take(next, sel)
    var fc = next.freeCells.slice(); fc[dest.col] = cards[0]; next.freeCells = fc
  } else if (dest.row === 0) {
    var suit = SUITS[dest.col - 4]
    if (cards.length !== 1 || cards[0].suit !== suit || cards[0].rank !== state.foundations[suit] + 1) return null
    next = beginMove(state)
    take(next, sel)
    next.foundations[suit] = cards[0].rank
  } else {
    var target = state.tableau[dest.col]
    if (target.length) {
      var top = target[target.length - 1]
      if (cards[0].rank !== top.rank - 1 || isRed(cards[0].suit) === isRed(top.suit)) return null
    }
    if (cards.length > maxMovable(state, !target.length, sel.row === 1 ? sel.col : -1)) return null
    next = beginMove(state)
    var moved = take(next, sel)
    var t = next.tableau.slice()
    t[dest.col] = t[dest.col].concat(moved)
    next.tableau = t
  }

  next = autoPlay(next)
  if (dest.row === 1) next.cursor = clampCursor(next, { row: 1, col: dest.col, depth: topDepth(next, dest.col) })
  else next.cursor = clampCursor(next, state.cursor)
  return next
}

// A card is "safe" to send home when nothing could still need to be built
// on it: aces and twos always, otherwise when both opposite-colour
// foundations have reached rank - 1.
function isSafe(state, card) {
  if (card.rank !== state.foundations[card.suit] + 1) return false
  if (card.rank <= 2) return true
  var opp = isRed(card.suit) ? ["S", "C"] : ["H", "D"]
  return state.foundations[opp[0]] >= card.rank - 1 && state.foundations[opp[1]] >= card.rank - 1
}

function autoPlay(state) {
  var s = state, moved = true, guard = 0
  while (moved && guard++ < 60) {
    moved = false
    for (var i = 0; i < 4 && !moved; ++i) {
      var c = s.freeCells[i]
      if (c && isSafe(s, c)) {
        var fc = s.freeCells.slice(); fc[i] = null
        s = copy(s); s.freeCells = fc; s.foundations[c.suit] = c.rank; moved = true
      }
    }
    for (var col = 0; col < 8 && !moved; ++col) {
      var cards = s.tableau[col]
      if (!cards.length) continue
      var top = cards[cards.length - 1]
      if (isSafe(s, top)) {
        var t = s.tableau.slice(); t[col] = cards.slice(0, -1)
        s = copy(s); s.tableau = t; s.foundations[top.suit] = top.rank; moved = true
      }
    }
  }
  if (s !== state) { s.history = state.history; s.moves = state.moves; s.selected = null }
  return s
}

function smartMove(state, sel) {
  var cards = selectionCards(state, sel)
  if (!cards.length) return null
  if (cards.length === 1 && !(sel.row === 0 && sel.col >= 4)) {
    var f = dropTo(state, sel, { row: 0, col: 4 + SUITS.indexOf(cards[0].suit) })
    if (f) return f
  }
  var wholeColumn = sel.row === 1 && sel.depth === 0
  var start = sel.row === 1 ? sel.col : -1
  // Prefer a real build over an empty column.
  for (var pass = 0; pass < 2; ++pass) {
    for (var i = 1; i <= 8; ++i) {
      var col = (start + i + 8) % 8
      var empty = !state.tableau[col].length
      if ((pass === 0) === empty) continue
      if (empty && wholeColumn) continue
      var t = dropTo(state, sel, { row: 1, col: col, depth: 0 })
      if (t) return t
    }
  }
  if (cards.length === 1 && !(sel.row === 0 && sel.col < 4)) {
    for (var c = 0; c < 4; ++c) {
      var fcMove = dropTo(state, sel, { row: 0, col: c, depth: 0 })
      if (fcMove) return fcMove
    }
  }
  return null
}

function deselect(state) { var n = copy(state); n.selected = null; return n }
function withNote(state, note) { var n = copy(state); n.note = note; return n }

function activate(state) {
  var cur = state.cursor, sel = state.selected
  if (sel) {
    if (sel.row === cur.row && sel.col === cur.col && (cur.row === 0 || sel.depth === cur.depth)) {
      var smart = smartMove(state, sel)
      if (smart) return smart
      var none = deselect(state); none.note = "no move for that"
      return none
    }
    var dropped = dropTo(state, sel, cur)
    if (dropped) return dropped
    var cards = selectionCards(state, sel)
    if (cur.row === 1 && cards.length > 1 && cards.length > maxMovable(state, !state.tableau[cur.col].length, sel.row === 1 ? sel.col : -1))
      return withNote(state, "only " + maxMovable(state, !state.tableau[cur.col].length, sel.col) + " cards can move")
    if ((cur.row === 1 || cur.col < 4) && selectionCards(state, cur).length) {
      var re = copy(state); re.selected = { row: cur.row, col: cur.col, depth: cur.depth }
      return re
    }
    return withNote(state, "can't go there")
  }
  var pick = { row: cur.row, col: cur.col, depth: cur.row === 1 ? cur.depth : 0 }
  if (!selectionCards(state, pick).length) return withNote(state, "")
  var p = copy(state); p.selected = pick
  return p
}

function sendHome(state) {
  var sel = state.selected || (state.cursor.row === 1
    ? { row: 1, col: state.cursor.col, depth: topDepth(state, state.cursor.col) }
    : { row: 0, col: state.cursor.col, depth: 0 })
  var cards = selectionCards(state, sel)
  if (cards.length !== 1 || (sel.row === 0 && sel.col >= 4)) return withNote(state, "")
  return dropTo(state, sel, { row: 0, col: 4 + SUITS.indexOf(cards[0].suit) }) || withNote(state, "can't go home yet")
}

// Parks the top/selected card in the first open free cell.
function toFreeCell(state) {
  var sel = state.selected || (state.cursor.row === 1
    ? { row: 1, col: state.cursor.col, depth: topDepth(state, state.cursor.col) } : null)
  if (!sel || sel.row !== 1) return withNote(state, "")
  var top = { row: 1, col: sel.col, depth: topDepth(state, sel.col) }
  for (var c = 0; c < 4; ++c) {
    var n = dropTo(state, top, { row: 0, col: c, depth: 0 })
    if (n) return n
  }
  return withNote(state, "free cells full")
}

function undo(state) {
  if (state.selected) return deselect(state)
  if (!state.history.length) return state
  var h = state.history[state.history.length - 1]
  var next = copy(state)
  next.freeCells = h.freeCells; next.tableau = h.tableau
  next.foundations = { S: h.foundations.S, H: h.foundations.H, D: h.foundations.D, C: h.foundations.C }
  next.history = state.history.slice(0, -1)
  next.moves = state.moves + 1
  next.cursor = clampCursor(next, state.cursor)
  return next
}

function score(state) {
  return state.foundations.S + state.foundations.H + state.foundations.D + state.foundations.C
}

function isWon(state) { return score(state) === 52 }

function serialize(state) {
  return { freeCells: state.freeCells, foundations: state.foundations, tableau: state.tableau,
    cursor: state.cursor, moves: state.moves, history: state.history.slice(-40) }
}

function deserialize(obj) {
  if (!obj || !Array.isArray(obj.tableau) || obj.tableau.length !== 8) return null
  if (!Array.isArray(obj.freeCells) || obj.freeCells.length !== 4 || !obj.foundations) return null
  if (!obj.cursor || typeof obj.cursor.row !== "number") return null // pre-rewrite save: deal fresh
  var s = {
    freeCells: obj.freeCells,
    foundations: { S: obj.foundations.S || 0, H: obj.foundations.H || 0, D: obj.foundations.D || 0, C: obj.foundations.C || 0 },
    tableau: obj.tableau, cursor: obj.cursor, selected: null,
    history: Array.isArray(obj.history) ? obj.history : [], moves: obj.moves || 0, note: ""
  }
  s.cursor = clampCursor(s, obj.cursor)
  return s
}
