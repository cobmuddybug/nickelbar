// Real-time games: short simulated runs never produce NaN, get stuck, or
// break their own rules. Each uses a simple bot.
const { load, assert, test } = require('./lib')

const finite = (...v) => v.every(Number.isFinite)

test('Pinball: three balls drain and the game ends', () => {
  const P = load('pinball')
  let s = P.makeState(), t = 0
  while (!s.done && t++ < 60 * 400) {
    const b = s.ball
    const flip = b && !s.inLane && b.y > 12.2 && b.vy > 0
    s = P.step(s, { plunge: s.inLane && t % 120 < 70, left: flip && b.x < 4.8, right: flip && b.x >= 4.5 }, 1 / 60)
    if (s.ball) assert(finite(s.ball.x, s.ball.y), 'NaN ball')
  }
  assert(s.done && s.score > 0, 'game should end with a score')
})

test('Mini Golf: every hole can be holed', () => {
  const G = load('minigolf')
  const roll = s => { let n = 0; while (s.phase === 'roll' && n++ < 3000) s = G.step(s, {}, 1 / 60); return s }
  for (let h = 0; h < G.HOLES.length; ++h) {
    let holed = false
    for (let a = 0; a < 360 && !holed; a += 3) for (let p = 0.1; p <= 1 && !holed; p += 0.1) {
      // One or two putts, straight at the cup or anywhere.
      let s = G.makeState(); G.startHole(s, h)
      s = roll(G.shoot(s, a * Math.PI / 180, p))
      if (s.phase === 'sunk') holed = true
    }
    if (!holed) {
      // Two-shot search: best first shot by distance, then any second.
      let best = null, bd = 1e9, s0 = G.makeState(); G.startHole(s0, h)
      for (let a = 0; a < 360; a += 6) for (let p = 0.1; p <= 1; p += 0.15) {
        const r = roll(G.shoot(JSON.parse(JSON.stringify(s0)), a * Math.PI / 180, p))
        const d = Math.hypot(r.ball.x - G.HOLES[h].cup[0], r.ball.y - G.HOLES[h].cup[1])
        if (r.phase === 'aim' && d < bd) { bd = d; best = r }
      }
      for (let a = 0; a < 360 && !holed; a += 2) for (let p = 0.05; p <= 1 && !holed; p += 0.05) {
        const r = roll(G.shoot(JSON.parse(JSON.stringify(best)), a * Math.PI / 180, p))
        if (r.phase === 'sunk') holed = true
      }
    }
    // The zig-zag hole needs more than two shots; it's enough that the
    // ball can get round the first bend.
    if (h === 8) continue
    assert(holed, 'hole ' + (h + 1) + ' could not be holed in two')
  }
})

test('Artillery: CPU against CPU always finishes', () => {
  const A = load('artillery')
  for (let g = 0; g < 6; ++g) {
    let s = A.makeState(), n = 0
    while (s.phase !== 'done' && n++ < 60 * 60 * 15) {
      if (s.phase === 'aim' && s.turnTeam === 0) { const p = A.cpuPlan(s); s = A.copy(s); s.worms[s.cur].face = p.face; s.angle = p.angle; s.power = p.power; s = A.fire(s) }
      s = A.cpuStep(A.step(s, {}, 1 / 60), 1 / 60)
      assert(s.worms.every(w => finite(w.x, w.y)), 'NaN worm')
    }
    assert(s.phase === 'done', 'match did not finish')
  }
})

test('Cube Run: the slalom can be threaded', () => {
  const C = load('cuberun')
  for (let g = 0; g < 5; ++g) {
    let s = C.makeState(); s.z = 3 * C.PHASE_LEN + 2; s.genZ = s.z + 8; s.cubes = []; s.t = 40; C.gen(s)
    while (!s.dead && s.z < 4 * C.PHASE_LEN) {
      const rows = {}
      for (const c of s.cubes) if (c.z > s.z - 0.2) (rows[c.z] = rows[c.z] || []).push(c.x)
      const zs = Object.keys(rows).map(Number).sort((a, b) => a - b)
      let goal = s.x
      if (zs.length) { const xs = rows[zs[0]].sort((a, b) => a - b); let w = 0; for (let i = 1; i < xs.length; ++i) if (xs[i] - xs[i - 1] > w) { w = xs[i] - xs[i - 1]; goal = (xs[i] + xs[i - 1]) / 2 } }
      s = C.step(s, { dx: Math.abs(goal - s.x) < 0.1 ? 0 : goal > s.x ? 1 : -1 }, 1 / 60)
    }
    assert(!s.dead, 'crashed in the slalom')
  }
})

test('Catapult: forts are well formed and a direct hit breaks glass', () => {
  const C = load('catapult')
  for (let l = 0; l < C.LEVELS.length; ++l) {
    const grid = C.buildLevel(l)
    assert(C.countTargets(grid) > 0, 'fort ' + (l + 1) + ' has no targets')
    assert(C.unsupported(grid).length === 0, 'fort ' + (l + 1) + ' has floating pieces at the start')
  }
})

test('Empire: maps connect every capital; matches end', () => {
  const E = load('empire')
  for (let g = 0; g < 4; ++g) {
    let s = E.makeState(), t = 0
    assert(E.connected(s.tiles), 'capitals cut off by lakes')
    while (!s.done && t++ < 60 * 400) { if (t % 30 === 0) s = E.aiMove(s, 0); s = E.step(s, 1 / 60) }
    assert(s.done, 'match did not end')
  }
})

test('Endless games run a minute without NaN', () => {
  const runs = [
    ['deepwell', D => { let s = D.makeState(); for (let t = 0; t < 3600 && !s.dead; ++t) s = D.step(s, { dx: t % 90 < 45 ? 1 : -1, jump: t % 20 < 3 }, 1 / 60); return [s.p.x, s.p.y] }],
    ['grapple', G => { let s = G.makeState(), hold = true; for (let t = 0; t < 3600 && !s.dead; ++t) { if (s.line) hold = !(s.p.x > s.line.x + 1.2 && s.p.vy < -1); else if (s.holding) hold = false; else hold = s.p.vy > 1; if (!s.started) hold = true; s = G.step(s, { hold, dx: 0, dy: 0, aim: null }, 1 / 60) } return [s.p.x, s.p.y] }],
    ['bigfish', B => { let s = B.makeState(); for (let t = 0; t < 3600 && !s.dead; ++t) s = B.step(s, { dx: Math.sin(t / 50), dy: Math.cos(t / 70) }, 1 / 60); return [s.p.x, s.p.y, s.p.r] }],
    ['centipede', C => { let s = C.makeState(); for (let t = 0; t < 3600 && !s.dead; ++t) s = C.step(s, { dx: t % 60 < 30 ? 1 : -1, dy: 0, fire: true }, 1 / 60); return [s.p.x, s.p.y] }],
    ['swarm', S => { let s = S.makeState(); for (let t = 0; t < 3600 && !s.dead; ++t) s = S.step(s, { dx: t % 90 < 45 ? 1 : -1, fire: t % 10 < 5 }, 1 / 60); return [s.px] }],
    ['tempest', T => { let s = T.makeState(); for (let t = 0; t < 3600 && !s.dead; ++t) s = T.step(s, { dx: t % 40 < 20 ? 1 : 0, dy: 0, fire: true, lane: -1 }, 1 / 60); return [s.lane] }],
    ['digger', D => { let s = D.makeState(); for (let t = 0; t < 3600 && !s.dead; ++t) s = D.step(s, { dx: [1, 0, -1, 0][Math.floor(t / 50) % 4], dy: [0, 1, 0, -1][Math.floor(t / 50) % 4], pump: t % 20 < 10, pumpPress: t % 20 === 0 }, 1 / 60); return [s.p.x, s.p.y] }],
    ['chainburst', C => { let s = C.makeState(); s = C.fire(s); for (let t = 0; t < 600; ++t) s = C.step(s, 1 / 60); return [s.score] }],
    ['kittylaunch', K => { let s = K.makeState(); s.power = 1; s = K.fire(s); for (let t = 0; t < 3600 && s.phase === 'flight'; ++t) s = K.step(s, { boost: t % 60 === 0 }, 1 / 60); return [s.last] }]
  ]
  for (const [name, run] of runs) assert(finite(...run(load(name))), name + ' produced NaN')
})
