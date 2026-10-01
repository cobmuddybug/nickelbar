.pragma library
.import "../../engine/Rng.js" as Rng

// Frogger-style crossing. 13 columns x 13 rows, top to bottom:
//   row 0      five home bays (the rest of the row is hedge)
//   rows 1-5   river: logs and turtles drift; the water itself drowns you
//   row 6      median (safe)
//   rows 7-11  road: cars and trucks
//   row 12     start verge (safe)
// Lanes move continuously (fractional x); the hopper moves one cell per key.
// Riding a log carries you; being carried off the edge is fatal.
// Scoring: 10 per new furthest row reached this life, 50 per bay filled
// plus a time bonus, 1000 for filling all five (which starts a faster level).

var COLS = 13
var ROWS = 13
var BAYS = [1, 3.5, 6, 8.5, 11] // bay centres (col units); each is 1 wide
var TIME_LIMIT = 30              // seconds per life before you drown in paperwork

// Lane definitions: row, speed (cols/s, sign = direction), kind, length,
// gap pattern (spacing between starts).
function laneSpecs(level) {
  var k = 1 + level * 0.18
  return [
    { row: 1, speed: 1.3 * k, kind: "log", len: 3, spacing: 6 },
    { row: 2, speed: -1.6 * k, kind: "turtle", len: 2, spacing: 4.5 },
    { row: 3, speed: 2.0 * k, kind: "log", len: 5, spacing: 8 },
    { row: 4, speed: 1.0 * k, kind: "log", len: 2, spacing: 4.5 },
    { row: 5, speed: -1.4 * k, kind: "turtle", len: 3, spacing: 5 },
    { row: 7, speed: -1.2 * k, kind: "truck", len: 2, spacing: 6 },
    { row: 8, speed: 2.2 * k, kind: "car", len: 1, spacing: 5 },
    { row: 9, speed: -1.6 * k, kind: "car", len: 1, spacing: 4 },
    { row: 10, speed: 1.1 * k, kind: "car", len: 1, spacing: 4.5 },
    { row: 11, speed: -0.9 * k, kind: "car", len: 1, spacing: 3.8 }
  ]
}

function makeLanes(level) {
  var specs = laneSpecs(level)
  var lanes = []
  for (var i = 0; i < specs.length; ++i) {
    var sp = specs[i]
    var items = []
    var span = COLS + sp.spacing * 2
    var start = Rng.random() * sp.spacing
    for (var x = start; x < span; x += sp.spacing + (Rng.random() - 0.5) * 0.8) items.push(x - sp.spacing)
    lanes.push({ row: sp.row, speed: sp.speed, kind: sp.kind, len: sp.len, span: span, items: items })
  }
  return lanes
}

function makeState() {
  return { level: 0, lanes: makeLanes(0), frog: { x: 6, y: 12 }, bays: [false, false, false, false, false],
    lives: 3, score: 0, furthest: 12, timeLeft: TIME_LIMIT, alive: true, dying: 0, clock: 0, lastDeath: "" }
}

function copy(s) {
  return { level: s.level, lanes: s.lanes, frog: s.frog, bays: s.bays, lives: s.lives, score: s.score,
    furthest: s.furthest, timeLeft: s.timeLeft, alive: s.alive, dying: s.dying, clock: s.clock, lastDeath: s.lastDeath }
}

// Items live on a looping strip [ -spacing, COLS + spacing ); position of
// an item's left edge at the current time.
function itemX(lane, base) {
  var x = base
  return ((x % lane.span) + lane.span) % lane.span - (lane.span - COLS) / 2
}

function laneAt(state, row) {
  for (var i = 0; i < state.lanes.length; ++i) if (state.lanes[i].row === row) return state.lanes[i]
  return null
}

// Turtles dive on a slow cycle; a submerged turtle is water.
function turtlesUp(lane, idx, clock) {
  if (lane.kind !== "turtle") return true
  if (idx % 3 !== 0) return true
  return Math.sin(clock * 1.3 + idx) > -0.55
}

function overlapping(lane, x, clock) {
  for (var i = 0; i < lane.items.length; ++i) {
    var left = itemX(lane, lane.items[i])
    if (x + 0.8 > left && x + 0.2 < left + lane.len) {
      if (!turtlesUp(lane, i, clock)) return false
      return true
    }
  }
  return false
}

function die(state, why) {
  var s = copy(state)
  s.dying = 0.9
  s.lastDeath = why
  return s
}

function respawn(state) {
  var s = copy(state)
  s.lives = state.lives - 1
  if (s.lives <= 0) { s.alive = false; s.dying = 0; return s }
  s.frog = { x: 6, y: 12 }
  s.furthest = 12
  s.timeLeft = TIME_LIMIT
  s.dying = 0
  return s
}

function hop(state, dx, dy) {
  if (!state.alive || state.dying > 0) return state
  var nx = Math.round(state.frog.x) + dx, ny = state.frog.y + dy
  if (dx !== 0) nx = state.frog.x + dx // keep fractional x while riding
  if (nx < -0.2 || nx > COLS - 0.8 || ny < 0 || ny > ROWS - 1) return state
  var s = copy(state)
  s.frog = { x: dy !== 0 ? Math.round(nx) : nx, y: ny }
  if (ny < state.furthest) { s.score = state.score + 10 * (state.furthest - ny); s.furthest = ny }
  if (ny === 0) return landHome(s)
  return s
}

function landHome(state) {
  var fx = state.frog.x
  for (var b = 0; b < BAYS.length; ++b) {
    if (Math.abs(fx - BAYS[b]) <= 0.45) {
      if (state.bays[b]) return die(state, "bay taken")
      var s = copy(state)
      var bays = state.bays.slice(); bays[b] = true
      s.bays = bays
      s.score = state.score + 50 + Math.floor(state.timeLeft) * 2
      s.frog = { x: 6, y: 12 }
      s.furthest = 12
      s.timeLeft = TIME_LIMIT
      if (bays.every(function(v) { return v })) {
        s.score += 1000
        s.level = state.level + 1
        s.lanes = makeLanes(s.level)
        s.bays = [false, false, false, false, false]
      }
      return s
    }
  }
  return die(state, "hedge")
}

function step(state, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.clock = state.clock + dt
  s.lanes = state.lanes.map(function(l) {
    return { row: l.row, speed: l.speed, kind: l.kind, len: l.len, span: l.span,
      items: l.items.map(function(x) { return x + l.speed * dt }) }
  })
  if (state.dying > 0) {
    s.dying = state.dying - dt
    return s.dying <= 0 ? respawn(s) : s
  }
  s.timeLeft = state.timeLeft - dt
  if (s.timeLeft <= 0) return die(s, "time")

  var f = state.frog
  var lane = laneAt(s, f.y)
  if (lane && lane.kind !== "car" && lane.kind !== "truck") {
    if (!overlapping(lane, f.x, s.clock)) return die(s, "splash")
    var nx = f.x + lane.speed * dt
    if (nx < -0.5 || nx > COLS - 0.5) return die(s, "swept away")
    s.frog = { x: nx, y: f.y }
  } else if (lane) {
    if (overlapping(lane, f.x, s.clock)) return die(s, "squish")
  }
  return s
}

function serialize(state) {
  return { level: state.level, bays: state.bays, lives: state.lives, score: state.score, alive: state.alive }
}

function deserialize(obj) {
  if (!obj || typeof obj.score !== "number" || obj.alive === false) return null
  var s = makeState()
  s.level = obj.level || 0; s.lanes = makeLanes(s.level)
  s.bays = Array.isArray(obj.bays) && obj.bays.length === 5 ? obj.bays : s.bays
  s.lives = obj.lives || 3; s.score = obj.score
  return s
}
