.pragma library
.import "../../engine/Rng.js" as Rng

// Checkers (English draughts) against a negamax / alpha-beta AI. board[y][x]:
// 0 empty, 1 your man, 2 your king, 3 AI man, 4 AI king; only squares with
// (x + y) odd are used. You start at the bottom and move up.
//
// Captures are compulsory and a jump must be carried on while it can; a man
// that reaches the far row is crowned and stops there. A move is a path of
// squares, and the player builds one a hop at a time: pick a piece, then
// each square it lands on, until the path matches a whole legal move.
// 50 moves each with no capture is a draw.

var N = 8
// Hard deepens until its time budget runs out, so it stays quick in
// crowded king endgames where a fixed depth would stall the shell.
var LEVELS = [{ name: "EASY", depth: 2 }, { name: "MEDIUM", depth: 4 }, { name: "HARD", depth: 10, budget: 300 }]
var DRAW_PLIES = 100

// Two players at the same keyboard instead of the computer (set by the overlay through the game's QML).
var TWO = false
function setTwoPlayer(on) { TWO = !!on }
function isTwoPlayer() { return TWO }

function initialBoard() {
  var b = []
  for (var y = 0; y < N; ++y) {
    var row = []
    for (var x = 0; x < N; ++x) row.push((x + y) % 2 === 1 ? (y < 3 ? 3 : y > 4 ? 1 : 0) : 0)
    b.push(row)
  }
  return b
}

function makeState(level, wins, losses) {
  return { board: initialBoard(), cursor: { x: 0, y: 5 }, sel: [], level: level === undefined ? 1 : level,
           winner: 0, quiet: 0, last: null, history: [], wins: wins || 0, losses: losses || 0, note: "", turn: 1 }
}

function copy(s) {
  return { board: s.board, cursor: s.cursor, sel: s.sel, level: s.level, winner: s.winner, quiet: s.quiet,
           last: s.last, history: s.history, wins: s.wins, losses: s.losses, note: "", turn: s.turn || 1 }
}

// Whose move it is for the person at the keys: always side 1 against the computer.
function me(s) { return TWO ? (s.turn || 1) : 1 }

function side(v) { return v === 1 || v === 2 ? 1 : v === 3 || v === 4 ? 2 : 0 }
function isKing(v) { return v === 2 || v === 4 }
function inside(x, y) { return x >= 0 && y >= 0 && x < N && y < N }

function dirsFor(v) {
  if (isKing(v)) return [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  return side(v) === 1 ? [[-1, -1], [1, -1]] : [[-1, 1], [1, 1]]
}

function crownRow(p) { return p === 1 ? 0 : N - 1 }

// Every jump sequence from (x, y) for piece v, as full paths.
function jumps(b, x, y, v, path, caps, out) {
  var p = side(v), found = false
  var ds = dirsFor(v)
  for (var i = 0; i < ds.length; ++i) {
    var mx = x + ds[i][0], my = y + ds[i][1], lx = x + ds[i][0] * 2, ly = y + ds[i][1] * 2
    if (!inside(lx, ly) || b[ly][lx] !== 0) continue
    var m = b[my][mx]
    if (side(m) === 0 || side(m) === p) continue
    var already = false
    for (var c = 0; c < caps.length; ++c) if (caps[c].x === mx && caps[c].y === my) already = true
    if (already) continue
    found = true
    var np = path.concat([{ x: lx, y: ly }]), nc = caps.concat([{ x: mx, y: my }])
    // Lift the piece while it travels so it can't block its own path.
    b[y][x] = 0; b[my][mx] = -m; b[ly][lx] = v
    if (!isKing(v) && ly === crownRow(p)) out.push({ path: np, caps: nc })
    else jumps(b, lx, ly, v, np, nc, out)
    b[ly][lx] = 0; b[my][mx] = m; b[y][x] = v
  }
  if (!found && caps.length) out.push({ path: path, caps: caps })
}

function moves(b, p) {
  var caps = [], plain = []
  for (var y = 0; y < N; ++y)
    for (var x = 0; x < N; ++x) {
      var v = b[y][x]
      if (side(v) !== p) continue
      jumps(b, x, y, v, [{ x: x, y: y }], [], caps)
      if (caps.length) continue
      var ds = dirsFor(v)
      for (var i = 0; i < ds.length; ++i) {
        var nx = x + ds[i][0], ny = y + ds[i][1]
        if (inside(nx, ny) && b[ny][nx] === 0) plain.push({ path: [{ x: x, y: y }, { x: nx, y: ny }], caps: [] })
      }
    }
  return caps.length ? caps : plain
}

function apply(b, mv) {
  var n = b.map(function(r) { return r.slice() })
  var a = mv.path[0], z = mv.path[mv.path.length - 1]
  var v = n[a.y][a.x]
  n[a.y][a.x] = 0
  for (var i = 0; i < mv.caps.length; ++i) n[mv.caps[i].y][mv.caps[i].x] = 0
  if (v === 1 && z.y === 0) v = 2
  if (v === 3 && z.y === N - 1) v = 4
  n[z.y][z.x] = v
  return n
}

function evaluate(b, p) {
  var sc = 0
  for (var y = 0; y < N; ++y)
    for (var x = 0; x < N; ++x) {
      var v = b[y][x]
      if (!v) continue
      var val = isKing(v) ? 170 : 100 + (side(v) === 1 ? (N - 1 - y) : y) * 3
      if (x >= 2 && x <= 5 && y >= 2 && y <= 5) val += 4
      // Back-row men guard against enemy kings.
      if (!isKing(v) && y === (side(v) === 1 ? N - 1 : 0)) val += 6
      sc += side(v) === p ? val : -val
    }
  return sc
}

var deadline = 0, nodes = 0

function negamax(b, p, depth, alpha, beta) {
  if (deadline && (++nodes & 255) === 0 && Date.now() > deadline) throw "timeout"
  var ms = moves(b, p)
  if (!ms.length) return -100000 - depth
  if (depth <= 0 && !ms[0].caps.length) return evaluate(b, p)
  if (depth <= -2) return evaluate(b, p)   // cap how far forced captures extend the search
  var best = -1e9
  for (var i = 0; i < ms.length; ++i) {
    var v = -negamax(apply(b, ms[i]), 3 - p, depth - 1, -beta, -alpha)
    if (v > best) best = v
    if (v > alpha) alpha = v
    if (alpha >= beta) break
  }
  return best
}

function searchRoot(b, ms, depth) {
  var best = -1e9, pool = []
  for (var i = 0; i < ms.length; ++i) {
    var v = -negamax(apply(b, ms[i]), 1, depth - 1, -1e9, 1e9)
    if (v > best + 0.5) { best = v; pool = [ms[i]] }
    else if (Math.abs(v - best) <= 0.5) pool.push(ms[i])
  }
  return pool
}

function pickMove(b, level) {
  var ms = moves(b, 2)
  if (!ms.length) return null
  if (ms.length === 1) return ms[0]
  var pool = null
  if (!level.budget) pool = searchRoot(b, ms, level.depth)
  else {
    deadline = Date.now() + level.budget
    for (var d = 2; d <= level.depth; ++d) {
      try { pool = searchRoot(b, ms, d) } catch (e) { if (e !== "timeout") throw e; break }
    }
    deadline = 0
  }
  return pool[Math.floor(Rng.random() * pool.length)]
}

function samePt(a, b) { return a.x === b.x && a.y === b.y }

// Legal player moves that start with the squares picked so far.
function candidates(s) {
  var ms = moves(s.board, me(s)), out = []
  for (var i = 0; i < ms.length; ++i) {
    var ok = ms[i].path.length >= s.sel.length
    for (var j = 0; ok && j < s.sel.length; ++j) ok = samePt(ms[i].path[j], s.sel[j])
    if (ok) out.push(ms[i])
  }
  return out
}

// Squares worth highlighting: pieces that can move (nothing picked yet), or
// the next landing squares (a piece picked).
function targets(s) {
  var c = candidates(s), out = [], seen = {}
  var k = s.sel.length
  for (var i = 0; i < c.length; ++i) {
    var p = c[i].path[k]
    if (!p || seen[p.x + "," + p.y]) continue
    seen[p.x + "," + p.y] = true
    out.push(p)
  }
  return out
}

function over(s) { return s.winner !== 0 }

function finish(n) {
  if (!moves(n.board, 1).length) n.winner = 2
  else if (n.quiet >= DRAW_PLIES) n.winner = 3
  return n
}

function play(s, mv) {
  var n = copy(s)
  n.history = s.history.concat([s.board]).slice(-40)
  n.board = apply(s.board, mv)
  n.quiet = mv.caps.length ? 0 : s.quiet + 1
  n.sel = []
  n.last = null
  if (TWO) {
    var who = me(s)
    n.turn = 3 - who
    if (!moves(n.board, 3 - who).length) n.winner = who
    else if (n.quiet >= DRAW_PLIES) n.winner = 3
    return n
  }
  if (!moves(n.board, 2).length) { n.winner = 1; n.wins = s.wins + 1; return n }
  var ai = pickMove(n.board, LEVELS[n.level])
  n.board = apply(n.board, ai)
  n.quiet = ai.caps.length ? 0 : n.quiet + 1
  n.last = ai
  finish(n)
  if (n.winner === 2) n.losses = s.losses + 1
  return n
}

// SPACE on the cursor square: pick a piece, land a hop, or (on the picked
// piece itself) let go.
function activate(s) {
  if (over(s)) return s
  var cur = s.cursor
  if (s.sel.length === 1 && samePt(s.sel[0], cur)) { var d = copy(s); d.sel = []; return d }
  var t = targets(s), hit = false
  for (var i = 0; i < t.length; ++i) if (samePt(t[i], cur)) hit = true
  if (!hit) {
    // Picking a different piece of yours starts over from it.
    if (side(s.board[cur.y][cur.x]) === me(s)) {
      var fresh = copy(s); fresh.sel = []
      if (targets(fresh).some(function(p) { return samePt(p, cur) })) { fresh.sel = [cur]; return fresh }
      fresh.note = moves(s.board, me(s))[0].caps.length ? "you must take a piece" : "that piece can't move"
      return fresh
    }
    var n0 = copy(s); n0.note = s.sel.length ? "can't go there" : "pick one of your pieces"; return n0
  }
  var n = copy(s)
  n.sel = s.sel.concat([cur])
  var c = candidates(n)
  for (var j = 0; j < c.length; ++j) if (c[j].path.length === n.sel.length) return play(s, c[j])
  return n
}

function moveCursor(s, dx, dy) {
  var n = copy(s)
  n.cursor = { x: Math.max(0, Math.min(N - 1, s.cursor.x + dx)), y: Math.max(0, Math.min(N - 1, s.cursor.y + dy)) }
  n.sel = s.sel
  return n
}

function undo(s) {
  if (!s.history.length) return s
  var n = copy(s)
  n.board = s.history[s.history.length - 1]
  n.history = s.history.slice(0, -1)
  n.sel = []
  n.last = null
  n.winner = 0
  if (TWO) n.turn = 3 - (s.turn || 1)
  return n
}

function count(b, p) {
  var c = 0
  for (var y = 0; y < N; ++y) for (var x = 0; x < N; ++x) if (side(b[y][x]) === p) c++
  return c
}

function serialize(s) {
  return { board: s.board, level: s.level, quiet: s.quiet, wins: s.wins, losses: s.losses, over: over(s) }
}

function deserialize(o) {
  if (!o || !o.board || o.board.length !== N) return null
  var s = makeState(o.level, o.wins, o.losses)
  s.board = o.board
  s.quiet = o.quiet || 0
  if (o.over) s.winner = 3
  return s
}
