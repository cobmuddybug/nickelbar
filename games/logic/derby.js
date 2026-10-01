.pragma library
.import "../../engine/Rng.js" as Rng

// Derby, the midway roll-a-ball horse race. A needle sweeps along a row
// of holes; roll when it's over a good one: each hole moves your horse
// its number (1, 2, or 3 for the middle). Five other horses run on their
// own. First to the finish; three races a game, 100 / 50 / 25 points for
// 1st / 2nd / 3rd in each.

var LENGTH = 18
var HORSES = 6                     // 0 is yours
var HOLES = [1, 2, 1, 3, 1, 2, 1]  // left to right
var RACES = 3
var PLACE_PTS = [100, 50, 25]
var ROLL = 0.7         // ball's run to the holes
var RETURN = 0.55      // and back to your hand
var AI_GAP = 1.45

function newRace(race, score, log) {
  var pos = [], cool = []
  for (var i = 0; i < HORSES; ++i) { pos.push(0); cool.push(0.5 + Rng.random()) }
  return { race: race, pos: pos, shown: pos.slice(), cool: cool, needleT: Rng.random() * 6, needle: 0.5,
           ball: null, finish: [], phase: "go", wait: 1.5, score: score || 0, log: log || [], done: false }
}

function makeState() { return newRace(1, 0, []) }

function copy(s) {
  return { race: s.race, pos: s.pos, shown: s.shown, cool: s.cool, needleT: s.needleT, needle: s.needle, ball: s.ball,
           finish: s.finish, phase: s.phase, wait: s.wait, score: s.score, log: s.log, done: s.done }
}

function holeAt(x) { return Math.max(0, Math.min(HOLES.length - 1, Math.floor(x * HOLES.length))) }

// How fast the rivals go: they get a little quicker each race.
function aiGap(race) { return AI_GAP - race * 0.06 }

function roll(state) {
  if (state.done || state.phase !== "go" || state.ball) return state
  var s = copy(state)
  // A little scatter so the rolls aren't perfectly repeatable.
  var x = Math.max(0, Math.min(0.999, state.needle + (Rng.random() - 0.5) * 0.05))
  s.ball = { x: x, t: 0, scored: false }
  return s
}

function advance(s, i, n) {
  if (s.pos[i] >= LENGTH) return
  s.pos[i] = Math.min(LENGTH, s.pos[i] + n)
  if (s.pos[i] >= LENGTH && s.finish.indexOf(i) < 0) s.finish.push(i)
}

function step(state, dt) {
  if (state.done) return state
  var s = copy(state)
  s.pos = state.pos.slice(); s.cool = state.cool.slice(); s.finish = state.finish.slice()
  // Horses on screen catch up with where they are.
  s.shown = state.shown.map(function(v, i) { return Math.min(s.pos[i], v + dt * 4) })
  if (state.phase === "done") {
    s.wait = state.wait - dt
    if (s.wait <= 0) {
      if (state.race >= RACES) { s.done = true; return s }
      return newRace(state.race + 1, state.score, state.log)
    }
    return s
  }
  s.needleT = state.needleT + dt * (2.2 + state.race * 0.35)
  s.needle = 0.5 + 0.5 * Math.sin(s.needleT)
  if (state.ball) {
    var b = { x: state.ball.x, t: state.ball.t + dt, scored: state.ball.scored }
    if (b.t >= ROLL && !b.scored) { advance(s, 0, HOLES[holeAt(b.x)]); b.scored = true }
    s.ball = b.t >= ROLL + RETURN ? null : b
  }
  for (var i = 1; i < HORSES; ++i) {
    s.cool[i] = state.cool[i] - dt
    if (s.cool[i] <= 0) {
      var r = Rng.random()
      advance(s, i, r < 0.5 ? 1 : r < 0.82 ? 2 : 3)
      s.cool[i] = aiGap(state.race) * (0.6 + Rng.random() * 0.8)
    }
  }
  if (s.finish.length && s.finish.indexOf(0) >= 0 || s.finish.length >= 3) {
    // Race over once you're home or the podium's full.
    var place = s.finish.indexOf(0)
    var pts = place >= 0 && place < 3 ? PLACE_PTS[place] : 0
    s.score = state.score + pts
    s.log = state.log.concat([place >= 0 ? place + 1 : 0])
    s.phase = "done"
    s.wait = 2.5
  }
  return s
}
