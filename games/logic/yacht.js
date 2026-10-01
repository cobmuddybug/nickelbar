.pragma library
.import "../../engine/Rng.js" as Rng

// Yacht, with the familiar thirteen-box scorecard: ones to sixes (35 bonus
// at 63), three and four of a kind, full house 25, small straight 30,
// large straight 40, yacht 50, chance. Each extra yacht after a 50 is worth
// 100 more and plays as a joker (full house and straights score in full).
//
// Cursor: row "dice" walks the five dice, row "card" walks the scorecard,
// laid out as two columns (upper 0-5 on the left, lower 6-12 on the right).

var CATS = [
  { id: "ones",   name: "Ones",            upper: 1 },
  { id: "twos",   name: "Twos",            upper: 2 },
  { id: "threes", name: "Threes",          upper: 3 },
  { id: "fours",  name: "Fours",           upper: 4 },
  { id: "fives",  name: "Fives",           upper: 5 },
  { id: "sixes",  name: "Sixes",           upper: 6 },
  { id: "three",  name: "3 of a kind" },
  { id: "four",   name: "4 of a kind" },
  { id: "full",   name: "Full house" },
  { id: "small",  name: "Sm. straight" },
  { id: "large",  name: "Lg. straight" },
  { id: "yacht",  name: "Yacht" },
  { id: "chance", name: "Chance" }
]
var UPPER_BONUS_AT = 63
var UPPER_BONUS = 35
var YACHT_BONUS = 100

function counts(dice) {
  var c = [0, 0, 0, 0, 0, 0, 0]
  for (var i = 0; i < dice.length; ++i) c[dice[i]]++
  return c
}

function sum(dice) { var t = 0; for (var i = 0; i < dice.length; ++i) t += dice[i]; return t }

function isYacht(dice) { return dice.length === 5 && counts(dice).indexOf(5) >= 0 }

function hasRun(c, len) {
  var run = 0
  for (var v = 1; v <= 6; ++v) {
    run = c[v] ? run + 1 : 0
    if (run >= len) return true
  }
  return false
}

// What `dice` would score in box `i`. `joker` = an extra yacht whose own
// box is already filled with 50.
function potential(dice, i, joker) {
  if (!dice.length) return 0
  var cat = CATS[i], c = counts(dice), max = Math.max.apply(null, c)
  if (cat.upper) return c[cat.upper] * cat.upper
  switch (cat.id) {
  case "three": return max >= 3 ? sum(dice) : 0
  case "four": return max >= 4 ? sum(dice) : 0
  case "full": return joker || (c.indexOf(3) >= 0 && c.indexOf(2) >= 0) ? 25 : 0
  case "small": return joker || hasRun(c, 4) ? 30 : 0
  case "large": return joker || hasRun(c, 5) ? 40 : 0
  case "yacht": return max === 5 ? 50 : 0
  case "chance": return sum(dice)
  }
  return 0
}

function makeState() {
  var scores = []
  for (var i = 0; i < CATS.length; ++i) scores.push(null)
  return { dice: [], held: [false, false, false, false, false], rolls: 3, scores: scores,
    yachtBonus: 0, turn: 1, cursor: { row: "dice", i: 0 }, note: "", last: -1 }
}

function copy(s) {
  return { dice: s.dice, held: s.held, rolls: s.rolls, scores: s.scores, yachtBonus: s.yachtBonus,
    turn: s.turn, cursor: s.cursor, note: "", last: s.last }
}

function upperTotal(s) {
  var t = 0
  for (var i = 0; i < 6; ++i) t += s.scores[i] || 0
  return t
}

function bonus(s) { return upperTotal(s) >= UPPER_BONUS_AT ? UPPER_BONUS : 0 }

function total(s) {
  var t = bonus(s) + s.yachtBonus
  for (var i = 0; i < CATS.length; ++i) t += s.scores[i] || 0
  return t
}

function finished(s) {
  for (var i = 0; i < CATS.length; ++i) if (s.scores[i] === null) return false
  return true
}

function joker(s) { return isYacht(s.dice) && s.scores[11] === 50 }

function roll(state) {
  if (finished(state)) return state
  if (state.rolls <= 0) { var n = copy(state); n.note = "no rolls left, pick a box"; return n }
  var s = copy(state)
  var fresh = !state.dice.length
  s.dice = []
  for (var i = 0; i < 5; ++i)
    s.dice.push(!fresh && state.held[i] ? state.dice[i] : 1 + Math.floor(Rng.random() * 6))
  s.rolls = state.rolls - 1
  if (isYacht(s.dice)) s.note = "yacht!"
  // After the last roll, hop to the scorecard.
  if (s.rolls === 0 && state.cursor.row === "dice") s.cursor = { row: "card", i: bestOpen(s) }
  return s
}

function toggleHold(state, i) {
  if (!state.dice.length || state.rolls === 0) return state
  var idx = i === undefined ? state.cursor.i : i
  var s = copy(state)
  s.held = state.held.slice()
  s.held[idx] = !s.held[idx]
  if (i !== undefined) s.cursor = { row: "dice", i: idx }
  return s
}

// The open box that scores most right now (ties go to the lower box).
function bestOpen(s) {
  var best = -1, bestV = -1, jk = joker(s)
  for (var i = 0; i < CATS.length; ++i) {
    if (s.scores[i] !== null) continue
    var v = potential(s.dice, i, jk)
    if (v > bestV) { best = i; bestV = v }
  }
  return Math.max(0, best)
}

function scoreBox(state, i) {
  var idx = i === undefined ? state.cursor.i : i
  if (!state.dice.length) { var n = copy(state); n.note = "roll first (R)"; return n }
  if (state.scores[idx] !== null) { var m = copy(state); m.note = "already used"; return m }
  var s = copy(state)
  var jk = joker(state)
  s.scores = state.scores.slice()
  s.scores[idx] = potential(state.dice, idx, jk)
  if (jk) { s.yachtBonus = state.yachtBonus + YACHT_BONUS; s.note = "yacht bonus +100" }
  s.last = idx
  s.dice = []
  s.held = [false, false, false, false, false]
  s.rolls = 3
  s.turn = state.turn + 1
  s.cursor = { row: "dice", i: 0 }
  return s
}

function moveCursor(state, dx, dy) {
  var c = state.cursor, next
  if (c.row === "dice") {
    if (dx) next = { row: "dice", i: (c.i + dx + 5) % 5 }
    else if (dy > 0) next = { row: "card", i: c.i < 3 ? 0 : 6 }
    else return state
  } else {
    var left = c.i < 6
    if (dx) {
      if (left && dx > 0) next = { row: "card", i: Math.min(12, c.i + 6) }
      else if (!left && dx < 0) next = { row: "card", i: Math.min(5, c.i - 6) }
      else return state
    } else if (dy < 0) {
      next = (c.i === 0 || c.i === 6) ? { row: "dice", i: left ? 1 : 3 } : { row: "card", i: c.i - 1 }
    } else if (dy > 0) {
      if (c.i === 5 || c.i === 12) return state
      next = { row: "card", i: c.i + 1 }
    } else return state
  }
  var s = copy(state)
  s.cursor = next
  return s
}

function activate(state) {
  if (state.cursor.row === "card") return scoreBox(state)
  if (!state.dice.length) return roll(state)
  return toggleHold(state)
}

function serialize(s) {
  return { dice: s.dice, held: s.held, rolls: s.rolls, scores: s.scores, yachtBonus: s.yachtBonus, turn: s.turn }
}

function deserialize(o) {
  if (!o || !o.scores || o.scores.length !== CATS.length) return null
  var s = makeState()
  s.dice = o.dice || []
  s.held = o.held || s.held
  s.rolls = typeof o.rolls === "number" ? o.rolls : 3
  s.scores = o.scores
  s.yachtBonus = o.yachtBonus || 0
  s.turn = o.turn || 1
  if (finished(s)) return null
  return s
}
