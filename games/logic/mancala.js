.pragma library
.import "../../engine/Rng.js" as Rng

// Mancala, in its Kalah form. Six pits a side, four seeds each, and a store
// (mancala) at each end. Sow counter-clockwise, one seed per pit, skipping
// the other side's store. Last seed in your store: go again. Last seed in
// an empty pit of yours with seeds opposite: take both. When a side runs
// out, the other side keeps what's left on its own row.
//
// pits[0..5]  your pits, left to right      pits[6]   your store
// pits[7..12] the computer's pits, right to left as you look at the board
//                                            pits[13]  the computer's store
// (so pit i is opposite pit 12 - i)

var PITS = 6
var YOU = 0, CPU = 1
var STORE = [6, 13]

function newPits() { return [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0] }

function makeState() {
  return { pits: newPits(), turn: YOU, cursor: 0, over: false, last: [], note: "", moves: 0 }
}

function side(pit) { return pit < 6 ? YOU : (pit < 13 && pit > 6 ? CPU : -1) }
function firstPit(who) { return who === YOU ? 0 : 7 }

function legal(pits, who) {
  var out = []
  for (var i = 0; i < PITS; ++i) if (pits[firstPit(who) + i] > 0) out.push(firstPit(who) + i)
  return out
}

// Play pit `pit` for `who`. Returns { pits, extra, captured, last, over } without
// touching the turn; pure on the pit array.
function sow(pits, who, pit) {
  var p = pits.slice()
  var n = p[pit]
  p[pit] = 0
  var skip = STORE[1 - who]
  var i = pit
  var path = []
  while (n > 0) {
    i = (i + 1) % 14
    if (i === skip) continue
    p[i]++; n--
    path.push(i)
  }
  var extra = i === STORE[who]
  var captured = 0
  if (!extra && side(i) === who && p[i] === 1 && p[12 - i] > 0) {
    captured = p[i] + p[12 - i]
    p[STORE[who]] += captured
    p[i] = 0; p[12 - i] = 0
  }
  // end of game: one side empty
  var youEmpty = true, cpuEmpty = true
  for (var k = 0; k < PITS; ++k) { if (p[k] > 0) youEmpty = false; if (p[7 + k] > 0) cpuEmpty = false }
  var over = youEmpty || cpuEmpty
  if (over) {
    for (var m = 0; m < PITS; ++m) { p[6] += p[m]; p[m] = 0; p[13] += p[7 + m]; p[7 + m] = 0 }
  }
  return { pits: p, extra: extra && !over, captured: captured, last: path, over: over }
}

function winner(s) {
  if (!s.over) return -1
  if (s.pits[6] === s.pits[13]) return 2
  return s.pits[6] > s.pits[13] ? YOU : CPU
}

// ---- computer player: alpha-beta over the seed count --------------------------------

function evaluate(pits) { return pits[13] - pits[6] }   // from the computer's view

function search(pits, who, depth, alpha, beta) {
  // who is the player to move; returns the best value from the CPU's view
  var moves = legal(pits, who)
  if (depth === 0 || !moves.length) return evaluate(pits)
  var i, r, v
  if (who === CPU) {
    v = -1e9
    for (i = 0; i < moves.length; ++i) {
      r = sow(pits, CPU, moves[i])
      var score = r.over ? evaluate(r.pits) * 10 : search(r.pits, r.extra ? CPU : YOU, depth - 1, alpha, beta)
      if (score > v) v = score
      if (v > alpha) alpha = v
      if (alpha >= beta) break
    }
    return v
  }
  v = 1e9
  for (i = 0; i < moves.length; ++i) {
    r = sow(pits, YOU, moves[i])
    var sc = r.over ? evaluate(r.pits) * 10 : search(r.pits, r.extra ? YOU : CPU, depth - 1, alpha, beta)
    if (sc < v) v = sc
    if (v < beta) beta = v
    if (alpha >= beta) break
  }
  return v
}

// Difficulty (0 easy, 1 normal, 2 hard), set by the overlay through the game's QML.
var LEVEL = 1
function setDifficulty(i) { LEVEL = i === 0 || i === 2 ? i : 1 }

function chooseCpu(pits, depth, rand) {
  var moves = legal(pits, CPU), best = -1, bestV = -1e9
  depth = depth || [3, 8, 9][LEVEL]
  for (var i = 0; i < moves.length; ++i) {
    var r = sow(pits, CPU, moves[i])
    var v = r.over ? evaluate(r.pits) * 10 : search(r.pits, r.extra ? CPU : YOU, depth - 1, -1e9, 1e9)
    v += ((rand || Rng.random)() - 0.5) * 0.01      // tie-break
    if (v > bestV) { bestV = v; best = moves[i] }
  }
  return best
}

// ---- play -----------------------------------------------------------------------------

function clone(s, patch) {
  var o = { pits: s.pits, turn: s.turn, cursor: s.cursor, over: s.over, last: s.last, note: s.note, moves: s.moves }
  for (var k in patch) o[k] = patch[k]
  return o
}

function apply(s, pit) {
  var who = s.turn
  if (s.over || side(pit) !== who || s.pits[pit] === 0) return s
  var r = sow(s.pits, who, pit)
  var name = who === YOU ? "You" : "The computer"
  var note = r.captured ? name + " captured " + r.captured : (r.extra ? (who === YOU ? "You go again" : "The computer goes again") : "")
  var turn = r.over ? who : (r.extra ? who : 1 - who)
  return clone(s, { pits: r.pits, turn: turn, over: r.over, last: r.last, note: note, moves: s.moves + 1 })
}

// move the cursor across your own non-empty pits
function moveCursor(s, dx) {
  if (s.turn !== YOU || s.over || dx === 0) return s
  var c = s.cursor
  for (var i = 0; i < PITS; ++i) {
    c += dx
    if (c < 0 || c >= PITS) return s
    if (s.pits[c] > 0) return clone(s, { cursor: c })
  }
  return s
}

function playCursor(s) {
  return s.turn === YOU ? apply(s, s.cursor) : s
}

function fixCursor(s) {
  if (s.pits[s.cursor] > 0 || s.turn !== YOU) return s
  for (var d = 1; d < PITS; ++d) {
    if (s.cursor + d < PITS && s.pits[s.cursor + d] > 0) return clone(s, { cursor: s.cursor + d })
    if (s.cursor - d >= 0 && s.pits[s.cursor - d] > 0) return clone(s, { cursor: s.cursor - d })
  }
  return s
}

function cpuMove(s, depth, rand) {
  if (s.turn !== CPU || s.over) return s
  var pit = chooseCpu(s.pits, depth, rand)
  return fixCursor(apply(s, pit))
}

function serialize(s) { return s }
function deserialize(o) {
  if (!o || !o.pits || o.pits.length !== 14) return null
  return { pits: o.pits, turn: o.turn === CPU ? CPU : YOU, cursor: o.cursor || 0, over: !!o.over,
           last: o.last || [], note: o.note || "", moves: o.moves || 0 }
}
