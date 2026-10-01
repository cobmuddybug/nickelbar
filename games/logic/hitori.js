.pragma library
.import "../../engine/Rng.js" as Rng

// Hitori: shade cells so that no number repeats among the unshaded cells of
// any row or column, no two shaded cells touch, and the unshaded cells all
// join up. Marks: 0 open, 1 shaded, 2 circled (known to stay).
//
// Generator: a Latin square, some non-touching cells shaded while the rest
// stay connected, then each shaded cell rewritten as a repeat of a number
// beside it. A puzzle is kept only if the human-style solver below (forced
// deductions, plus "try it and see it break at once") finishes it, which
// also makes the answer unique.

function rnd(rand) { return (rand || Rng.random)() }
function shuffle(a, rand) {
  for (var i = a.length - 1; i > 0; --i) {
    var j = Math.floor(rnd(rand) * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}
function range(n) { var a = []; for (var i = 0; i < n; ++i) a.push(i); return a }
function grid(n, v) { var g = []; for (var y = 0; y < n; ++y) g.push(new Array(n).fill(v)); return g }

// Are all cells that are not shaded (mark !== 1) one connected piece?
function connected(marks, n) {
  var start = -1, total = 0
  for (var i = 0; i < n * n; ++i) {
    if (marks[Math.floor(i / n)][i % n] !== 1) { total++; if (start < 0) start = i }
  }
  if (total === 0) return false
  var seen = {}, stack = [start], count = 0
  seen[start] = true
  while (stack.length) {
    var c = stack.pop(); count++
    var x = c % n, y = Math.floor(c / n)
    var nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    for (var k = 0; k < 4; ++k) {
      var nx = nb[k][0], ny = nb[k][1]
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || marks[ny][nx] === 1) continue
      var id = ny * n + nx
      if (!seen[id]) { seen[id] = true; stack.push(id) }
    }
  }
  return count === total
}

// ---- solver ------------------------------------------------------------------

// cells: 0 unknown, 1 black, 2 white. Returns false on a contradiction.
function propagate(nums, cells, n) {
  var changed = true
  function setc(x, y, v) {
    var cur = cells[y][x]
    if (cur === v) return true
    if (cur !== 0) return false
    cells[y][x] = v; changed = true
    return true
  }
  while (changed) {
    changed = false
    for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) {
      var c = cells[y][x], v = nums[y][x]
      if (c === 2) {
        for (var k = 0; k < n; ++k) {
          if (k !== x && nums[y][k] === v && !setc(k, y, 1)) return false
          if (k !== y && nums[k][x] === v && !setc(x, k, 1)) return false
        }
      } else if (c === 1) {
        var nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
        for (var q = 0; q < 4; ++q) {
          var nx = nb[q][0], ny = nb[q][1]
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
          if (!setc(nx, ny, 2)) return false
        }
      }
    }
    // Lines: an adjacent equal pair has exactly one shaded member, so every
    // other copy of that number in the line is shaded; x y x forces y open.
    for (var dir = 0; dir < 2; ++dir) {
      for (var a = 0; a < n; ++a) {
        var get = function(i) { return dir === 0 ? nums[a][i] : nums[i][a] }
        var put = function(i, val) { return dir === 0 ? setc(i, a, val) : setc(a, i, val) }
        for (var i = 0; i + 1 < n; ++i) {
          if (get(i) === get(i + 1)) {
            for (var j = 0; j < n; ++j) if (j !== i && j !== i + 1 && get(j) === get(i) && !put(j, 1)) return false
          }
          if (i + 2 < n && get(i) === get(i + 2) && !put(i + 1, 2)) return false
        }
      }
    }
    // Connectivity: a cell whose shading would cut the open cells apart is open.
    var wasBlack = connected(cells, n)
    if (!wasBlack) return false
    for (var yy = 0; yy < n; ++yy) for (var xx = 0; xx < n; ++xx) {
      if (cells[yy][xx] !== 0) continue
      cells[yy][xx] = 1
      var ok = connected(cells, n)
      cells[yy][xx] = 0
      if (!ok && !setc(xx, yy, 2)) return false
    }
  }
  return true
}

function copy(cells) { return cells.map(function(r) { return r.slice() }) }

// Full solver: propagate, then one level of trial (assume a value; if that
// breaks at once, the other value is forced). Returns the solved cells or null.
function solve(nums, n, useTrial) {
  var cells = grid(n, 0)
  if (!propagate(nums, cells, n)) return null
  var progress = true
  while (progress) {
    progress = false
    var unknown = 0
    for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) if (cells[y][x] === 0) unknown++
    if (!unknown) break
    if (!useTrial) break
    for (var y2 = 0; y2 < n && !progress; ++y2) for (var x2 = 0; x2 < n && !progress; ++x2) {
      if (cells[y2][x2] !== 0) continue
      for (var v = 1; v <= 2; ++v) {
        var t = copy(cells); t[y2][x2] = v
        if (!propagate(nums, t, n)) {
          cells[y2][x2] = 3 - v
          if (!propagate(nums, cells, n)) return null
          progress = true
          break
        }
      }
    }
  }
  for (var a = 0; a < n; ++a) for (var b = 0; b < n; ++b) if (cells[a][b] === 0) return null
  return isSolution(nums, cells, n) ? cells : null
}

// Rules only (marks: 1 shaded; anything else counts as open).
function isSolution(nums, marks, n) {
  for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) {
    if (marks[y][x] !== 1) continue
    if (x + 1 < n && marks[y][x + 1] === 1) return false
    if (y + 1 < n && marks[y + 1][x] === 1) return false
  }
  for (var a = 0; a < n; ++a) {
    var rowSeen = {}, colSeen = {}
    for (var b = 0; b < n; ++b) {
      if (marks[a][b] !== 1) { if (rowSeen[nums[a][b]]) return false; rowSeen[nums[a][b]] = true }
      if (marks[b][a] !== 1) { if (colSeen[nums[b][a]]) return false; colSeen[nums[b][a]] = true }
    }
  }
  return connected(marks, n)
}

// Brute-force count of solutions (used by the tests on small boards).
function countSolutions(nums, n, limit) {
  var count = 0, marks = grid(n, 0)
  function rec(i) {
    if (count >= limit) return
    if (i === n * n) { if (isSolution(nums, marks, n)) count++; return }
    var x = i % n, y = Math.floor(i / n)
    marks[y][x] = 0; rec(i + 1)
    var adj = (x > 0 && marks[y][x - 1] === 1) || (y > 0 && marks[y - 1][x] === 1)
    if (!adj) { marks[y][x] = 1; rec(i + 1); marks[y][x] = 0 }
  }
  rec(0)
  return count
}

// ---- generator -----------------------------------------------------------------

function randomBlacks(n, want, rand) {
  var marks = grid(n, 0)
  var order = shuffle(range(n * n), rand), placed = 0
  for (var i = 0; i < order.length && placed < want; ++i) {
    var x = order[i] % n, y = Math.floor(order[i] / n)
    if ((x > 0 && marks[y][x - 1] === 1) || (x + 1 < n && marks[y][x + 1] === 1) ||
        (y > 0 && marks[y - 1][x] === 1) || (y + 1 < n && marks[y + 1][x] === 1)) continue
    marks[y][x] = 1
    if (!connected(marks, n)) { marks[y][x] = 0; continue }
    placed++
  }
  return marks
}

function generate(n, rand) {
  for (var attempt = 0; attempt < 400; ++attempt) {
    var rows = shuffle(range(n), rand), cols = shuffle(range(n), rand), syms = shuffle(range(n), rand)
    var nums = grid(n, 0)
    for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) nums[y][x] = syms[(rows[y] + cols[x]) % n] + 1
    var blacks = randomBlacks(n, Math.round(n * n * (0.24 + rnd(rand) * 0.08)), rand)
    var ok = true
    for (var by = 0; by < n && ok; ++by) for (var bx = 0; bx < n && ok; ++bx) {
      if (blacks[by][bx] !== 1) continue
      var opts = []
      for (var k = 0; k < n; ++k) {
        if (k !== bx && blacks[by][k] !== 1) opts.push(nums[by][k])
        if (k !== by && blacks[k][bx] !== 1) opts.push(nums[k][bx])
      }
      if (!opts.length) { ok = false; break }
      nums[by][bx] = opts[Math.floor(rnd(rand) * opts.length)]
    }
    if (!ok) continue
    var sol = solve(nums, n, true)
    if (sol) {
      var mask = sol.map(function(r) { return r.map(function(v) { return v === 1 ? 1 : 0 }) })
      return { nums: nums, solution: mask }
    }
  }
  return null
}

// ---- play state ---------------------------------------------------------------

function makeState(n, rand) {
  n = n || 6
  var p = generate(n, rand)
  while (!p) p = generate(n, rand)
  return { size: n, nums: p.nums, solution: p.solution, marks: grid(n, 0), cursor: { x: 0, y: 0 },
           moves: 0, won: false, history: [] }
}

function clone(s, patch) {
  var o = { size: s.size, nums: s.nums, solution: s.solution, marks: s.marks, cursor: s.cursor,
            moves: s.moves, won: s.won, history: s.history }
  for (var k in patch) o[k] = patch[k]
  return o
}

function moveCursor(s, dx, dy) {
  var x = Math.max(0, Math.min(s.size - 1, s.cursor.x + dx)), y = Math.max(0, Math.min(s.size - 1, s.cursor.y + dy))
  return clone(s, { cursor: { x: x, y: y } })
}

function setMark(s, x, y, v) {
  if (s.won) return s
  var marks = s.marks.map(function(r) { return r.slice() })
  var was = marks[y][x]
  marks[y][x] = v
  return clone(s, { marks: marks, moves: s.moves + 1, won: isSolution(s.nums, marks, s.size),
                    history: s.history.concat([{ x: x, y: y, was: was }]) })
}

// Toggle shaded (kind 1) or circled (kind 2) at the cursor.
function toggle(s, kind, x, y) {
  x = x === undefined ? s.cursor.x : x; y = y === undefined ? s.cursor.y : y
  var cur = s.marks[y][x]
  return setMark(s, x, y, cur === kind ? 0 : kind)
}

function undo(s) {
  if (s.won || !s.history.length) return s
  var h = s.history[s.history.length - 1]
  var marks = s.marks.map(function(r) { return r.slice() })
  marks[h.y][h.x] = h.was
  return clone(s, { marks: marks, cursor: { x: h.x, y: h.y }, history: s.history.slice(0, -1) })
}

// Cells the player has already got wrong, for the error highlight: shaded
// cells that touch, and circled cells that repeat a number in a line.
// (Plain repeats among open cells are just the puzzle, so they aren't flagged.)
function conflicts(s) {
  var n = s.size, bad = grid(n, false)
  for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) {
    if (s.marks[y][x] === 1) {
      if ((x + 1 < n && s.marks[y][x + 1] === 1) || (y + 1 < n && s.marks[y + 1][x] === 1)) { bad[y][x] = true }
      if ((x > 0 && s.marks[y][x - 1] === 1) || (y > 0 && s.marks[y - 1][x] === 1)) { bad[y][x] = true }
    } else if (s.marks[y][x] === 2) {
      for (var k = 0; k < n; ++k) {
        if (k !== x && s.marks[y][k] === 2 && s.nums[y][k] === s.nums[y][x]) bad[y][x] = true
        if (k !== y && s.marks[k][x] === 2 && s.nums[k][x] === s.nums[y][x]) bad[y][x] = true
      }
    }
  }
  return bad
}

function serialize(s) {
  return { size: s.size, nums: s.nums, solution: s.solution, marks: s.marks, cursor: s.cursor,
           moves: s.moves, won: s.won, history: s.history }
}
function deserialize(o) {
  if (!o || !o.nums || !o.marks || !o.solution) return null
  return { size: o.size || o.nums.length, nums: o.nums, solution: o.solution, marks: o.marks,
           cursor: o.cursor || { x: 0, y: 0 }, moves: o.moves || 0, won: !!o.won,
           history: Array.isArray(o.history) ? o.history : [] }
}
