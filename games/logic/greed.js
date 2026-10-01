.pragma library
.import "../../engine/Rng.js" as Rng

// Greed, the push-your-luck dice game (also Farkle, 10,000). Roll six
// dice and set aside at least one scoring die or combination; then either
// bank the turn's points or roll what's left and risk them. A roll with
// nothing that scores is a bust and the turn's points are lost. Score all
// six and you get all six back ("hot dice"). Ten turns; score is the total.
//
// Scoring: a 1 is 100, a 5 is 50; three of a kind is 100 × the face (three
// 1s are 1000), and each die past three doubles it; 1-2-3-4-5-6 is 1500,
// three pairs 750.

var TURNS = 10

function counts(dice) {
  var c = [0, 0, 0, 0, 0, 0, 0]
  for (var i = 0; i < dice.length; ++i) c[dice[i]]++
  return c
}

// Points for exactly these dice, or 0 if any of them doesn't score.
function scoreSet(dice) {
  if (!dice.length) return 0
  var c = counts(dice)
  if (dice.length === 6) {
    if (c[1] && c[2] && c[3] && c[4] && c[5] && c[6]) return 1500
    var pairs = 0
    for (var f = 1; f <= 6; ++f) if (c[f] === 2) pairs++
    if (pairs === 3) return 750
  }
  var pts = 0
  for (var v = 1; v <= 6; ++v) {
    var n = c[v]
    if (!n) continue
    if (n >= 3) pts += (v === 1 ? 1000 : v * 100) * Math.pow(2, n - 3)
    else if (v === 1) pts += n * 100
    else if (v === 5) pts += n * 50
    else return 0
  }
  return pts
}

// Does anything in this roll score at all?
function scores(dice) {
  var c = counts(dice)
  if (c[1] || c[5]) return true
  for (var v = 1; v <= 6; ++v) if (c[v] >= 3) return true
  return scoreSet(dice) > 0
}

// The best-scoring subset of a roll (for the hint and the "take best" key).
function best(dice) {
  var n = dice.length, top = 0, pick = []
  for (var m = 1; m < (1 << n); ++m) {
    var sub = [], idx = []
    for (var i = 0; i < n; ++i) if (m & (1 << i)) { sub.push(dice[i]); idx.push(i) }
    var p = scoreSet(sub)
    if (p > top) { top = p; pick = idx }
  }
  return { points: top, idx: pick }
}

function makeState() {
  return { dice: [], held: [], turnPts: 0, total: 0, turn: 1, cursor: 0, phase: "start", note: "", log: [] }
}

function copy(s) {
  return { dice: s.dice, held: s.held, turnPts: s.turnPts, total: s.total, turn: s.turn, cursor: s.cursor,
           phase: s.phase, note: "", log: s.log }
}

function selected(s) {
  var out = []
  for (var i = 0; i < s.dice.length; ++i) if (s.held[i]) out.push(s.dice[i])
  return out
}

function selPoints(s) { return scoreSet(selected(s)) }

function rollDice(k) {
  var d = []
  for (var i = 0; i < k; ++i) d.push(1 + Math.floor(Rng.random() * 6))
  return d
}

function finished(s) { return s.phase === "done" }

function endTurn(n, banked, note) {
  n.log = n.log.concat([banked])
  n.note = note
  n.turnPts = 0
  n.dice = []; n.held = []
  if (n.turn >= TURNS) { n.phase = "done"; return n }
  n.turn++
  n.phase = "start"
  return n
}

// R: roll. Mid-turn, the dice you've picked are set aside first (they
// must all score).
function roll(s) {
  if (s.phase === "done") return s
  var n = copy(s), keep = 6
  if (s.phase === "picking") {
    var p = selPoints(s)
    if (!p) { n.note = selected(s).length ? "those don't all score" : "set aside something that scores first"; return n }
    n.turnPts = s.turnPts + p
    keep = s.dice.length - selected(s).length
    if (keep === 0) { keep = 6; n.note = "hot dice! all six again" }
  }
  n.dice = rollDice(keep)
  n.held = n.dice.map(function() { return false })
  n.cursor = 0
  if (!scores(n.dice)) { n.phase = "bust"; n.note = "nothing scores: bust"; return n }
  n.phase = "picking"
  return n
}

// B: bank the turn (including what's picked right now).
function bank(s) {
  if (s.phase !== "picking") return s
  var p = selPoints(s)
  if (!p) { var z = copy(s); z.note = selected(s).length ? "those don't all score" : "set aside something that scores first"; return z }
  var n = copy(s)
  var got = s.turnPts + p
  n.total = s.total + got
  return endTurn(n, got, "banked " + got)
}

// After a bust, any key carries on to the next turn.
function acceptBust(s) {
  if (s.phase !== "bust") return s
  return endTurn(copy(s), 0, "")
}

function toggle(s, i) {
  if (s.phase !== "picking" || i < 0 || i >= s.dice.length) return s
  var n = copy(s)
  n.held = s.held.slice()
  n.held[i] = !s.held[i]
  n.cursor = i
  return n
}

function takeBest(s) {
  if (s.phase !== "picking") return s
  var b = best(s.dice), n = copy(s)
  n.held = s.dice.map(function(_, i) { return b.idx.indexOf(i) >= 0 })
  return n
}

function moveCursor(s, dx) {
  if (!s.dice.length) return s
  var n = copy(s)
  n.cursor = (s.cursor + dx + s.dice.length) % s.dice.length
  return n
}

function serialize(s) { return { dice: s.dice, held: s.held, turnPts: s.turnPts, total: s.total, turn: s.turn, phase: s.phase, log: s.log } }

function deserialize(o) {
  if (!o || typeof o.total !== "number" || o.phase === "done") return null
  var s = makeState()
  s.dice = o.dice || []; s.held = o.held || []; s.turnPts = o.turnPts || 0; s.total = o.total; s.turn = o.turn || 1
  s.phase = o.phase || "start"; s.log = o.log || []
  return s
}
