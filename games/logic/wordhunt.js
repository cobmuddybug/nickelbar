.pragma library
.import "../../engine/Rng.js" as Rng

// Word Hunt (after Boggle): a 4x4 board of letters, three minutes. Trace
// words through touching tiles (diagonals count, no tile twice in a word).
// Three letters or more; the Qu tile counts as both letters. The dictionary
// is a sorted array of lower-case words, searched by bisection.

var SIZE = 4
var ROUND = 180

var WEIGHTS = { e: 12, a: 9, i: 9, o: 8, n: 6, r: 6, t: 6, l: 4, s: 5, u: 4, d: 4, g: 3, b: 2, c: 2, m: 2,
                p: 2, f: 2, h: 2, v: 1, w: 2, y: 2, k: 1, j: 1, x: 1, q: 1, z: 1 }

function rnd(rand) { return (rand || Rng.random)() }

function randomTile(rand) {
  var total = 0, k
  for (k in WEIGHTS) total += WEIGHTS[k]
  var r = rnd(rand) * total
  for (k in WEIGHTS) { r -= WEIGHTS[k]; if (r < 0) return k === "q" ? "qu" : k }
  return "e"
}

function randomBoard(rand) {
  for (var tries = 0; tries < 50; ++tries) {
    var b = [], vowels = 0
    for (var i = 0; i < SIZE * SIZE; ++i) {
      var t = randomTile(rand); b.push(t)
      if ("aeiou".indexOf(t) >= 0 && t.length === 1) vowels++
    }
    if (vowels >= 4 && vowels <= 7) return b
  }
  return "rstlneaidgcomupb".split("")
}

// ---- dictionary ---------------------------------------------------------------------

function lowerBound(words, w) {
  var lo = 0, hi = words.length
  while (lo < hi) {
    var mid = (lo + hi) >> 1
    if (words[mid] < w) lo = mid + 1; else hi = mid
  }
  return lo
}
function isWord(words, w) { var i = lowerBound(words, w); return i < words.length && words[i] === w }
function hasPrefix(words, p) { var i = lowerBound(words, p); return i < words.length && words[i].indexOf(p) === 0 }

// ---- board search -----------------------------------------------------------------------

function adjacent(a, b) {
  var ax = a % SIZE, ay = Math.floor(a / SIZE), bx = b % SIZE, by = Math.floor(b / SIZE)
  return a !== b && Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1
}

// A path (cell indices) that spells `word`, or null.
function findPath(board, word) {
  var used = []
  function go(cell, pos, path) {
    var t = board[cell]
    if (word.substr(pos, t.length) !== t) return null
    var next = pos + t.length, p = path.concat([cell])
    if (next === word.length) return p
    used[cell] = true
    for (var n = 0; n < SIZE * SIZE; ++n) {
      if (used[n] || !adjacent(cell, n)) continue
      var r = go(n, next, p)
      if (r) { used[cell] = false; return r }
    }
    used[cell] = false
    return null
  }
  for (var c = 0; c < SIZE * SIZE; ++c) {
    used = []
    var r = go(c, 0, [])
    if (r) return r
  }
  return null
}

// Every dictionary word on the board.
function solveAll(board, words) {
  var found = {}, used = []
  function go(cell, str) {
    var s = str + board[cell]
    if (!hasPrefix(words, s)) return
    if (s.length >= 3 && isWord(words, s)) found[s] = true
    used[cell] = true
    for (var n = 0; n < SIZE * SIZE; ++n) if (!used[n] && adjacent(cell, n)) go(n, s)
    used[cell] = false
  }
  for (var c = 0; c < SIZE * SIZE; ++c) go(c, "")
  return Object.keys(found).sort()
}

function points(word) {
  var n = word.length
  return n <= 4 ? 1 : n === 5 ? 2 : n === 6 ? 3 : n === 7 ? 5 : 11
}

// ---- play ---------------------------------------------------------------------------------

function makeState(words, rand) {
  var board = randomBoard(rand), all = []
  if (words && words.length) {
    for (var tries = 0; tries < 30; ++tries) {
      all = solveAll(board, words)
      if (all.length >= 60) break
      board = randomBoard(rand)
    }
  }
  return { board: board, typed: "", found: [], score: 0, timeLeft: ROUND, over: false, note: "", all: all, total: all.length }
}

function clone(s, patch) {
  var o = { board: s.board, typed: s.typed, found: s.found, score: s.score, timeLeft: s.timeLeft, over: s.over,
            note: s.note, all: s.all, total: s.total }
  for (var k in patch) o[k] = patch[k]
  return o
}

function type(s, ch) {
  if (s.over || s.typed.length >= 16) return s
  return clone(s, { typed: s.typed + ch, note: "" })
}
function backspace(s) { return s.over || !s.typed ? s : clone(s, { typed: s.typed.slice(0, -1), note: "" }) }
function clear(s) { return clone(s, { typed: "" }) }

function submitWord(s, word, words) {
  if (s.over) return s
  if (word.length < 3) return clone(s, { typed: "", note: "TOO SHORT" })
  if (s.found.indexOf(word) >= 0) return clone(s, { typed: "", note: "ALREADY FOUND" })
  if (!findPath(s.board, word)) return clone(s, { typed: "", note: "NOT ON THE BOARD" })
  if (!isWord(words, word)) return clone(s, { typed: "", note: "NOT IN THE DICTIONARY" })
  var p = points(word)
  return clone(s, { typed: "", found: s.found.concat([word]), score: s.score + p, note: "+" + p + "  " + word.toUpperCase() })
}

function submit(s, words) { return submitWord(s, s.typed, words) }

function wordOfCells(s, cells) { return cells.map(function(c) { return s.board[c] }).join("") }

function tick(s, dt) {
  if (s.over) return s
  var t = Math.max(0, s.timeLeft - dt)
  return clone(s, { timeLeft: t, over: t <= 0 })
}

// The longest words left on the board, for the results.
function missed(s, n) {
  var left = s.all.filter(function(w) { return s.found.indexOf(w) < 0 })
  left.sort(function(a, b) { return b.length - a.length || (a < b ? -1 : 1) })
  return left.slice(0, n)
}

function serialize(s) {
  return { board: s.board, typed: s.typed, found: s.found, score: s.score, timeLeft: s.timeLeft, over: s.over }
}
function deserialize(o, words) {
  if (!o || !o.board || o.board.length !== SIZE * SIZE) return null
  var s = { board: o.board, typed: o.typed || "", found: o.found || [], score: o.score || 0,
            timeLeft: typeof o.timeLeft === "number" ? o.timeLeft : ROUND, over: !!o.over, note: "", all: [], total: 0 }
  if (words && words.length) { s.all = solveAll(s.board, words); s.total = s.all.length }
  return s
}
