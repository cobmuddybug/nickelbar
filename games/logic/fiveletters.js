.pragma library

// Five Letters: guess the five-letter word in six tries. After each guess
// every letter is marked 2 (right place), 1 (in the word, elsewhere) or 0
// (not in it, or not that many times). Word lists come from
// games/data/words.json (see dev/tools/words.py): `answers` are common
// words, `guesses` everything a guess may be.
//
// Score is the win streak; a miss resets it.

var ROWS = 6
var LEN = 5

function makeState(answer, streak, stats) {
  return { answer: answer, guesses: [], typing: "", won: false, lost: false, note: "",
           streak: streak || 0, stats: stats || { played: 0, wins: 0, dist: [0, 0, 0, 0, 0, 0] } }
}

function copy(s) {
  return { answer: s.answer, guesses: s.guesses, typing: s.typing, won: s.won, lost: s.lost, note: "",
           streak: s.streak, stats: s.stats }
}

function done(s) { return s.won || s.lost }

// Two passes so repeated letters are marked the way people expect: exact
// hits first, then "elsewhere" only while unmatched copies remain.
function mark(guess, answer) {
  var out = [0, 0, 0, 0, 0], left = {}
  for (var i = 0; i < LEN; ++i) {
    if (guess[i] === answer[i]) out[i] = 2
    else left[answer[i]] = (left[answer[i]] || 0) + 1
  }
  for (var j = 0; j < LEN; ++j) {
    if (out[j] === 2) continue
    if (left[guess[j]]) { out[j] = 1; left[guess[j]]-- }
  }
  return out
}

function type(s, ch) {
  if (done(s) || s.typing.length >= LEN || !/^[a-z]$/.test(ch)) return s
  var n = copy(s)
  n.typing = s.typing + ch
  return n
}

function backspace(s) {
  if (done(s) || !s.typing.length) return s
  var n = copy(s)
  n.typing = s.typing.slice(0, -1)
  return n
}

// `valid` is a lookup object of allowed guesses.
function submit(s, valid) {
  if (done(s)) return s
  var n = copy(s)
  if (s.typing.length < LEN) { n.note = "not enough letters"; return n }
  if (!valid[s.typing]) { n.note = "not in the word list"; return n }
  n.guesses = s.guesses.concat([{ word: s.typing, marks: mark(s.typing, s.answer) }])
  n.typing = ""
  var stats = { played: s.stats.played, wins: s.stats.wins, dist: s.stats.dist.slice() }
  if (s.typing === s.answer) {
    n.won = true
    n.streak = s.streak + 1
    stats.played++; stats.wins++; stats.dist[n.guesses.length - 1]++
  } else if (n.guesses.length >= ROWS) {
    n.lost = true
    n.streak = 0
    stats.played++
  }
  n.stats = stats
  return n
}

// Best mark seen for each letter, for the on-screen keyboard: -1 unused.
function letterMarks(s) {
  var out = {}
  for (var i = 0; i < s.guesses.length; ++i) {
    var g = s.guesses[i]
    for (var j = 0; j < LEN; ++j) {
      var ch = g.word[j], m = g.marks[j]
      if (out[ch] === undefined || m > out[ch]) out[ch] = m
    }
  }
  return out
}

function serialize(s) {
  return { answer: s.answer, guesses: s.guesses.map(function(g) { return g.word }), typing: s.typing,
           streak: s.streak, stats: s.stats }
}

// Replays the saved guesses so marks and won/lost are rebuilt, not trusted.
function deserialize(o) {
  if (!o || typeof o.answer !== "string" || o.answer.length !== LEN) return null
  var s = makeState(o.answer, o.streak, o.stats)
  var before = s.stats
  var all = {}
  for (var i = 0; i < (o.guesses || []).length; ++i) all[o.guesses[i]] = true
  for (var j = 0; j < (o.guesses || []).length && !done(s); ++j) {
    s.typing = o.guesses[j]
    s = submit(s, all)
  }
  // Stats in the save already count a finished word; don't count it twice.
  s.stats = before
  if (done(s)) s.streak = o.streak || 0
  s.typing = typeof o.typing === "string" && !done(s) ? o.typing.slice(0, LEN) : ""
  return s
}
