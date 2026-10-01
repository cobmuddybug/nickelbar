// Pitfall: the jungle is deterministic and full of treasure, every kind of
// pit can be crossed the way the game intends, and simulated runs stay sane.
const { load, assert, test } = require('./lib')

const P = load('pitfall')
const finite = (...v) => v.every(Number.isFinite)
const kinds = () => Array.from({ length: P.N }, (_, i) => P.kind(i))
const first = k => kinds().findIndex(x => x === k)

test('pitfall: the jungle is deterministic and has every hazard', () => {
  assert(JSON.stringify(kinds()) === JSON.stringify(kinds()), 'kinds differ between calls')
  for (const k of ['logs', 'fire', 'cobra', 'tar', 'sand', 'crocs', 'hole', 'clear'])
    assert(first(k) >= 0, 'no ' + k + ' screen')
  const n = P.countTreasures()
  assert(n >= 20 && n <= 45, 'treasure count ' + n)
  for (let i = 0; i < P.N; ++i) {
    const t = P.treasureAt(i)
    if (t) assert(t.x < 0.2 || t.x > 0.8, 'treasure in a bad spot on ' + i)
  }
})

// Start on screen `i` at x, then search jump/release timings for a crossing.
function crossing(i, x0, target, maxT) {
  const dt = 1 / 60
  for (let j = 0; j < 3.2; j += 0.1) for (let r = 0; r < 2.6; r += 0.1) {
    let s = P.makeState(); s.i = i; s.x = x0; s.invuln = 99
    let t = 0, jumped = false, released = false, lives = s.lives
    while (t < maxT && s.alive) {
      if (!jumped && t >= j) { s = P.jump(s); jumped = true }
      if (s.mode === 'vine' && !released && t >= j + r) { s = P.jump(s); released = true }
      s = P.step(s, { dx: jumped && s.mode === 'air' ? 1 : 0 }, dt)
      assert(finite(s.x, s.y, s.vy), 'NaN')
      if (s.lives < lives) break
      if (s.mode === 'run' && s.x >= target && s.i === i) return true
      t += dt
    }
  }
  return false
}

test('pitfall: tar and quicksand can be crossed on the vine', () => {
  assert(crossing(first('tar'), 0.2, 0.8, 8), 'tar pit cannot be crossed')
  assert(crossing(first('sand'), 0.2, 0.8, 8), 'quicksand cannot be crossed')
})

test('pitfall: the crocodile pond can be crossed on closed mouths', () => {
  const i = first('crocs'), dt = 1 / 60
  // Hop bank -> croc -> croc -> bank; search how long to wait before each jump.
  const grid = []
  for (let w = 0; w < 2.4; w += 0.1) grid.push(w)
  let ok = false
  for (const w1 of grid) { if (ok) break
    for (const w2 of grid) { if (ok) break
      for (const w3 of grid) {
        let s = P.makeState(); s.i = i; s.x = 0.245; s.invuln = 99
        const waits = [w1, w2, w3]; let hop = 0, since = 0
        for (let t = 0; t < 14 && s.alive && !ok; t += dt) {
          if (s.mode === 'run' && s.y === 0) {
            since += dt
            if (hop < 3 && since >= waits[hop]) { s = P.jump(s); hop++; since = 0 }
          }
          s = P.step(s, { dx: s.mode === 'air' ? 1 : 0 }, dt)
          if (s.lives < P.LIVES) break
          if (hop === 3 && s.mode === 'run' && s.x > 0.8) { ok = true }
        }
        if (ok) break
      }
    }
  }
  assert(ok, 'no timing crosses the crocodile pond')
})

test('pitfall: holes drop to a tunnel, the ladder comes back up, tunnels skip three screens', () => {
  const i = first('hole'), dt = 1 / 60
  let s = P.makeState(); s.i = i; s.x = 0.4
  for (let t = 0; t < 1 && s.mode !== 'under'; t += dt) s = P.step(s, { dx: 1 }, dt)
  assert(s.mode === 'under' && s.i === i, 'did not drop into the hole')
  s = P.step(s, { up: true }, dt)
  assert(s.mode === 'air' && s.holeLock > 0, 'ladder did not lift you out')
  for (let t = 0; t < 1.5; t += dt) s = P.step(s, { dx: 0 }, dt)
  assert(s.mode === 'run' && s.i === i, 'did not settle back on the surface')

  // Walk right along a tunnel with no wall, jumping the scorpion.
  const j = kinds().findIndex((k, n) => k === 'hole' && P.wallAt(n) <= 0 && n + 3 < P.N - 1 && n > 1)
  let u = P.makeState(); u.i = j; u.x = 0.4
  for (let t = 0; t < 1 && u.mode !== 'under'; t += dt) u = P.step(u, { dx: 1 }, dt)
  u.invuln = 99
  for (let t = 0; t < 6 && u.i === j; t += dt) u = P.step(u, { dx: 1 }, dt)
  assert(u.i === j + 3 && u.mode === 'under', 'tunnel did not advance three screens')
})

test('pitfall: a brick wall stops you', () => {
  const j = kinds().findIndex((k, n) => k === 'hole' && P.wallAt(n) === 1 && n > 1)
  let u = P.makeState(); u.i = j; u.x = 0.4
  const dt = 1 / 60
  for (let t = 0; t < 1 && u.mode !== 'under'; t += dt) u = P.step(u, { dx: 1 }, dt)
  u.invuln = 99
  for (let t = 0; t < 6; t += dt) u = P.step(u, { dx: 1 }, dt)
  assert(u.i === j && u.x < P.wallX(1), 'walked through the wall')
})

test('pitfall: logs cost points, not lives; treasure pays', () => {
  const i = first('logs'), dt = 1 / 60
  let s = P.makeState(); s.i = i; s.x = 0.5
  s.logs = [{ x: 0.5 }]; s.logT = 99
  s = P.step(s, { dx: 0 }, dt)
  assert(s.score === P.START_SCORE - 100 && s.lives === P.LIVES, 'log hit should cost 100 points')
  s = P.step(s, { dx: 0 }, dt)
  assert(s.score === P.START_SCORE - 100, 'hit again during invulnerability')

  const ti = Array.from({ length: P.N }, (_, n) => n).find(n => P.treasureAt(n))
  const tr = P.treasureAt(ti)
  let g = P.makeState(); g.i = ti; g.x = tr.x
  g = P.step(g, { dx: 0 }, dt)
  assert(g.score === P.START_SCORE + tr.value && g.treasures === 1, 'treasure not paid')
  g.x = tr.x
  g = P.step(g, { dx: 0 }, dt)
  assert(g.treasures === 1, 'treasure paid twice')
})

test('pitfall: a bot that just runs right ends the game with sane state', () => {
  const dt = 1 / 60
  let s = P.makeState(), t = 0
  while (s.alive && t++ < 60 * 600) {
    s = P.step(s, { dx: 1 }, dt)
    assert(finite(s.x, s.y, s.vy, s.score, s.time), 'NaN at ' + t)
    if (t % 45 === 0) s = P.jump(s)
    if (s.mode === 'vine') s = P.jump(s)
  }
  assert(!s.alive, 'run never ended')
  assert(s.lives === 0 || s.time === 0 || s.won, 'ended for no reason')
})

test('pitfall: running out of time and lives both end the run; saves round-trip', () => {
  let s = P.makeState(); s.time = 0.01
  s = P.step(s, { dx: 0 }, 1 / 60)
  assert(!s.alive, 'time up should end it')
  let d = P.makeState(); d.lives = 1; d.i = 4
  d = P.step(P.jump(d), { dx: 0 }, 1 / 60)
  const kk = P.makeState(); kk.i = P.kind(2) === 'tar' ? 2 : first('tar'); kk.x = 0.4
  let z = kk
  for (let t = 0; t < 3 && z.lives === P.LIVES; t += 1 / 60) z = P.step(z, { dx: 0 }, 1 / 60)
  assert(z.lives === P.LIVES - 1 && z.dead > 0, 'stepping into tar should cost a life')
  const back = P.deserialize(P.serialize(P.makeState()))
  assert(back && back.lives === P.LIVES, 'save round trip')
  assert(P.deserialize('nonsense') === null, 'bad save accepted')
})
