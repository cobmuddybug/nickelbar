.pragma library
.import "../../engine/Rng.js" as Rng

// Cube Run (after Cube Field). You skim forward over an endless plain
// while cubes rush at you; steer left and right. One touch and it's over.
// It speeds up the whole time and changes character every phase:
//   1 scattered cubes · 2 thicker field · 3 corridor: a winding lane
//   between walls · 4 slalom: gates to thread · then round again, faster.
// Skimming past a cube close (without touching) is a near miss: it pays,
// and near misses in quick succession build a multiplier. Gems floating
// along the way are worth grabbing.
//
// World units: x across (the player stays in a lane band ±BAND), z ahead.

var BAND = 40
var SHIP_W = 0.28
var VIEW = 70
var PHASE_LEN = 450          // z distance per phase
var START_SPEED = 14
var SPEED_GAIN = 0.25        // per second

function makeState() {
  var s = { x: 0, vx: 0, z: 0, speed: START_SPEED, cubes: [], gems: [], genZ: 8, t: 0, dead: false,
            score: 0, near: 0, mult: 1, multT: 0, pops: [], phase: 0, lane: 0, gate: null, gemCount: 0, msg: "PHASE 1", msgT: 1.5 }
  gen(s)
  return s
}

function phaseAt(z) { return Math.floor(z / PHASE_LEN) % 4 }

// Fill the road ahead, one row per metre or two.
function gen(s) {
  while (s.genZ < s.z + VIEW) {
    var z = s.genZ, ph = phaseAt(z), lap = Math.floor(z / (PHASE_LEN * 4))
    if (ph === 0 || ph === 1) {
      var n = ph === 0 ? 2 + lap : 3 + lap * 2
      for (var i = 0; i < n; ++i) if (Rng.random() < (ph === 0 ? 0.6 : 0.5)) s.cubes.push({ x: s.x + (Rng.random() - 0.5) * 26, z: z, hue: Math.floor(Rng.random() * 3) })
      s.genZ += ph === 0 ? 2.2 : 1.8
    } else if (ph === 2) {
      // A lane that wanders; walls of cubes either side.
      // The lane curves smoothly: its drift changes a little each row.
      s.laneV = Math.max(-0.22, Math.min(0.22, (s.laneV || 0) + (Rng.random() - 0.5) * 0.12))
      s.lane += s.laneV
      if (Math.abs(s.lane - s.x) > 8) s.laneV = -s.laneV
      // It funnels in from wide at the start of the phase, and the ground
      // outside the walls is thick with cubes so there's no going round.
      var into = z - Math.floor(z / PHASE_LEN) * PHASE_LEN
      var half = Math.max(1.6, 2.6 - lap * 0.25) + Math.max(0, 1 - into / 60) * 8
      for (var k = 0; k < 3; ++k) {
        s.cubes.push({ x: s.lane - half - k * 1.02, z: z, hue: 2, wall: true })
        s.cubes.push({ x: s.lane + half + k * 1.02, z: z, hue: 2, wall: true })
      }
      for (var o = 0; o < 2; ++o) {
        s.cubes.push({ x: s.lane - half - 3.5 - Rng.random() * 9, z: z, hue: 0 })
        s.cubes.push({ x: s.lane + half + 3.5 + Rng.random() * 9, z: z, hue: 0 })
      }
      s.genZ += 1.05
    } else {
      // Slalom: a line of cubes with one gap, alternating sides.
      // Each gate sits a fixed hop from the last, alternating sides, and
      // drifts back toward you if you've wandered off.
      if (s.gate === undefined || s.gate === null) s.gate = s.lane
      s.gate += (Math.floor(z / 16) % 2 ? 2 : -2) + (s.x - s.gate) * 0.15
      var gap = s.gate
      var width = Math.max(1.5, 2.4 - lap * 0.2)
      for (var c = -12; c <= 12; ++c) {
        var cx = gap + c * 1.05
        if (Math.abs(cx - gap) < width / 2 + 0.5) continue
        s.cubes.push({ x: cx, z: z, hue: 1 })
      }
      s.genZ += 16
    }
    if (Rng.random() < 0.06) s.gems.push({ x: (ph === 2 ? s.lane : s.x + (Rng.random() - 0.5) * 10), z: z + 0.5, got: false })
  }
  // Keep the corridor lane following you between phases.
  if (phaseAt(s.genZ) !== 2) s.lane = s.x
  if (phaseAt(s.genZ) !== 3) s.gate = null
}

function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; return n }

function step(state, input, dt) {
  if (state.dead) return state
  var s = shallow(state)
  s.t += dt
  s.msgT = Math.max(0, s.msgT - dt)
  s.multT = Math.max(0, s.multT - dt)
  if (!s.multT) s.mult = 1
  s.pops = s.pops.map(function(p) { return { text: p.text, t: p.t - dt, x: p.x } }).filter(function(p) { return p.t > 0 })

  s.speed = START_SPEED + s.t * SPEED_GAIN
  // Steering: quick to respond, a touch of slide.
  var target = (input.dx || 0) * (7 + s.speed * 0.2)
  s.vx += (target - s.vx) * Math.min(1, dt * 14)
  s.x += s.vx * dt
  var oldZ = s.z
  s.z += s.speed * dt

  var ph = phaseAt(s.z)
  if (ph !== s.phase) { s.phase = ph; s.msg = "PHASE " + (Math.floor(s.z / PHASE_LEN) + 1) + " · " + ["FIELD", "THICKET", "CORRIDOR", "SLALOM"][ph]; s.msgT = 1.8 }

  // Collisions and near misses against cubes we just passed through.
  var keep = []
  for (var i = 0; i < s.cubes.length; ++i) {
    var c = s.cubes[i]
    if (c.z + 1 < s.z - 1) continue
    if (c.z <= s.z && c.z + 1 >= oldZ) {
      var gap = Math.abs(c.x - s.x) - 0.5 - SHIP_W
      if (gap < 0) { s.dead = true; s.crashAt = c; return s }
      if (gap < 0.45 && !c.passed && !c.wall) {
        c = shallow(c); c.passed = true
        s.mult = Math.min(8, s.multT > 0 ? s.mult + 1 : 2)
        s.multT = 1.6
        s.near++
        var pts = 25 * s.mult
        s.score += pts
        s.pops = s.pops.concat([{ text: "CLOSE +" + pts, t: 0.8, x: c.x - s.x }])
      }
    }
    keep.push(c)
  }
  s.cubes = keep
  var gems = []
  for (var g = 0; g < s.gems.length; ++g) {
    var gm = s.gems[g]
    if (gm.z < s.z - 1) continue
    if (!gm.got && gm.z <= s.z && gm.z >= oldZ - 0.5 && Math.abs(gm.x - s.x) < 0.8) {
      gm = shallow(gm); gm.got = true
      s.gemCount++
      s.score += 100
      s.pops = s.pops.concat([{ text: "GEM +100", t: 0.8, x: 0 }])
    }
    gems.push(gm)
  }
  s.gems = gems
  s.score += Math.floor(s.z) - Math.floor(oldZ)
  gen(s)
  return s
}
