.pragma library

// Signpost, after Simon Tatham's. Number every cell 1 to N so each cell's
// successor lies somewhere along the arrow it shows; some numbers are
// given. You don't type numbers: you link a cell to the next one, and the
// numbers follow along each chain from whatever it's anchored to.
//
// Puzzles are prebuilt with one answer (dev/tools/tatham/signpost.js):
// { w, h, arrows: direction 0..7 clockwise from up (-1 on the last cell),
// nums: given number or 0 }.

var DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]

function makeState(p, size, idx) {
  var succ = []
  for (var i = 0; i < p.w * p.h; ++i) succ.push(-1)
  return { p: p, size: size, idx: idx, succ: succ, cursor: { x: 0, y: 0 }, from: -1, history: [], solved: false, note: "" }
}

function copy(s) {
  return { p: s.p, size: s.size, idx: s.idx, succ: s.succ, cursor: s.cursor, from: s.from, history: s.history,
           solved: s.solved, note: "" }
}

function cursorCell(s) { return s.cursor.y * s.p.w + s.cursor.x }

function inRay(p, a, b) {
  var d = p.arrows[a]
  if (d < 0) return false
  var x = a % p.w + DIRS[d][0], y = Math.floor(a / p.w) + DIRS[d][1]
  while (x >= 0 && y >= 0 && x < p.w && y < p.h) {
    if (y * p.w + x === b) return true
    x += DIRS[d][0]; y += DIRS[d][1]
  }
  return false
}

function preds(s) {
  var out = []
  for (var i = 0; i < s.succ.length; ++i) out.push(-1)
  for (var j = 0; j < s.succ.length; ++j) if (s.succ[j] >= 0) out[s.succ[j]] = j
  return out
}

// Chains and what number each cell gets. Returns per cell: { num, label,
// chain, bad } where num is a number if the chain holds a given, else
// label is "a", "a+1"...; bad marks givens that disagree with each other.
function numbering(s) {
  var p = s.p, N = p.w * p.h, pr = preds(s), out = [], chainId = 0, letter = 0
  for (var i = 0; i < N; ++i) out.push(null)
  for (var h = 0; h < N; ++h) {
    if (pr[h] >= 0) continue
    var cells = [], c = h
    while (c >= 0 && cells.length <= N) { cells.push(c); c = s.succ[c] }
    var base = null, bad = false
    for (var k = 0; k < cells.length; ++k) {
      var g = p.nums[cells[k]]
      if (!g) continue
      if (base === null) base = g - k
      else if (g - k !== base) bad = true
    }
    var lab = cells.length > 1 && base === null ? String.fromCharCode(97 + (letter++ % 26)) : ""
    for (var m = 0; m < cells.length; ++m)
      out[cells[m]] = { num: base !== null ? base + m : 0, label: lab ? (m ? lab + "+" + m : lab) : "", chain: chainId, bad: bad }
    chainId++
  }
  return out
}

function isSolved(s) {
  var p = s.p, N = p.w * p.h, start = p.nums.indexOf(1)
  var c = start, k = 1, seen = {}
  while (c >= 0) {
    if (seen[c]) return false
    seen[c] = true
    if (p.nums[c] && p.nums[c] !== k) return false
    c = s.succ[c]; k++
  }
  return k - 1 === N
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.cursor = { x: (s.cursor.x + dx + s.p.w) % s.p.w, y: (s.cursor.y + dy + s.p.h) % s.p.h }
  return n
}

function link(s, a, b) {
  var n = copy(s)
  if (!inRay(s.p, a, b)) { n.note = "not where that arrow points"; return n }
  // Following b's chain back to a would make a loop.
  var c = b, guard = 0
  while (c >= 0 && guard++ < s.succ.length) { if (c === a) { n.note = "that would make a loop"; return n } c = s.succ[c] }
  n.history = s.history.concat([s.succ]).slice(-300)
  var succ = s.succ.slice()
  for (var i = 0; i < succ.length; ++i) if (succ[i] === b) succ[i] = -1
  succ[a] = b
  n.succ = succ
  n.from = s.p.arrows[b] >= 0 ? b : -1
  n.solved = isSolved(n)
  return n
}

// SPACE: pick the cursor cell to link from, or link the picked cell to it.
function activate(s) {
  if (s.solved) return s
  var c = cursorCell(s)
  if (s.from === c) { var n0 = copy(s); n0.from = -1; return n0 }
  if (s.from >= 0) return link(s, s.from, c)
  var n = copy(s)
  if (s.p.arrows[c] < 0) { n.note = "that's the last square"; return n }
  n.from = c
  return n
}

// Cut the links into and out of the cursor cell.
function clear(s) {
  var c = cursorCell(s), pr = preds(s)
  if (s.succ[c] < 0 && pr[c] < 0) { var n0 = copy(s); n0.from = -1; return n0 }
  var n = copy(s)
  n.history = s.history.concat([s.succ]).slice(-300)
  n.succ = s.succ.slice()
  n.succ[c] = -1
  if (pr[c] >= 0) n.succ[pr[c]] = -1
  n.from = -1
  return n
}

function cancel(s) { var n = copy(s); n.from = -1; return n }

function undo(s) {
  if (!s.history.length || s.solved) return s
  var n = copy(s)
  n.succ = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  n.from = -1
  return n
}

function serialize(s) { return { size: s.size, idx: s.idx, succ: s.succ } }

function deserialize(o, p) {
  if (!o || !o.succ || o.succ.length !== p.w * p.h) return null
  var s = makeState(p, o.size, o.idx)
  s.succ = o.succ
  s.solved = isSolved(s)
  return s
}
