// Slow checks, only with SLOW=1 (`make test-slow`).
const { load, assert, test } = require('./lib')

if (process.env.SLOW) {
  test('Catapult: a greedy search clears every fort within its stones', () => {
    const C = load('catapult')
    const settle = s => { let n = 0; while ((s.phase === 'flight' || s.phase === 'wait' || s.settling) && n++ < 60 * 20 && !s.dead && !(s.clearT > 0)) s = C.step(s, {}, 1 / 60); return s }
    for (let lv = 0; lv < C.LEVELS.length; ++lv) {
      let s = C.makeState(); s.level = lv; C.startLevel(s)
      for (let i = 0; i < 60; ++i) s = C.step(s, {}, 1 / 60)
      while (s.phase === 'aim' && !s.dead && !(s.clearT > 0)) {
        let best = null, bt = 1e9
        for (let a = -0.2; a <= 1.4; a += 0.1) for (let p = 0.3; p <= 1.001; p += 0.1) {
          let x = JSON.parse(JSON.stringify(s)); x.angle = a; x.power = p
          x = settle(C.launch(x))
          const v = C.countTargets(x.grid) * 100000 - x.score
          if (v < bt) { bt = v; best = x }
        }
        s = best
      }
      assert(s.clearT > 0, 'fort ' + (lv + 1) + ' not cleared')
    }
  })
}
