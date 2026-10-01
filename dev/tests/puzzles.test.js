// Puzzle content: every hand-made level can be finished.
const { load, assert, test } = require('./lib')

test('Roll Block: every level is solvable, with a par', () => {
  const R = load('rollblock')
  R.PARS.forEach((p, i) => assert(p > 0, 'level ' + (i + 1) + ' has no solution'))
})

test('Roll Block: the solver\'s route actually wins in play', () => {
  const R = load('rollblock')
  for (let n = 0; n < R.LEVELS.length; ++n) {
    // Rebuild the route breadth-first, then replay it through move/step.
    const L = R.parse(n), key = (b, o) => b.x + ',' + b.y + b.o + o, mv = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    let q = [{ b: L.start, out: L.bridgesOut, p: [] }], seen = {}, route = null
    while (q.length && !route) {
      const c = q.shift()
      for (const m of mv) {
        const r = R.apply(L, c.b, c.out, m[0], m[1])
        if (r.result === 'win') { route = c.p.concat([m]); break }
        if (r.result === 'fall' || seen[key(r.block, r.out)]) continue
        seen[key(r.block, r.out)] = 1
        q.push({ b: r.block, out: r.out, p: c.p.concat([m]) })
      }
    }
    let s = R.makeState(); R.startLevel(s, n)
    for (const m of route) { s = R.move(s, m[0], m[1]); for (let i = 0; i < 20; ++i) s = R.step(s, 1 / 60) }
    assert(s.phase === 'won' || s.level === n + 1 || s.done, 'level ' + (n + 1) + ' route did not win')
  }
})

test('Pipeline: a laid run fills, scores, and spills at the gap', () => {
  const P = load('pipeline')
  let s = P.makeState()
  s.cells = s.cells.map(() => ({ p: 0, wet: 0, fixed: false }))
  s.cells[3 * P.COLS + 1] = { p: P.E, wet: 0, fixed: true, source: true }
  s.source = { c: 1, r: 3 }
  for (let c = 2; c < 9; ++c) { s.cursor = { c, r: 3 }; s.queue[0] = c === 5 ? 15 : 10; s = P.place(s) }
  let n = 0
  while (s.phase === 'play' && n++ < 60 * 200) s = P.step(s, 1 / 60)
  assert(s.filled === 7, 'expected 7 lengths filled, got ' + s.filled)
  assert(s.phase === 'over', 'the open end should spill')
})

test('Cube Hop: a disc ride lures the snake off the edge', () => {
  const C = load('cubehop')
  let s = C.makeState()
  s.enemies = [{ kind: 'snake', r: 5, c: 0, fr: 5, fc: 0, t: 1, wait: 0.1 }]
  s.discs[0] = { r: 2, c: -1, used: false }
  s.p = { r: 3, c: 0, fr: 3, fc: 0, t: 1, state: 'idle' }
  s = C.hopPlayer(s, 'ul')
  const before = s.score
  for (let i = 0; i < 400; ++i) s = C.step(s, 1 / 60)
  assert(!s.enemies.some(e => e.kind === 'snake'), 'the snake should have jumped off')
  assert(s.score - before === 500 && s.lives === 3, 'lure should pay 500 and cost no life')
})
