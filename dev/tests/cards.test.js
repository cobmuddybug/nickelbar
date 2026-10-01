// Card and dice games: rules hold over many simulated games.
const { load, assert, test } = require('./lib')

test('Crazy Eights: 52 cards always, and every match ends', () => {
  const C = load('crazyeights')
  for (let g = 0; g < 150; ++g) {
    let s = C.makeState(), guard = 0
    while (s.phase !== 'done' && guard++ < 20000) {
      if (s.phase === 'round') { s = C.nextRound(s); continue }
      if (s.phase === 'suit') { s = C.chooseSuit(s, C.bestSuit(s.hands[0])); continue }
      if (s.turn === 0) { const i = s.hands[0].findIndex(c => C.playable(s, c)); s = i < 0 ? C.drawUntilPlayable(s, 0) : C.playCard(s, 0, i) }
      else s = C.cpuMove(s)
      const n = s.deck.length + s.pile.length + s.hands.reduce((a, h) => a + h.length, 0)
      assert(n === 52, 'card count ' + n)
    }
    assert(s.phase === 'done', 'match did not finish')
  }
})

test('Knucklebones: scoring and knock-outs', () => {
  const K = load('knucklebones')
  assert(K.columnScore([4, 4, 4]) === 36 && K.columnScore([2, 2, 5]) === 13, 'column scores')
  let s = K.makeState(); s.cpu = [[3, 3], [], []]; s.die = 3; s.turn = 'you'
  s = K.place(s, 0)
  assert(s.cpu[0].length === 0 && s.last.knocked === 2, 'a 3 should knock out both 3s')
  let wins = 0
  for (let g = 0; g < 400; ++g) {
    let t = K.makeState()
    while (!t.done) t = t.turn === 'you' ? K.place(t, [0, 1, 2].filter(c => t.you[c].length < 3)[0]) : K.cpuMove(t)
    if (K.outcome(t) === 'lose') wins++
  }
  assert(wins > 200, 'the computer should beat a naive player most of the time (' + wins + '/400)')
})

test('Scratch cards: exactly one triple on winners, none on losers', () => {
  const S = load('scratch')
  for (let g = 0; g < 5000; ++g) {
    const c = S.makeCard(), cnt = {}
    c.spots.forEach(p => (cnt[p.sym] = (cnt[p.sym] || 0) + 1))
    const trips = Object.keys(cnt).filter(k => cnt[k] >= 3)
    assert(trips.length === (c.win >= 0 ? 1 : 0), 'bad card')
    if (c.win >= 0) assert(+trips[0] === c.win, 'triple is not the winning symbol')
  }
})
