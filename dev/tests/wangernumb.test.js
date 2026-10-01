// Wangernumb: every rule gives a verdict, rounds always end, nothing goes NaN,
// the wheel is always a permutation, and saves round-trip.
const { load, assert, test } = require('./lib')

const W = load('wangernumb')

function play(seed, pick) {
  let s = W.makeState(seed), guard = 0
  const verdicts = {}
  while (!s.over && guard++ < 2000) {
    const n = pick(s, guard)
    for (const ch of String(n)) s = W.typeDigit(s, +ch)
    s = W.submit(s, guard)
    verdicts[s.verdict] = (verdicts[s.verdict] || 0) + 1
    if (s.bonus > 0) s = W.step(s, 0.5)
    assert(Number.isInteger(s.score) && s.score >= 0, 'score is a non-negative integer')
    assert(!Number.isNaN(s.rival) && !Number.isNaN(s.turn), 'no NaN')
    assert([...s.wheel].sort().join() === '0,1,2,3,4,5,6,7,8,9', 'wheel is a permutation')
  }
  assert(s.over, 'round terminated')
  return { s, verdicts }
}

test('wangernumb: 300 seeded rounds terminate with sane state', () => {
  for (let seed = 1; seed <= 300; ++seed) play(seed, (s, g) => (g * 7 + seed) % 100)
})

test('wangernumb: every rule can say yes and no', () => {
  for (let r = 0; r < W.RULES.length; ++r) {
    const seen = { yes: false, no: false }
    for (let seed = 1; seed < 400 && !(seen.yes && seen.no); ++seed) {
      const s = W.makeState(seed)
      s.rule = r
      for (const n of [1, 2, 3, 7, 9, 11, 22, 37, 50, 64, 77, 98, 99]) {
        for (const sec of [0, 1]) {
          const t = Object.assign({}, s)
          seen[W.evaluate(t, n, sec) ? 'yes' : 'no'] = true
        }
      }
    }
    assert(seen.yes && seen.no, 'rule ' + W.RULES[r] + ' is stuck on one answer')
  }
})

test('wangernumb: the bonus round opens on the fifth Wangernumb and everything scores in it', () => {
  let s = W.makeState(5), guard = 0
  while (s.bonus === 0 && !s.over && guard++ < 500) {
    s.rule = W.RULES.indexOf('mood'); s.mood = true
    s = W.typeDigit(s, 1); s = W.submit(s, 0)
  }
  assert(s.bonus > 0 && s.wangs === 5, 'bonus after five wangs')
  const before = s.score, strikes = s.strikes
  s.rule = W.RULES.indexOf('mood'); s.mood = false
  s = W.typeDigit(s, 4); s = W.submit(s, 0)
  assert(s.verdict === 'wang' && s.score > before && s.strikes === strikes, 'bonus scores regardless of the rule')
  s = W.step(s, W.BONUS_TIME + 1)
  assert(s.bonus === 0, 'bonus ends')
})

test('wangernumb: three strikes end the round', () => {
  let s = W.makeState(9)
  for (let i = 0; i < 3; ++i) {
    s.rule = W.RULES.indexOf('mood'); s.mood = false
    s = W.typeDigit(s, 3); s = W.submit(s, 0)
  }
  assert(s.over && s.strikes === 3, 'three strikes')
})

test('wangernumb: glyphs and saves', () => {
  assert(W.glyph(407, 0) === '407' && W.glyph(407, 1) === 'AOT', 'leet glyphs')
  const s = W.makeState(3)
  const back = W.deserialize(JSON.parse(JSON.stringify(W.serialize(s))))
  assert(back && back.seed === s.seed && back.rule === s.rule, 'round trip')
  assert(W.deserialize({}) === null && W.deserialize(null) === null, 'rejects junk')
})

test('wangernumb: the host names nobody', () => {
  const all = []
  for (const k in W.LINES) all.push(...W.LINES[k])
  all.push(...W.EVENTS, ...W.FAKE_HELP)
  for (const line of all) assert(!/\b(Julietta|Simon|Francis|Mitchell|Webb)\b/.test(line), 'named someone: ' + line)
})
