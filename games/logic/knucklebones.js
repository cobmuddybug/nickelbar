.pragma library
.import "../../engine/Rng.js" as Rng

// Knucklebones (the dice game from Cult of the Lamb). Each side has three
// columns of three. On your turn you roll one die and put it in a column
// that has room; any of the other side's dice of the same value in the
// facing column are knocked out. A column scores the sum of its dice,
// except matching dice multiply: n dice showing v are worth v × n × n.
// The round ends when either side's board is full; higher total wins.

var COLS = 3
var ROWS = 3

function roll() { return 1 + Math.floor(Rng.random() * 6) }

function emptyBoard() { return [[], [], []] }

function columnScore(col) {
  var c = [0, 0, 0, 0, 0, 0, 0], pts = 0
  for (var i = 0; i < col.length; ++i) c[col[i]]++
  for (var v = 1; v <= 6; ++v) pts += v * c[v] * c[v]
  return pts
}

function total(board) {
  var t = 0
  for (var i = 0; i < COLS; ++i) t += columnScore(board[i])
  return t
}

function full(board) {
  for (var i = 0; i < COLS; ++i) if (board[i].length < ROWS) return false
  return true
}

function makeState() {
  return { you: emptyBoard(), cpu: emptyBoard(), die: roll(), turn: "you", cursor: 1, done: false, last: null }
}

function copyBoard(b) { return [b[0].slice(), b[1].slice(), b[2].slice()] }

function copy(s) {
  return { you: copyBoard(s.you), cpu: copyBoard(s.cpu), die: s.die, turn: s.turn, cursor: s.cursor, done: s.done, last: s.last }
}

function moveCursor(state, dx) {
  var s = copy(state)
  s.cursor = Math.max(0, Math.min(COLS - 1, state.cursor + dx))
  return s
}

// Put the current die in column `col` for whoever's turn it is.
function place(state, col) {
  if (state.done) return state
  var mine = state.turn === "you" ? "you" : "cpu", theirs = mine === "you" ? "cpu" : "you"
  if (state[mine][col].length >= ROWS) return state
  var s = copy(state)
  s[mine][col].push(state.die)
  var before = s[theirs][col].length
  s[theirs][col] = s[theirs][col].filter(function(v) { return v !== state.die })
  s.last = { who: mine, col: col, value: state.die, knocked: before - s[theirs][col].length }
  if (full(s[mine])) { s.done = true; return s }
  s.turn = theirs
  s.die = roll()
  return s
}

// The computer's pick: what it gains plus what it takes away from you,
// with a nudge against filling a column (and so ending the round) while
// it's behind.
// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function cpuChoice(state) {
  var best = -1, bestV = -1e9, v = state.die
  for (var c = 0; c < COLS; ++c) {
    if (state.cpu[c].length >= ROWS) continue
    var mine = state.cpu[c].concat([v])
    var gain = columnScore(mine) - columnScore(state.cpu[c])
    var theirs = state.you[c].filter(function(x) { return x !== v })
    var hurt = columnScore(state.you[c]) - columnScore(theirs)
    var val = gain + hurt * 1.1
    // Low dice are better spent in a column the other side can't punish.
    if (state.you[c].indexOf(v) < 0 && hurt === 0 && v <= 2) val += 0.5
    var filling = mine.length === ROWS
    if (filling) {
      var endsGame = true
      for (var k = 0; k < COLS; ++k) if (k !== c && state.cpu[k].length < ROWS) endsGame = false
      if (endsGame && total(state.cpu) + gain <= total(state.you) - hurt) val -= 1000
    }
    val += Rng.random() * [3.5, 0.8, 0.1][LEVEL]
    if (val > bestV) { bestV = val; best = c }
  }
  return best
}

function cpuMove(state) {
  if (state.done || state.turn !== "cpu") return state
  return place(state, cpuChoice(state))
}

function outcome(state) {
  var a = total(state.you), b = total(state.cpu)
  return a > b ? "win" : a < b ? "lose" : "draw"
}

function serialize(state) { return JSON.parse(JSON.stringify(state)) }

function deserialize(obj) {
  if (!obj || !obj.you || !obj.cpu || obj.you.length !== COLS) return null
  var s = copy(obj)
  if (s.turn !== "you" && s.turn !== "cpu") return null
  return s
}
