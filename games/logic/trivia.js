.pragma library
.import "../../engine/Rng.js" as Rng

// Pure multiple-choice trivia logic. The questions themselves live in
// games/data/trivia/ (built by dev/tools/trivia.py from OpenTriviaQA); this
// module only sees one question at a time as { text, choices, answer, from }.
//
// A run is one topic, played until STRIKES wrong answers; score is the
// number answered right. Phases: "topics" (the picker grid), "question"
// (choosing), "reveal" (right answer shown; SPACE for the next one). As
// everywhere else here, every function returns a fresh top-level object.

var STRIKES = 3
var MENU_COLS = 3

function menu(cursor) {
  return { phase: "topics", cursor: cursor || 0, topic: "", q: null, picked: -1,
           right: 0, strikes: 0, streak: 0, bestStreak: 0, asked: 0 }
}

function copy(s) {
  return { phase: s.phase, cursor: s.cursor, topic: s.topic, q: s.q, picked: s.picked,
           right: s.right, strikes: s.strikes, streak: s.streak, bestStreak: s.bestStreak, asked: s.asked }
}

// A fresh run on `topic`, waiting for its first question (q stays null
// until the topic's file has loaded and ask() hands one in).
function start(topic) {
  var s = menu(0)
  s.phase = "question"
  s.topic = topic
  return s
}

function ask(s, q) {
  var next = copy(s)
  next.phase = "question"
  next.q = q
  next.picked = -1
  next.cursor = 0
  next.asked = s.asked + 1
  return next
}

// Topics are a MENU_COLS-wide grid; choices are a column that wraps.
function moveCursor(s, dx, dy, topicCount) {
  var next = copy(s)
  if (s.phase === "topics") {
    // Left/right wrap through the list; up/down step a row and stop at the edges.
    if (dx !== 0) next.cursor = (s.cursor + dx + topicCount) % topicCount
    var i = s.cursor + dy * MENU_COLS
    if (dy !== 0 && i >= 0 && i < topicCount) next.cursor = i
  } else if (s.phase === "question" && s.q) {
    var n = s.q.choices.length
    next.cursor = (s.cursor + dy + dx + n) % n
  }
  return next
}

function pick(s, i) {
  if (s.phase !== "question" || !s.q || i < 0 || i >= s.q.choices.length) return s
  var next = copy(s)
  next.phase = "reveal"
  next.picked = i
  next.cursor = i
  if (i === s.q.answer) {
    next.right = s.right + 1
    next.streak = s.streak + 1
    next.bestStreak = Math.max(s.bestStreak, next.streak)
  } else {
    next.strikes = s.strikes + 1
    next.streak = 0
  }
  return next
}

function isOver(s) { return !!s && s.phase === "reveal" && s.strikes >= STRIKES }
function wasRight(s) { return !!s && s.phase === "reveal" && s.q && s.picked === s.q.answer }

// ---- decks -----------------------------------------------------------------
// Each topic keeps a seeded shuffle and a position in it, so questions don't
// repeat until the whole topic has been through once, across runs and
// restarts, without saving thousands of indices.

function rng(seed) {
  var a = seed >>> 0
  return function() {
    a = (a + 0x6D2B79F5) >>> 0
    var t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function newSeed() { return Math.floor(Rng.random() * 4294967296) >>> 0 }

function shuffled(n, seed) {
  var out = new Array(n), r = rng(seed)
  for (var i = 0; i < n; ++i) out[i] = i
  for (var j = n - 1; j > 0; --j) {
    var k = Math.floor(r() * (j + 1))
    var t = out[j]; out[j] = out[k]; out[k] = t
  }
  return out
}

// [text, choices, answerIndex] from the data files -> a question object.
function question(row, from) {
  return { text: row[0], choices: row[1], answer: row[2], from: from || "" }
}
