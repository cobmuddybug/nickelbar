.pragma library
.import "../../engine/Rng.js" as Rng

// Pure Mastermind logic. Peg identities are just indices 0-4 into whatever
// 5-color palette the QML file draws with — this module never names a
// color. Every function returns a brand-new top-level state object rather
// than mutating in place (see the note atop snake.js for why that matters
// to QML). "Game over" is never a stored flag: it's derived from the
// current row already having feedback (win, or the 10th row exhausted).

var CODE_LENGTH = 4
var PEG_COLORS = 5
var ROW_COUNT = 10

function randomSecret() {
  var secret = []
  for (var i = 0; i < CODE_LENGTH; ++i) secret.push(Math.floor(Rng.random() * PEG_COLORS))
  return secret
}

function makeState() {
  var rows = []
  for (var i = 0; i < ROW_COUNT; ++i) rows.push({ pegs: [0, 0, 0, 0], feedback: null })
  return { secret: randomSecret(), rows: rows, currentRow: 0, currentSlot: 0 }
}

function cloneShallow(state) {
  return { secret: state.secret, rows: state.rows, currentRow: state.currentRow, currentSlot: state.currentSlot }
}

// dx moves the selected slot; dy cycles that slot's peg color, but only on
// the still-open current row. Both can apply in the same call.
function moveCursor(state, dx, dy) {
  var next = cloneShallow(state)
  if (dx !== 0) next.currentSlot = Math.max(0, Math.min(CODE_LENGTH - 1, state.currentSlot + dx))

  if (dy !== 0) {
    var row = state.rows[state.currentRow]
    if (row.feedback === null) {
      var idx = row.pegs[next.currentSlot]
      var newIdx = dy < 0 ? (idx - 1 + PEG_COLORS) % PEG_COLORS : (idx + 1) % PEG_COLORS
      var newPegs = row.pegs.slice(); newPegs[next.currentSlot] = newIdx
      var newRows = state.rows.slice(); newRows[state.currentRow] = { pegs: newPegs, feedback: null }
      next.rows = newRows
    }
  }
  return next
}

// Directly sets the selected slot's colour and advances to the next slot —
// what the digit keys 1-5 do.
function setPeg(state, colorIdx) {
  var row = state.rows[state.currentRow]
  if (row.feedback !== null || colorIdx < 0 || colorIdx >= PEG_COLORS) return state
  var next = cloneShallow(state)
  var newPegs = row.pegs.slice(); newPegs[state.currentSlot] = colorIdx
  var newRows = state.rows.slice(); newRows[state.currentRow] = { pegs: newPegs, feedback: null }
  next.rows = newRows
  next.currentSlot = Math.min(CODE_LENGTH - 1, state.currentSlot + 1)
  return next
}

// Classic two-pass Mastermind scoring: exact-position matches first (black),
// then remaining same-color matches (white), each peg consumed at most once.
function computeFeedback(guess, secret) {
  var secretUsed = [false, false, false, false]
  var guessUsed = [false, false, false, false]
  var black = 0
  for (var i = 0; i < CODE_LENGTH; ++i) {
    if (guess[i] === secret[i]) { black++; secretUsed[i] = true; guessUsed[i] = true }
  }
  var white = 0
  for (var g = 0; g < CODE_LENGTH; ++g) {
    if (guessUsed[g]) continue
    for (var s = 0; s < CODE_LENGTH; ++s) {
      if (!secretUsed[s] && guess[g] === secret[s]) { white++; secretUsed[s] = true; break }
    }
  }
  return { black: black, white: white }
}

function submit(state) {
  var row = state.rows[state.currentRow]
  if (row.feedback !== null) return state // already submitted, nothing to do

  var feedback = computeFeedback(row.pegs, state.secret)
  var newRows = state.rows.slice()
  newRows[state.currentRow] = { pegs: row.pegs, feedback: feedback }

  var next = cloneShallow(state)
  next.rows = newRows
  if (feedback.black !== CODE_LENGTH && state.currentRow < ROW_COUNT - 1) {
    // The next row starts as a copy of this guess: most turns only change
    // a peg or two, and re-dialling all four from scratch is busywork.
    next.rows[state.currentRow + 1] = { pegs: row.pegs.slice(), feedback: null }
    next.currentRow = state.currentRow + 1
    next.currentSlot = 0
  }
  return next
}

function currentFeedback(state) { return state.rows[state.currentRow].feedback }
function isOver(state) {
  var fb = currentFeedback(state)
  return !!fb && (fb.black === CODE_LENGTH || state.currentRow === ROW_COUNT - 1)
}
function isWon(state) {
  var fb = currentFeedback(state)
  return !!fb && fb.black === CODE_LENGTH
}
function score(state) {
  return isWon(state) ? (ROW_COUNT + 1 - (state.currentRow + 1)) * 10 : 0
}

function serialize(state) {
  return { secret: state.secret, rows: state.rows, currentRow: state.currentRow, currentSlot: state.currentSlot }
}

function deserialize(obj) {
  if (!obj || !Array.isArray(obj.secret) || obj.secret.length !== CODE_LENGTH) return null
  if (!Array.isArray(obj.rows) || obj.rows.length !== ROW_COUNT) return null
  for (var i = 0; i < ROW_COUNT; ++i) {
    var r = obj.rows[i]
    if (!r || !Array.isArray(r.pegs) || r.pegs.length !== CODE_LENGTH) return null
  }
  return {
    secret: obj.secret.slice(),
    rows: obj.rows.map(function(r) {
      return { pegs: r.pegs.slice(), feedback: r.feedback ? { black: r.feedback.black || 0, white: r.feedback.white || 0 } : null }
    }),
    currentRow: typeof obj.currentRow === "number" ? Math.max(0, Math.min(ROW_COUNT - 1, obj.currentRow)) : 0,
    currentSlot: typeof obj.currentSlot === "number" ? Math.max(0, Math.min(CODE_LENGTH - 1, obj.currentSlot)) : 0
  }
}
