.pragma library
.import "../../engine/Rng.js" as Rng

// Claw machine. Steer the claw over a prize and drop it; it comes down,
// closes, lifts, and carries whatever it's holding to the chute on the
// left. Grip depends on how centred you were and how heavy the prize is,
// and a weak grip can slip on the way over. Every drop costs 100 of a 600
// bank and prizes pay into it, so a small toy loses money and the game ends when you
// can't afford another go. Score is the value of what you win (small 50, medium 150, big 400, the gold one 1000).
//
// Field x 0..1, y 0 (top) .. 1 (floor). Prizes are circles lying on the
// floor pile.

var TRIES = 10
var COST = 100               // every drop costs a play
var BANK = 600               // starting credits; winnings go back into the bank
var CHUTE = 0.14
var TOP = 0.08
var KINDS = [{ r: 0.045, pts: 50, weight: 0.2 }, { r: 0.06, pts: 150, weight: 0.45 }, { r: 0.08, pts: 400, weight: 0.7 },
             { r: 0.055, pts: 1000, weight: 0.85 }]

function makePrizes() {
  var out = [], guard = 0
  while (out.length < 16 && guard++ < 500) {
    var roll = Rng.random(), k = roll < 0.45 ? 0 : roll < 0.8 ? 1 : roll < 0.96 ? 2 : 3
    var r = KINDS[k].r, x = CHUTE + 0.08 + r + Rng.random() * (0.98 - CHUTE - 0.08 - 2 * r)
    // Settle it onto the floor or on top of what's below.
    var y = 1 - r
    for (var i = 0; i < out.length; ++i) {
      var o = out[i], dx = Math.abs(o.x - x)
      if (dx < o.r + r) { var top = o.y - Math.sqrt(Math.max(0, (o.r + r) * (o.r + r) - dx * dx)); if (top < y) y = top }
    }
    if (y < 0.55) continue
    out.push({ x: x, y: y, r: r, kind: k, hue: Math.floor(Rng.random() * 6) })
  }
  return out
}

function makeState() {
  return { prizes: makePrizes(), x: 0.6, y: TOP, phase: "move", timer: 12, held: -1, grip: 0, tries: Math.floor(BANK / COST), credits: BANK,
           score: 0, won: [], note: "", noteLife: 0, open: 1, done: false }
}

function copy(s) {
  return { prizes: s.prizes, x: s.x, y: s.y, phase: s.phase, timer: s.timer, held: s.held, grip: s.grip, tries: s.tries, credits: s.credits,
           score: s.score, won: s.won, note: s.note, noteLife: s.noteLife, open: s.open, done: s.done }
}

function steer(state, dx) {
  if (state.phase !== "move") return state
  var s = copy(state)
  s.x = Math.max(CHUTE + 0.02, Math.min(0.97, state.x + dx))
  return s
}

function drop(state) {
  if (state.phase !== "move" || state.done) return state
  var s = copy(state)
  s.phase = "down"
  s.credits = state.credits - COST
  s.tries = Math.floor(s.credits / COST)
  return s
}

// Lowest point the claw can reach at x: the top of the highest prize under it.
function floorAt(s, x) {
  var y = 0.97
  for (var i = 0; i < s.prizes.length; ++i) {
    var p = s.prizes[i]
    if (Math.abs(p.x - x) < p.r * 0.9) y = Math.min(y, p.y - p.r * 0.6)
  }
  return y
}

function say(s, t) { s.note = t; s.noteLife = 1.4 }

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.noteLife = Math.max(0, state.noteLife - dt)
  var sp = 0.5
  if (state.phase === "move") {
    s.timer = state.timer - dt
    if (s.timer <= 0) { s.phase = "down"; s.credits = state.credits - COST }
  } else if (state.phase === "down") {
    s.y = state.y + sp * dt
    var f = floorAt(state, state.x)
    if (s.y >= f) { s.y = f; s.phase = "close"; s.timer = 0.5 }
  } else if (state.phase === "close") {
    s.open = Math.max(0, state.open - dt * 2)
    s.timer = state.timer - dt
    if (s.timer <= 0) {
      // Grab the prize most nearly under the claw, if any.
      var best = -1, bd = 1e9
      for (var i = 0; i < state.prizes.length; ++i) {
        var p = state.prizes[i], d = Math.abs(p.x - state.x)
        if (d < p.r && Math.abs(p.y - p.r - state.y) < p.r * 1.2 && d < bd) { bd = d; best = i }
      }
      if (best >= 0) {
        var pk = state.prizes[best], centred = 1 - bd / pk.r
        s.grip = Math.pow(centred, 1.5) * (1 - KINDS[pk.kind].weight * 0.8) + (Rng.random() - 0.5) * 0.3
        if (s.grip > 0.3) s.held = best
        else say(s, "SLIPPED OFF")
      } else say(s, "NOTHING THERE")
      s.phase = "up"
    }
  } else if (state.phase === "up") {
    s.y = Math.max(TOP, state.y - sp * dt)
    if (state.held >= 0 && Rng.random() < dt * (0.75 - state.grip) * 1.2) { s = dropPrize(s, "DROPPED IT") }
    if (s.y <= TOP) s.phase = "carry"
  } else if (state.phase === "carry") {
    s.x = Math.max(CHUTE * 0.5, state.x - sp * dt)
    if (state.held >= 0 && Rng.random() < dt * (0.6 - state.grip) * 0.9) { s = dropPrize(s, "DROPPED IT") }
    if (s.x <= CHUTE * 0.5) {
      if (s.held >= 0) {
        var won = state.prizes[s.held]
        s.score = state.score + KINDS[won.kind].pts
        s.credits = state.credits + KINDS[won.kind].pts
        s.won = state.won.concat([won.kind])
        say(s, "WON " + KINDS[won.kind].pts + "!")
        s.prizes = state.prizes.filter(function(_, j) { return j !== s.held })
        s.held = -1
      }
      s.phase = "open"; s.timer = 0.6
    }
  } else if (state.phase === "open") {
    s.open = Math.min(1, state.open + dt * 2)
    s.timer = state.timer - dt
    if (s.timer <= 0) {
      s.tries = Math.floor(s.credits / COST)
      if (s.tries <= 0 || !s.prizes.length) { s.done = true; return s }
      s.phase = "move"; s.timer = 12; s.x = 0.6
    }
  }
  // A held prize travels with the claw.
  if (s.held >= 0) {
    var h = s.prizes[s.held], ps = s.prizes.slice()
    ps[s.held] = { x: s.x, y: s.y + h.r * 1.1, r: h.r, kind: h.kind, hue: h.hue }
    s.prizes = ps
  }
  return s
}

// The held prize falls back onto the pile below.
function dropPrize(s, why) {
  var h = s.prizes[s.held], others = s.prizes.filter(function(_, j) { return j !== s.held })
  var y = 1 - h.r
  for (var i = 0; i < others.length; ++i) {
    var o = others[i], dx = Math.abs(o.x - h.x)
    if (dx < o.r + h.r) { var top = o.y - Math.sqrt(Math.max(0, (o.r + h.r) * (o.r + h.r) - dx * dx)); if (top < y) y = top }
  }
  var x = Math.max(CHUTE + 0.02 + h.r, h.x)
  others.push({ x: x, y: y, r: h.r, kind: h.kind, hue: h.hue })
  s.prizes = others
  s.held = -1
  say(s, why)
  return s
}
