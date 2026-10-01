.pragma library

// Roll Block (after Bloxorz). Tip a 1×1×2 block over the tiles and drop it
// upright into the hole. Roll off the edge and you start the level again.
//   #  floor        G  the hole (stand on it to finish)
//   F  fragile: holds the block lying down, gives way under it standing
//   o  round switch: any part of the block toggles the bridges
//   x  cross switch: only the block standing upright toggles them
//   b  bridge, retracted at the start     B  bridge, out at the start
//   S  start (the block stands here)       .  nothing
// Score per level: 200, less 10 for every move over par (at least 20).
//
// The block: { x, y, o } with o "S" standing on (x, y), "H" lying across
// (x, y)-(x+1, y), "V" lying along (x, y)-(x, y+1).

var LEVELS = [
  [ "###.......",
    "#S####....",
    "#########.",
    ".#########",
    ".....##G##",
    "......###." ],
  [ "#####.........",
    "#S###.........",
    "#####.........",
    "..#############",
    "..#####...##G##",
    "..........#####" ],
  [ "###############",
    "#S####FFFF###G#",
    "###..........##",
    "..............." ],
  [ "######........",
    "#S####........",
    "######FFFFFF##",
    "######FFFFFF##",
    "...........#G#",
    "...........###" ],
  [ "....####.......",
    "....#S##.......",
    "....####.......",
    "....##o#bb####.",
    "..........##G#.",
    "..........####." ],
  [ "###.....######",
    "#S#bbbbb##..##",
    "#o#.....##G.##",
    "###.....######" ],
  [ "####......####",
    "#S##bbbbbb##G#",
    "#x##......####",
    "####.........." ],
  [ "..####.........",
    "..#S#o.........",
    "..####.........",
    "..####bbb####..",
    ".........#FF###",
    ".........####bb",
    ".............#G",
    ".............##" ],
  [ "######.........",
    "#S####.........",
    "###.##..#####..",
    "..#.##..##F##..",
    "..######FFFFF..",
    "........##F##..",
    "........##G##..",
    "........#####.." ],
  [ "###...###.......",
    "#S#...#x#.......",
    "#########bbbb###",
    "###...###.#FF#G#",
    "..........######" ],
  [ ".#####.....####",
    ".#S#o#.....#G##",
    ".#####bb##b####",
    "...##.....##...",
    "...######F##...",
    "......#FFF#....",
    "......#####...." ]
]

function parse(n) {
  var rows = LEVELS[n], w = 0
  for (var r = 0; r < rows.length; ++r) w = Math.max(w, rows[r].length)
  var tiles = [], start = null
  for (var y = 0; y < rows.length; ++y) {
    var row = []
    for (var x = 0; x < w; ++x) {
      var ch = rows[y][x] || "."
      if (ch === "S") { start = { x: x, y: y, o: "S" }; ch = "#" }
      row.push(ch)
    }
    tiles.push(row)
  }
  var bridges = false
  for (var yy = 0; yy < tiles.length; ++yy) for (var xx = 0; xx < w; ++xx) if (tiles[yy][xx] === "B") bridges = true
  return { tiles: tiles, w: w, h: tiles.length, start: start, bridgesOut: bridges }
}

function cells(b) {
  return b.o === "S" ? [[b.x, b.y]] : b.o === "H" ? [[b.x, b.y], [b.x + 1, b.y]] : [[b.x, b.y], [b.x, b.y + 1]]
}

function roll(b, dx, dy) {
  if (b.o === "S") {
    if (dx < 0) return { x: b.x - 2, y: b.y, o: "H" }
    if (dx > 0) return { x: b.x + 1, y: b.y, o: "H" }
    if (dy < 0) return { x: b.x, y: b.y - 2, o: "V" }
    return { x: b.x, y: b.y + 1, o: "V" }
  }
  if (b.o === "H") {
    if (dx < 0) return { x: b.x - 1, y: b.y, o: "S" }
    if (dx > 0) return { x: b.x + 2, y: b.y, o: "S" }
    return { x: b.x, y: b.y + dy, o: "H" }
  }
  if (dy < 0) return { x: b.x, y: b.y - 1, o: "S" }
  if (dy > 0) return { x: b.x, y: b.y + 2, o: "S" }
  return { x: b.x + dx, y: b.y, o: "V" }
}

function tileAt(L, x, y) { return x < 0 || y < 0 || x >= L.w || y >= L.h ? "." : L.tiles[y][x] }

// Is there ground under (x, y) with the bridges as they are?
function solid(L, x, y, out) {
  var t = tileAt(L, x, y)
  if (t === ".") return false
  if (t === "b" || t === "B") return out
  return true
}

// Apply a roll: returns { block, out, result } where result is
// "ok" | "fall" | "win".
function apply(L, block, out, dx, dy) {
  var nb = roll(block, dx, dy), c = cells(nb)
  for (var i = 0; i < c.length; ++i) if (!solid(L, c[i][0], c[i][1], out)) return { block: nb, out: out, result: "fall" }
  if (nb.o === "S" && tileAt(L, nb.x, nb.y) === "F") return { block: nb, out: out, result: "fall" }
  // Switches.
  var flip = false
  for (var k = 0; k < c.length; ++k) {
    var t = tileAt(L, c[k][0], c[k][1])
    if (t === "o" || (t === "x" && nb.o === "S")) flip = !flip
  }
  var nout = flip ? !out : out
  if (nb.o === "S" && tileAt(L, nb.x, nb.y) === "G") return { block: nb, out: nout, result: "win" }
  return { block: nb, out: nout, result: "ok" }
}

// Fewest moves to finish level n (breadth-first), or -1.
function solve(n) {
  var L = parse(n), key = function(b, o) { return b.x + "," + b.y + b.o + (o ? 1 : 0) }
  var q = [{ b: L.start, out: L.bridgesOut, d: 0 }], seen = {}
  seen[key(L.start, L.bridgesOut)] = true
  var moves = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  while (q.length) {
    var cur = q.shift()
    for (var m = 0; m < 4; ++m) {
      var r = apply(L, cur.b, cur.out, moves[m][0], moves[m][1])
      if (r.result === "win") return cur.d + 1
      if (r.result === "fall") continue
      var k = key(r.block, r.out)
      if (seen[k]) continue
      seen[k] = true
      q.push({ b: r.block, out: r.out, d: cur.d + 1 })
    }
  }
  return -1
}

var PARS = []
for (var li = 0; li < LEVELS.length; ++li) PARS.push(solve(li))

function startLevel(s, n) {
  s.level = n
  s.map = parse(n)
  s.block = s.map.start
  s.out = s.map.bridgesOut
  s.moves = 0
  s.history = []
  s.anim = null
  s.phase = "play"
}

function makeState() {
  var s = { level: 0, score: 0, total: 0, falls: 0, msg: "", msgT: 0, done: false, t: 0 }
  startLevel(s, 0)
  s.msg = "LEVEL 1 · par " + PARS[0]; s.msgT = 2
  return s
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

function move(state, dx, dy) {
  if (state.phase !== "play" || state.anim) return state
  var s = shallow(state)
  var r = apply(s.map, s.block, s.out, dx, dy)
  s.history = s.history.concat([{ block: s.block, out: s.out }])
  s.anim = { from: s.block, to: r.block, t: 0, result: r.result }
  s.block = r.block
  s.out = r.out
  s.moves++
  s.total++
  return s
}

function undo(state) {
  if (!state.history.length || state.phase !== "play" || state.anim) return state
  var s = shallow(state), h = s.history[s.history.length - 1]
  s.history = s.history.slice(0, -1)
  s.block = h.block; s.out = h.out; s.moves++
  return s
}

function step(state, dt) {
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  if (s.anim) {
    var a = shallow(s.anim)
    a.t += dt / (a.result === "fall" ? 0.5 : 0.13)
    s.anim = a.t >= 1 ? null : a
    if (!s.anim) {
      if (a.result === "fall") {
        s.falls++
        s.msg = "FELL OFF · try again"; s.msgT = 1.2
        var keep = s.total
        startLevel(s, s.level)
        s.total = keep
      } else if (a.result === "win") {
        var pts = Math.max(20, 200 - Math.max(0, s.moves - PARS[s.level]) * 10)
        s.score += pts
        s.msg = (s.moves <= PARS[s.level] ? "PERFECT · " : "") + s.moves + " moves (par " + PARS[s.level] + ")  +" + pts; s.msgT = 2
        s.phase = "won"; s.wonT = 1.4
      }
    }
  }
  if (s.phase === "won") {
    s.wonT -= dt
    if (s.wonT <= 0) {
      if (s.level + 1 >= LEVELS.length) { s.done = true; s.phase = "done" }
      else { startLevel(s, s.level + 1); s.msg = "LEVEL " + (s.level + 1) + " · par " + PARS[s.level]; s.msgT = 2 }
    }
  }
  return s
}
