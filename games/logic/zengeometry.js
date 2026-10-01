.pragma library
.import "../../engine/Rng.js" as Rng

// Endless match-3 rules engine, ported from the standalone Zen Geometry
// plugin (github: omarchy-zen-match). Pure and side-effect free like every
// other logic module here — the only change from the original is dropping
// its own top-level NEXT_UID mutable counter in favour of one carried on
// the state object, so multiple boards (or a reload) never share IDs.

var ROWS = 8
var COLS = 8
var TYPE_COUNT = 7

// special: 0 normal, 1 blast (4-line), 2 cross (T/L), 3 prism (5-line)

function makePiece(type, special, uid) {
  return { type: type, special: special || 0, uid: uid }
}

function clonePiece(piece) {
  if (!piece) return null
  return { type: piece.type, special: piece.special || 0, uid: piece.uid }
}

function cloneBoard(board) {
  var out = []
  for (var i = 0; i < board.length; ++i) out.push(clonePiece(board[i]))
  return out
}

function indexOf(row, col) { return row * COLS + col }
function rowOf(index) { return Math.floor(index / COLS) }
function colOf(index) { return index % COLS }
function inBounds(row, col) { return row >= 0 && row < ROWS && col >= 0 && col < COLS }

function adjacent(a, b) {
  if (a < 0 || b < 0 || a >= ROWS * COLS || b >= ROWS * COLS) return false
  var ar = rowOf(a), ac = colOf(a)
  var br = rowOf(b), bc = colOf(b)
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1
}

function neighbour(index, dr, dc) {
  var r = rowOf(index) + dr
  var c = colOf(index) + dc
  return inBounds(r, c) ? indexOf(r, c) : -1
}

function swap(board, a, b) {
  var out = cloneBoard(board)
  var tmp = out[a]
  out[a] = out[b]
  out[b] = tmp
  return out
}

function randomType() { return Math.floor(Rng.random() * TYPE_COUNT) }

function wouldMakeInitialTriple(board, row, col, type) {
  if (col >= 2) {
    var a = board[indexOf(row, col - 1)]
    var b = board[indexOf(row, col - 2)]
    if (a && b && a.type === type && b.type === type) return true
  }
  if (row >= 2) {
    var c = board[indexOf(row - 1, col)]
    var d = board[indexOf(row - 2, col)]
    if (c && d && c.type === type && d.type === type) return true
  }
  return false
}

function formsMatchAt(board, idx) {
  if (idx < 0 || idx >= board.length) return false
  var piece = board[idx]
  if (!piece || piece.type < 0) return false

  var r = rowOf(idx), c = colOf(idx), t = piece.type
  var count = 1, x

  for (x = c - 1; x >= 0; --x) { var pL = board[indexOf(r, x)]; if (!pL || pL.type !== t) break; ++count }
  for (x = c + 1; x < COLS; ++x) { var pR = board[indexOf(r, x)]; if (!pR || pR.type !== t) break; ++count }
  if (count >= 3) return true

  count = 1
  for (x = r - 1; x >= 0; --x) { var pU = board[indexOf(x, c)]; if (!pU || pU.type !== t) break; ++count }
  for (x = r + 1; x < ROWS; ++x) { var pD = board[indexOf(x, c)]; if (!pD || pD.type !== t) break; ++count }
  return count >= 3
}

function swapIsLegal(board, a, b) {
  if (!adjacent(a, b) || !board[a] || !board[b]) return false
  if ((board[a].special || 0) === 3 || (board[b].special || 0) === 3) return true
  var test = swap(board, a, b)
  return formsMatchAt(test, a) || formsMatchAt(test, b)
}

function hasLegalMove(board) {
  for (var i = 0; i < board.length; ++i) {
    var right = neighbour(i, 0, 1)
    var down = neighbour(i, 1, 0)
    if (right >= 0 && swapIsLegal(board, i, right)) return true
    if (down >= 0 && swapIsLegal(board, i, down)) return true
  }
  return false
}

// uid is a mutable counter threaded through as {value: n} so callers can
// keep it beside the board in state without a module-level global.
function makeBoard(uid) {
  for (var attempt = 0; attempt < 200; ++attempt) {
    var board = []
    for (var row = 0; row < ROWS; ++row) {
      for (var col = 0; col < COLS; ++col) {
        var choices = []
        for (var t = 0; t < TYPE_COUNT; ++t) if (!wouldMakeInitialTriple(board, row, col, t)) choices.push(t)
        var type = choices[Math.floor(Rng.random() * choices.length)]
        board.push(makePiece(type, 0, uid.value++))
      }
    }
    if (hasLegalMove(board)) return board
  }
  var fallback = []
  for (var i = 0; i < ROWS * COLS; ++i) fallback.push(makePiece((i + Math.floor(i / COLS)) % TYPE_COUNT, 0, uid.value++))
  return fallback
}

function findRuns(board) {
  var runs = []
  var r, c, start, t, p

  for (r = 0; r < ROWS; ++r) {
    c = 0
    while (c < COLS) {
      p = board[indexOf(r, c)]
      if (!p || p.type < 0) { ++c; continue }
      t = p.type; start = c; ++c
      while (c < COLS) { var nextH = board[indexOf(r, c)]; if (!nextH || nextH.type !== t) break; ++c }
      if (c - start >= 3) {
        var h = []
        for (var hc = start; hc < c; ++hc) h.push(indexOf(r, hc))
        runs.push({ orientation: "h", type: t, indices: h })
      }
    }
  }

  for (c = 0; c < COLS; ++c) {
    r = 0
    while (r < ROWS) {
      p = board[indexOf(r, c)]
      if (!p || p.type < 0) { ++r; continue }
      t = p.type; start = r; ++r
      while (r < ROWS) { var nextV = board[indexOf(r, c)]; if (!nextV || nextV.type !== t) break; ++r }
      if (r - start >= 3) {
        var v = []
        for (var vr = start; vr < r; ++vr) v.push(indexOf(vr, c))
        runs.push({ orientation: "v", type: t, indices: v })
      }
    }
  }

  return runs
}

function overlaps(a, b) {
  if (a.type !== b.type) return false
  var seen = {}
  for (var i = 0; i < a.indices.length; ++i) seen[a.indices[i]] = true
  for (var j = 0; j < b.indices.length; ++j) if (seen[b.indices[j]]) return true
  return false
}

function groupRuns(runs) {
  var parent = []
  var i, j
  for (i = 0; i < runs.length; ++i) parent[i] = i

  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  function unite(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra }

  for (i = 0; i < runs.length; ++i)
    for (j = i + 1; j < runs.length; ++j) if (overlaps(runs[i], runs[j])) unite(i, j)

  var byRoot = {}
  for (i = 0; i < runs.length; ++i) {
    var root = find(i)
    if (!byRoot[root]) byRoot[root] = []
    byRoot[root].push(runs[i])
  }

  var groups = []
  for (var key in byRoot) {
    var groupRunsList = byRoot[key]
    var set = {}, indices = []
    var hasH = false, hasV = false, longest = groupRunsList[0]
    for (i = 0; i < groupRunsList.length; ++i) {
      var run = groupRunsList[i]
      if (run.orientation === "h") hasH = true
      if (run.orientation === "v") hasV = true
      if (run.indices.length > longest.indices.length) longest = run
      for (j = 0; j < run.indices.length; ++j) {
        var idx = run.indices[j]
        if (!set[idx]) { set[idx] = true; indices.push(idx) }
      }
    }
    groups.push({ type: groupRunsList[0].type, runs: groupRunsList, indices: indices, hasH: hasH, hasV: hasV, longest: longest })
  }
  return groups
}

function includesIndex(indices, value) {
  for (var i = 0; i < indices.length; ++i) if (indices[i] === value) return true
  return false
}

function chooseCreationIndex(group, preferredA, preferredB, special) {
  if (includesIndex(group.indices, preferredA)) return preferredA
  if (includesIndex(group.indices, preferredB)) return preferredB

  if (special === 2) {
    for (var i = 0; i < group.runs.length; ++i) {
      if (group.runs[i].orientation !== "h") continue
      for (var j = 0; j < group.runs.length; ++j) {
        if (group.runs[j].orientation !== "v") continue
        for (var a = 0; a < group.runs[i].indices.length; ++a) {
          var idx = group.runs[i].indices[a]
          if (includesIndex(group.runs[j].indices, idx)) return idx
        }
      }
    }
  }

  var longest = group.longest.indices
  return longest[Math.floor(longest.length / 2)]
}

function addUnique(set, queue, idx, protectedSet) {
  if (idx < 0 || idx >= ROWS * COLS) return
  if (protectedSet && protectedSet[idx]) return
  if (!set[idx]) { set[idx] = true; queue.push(idx) }
}

function expandSpecials(board, initialIndices, protectedIndices) {
  var set = {}, queue = [], protectedSet = {}
  var i
  for (i = 0; i < protectedIndices.length; ++i) protectedSet[protectedIndices[i]] = true
  for (i = 0; i < initialIndices.length; ++i) addUnique(set, queue, initialIndices[i], protectedSet)

  for (var q = 0; q < queue.length; ++q) {
    var idx = queue[q]
    var piece = board[idx]
    if (!piece) continue
    var special = piece.special || 0
    var r = rowOf(idx), c = colOf(idx)

    if (special === 1) {
      for (var dr = -1; dr <= 1; ++dr)
        for (var dc = -1; dc <= 1; ++dc)
          if (inBounds(r + dr, c + dc)) addUnique(set, queue, indexOf(r + dr, c + dc), protectedSet)
    } else if (special === 2) {
      for (var cc = 0; cc < COLS; ++cc) addUnique(set, queue, indexOf(r, cc), protectedSet)
      for (var rr = 0; rr < ROWS; ++rr) addUnique(set, queue, indexOf(rr, c), protectedSet)
    }
  }

  var out = []
  for (var key in set) out.push(Number(key))
  out.sort(function(a, b) { return a - b })
  return out
}

function planMatches(board, preferredA, preferredB) {
  var runs = findRuns(board)
  if (runs.length === 0) return { clearIndices: [], creations: [] }

  var groups = groupRuns(runs)
  var clearSet = {}, creations = [], protectedIndices = []

  for (var g = 0; g < groups.length; ++g) {
    var group = groups[g]
    for (var i = 0; i < group.indices.length; ++i) clearSet[group.indices[i]] = true

    var special = 0
    if (group.longest.indices.length >= 5) special = 3
    else if (group.hasH && group.hasV) special = 2
    else if (group.longest.indices.length === 4) special = 1

    if (special !== 0) {
      var creationIndex = chooseCreationIndex(group, preferredA, preferredB, special)
      protectedIndices.push(creationIndex)
      delete clearSet[creationIndex]
      creations.push({ index: creationIndex, piece: special === 3 ? makePiece(-1, 3) : makePiece(group.type, special) })
    }
  }

  var clear = []
  for (var key in clearSet) clear.push(Number(key))
  clear = expandSpecials(board, clear, protectedIndices)
  return { clearIndices: clear, creations: creations }
}

function planPrismSwap(board, a, b) {
  var work = cloneBoard(board)
  var pa = work[a], pb = work[b]
  if (!pa || !pb) return { board: work, clearIndices: [], creations: [] }

  if ((pa.special || 0) === 3 && (pb.special || 0) === 3) {
    var all = []
    for (var i = 0; i < work.length; ++i) all.push(i)
    return { board: work, clearIndices: all, creations: [] }
  }

  var prismIndex = (pa.special || 0) === 3 ? a : b
  var targetIndex = prismIndex === a ? b : a
  var target = work[targetIndex]
  var targetType = target.type
  var initial = [prismIndex]

  if ((target.special || 0) === 1 || (target.special || 0) === 2) {
    var copiedSpecial = target.special
    for (i = 0; i < work.length; ++i) {
      if (i !== prismIndex && work[i] && work[i].type === targetType && (work[i].special || 0) !== 3) {
        work[i] = makePiece(targetType, copiedSpecial, work[i].uid)
        initial.push(i)
      }
    }
  } else {
    for (i = 0; i < work.length; ++i)
      if (i !== prismIndex && work[i] && work[i].type === targetType) initial.push(i)
  }

  return { board: work, clearIndices: expandSpecials(work, initial, []), creations: [] }
}

function applyPlan(board, plan, uid) {
  var out = cloneBoard(board)
  var i
  for (i = 0; i < plan.clearIndices.length; ++i) out[plan.clearIndices[i]] = null
  for (i = 0; i < plan.creations.length; ++i) {
    var creation = plan.creations[i]
    var existing = out[creation.index]
    out[creation.index] = makePiece(creation.piece.type, creation.piece.special || 0, existing && existing.uid ? existing.uid : uid.value++)
  }
  return collapseAndRefill(out, uid)
}

function collapseAndRefill(board, uid) {
  var out = cloneBoard(board)
  for (var col = 0; col < COLS; ++col) {
    var stack = []
    for (var row = ROWS - 1; row >= 0; --row) {
      var p = out[indexOf(row, col)]
      if (p) stack.push(p)
    }
    var write = ROWS - 1
    for (var s = 0; s < stack.length; ++s) { out[indexOf(write, col)] = stack[s]; --write }
    while (write >= 0) { out[indexOf(write, col)] = makePiece(randomType(), 0, uid.value++); --write }
  }
  return out
}

function shuffleBoard(board, uid) {
  var pieces = cloneBoard(board)
  for (var attempt = 0; attempt < 300; ++attempt) {
    for (var i = pieces.length - 1; i > 0; --i) {
      var j = Math.floor(Rng.random() * (i + 1))
      var tmp = pieces[i]; pieces[i] = pieces[j]; pieces[j] = tmp
    }
    if (findRuns(pieces).length === 0 && hasLegalMove(pieces)) return cloneBoard(pieces)
  }
  return makeBoard(uid)
}
