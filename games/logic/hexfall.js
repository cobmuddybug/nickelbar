.pragma library
.import "../../engine/Rng.js" as Rng

// Hexfall, after Hextris: blocks fall in from six directions onto a
// hexagon you turn with left/right. They stack on whichever side they hit;
// three or more of one colour touching (along a side's stack, or across
// neighbouring sides at the same height) clear, and whatever sat on top
// drops down, which can set off more. A side stacked past MAX_ROWS ends it.
//
// Stacks belong to the hexagon's sides (0..5); falling blocks are in world
// lanes (0..5, lane k at angle k * 60°). Side s faces lane (s + rot) % 6.

var SIDES = 6
var MAX_ROWS = 8
var SPAWN_AT = MAX_ROWS + 5     // distance (in block rows) new blocks start from
var COLORS = 4

function makeState() {
  return { stacks: [[], [], [], [], [], []], rot: 0, vis: 0, falling: [], spawnIn: 1, clock: 0,
           score: 0, alive: true, combo: 0, comboIn: 0, bursts: [], cleared: 0 }
}

function copy(s) {
  return { stacks: s.stacks, rot: s.rot, vis: s.vis, falling: s.falling, spawnIn: s.spawnIn, clock: s.clock,
           score: s.score, alive: s.alive, combo: s.combo, comboIn: s.comboIn, bursts: s.bursts, cleared: s.cleared }
}

function mod(a, n) { return ((a % n) + n) % n }
function sideOf(s, lane) { return mod(lane - s.rot, SIDES) }
function laneOf(s, side) { return mod(side + s.rot, SIDES) }

// Speeds ramp with time survived.
function fallSpeed(s) { return 3.2 + Math.min(4.5, s.clock / 40) }
function spawnGap(s) { return Math.max(0.55, 1.5 - s.clock / 90) }

function rotate(state, dir) {
  if (!state.alive) return state
  var s = copy(state)
  s.rot = mod(state.rot + dir, SIDES)
  return s
}

// Cells to clear: every same-colour group of 3+ that includes a fresh cell.
function findClears(stacks, fresh) {
  var seen = {}, out = []
  for (var f = 0; f < fresh.length; ++f) {
    var st = fresh[f]
    var key0 = st.side + ":" + st.row
    if (seen[key0] || st.row >= stacks[st.side].length) continue
    var col = stacks[st.side][st.row]
    var group = [], queue = [st], local = {}
    local[key0] = true
    while (queue.length) {
      var c = queue.pop()
      group.push(c)
      var nb = [{ side: c.side, row: c.row - 1 }, { side: c.side, row: c.row + 1 },
                { side: mod(c.side - 1, SIDES), row: c.row }, { side: mod(c.side + 1, SIDES), row: c.row }]
      for (var i = 0; i < nb.length; ++i) {
        var n = nb[i], k = n.side + ":" + n.row
        if (local[k] || n.row < 0 || n.row >= stacks[n.side].length || stacks[n.side][n.row] !== col) continue
        local[k] = true
        queue.push(n)
      }
    }
    if (group.length >= 3) for (var g = 0; g < group.length; ++g) {
      var kk = group[g].side + ":" + group[g].row
      if (!seen[kk]) { seen[kk] = true; out.push(group[g]) }
    }
  }
  return out
}

// Removes `cells`, lets stacks drop, and reports the cells that moved (they
// may now match too).
function collapse(stacks, cells) {
  var gone = {}
  for (var i = 0; i < cells.length; ++i) gone[cells[i].side + ":" + cells[i].row] = true
  var next = [], moved = []
  for (var sd = 0; sd < SIDES; ++sd) {
    var col = []
    for (var r = 0; r < stacks[sd].length; ++r) {
      if (gone[sd + ":" + r]) continue
      if (col.length !== r) moved.push({ side: sd, row: col.length })
      col.push(stacks[sd][r])
    }
    next.push(col)
  }
  return { stacks: next, moved: moved }
}

function spawn(s) {
  var lane = Math.floor(Rng.random() * SIDES)
  var out = [{ lane: lane, d: SPAWN_AT, color: Math.floor(Rng.random() * COLORS) }]
  // Later on, blocks sometimes come in pairs.
  if (s.clock > 30 && Rng.random() < 0.3) {
    var other = mod(lane + (Rng.random() < 0.5 ? 3 : 2), SIDES)
    out.push({ lane: other, d: SPAWN_AT + 0.5, color: Math.floor(Rng.random() * COLORS) })
  }
  return out
}

function step(state, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.clock = state.clock + dt

  // Ease the drawn rotation toward the real one, the short way round.
  var diff = mod(s.rot - state.vis + 3, SIDES) - 3
  s.vis = Math.abs(diff) < 0.02 ? s.rot : mod(state.vis + diff * Math.min(1, dt * 16), SIDES)

  s.bursts = state.bursts.filter(function(b) { return b.life > dt }).map(function(b) {
    return { side: b.side, row: b.row, color: b.color, lane: b.lane, life: b.life - dt }
  })
  s.comboIn = Math.max(0, state.comboIn - dt)
  if (s.comboIn === 0) s.combo = 0

  s.spawnIn = state.spawnIn - dt
  var falling = state.falling.slice()
  if (s.spawnIn <= 0) { falling = falling.concat(spawn(s)); s.spawnIn = spawnGap(s) }

  var stacks = state.stacks, landed = [], still = [], v = fallSpeed(s)
  for (var i = 0; i < falling.length; ++i) {
    var b = falling[i], d = b.d - v * dt
    var side = sideOf(s, b.lane), h = stacks[side].length
    if (d <= h) {
      if (stacks === state.stacks) stacks = stacks.map(function(c) { return c.slice() })
      stacks[side].push(b.color)
      landed.push({ side: side, row: stacks[side].length - 1 })
    } else still.push({ lane: b.lane, d: d, color: b.color })
  }
  s.falling = still

  // Clear, drop, and look again until nothing more goes.
  var fresh = landed, chain = 0
  while (fresh.length) {
    var clears = findClears(stacks, fresh)
    if (!clears.length) break
    chain++
    s.combo = s.combo + 1
    s.comboIn = 2.5
    s.cleared += clears.length
    s.score += clears.length * 10 * s.combo
    var bursts = s.bursts.slice()
    for (var c = 0; c < clears.length; ++c)
      bursts.push({ side: clears[c].side, row: clears[c].row, color: stacks[clears[c].side][clears[c].row],
                    lane: laneOf(s, clears[c].side), life: 0.35 })
    s.bursts = bursts
    var col = collapse(stacks, clears)
    stacks = col.stacks
    fresh = col.moved
  }
  s.stacks = stacks

  for (var sd = 0; sd < SIDES; ++sd) if (stacks[sd].length > MAX_ROWS) s.alive = false
  return s
}

function serialize(s) { return { stacks: s.stacks, rot: s.rot, score: s.score, clock: s.clock, alive: s.alive } }

function deserialize(o) {
  if (!o || !o.stacks || o.stacks.length !== SIDES || o.alive === false) return null
  var s = makeState()
  s.stacks = o.stacks; s.rot = o.rot || 0; s.vis = s.rot; s.score = o.score || 0; s.clock = o.clock || 0
  return s
}
