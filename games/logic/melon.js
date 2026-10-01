.pragma library
.import "../../engine/Rng.js" as Rng

// Melon Drop, after the Suika (watermelon) game. Drop fruit into a box;
// two of the same size that touch merge into the next size up, and two of
// the biggest vanish for a bonus. If fruit stays piled above the line for
// a couple of seconds, that's the end.
//
// Physics is position-based (Verlet): every fruit keeps where it is and
// where it was, gravity nudges it, and overlaps are pushed apart a few
// times per substep. Crude, but stable, and plenty for round fruit.

var W = 1.0
var H = 1.3
var LINE = 0.2                 // the danger line, measured from the top
var RADII = [0.034, 0.045, 0.058, 0.072, 0.088, 0.106, 0.126, 0.148, 0.172, 0.2, 0.235]
var DROPPABLE = 5              // only the smallest five get dropped
var GRAVITY = 2.4
var SUBSTEPS = 4
var ITER = 3
var COOLDOWN = 0.45
var LOSE_AFTER = 2.0

function score(level) { return (level + 1) * (level + 2) / 2 }

function makeState() {
  return { fruits: [], x: W / 2, next: pickNext(0), after: pickNext(0), cooldown: 0, score: 0,
           alive: true, danger: 0, idSeq: 1, biggest: 0, pops: [] }
}

function copy(s) {
  return { fruits: s.fruits, x: s.x, next: s.next, after: s.after, cooldown: s.cooldown, score: s.score,
           alive: s.alive, danger: s.danger, idSeq: s.idSeq, biggest: s.biggest, pops: s.pops }
}

// Small fruit most of the time; bigger ones once the game's got going.
function pickNext(biggest) {
  var cap = Math.max(3, Math.min(DROPPABLE, biggest))
  return Math.floor(Math.pow(Rng.random(), 1.4) * cap)
}

function clampX(x, level) { var r = RADII[level]; return Math.max(r, Math.min(W - r, x)) }

function move(state, dx) {
  var s = copy(state)
  s.x = clampX(state.x + dx, state.next)
  return s
}

function drop(state) {
  if (!state.alive || state.cooldown > 0) return state
  var s = copy(state)
  var r = RADII[state.next], x = clampX(state.x, state.next), y = r + 0.01
  s.fruits = state.fruits.concat([{ id: state.idSeq, x: x, y: y, px: x, py: y, level: state.next, age: 0 }])
  s.idSeq = state.idSeq + 1
  s.next = state.after
  s.after = pickNext(state.biggest)
  s.x = clampX(state.x, s.next)
  s.cooldown = COOLDOWN
  return s
}

function step(state, dt) {
  if (!state.alive) return state
  var s = copy(state)
  s.cooldown = Math.max(0, state.cooldown - dt)
  s.pops = state.pops.filter(function(p) { return p.life > dt }).map(function(p) {
    return { x: p.x, y: p.y, r: p.r, level: p.level, life: p.life - dt }
  })
  // Work on private copies; the old state keeps its own.
  var f = state.fruits.map(function(o) { return { id: o.id, x: o.x, y: o.y, px: o.px, py: o.py, level: o.level, age: o.age + dt, calm: Math.max(0, (o.calm || 0) - dt) } })
  var h = dt / SUBSTEPS
  for (var sub = 0; sub < SUBSTEPS; ++sub) {
    for (var i = 0; i < f.length; ++i) {
      var o = f[i]
      var vx = (o.x - o.px) * 0.995, vy = (o.y - o.py) * 0.995
      // A fresh merge spawns overlapping its neighbours; the push-out must not become a launch.
      var vm = Math.sqrt(vx * vx + vy * vy), cap = o.calm > 0 ? 0.004 : 0.02
      if (vm > cap) { vx *= cap / vm; vy *= cap / vm }
      o.px = o.x; o.py = o.y
      o.x += vx; o.y += vy + GRAVITY * h * h
    }
    for (var it = 0; it < ITER; ++it) {
      f.sort(function(a, b) { return a.x - b.x })
      for (var a = 0; a < f.length; ++a) {
        var A = f[a]
        if (A.dead) continue
        for (var b = a + 1; b < f.length; ++b) {
          var B = f[b]
          if (B.dead) continue
          var ra = RADII[A.level], rb = RADII[B.level]
          if (B.x - A.x > ra + RADII[RADII.length - 1]) break
          var dx = B.x - A.x, dy = B.y - A.y, d2 = dx * dx + dy * dy, min = ra + rb
          // Same sizes merge on touching (with a hair of slack, since
          // resting fruit get pushed exactly apart); others only collide.
          if (A.level === B.level && d2 < min * min * 1.06) { merge(s, f, A, B); break }
          if (d2 >= min * min) continue
          var d = Math.sqrt(d2) || 1e-6
          var push = (min - d) / d * 0.5
          // Heavier (bigger) fruit moves less.
          var ma = ra * ra, mb = rb * rb, wa = mb / (ma + mb), wb = ma / (ma + mb)
          A.x -= dx * push * wa * 2; A.y -= dy * push * wa * 2
          B.x += dx * push * wb * 2; B.y += dy * push * wb * 2
          if (A.calm > 0 || B.calm > 0) {   // soak up the separation so it leaves no velocity behind
            A.px = A.x - (A.x - A.px) * 0.2; A.py = A.y - (A.y - A.py) * 0.2
            B.px = B.x - (B.x - B.px) * 0.2; B.py = B.y - (B.y - B.py) * 0.2
          }
        }
      }
      for (var k = 0; k < f.length; ++k) {
        var q = f[k], r = RADII[q.level]
        if (q.x < r) q.x = r
        if (q.x > W - r) q.x = W - r
        if (q.y > H - r) { q.y = H - r; q.px = q.x - (q.x - q.px) * 0.8 }   // floor friction
      }
    }
    f = f.filter(function(o) { return !o.dead })
  }
  s.fruits = f

  // Anything settled with its top above the line counts toward losing.
  var over = false
  for (var j = 0; j < f.length; ++j) {
    var fr = f[j]
    if (fr.age > 1.2 && fr.y - RADII[fr.level] < LINE && Math.abs(fr.y - fr.py) < 0.004) over = true
  }
  s.danger = over ? state.danger + dt : Math.max(0, state.danger - dt * 2)
  if (s.danger >= LOSE_AFTER) s.alive = false
  return s
}

function merge(s, f, A, B) {
  A.dead = true; B.dead = true
  var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2
  s.score += score(A.level)
  s.pops = s.pops.concat([{ x: mx, y: my, r: RADII[A.level], level: A.level, life: 0.3 }])
  if (A.level === RADII.length - 1) { s.score += 100; return }
  var lv = A.level + 1
  f.push({ id: s.idSeq, x: mx, y: my, px: mx, py: my, level: lv, age: 1, calm: 0.4 })
  s.idSeq++
  if (lv > s.biggest) s.biggest = lv
}

function serialize(s) {
  return { fruits: s.fruits.map(function(o) { return [o.x, o.y, o.level] }), score: s.score, next: s.next,
           after: s.after, biggest: s.biggest, alive: s.alive }
}

function deserialize(o) {
  if (!o || !o.fruits || o.alive === false) return null
  var s = makeState()
  s.fruits = o.fruits.map(function(a, i) { return { id: i + 1, x: a[0], y: a[1], px: a[0], py: a[1], level: a[2], age: 0 } })
  s.idSeq = s.fruits.length + 1
  s.score = o.score || 0; s.biggest = o.biggest || 0
  if (o.next >= 0) s.next = o.next
  if (o.after >= 0) s.after = o.after
  return s
}
