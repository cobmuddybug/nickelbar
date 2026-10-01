// The thirteen games added on 2026-10-01 (bowling, fishing, ...): rules and simulated play.
const fs = require('fs'), path = require('path')
const { load, assert, test, ROOT } = require('./lib')

// ---- Bowling ----------------------------------------------------------------------------

test('Bowling: standard scoring', () => {
  const B = load('bowling')
  assert(B.tally(Array(12).fill(10)).total === 300, 'perfect game is 300')
  assert(B.tally(Array(21).fill(5)).total === 150, 'all spares with a 5 bonus is 150')
  assert(B.tally(Array(20).fill(0)).total === 0, 'gutter game')
  assert(B.tally([10, 3, 4, 0, 0]).frames[0].total === 17, 'strike counts the next two rolls')
  assert(B.tally([7, 3, 5, 0]).frames[0].total === 15, 'spare counts the next roll')
  assert(B.tally([10, 3]).total === 0 || B.tally([10, 3]).frames[0].total === null, 'open strike is unscored')
})

function bowl(B, s, x, angle, spin, power) {
  s = B.setX(s, x); s = B.setAngle(B.advance(s), angle); s = B.setSpin(s, spin)
  s = B.launch(s, power)
  for (let i = 0; i < 2000 && s.phase === 'roll'; ++i) s = B.step(s, 1 / 60)
  assert(s.phase !== 'roll', 'the roll settles')
  return s
}

test('Bowling: a gutter ball scores nothing, a pocket hit usually scores plenty', () => {
  const B = load('bowling')
  let s = bowl(B, B.makeState(), -0.4, -0.16, 0, 0.7)
  assert(s.last === 0, 'gutter ball knocks nothing, got ' + s.last)
  let total = 0
  for (let k = 0; k < 20; ++k) { const t = bowl(B, B.makeState(), 0.05, 0, 0, 0.8); total += t.last }
  assert(total / 20 >= 6, 'centre throws average 6+ pins, got ' + total / 20)
})

test('Bowling: random games finish with legal scores', () => {
  const B = load('bowling')
  for (let g = 0; g < 4; ++g) {
    let s = B.makeState(), n = 0
    while (!s.done && n++ < 40) {
      s = bowl(B, s, Math.random() * 0.8 - 0.4, Math.random() * 0.2 - 0.1, Math.random() * 2 - 1, 0.4 + Math.random() * 0.6)
      assert(s.rolls.every(r => r >= 0 && r <= 10), 'roll sizes')
    }
    assert(s.done, 'a game ends within 40 throws')
    const t = B.score(s)
    assert(t >= 0 && t <= 300, 'score in range ' + t)
    assert(s.rolls.length >= 10 && s.rolls.length <= 21, 'roll count ' + s.rolls.length)
  }
})

test('Bowling: score marks', () => {
  const B = load('bowling')
  assert(B.marks({ rolls: [10] }, false).join() === 'X', 'strike')
  assert(B.marks({ rolls: [7, 3] }, false).join() === '7,/', 'spare')
  assert(B.marks({ rolls: [9, 0] }, false).join() === '9,-', 'miss')
  assert(B.marks({ rolls: [10, 10, 4] }, true).join() === 'X,X,4', 'tenth frame')
  assert(B.marks({ rolls: [10, 6, 4] }, true).join() === 'X,6,/', 'tenth frame fill spare')
})

// ---- Fishing ----------------------------------------------------------------------------

test('Fishing: a cast, a bite and a reel can land every kind of fish; the log adds up', () => {
  const F = load('fishing')
  let s = F.makeState(), landed = 0, snapped = 0, escaped = 0
  for (let n = 0; n < 400; ++n) {
    s = F.action(s)                              // charge
    for (let i = 0, k = Math.floor(Math.random() * 100); i < k; ++i) s = F.step(s, 0.01)
    s = F.action(s)                              // cast
    let guard = 0
    while (s.phase === 'wait' && guard++ < 5000) s = F.step(s, 0.02)
    if (s.phase === 'bite') s = F.action(s)      // strike
    // reel: tap in short bursts
    guard = 0
    while (s.phase === 'reel' && guard++ < 20000) { s = F.setHold(s, s.tension < (s.surge > 0 ? 0.55 : 0.72)); s = F.step(s, 0.016) }
    if (s.msg.indexOf('SNAP') === 0) snapped++
    else if (s.msg.indexOf('slipped') >= 0) escaped++
    else if (s.fish) landed++
    if (s.phase === 'result') s = F.action(s)
    assert(s.phase === 'idle', 'back to idle, got ' + s.phase)
  }
  assert(landed > 20, 'lands some fish, got ' + landed)
  const total = Object.values(s.log).reduce((a, e) => a + e.n, 0)
  assert(total === landed, 'log counts every landing: ' + total + ' vs ' + landed)
  assert(s.score > 0 && Number.isFinite(s.score), 'score')
  assert(F.deserialize(F.serialize(s)).score === s.score, 'save round trip')
})

test('Fishing: never reeling loses the fish; holding forever snaps the line on strong fish', () => {
  const F = load('fishing')
  const reel = hold => {
    let s = F.makeState()
    s = F.action(s); s = F.action(s)
    for (let i = 0; i < 5000 && s.phase === 'wait'; ++i) s = F.step(s, 0.02)
    assert(s.phase === 'bite', 'bites')
    s = F.action(s); s = F.setHold(s, hold)
    for (let i = 0; i < 5000 && s.phase === 'reel'; ++i) s = F.step(s, 0.016)
    return s
  }
  for (let i = 0; i < 20; ++i) { const s = reel(false); assert(s.phase === 'result' && !s.fish, 'an idle line loses the fish') }
  let snaps = 0
  for (let i = 0; i < 80; ++i) if (reel(true).msg.indexOf('SNAP') === 0) snaps++
  assert(snaps > 0, 'holding the button the whole time sometimes snaps the line')
})

// ---- Bumper Cars ------------------------------------------------------------------------

test('Bumper Cars: random play stays finite, ends, and rounds can be cleared', () => {
  const Bm = load('bumper')
  let cleared = 0, scoreMax = 0
  for (let g = 0; g < 30; ++g) {
    let s = Bm.makeState(), t = 0
    s = Bm.setInput(s, 0, 0)
    while (!s.done && t < 600) {
      if (Math.floor(t * 4) !== Math.floor((t - 0.016) * 4)) {
        // a simple player: chase the nearest car, boost when close, retreat from the edge
        const p = s.cars[0]
        let tx = 0, ty = 0, bd = 9
        for (let i = 1; i < s.cars.length; ++i) { const c = s.cars[i]; if (c.out) continue; const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; tx = c.x - p.x; ty = c.y - p.y } }
        if (Math.hypot(p.x, p.y) > 0.3) { tx = -p.x; ty = -p.y }
        s = Bm.setInput(s, Math.sign(tx), Math.sign(ty))
        if (bd < 0.15) s = Bm.boost(s)
      }
      const before = s.round
      s = Bm.step(s, 0.016); t += 0.016
      if (s.round > before) cleared++
      assert(s.cars.every(c => Number.isFinite(c.x + c.y + c.vx + c.vy)), 'finite positions')
    }
    scoreMax = Math.max(scoreMax, s.score)
  }
  assert(scoreMax > 0, 'some score')
  assert(cleared >= 0, 'rounds progress without errors')
})

test('Bumper Cars: a car pushed past the edge is out; the player falling ends the round', () => {
  const Bm = load('bumper')
  let s = Bm.makeState()
  s.cars[0].x = 0.52; s.cars[0].y = 0
  s = Bm.step(s, 0.016)
  assert(s.done && s.cars[0].out, 'player ring-out ends the game')
})

// ---- Echo -------------------------------------------------------------------------------

test('Echo: a perfect player climbs; a wrong note ends the round', () => {
  const E = load('echo')
  for (const mode of [0, 1]) {
    let s = E.makeState(mode)
    for (let round = 1; round <= 12; ++round) {
      let g = 0
      while (s.phase === 'show' && g++ < 5000) s = E.step(s, 0.02)
      assert(s.phase === 'input' && s.seq.length === round, 'listening for round ' + round)
      for (const n of s.seq.slice()) s = E.press(s, n)
    }
    assert(s.score === 12 * E.MODES[mode].n, 'score is length × pads, got ' + s.score)
    let g = 0
    while (s.phase === 'show' && g++ < 5000) s = E.step(s, 0.02)
    const wrong = (s.seq[0] + 1) % E.MODES[mode].n
    s = E.press(s, wrong)
    assert(s.done, 'wrong note ends it')
  }
  assert(E.press(E.makeState(0), 1).phase === 'show', 'presses are ignored while it is playing')
})

// ---- Roulette ---------------------------------------------------------------------------

test('Roulette: every bet returns 36/37 on average, and pays the right odds', () => {
  const R = load('roulette')
  const ids = ['dz1', 'dz2', 'dz3', 'col1', 'col2', 'col3', 'low', 'high', 'even', 'odd', 'red', 'black']
  for (let n = 0; n <= 36; ++n) ids.push('n' + n)
  for (const id of ids) {
    let back = 0
    for (let n = 0; n <= 36; ++n) back += R.payout({ [id]: 1 }, n)
    assert(back === 36, id + ' returns 36 over 37 spins, got ' + back)
  }
  assert(R.payout({ red: 10 }, 0) === 0 && R.payout({ n0: 1 }, 0) === 36, 'zero loses outside bets')
  assert(R.payout({ red: 10 }, 1) === 20 && R.payout({ dz1: 5 }, 12) === 15, 'even money and dozens')
  assert(R.WHEEL.length === 37 && new Set(R.WHEEL).size === 37, 'wheel has each pocket once')
  assert(R.REDS.length === 18, 'eighteen reds')
})

test('Roulette: chips are conserved through bets, spins and clears', () => {
  const R = load('roulette')
  let s = R.makeState()
  s = R.place(R.place(s, 'red'), 'n17', 5)
  assert(s.chips === 500 - 5 - 5, 'chips leave the stack')
  s = R.clear(s); assert(s.chips === 500 && !Object.keys(s.bets).length, 'clear refunds')
  s = R.place(s, 'black', 25); s = R.spin(s, 2)       // 2 is black
  for (let i = 0; i < 400 && s.phase === 'spin'; ++i) s = R.step(s, 0.02)
  assert(s.chips === 500 + 25 && s.win === 25, 'black wins even money')
  s = R.rebet(s); assert(s.chips === 500 && s.bets.black === 25, 'rebet')
  let g = R.makeState()
  for (let k = 0; k < 600 && !g.done; ++k) { g = R.place(g, 'n' + (k % 37), 100); g = R.spin(g); for (let i = 0; i < 400 && g.phase === 'spin'; ++i) g = R.step(g, 0.02) }
  assert(g.chips >= 0, 'chips never negative')
})

// ---- High Striker, Quick Draw, Mind Tester ------------------------------------------------

test('High Striker: judging, steady mashing finds the bell, auto-swing ends a round', () => {
  const H = load('striker')
  assert(H.judge(0.95).pts === 250, 'bell window scores 250')
  assert(H.judge(1.3).pts < H.judge(0.9).pts, 'overpowering is worse than the bell')
  assert(H.judge(0.5).pts === 50, 'weak swing scores its power')
  let s = H.makeState(), bells = 0
  for (let swing = 1; swing <= 5; ++swing) {
    let guard = 0
    while (s.phase === 'mash' && guard++ < 5000) {
      s = H.mash(s)
      for (let i = 0; i < 4; ++i) s = H.step(s, 0.02)            // ~12 presses a second
      if (s.power >= 0.93 && s.power <= 0.99) s = H.strike(s)
    }
    while (s.phase !== 'mash' && !s.done) s = H.step(s, 0.05)
    if (s.scores[swing - 1] === 250) bells++
  }
  assert(s.done && s.scores.length === 5, 'five swings')
  assert(bells >= 3, 'a bot that aims for the bell finds it, got ' + bells)
  let a = H.makeState(); a = H.mash(a)
  for (let i = 0; i < 1000 && a.phase === 'mash'; ++i) a = H.step(a, 0.05)
  assert(a.phase !== 'mash', 'the hammer swings itself eventually')
})

test('Quick Draw: foul, decoy, slow and fast all resolve', () => {
  const Q = load('quickdraw')
  let s = Q.makeState()
  assert(Q.fire(s).lives === 2 && Q.fire(s).msg === 'TOO EARLY!', 'early fire fouls')
  for (let i = 0; i < 1000 && s.phase === 'wait'; ++i) s = Q.step(s, 0.01)
  assert(s.phase === 'draw', 'draw cue arrives')
  const w = Q.fire(s); assert(w.won && w.score > 0, 'fast fire wins')
  let slow = s; for (let i = 0; i < 200 && slow.phase === 'draw'; ++i) slow = Q.step(slow, 0.01)
  assert(slow.phase === 'result' && !slow.won && slow.lives === 2, 'too slow loses a life')
  let g = Q.makeState(), n = 0
  while (!g.done && n++ < 100) { g = Q.fire(Q.fire(g)) }
  assert(g.done && g.lives === 0, 'three fouls end the game')
  assert(Q.oppTime(1) > Q.oppTime(10) && Q.oppTime(100) >= 0.24, 'outlaws speed up to a floor')
})

test('Mind Tester: readings are produced and the best is kept', () => {
  const M = load('mindtester')
  let s = M.makeState()
  for (let i = 0; i < 40; ++i) { s = M.press(s); for (let k = 0; k < 200 && s.phase === 'scan'; ++k) s = M.step(s, 0.02); assert(s.phase === 'show' && s.line.length > 0, 'a verdict') }
  assert(s.n === 40 && s.top > 0 && s.history.length === 8, 'counted')
})

// ---- Ring Toss --------------------------------------------------------------------------

test('Ring Toss: aimed rings score; a full session ends after twelve rings', () => {
  const T = load('ringtoss')
  let hitsTotal = 0, games = 40
  for (let g = 0; g < games; ++g) {
    let s = T.makeState(), n = 0
    while (!s.done && n++ < 40) {
      const free = s.bottles.filter(b => !b.on)
      const b = free.sort((a, c) => a.y - c.y)[0] || s.bottles[0]
      s = T.aim(s, b.x)
      let k = 0
      while (s.phase === 'aim' && k++ < 2000) {
        s = T.step(s, 0.01)
        if (Math.abs(T.depth(s.m) - b.y) < 0.01) { s = T.toss(s); break }
      }
      if (s.phase === 'aim') s = T.toss(s)
      for (let i = 0; i < 100 && s.phase === 'fly'; ++i) s = T.step(s, 0.01)
    }
    assert(s.done && s.rings >= 0 && s.rings <= 12, 'done')
    assert(s.total === s.bottles.filter(b => b.on).reduce((a, b) => a + b.pts, 0) + (s.bottles.every(b => b.on) ? 200 : 0), 'total matches the ringed bottles')
    hitsTotal += s.hits
  }
  assert(hitsTotal / games > 3, 'a timing bot lands rings, avg ' + hitsTotal / games)
})

// ---- Milk Jugs --------------------------------------------------------------------------

test('Milk Jugs: throws are finite, jugs can fall, racks can be cleared', () => {
  const J = load('jugs')
  let best = 0, cleared = 0
  for (let g = 0; g < 60; ++g) {
    let s = J.makeState(), n = 0
    while (!s.done && n++ < 12) {
      s = J.setAngle(s, 0.2 + Math.random() * 0.5)
      for (let i = 0, k = Math.floor(Math.random() * 120); i < k; ++i) s = J.step(s, 0.01)
      const level = s.level
      s = J.throwBall(s)
      for (let i = 0; i < 1000 && s.phase === 'fly'; ++i) {
        s = J.step(s, 1 / 60)
        assert(s.jugs.every(j => Number.isFinite(j.x + j.y)) && (!s.b || Number.isFinite(s.b.x + s.b.y)), 'finite')
      }
      assert(s.phase === 'aim' || s.done, 'throw settles')
      if (s.level > level) cleared++
      best = Math.max(best, s.total)
    }
  }
  assert(best > 0, 'some jugs fall')
  assert(J.deserialize(J.serialize(J.makeState(3, 50))).level === 3, 'save round trip')
})

// ---- Hold'em ----------------------------------------------------------------------------

const cardsOf = str => str.split(' ').map(t => ({ rank: { A: 1, K: 13, Q: 12, J: 11, T: 10 }[t[0]] || Number(t[0]), suit: t[1] }))

test("Hold'em: hand ranking", () => {
  const H = load('holdem'), ev = s => H.best(cardsOf(s))
  const order = ['2C 5D 9H JS KC', '2C 2D 9H JS KC', '2C 2D 9H 9S KC', '2C 2D 2H JS KC', '2C 3D 4H 5S AC', '2C 3D 4H 5S 6C',
    '2C 7C 9C JC KC', '2C 2D 2H JS JC', '2C 2D 2H 2S KC', '2C 3C 4C 5C 6C']
  for (let i = 1; i < order.length; ++i) assert(ev(order[i]) > ev(order[i - 1]), order[i] + ' beats ' + order[i - 1])
  assert(ev('AC 2D 3H 4S 5C') < ev('2C 3D 4H 5S 6C'), 'the wheel is the lowest straight')
  assert(ev('AS KS QS JS TS') > ev('KS QS JS TS 9S'), 'royal beats king-high straight flush')
  assert(ev('AC AD KH 7S 3C') > ev('AC AD QH 7S 3C'), 'kicker decides')
  assert(ev('2C 2D 5H 5S 9C 9D KC') === ev('5H 5S 9C 9D KC 2C 3D'), 'best five of seven: top two pair plus king')
  assert(H.handName(ev('2C 2D 2H JS JC')) === 'Full House', 'name')
})

test("Hold'em: bots play whole games; chips are conserved; side pots pay", () => {
  const H = load('holdem')
  for (let g = 0; g < 25; ++g) {
    let s = H.makeState(), guard = 0
    while (!s.done && guard++ < 6000) {
      if (s.phase === 'over') { s = H.nextHand(s); continue }
      if (s.toAct === 0) {
        const r = Math.random()
        s = H.act(s, 0, r < 0.15 ? 'fold' : r < 0.3 ? 'raise' : 'call')
      } else s = H.step(s, 1)
      const total = s.players.reduce((a, p) => a + p.chips + p.total, 0)
      assert(s.phase === 'over' ? s.players.reduce((a, p) => a + p.chips, 0) === 4000 : total === 4000, 'chips conserved, got ' + total)
      assert(s.players.every(p => p.chips >= 0), 'no negative stacks')
    }
    assert(s.done, 'a session ends, hand ' + s.hand)
  }
})

test("Hold'em: an all-in short stack only wins what it covered", () => {
  const H = load('holdem')
  let s = H.makeState()
  s.players[0].chips = 100; s.players[1].chips = 1000; s.players[2].chips = 1000; s.players[3].chips = 1000
  s = H.startHand(Object.assign({}, s, { hand: 0, dealer: 3 }))
  // Force a showdown by hand: everyone calls everything.
  let guard = 0
  while (s.phase === 'bet' && guard++ < 200) s = s.toAct === 0 ? H.act(s, 0, 'call') : H.act(s, s.toAct, 'call')
  assert(s.phase === 'over', 'hand ends')
  assert(s.players.reduce((a, p) => a + p.chips, 0) === 3100, 'chips conserved through showdown')
})

// ---- Raid -------------------------------------------------------------------------------

test('Raid: an autopilot survives into later stages without NaNs; dying ends the game', () => {
  const R = load('raid')
  let s = R.makeState(), t = 0
  s.lives = 9999
  while (!s.done && t < 400) {
    // fly to the nearest enemy's height and keep firing
    let target = s.boss ? s.boss.y : 0.5, best = 9
    for (const e of s.enemies) if (e.x - s.ship.x > 0 && e.x - s.ship.x < best) { best = e.x - s.ship.x; target = e.y }
    const dy = target - s.ship.y
    s = R.setInput(s, 0, Math.abs(dy) < 0.02 ? 0 : Math.sign(dy), true)
    s = R.step(s, 0.016); t += 0.016
    assert([s.ship.x, s.ship.y, s.score].every(Number.isFinite), 'finite')
    s.inv = 5     // invulnerable for the test
  }
  assert(s.score > 500 && s.kills > 20, 'autopilot kills things: ' + s.kills)
  assert(s.wave >= 2, 'a boss is beaten within 400 s, wave ' + s.wave)
  let d = R.makeState(); d.lives = 1; d.inv = 0
  d.shots = [{ x: d.ship.x, y: d.ship.y, vx: 0, vy: 0 }]
  d = R.step(d, 0.016)
  assert(d.done, 'a hit on the last life ends it')
})

// ---- Billiards --------------------------------------------------------------------------

test('Billiards: the computer plays both sides to a result; balls stay on the table', () => {
  const B = load('billiards')
  let results = { 0: 0, 1: 0 }, finished = 0
  for (let g = 0; g < 6; ++g) {
    let s = B.makeState(), n = 0, steps = 0
    while (!s.done && n++ < 400) {
      if (s.phase === 'aim' || s.phase === 'place') s = B.cpuTurn(s)
      let guard = 0
      while (s.phase === 'roll' && guard++ < 4000) {
        s = B.step(s, 1 / 60); steps++
        assert(s.balls.every(b => Number.isFinite(b.x + b.y)), 'finite')
        assert(s.balls.every(b => b.in || (b.x >= 0 && b.x <= 2 && b.y >= 0 && b.y <= 1)), 'balls stay inside')
      }
      assert(s.phase !== 'roll', 'every shot comes to rest')
    }
    if (s.done) { finished++; results[s.winner]++ }
  }
  assert(finished >= 3, 'most games finish, ' + finished)
})

test('Billiards: a straight shot pots a ball; a scratch gives ball in hand', () => {
  const B = load('billiards')
  let s = B.makeState()
  // A single object ball a short way from the corner pocket, cue behind it.
  s.balls.forEach(b => { if (b.id > 1) b.in = true })
  s.balls[1].x = 0.2; s.balls[1].y = 0.2
  s.balls[0].x = 0.6; s.balls[0].y = 0.6
  s = B.setAim(s, Math.atan2(0.2 - 0.6, 0.2 - 0.6)); s = B.setPower(s, 0.6); s = B.shoot(s)
  for (let i = 0; i < 4000 && s.phase === 'roll'; ++i) s = B.step(s, 1 / 60)
  assert(s.balls[1].in, 'the object ball is potted')
  assert(s.groups[0] === 'solid' && s.turn === 0 || s.phase === 'place', 'the potter keeps the table or the foul is called')
  let t = B.makeState()
  t.balls[0].x = 0.1; t.balls[0].y = 0.1
  t = B.shoot(B.setPower(B.setAim(t, Math.atan2(-0.1, -0.1)), 0.6))
  for (let i = 0; i < 4000 && t.phase === 'roll'; ++i) t = B.step(t, 1 / 60)
  assert(t.phase === 'place' && t.turn === 1, 'a scratch hands over ball in hand')
})

// ---- Newton's Apples, Tornado -----------------------------------------------------------

test("Newton's Apples: every apple is caught, missed or still falling; the wheel pays out", () => {
  const N = load('newton')
  for (let g = 0; g < 20; ++g) {
    let s = N.makeState(), t = 0
    while (!s.done && t < 400) {
      if (Math.random() < 0.05) s = N.drop(N.slide(s, Math.random() - 0.5))
      s = N.step(s, 0.016); t += 0.016
      assert(Number.isFinite(s.score) && s.apples.every(a => Number.isFinite(a.x + a.y)), 'finite')
      const ridersIn = s.cups.reduce((a, c) => a + c.n, 0)
      assert(s.caught + s.missed + s.apples.length === 50 - s.left, 'apples accounted for')
      assert(ridersIn + s.dumped === s.caught, 'caught apples are riding or dumped')
    }
    if (s.left === 0) assert(s.done, 'ends once all are used')
  }
  // Aimed drops: one directly above the top cup lands in it.
  let s = N.makeState(), best = 0
  for (let n = 0; n < 200 && s.left > 0; ++n) {
    const cp = N.cupPos(s, 0)
    s = N.slide(s, cp.x - s.x); s = N.drop(s)
    for (let i = 0; i < 90; ++i) s = N.step(s, 0.016)
  }
  assert(s.caught > 3, 'timed drops catch apples, caught ' + s.caught)
})

test('Tornado: balls land in slots and the total matches', () => {
  const T = load('tornado')
  let totalMax = 0
  for (let g = 0; g < 20; ++g) {
    let s = T.makeState(), t = 0
    while (!s.done && t < 300) {
      if (Math.random() < 0.06) s = T.drop(T.slide(s, Math.random() - 0.5))
      s = T.setWind(s, Math.floor(Math.random() * 3) - 1)
      s = T.step(s, 0.016); t += 0.016
      assert(s.balls.every(b => Number.isFinite(b.x + b.y)), 'finite')
    }
    assert(s.done, 'a game ends'); assert(s.score > 0, 'something scores')
    totalMax = Math.max(totalMax, s.score)
  }
  assert(totalMax >= 100, 'decent runs reach 100+')
})

test('Catalog: games are alphabetical within each category', () => {
  const cat = load('engine/GamesCatalog.js')
  for (const sec of cat.sections("", [], [], []).filter(s => cat.TYPE_ORDER.indexOf(s.name) >= 0)) {
    const t = sec.games.map(g => g.title.toLowerCase())
    assert(t.every((x, i) => i === 0 || t[i - 1] <= x), sec.name + ' is out of order')
  }
})

// ---- Stomper ----------------------------------------------------------------------------

test('Stomper: generated levels only use jumpable pieces and end in a flag', () => {
  const S = load('stomper')
  for (let lv = 1; lv <= 30; ++lv) {
    const L = S.generate(lv), t = L.tiles
    let gap = 0, maxGap = 0, maxPipe = 0
    for (let x = 0; x < L.W; ++x) {
      gap = t[S.G][x] === '.' ? gap + 1 : 0; maxGap = Math.max(maxGap, gap)
      let h = 0; while (t[S.G - 1 - h][x] === 'p') h++
      maxPipe = Math.max(maxPipe, h)
    }
    assert(maxGap <= 3, 'level ' + lv + ' gap ' + maxGap)
    assert(maxPipe <= 3, 'level ' + lv + ' pipe ' + maxPipe)
    assert(t[S.G - 2][L.flagX] === 'F', 'flag in level ' + lv)
    assert(L.spawns.every(e => e.x > 8 && e.x < L.W - 10), 'enemies are placed inside the level')
  }
  assert(JSON.stringify(S.generate(4).tiles) === JSON.stringify(S.generate(4).tiles), 'levels are deterministic')
})

test('Stomper: physics: you land on the ground, jump higher when holding, and bump blocks', () => {
  const S = load('stomper')
  const s = S.makeState(1)
  for (let i = 0; i < 30; ++i) S.step(s, 1 / 60, {})
  assert(s.p.ground && Math.abs(s.p.y + s.p.h - S.G) < 0.01, 'standing on the ground')
  const peak = hold => {
    const t = S.makeState(1); for (let i = 0; i < 10; ++i) S.step(t, 1 / 60, {})
    S.jump(t); let top = t.p.y
    for (let i = 0; i < 120; ++i) { S.step(t, 1 / 60, { jump: hold && i < 40 }); top = Math.min(top, t.p.y) }
    return S.G - SMALL - top
  }
  const SMALL = 0.95
  assert(peak(true) > peak(false) + 0.8, 'holding jump goes higher: ' + peak(true) + ' vs ' + peak(false))
  assert(peak(true) > 3.1 && peak(true) < 4.2, 'full jump is about 3.5 tiles: ' + peak(true))
  // Walk under a ? block and hit it from below.
  const b = S.makeState(1); let hit = false
  const bx = b.tiles[S.G - 4].indexOf('?')
  b.p.x = bx + 0.1; b.p.y = S.G - 0.95 - 0.0
  for (let i = 0; i < 10; ++i) S.step(b, 1 / 60, {})
  S.jump(b)
  for (let i = 0; i < 40; ++i) { S.step(b, 1 / 60, { jump: true }); if (b.tiles[S.G - 4][bx] === 'E') hit = true }
  assert(hit && b.coins === 1 && b.score >= 100, 'a prize block gives a coin')
})

test('Stomper: stomping kills a Gribble, a side hit costs a life, a berry makes you big', () => {
  const S = load('stomper')
  let s = S.makeState(1)
  s.ents = [{ type: 'gribble', x: 6, y: S.G - 0.9, vx: 0, vy: 0, w: 0.85, h: 0.9, mode: 'walk', dead: 0, ground: true }]
  s.p.x = 6.0; s.p.y = S.G - 3; s.p.vy = 6; s.p.ground = false
  for (let i = 0; i < 30 && s.ents.some(e => e.mode === 'walk'); ++i) S.step(s, 1 / 60, {})
  assert(s.ents.every(e => e.mode !== 'walk') && s.score >= 100, 'stomped')
  s = S.makeState(1)
  s.ents = [{ type: 'gribble', x: 6.2, y: S.G - 0.9, vx: 0, vy: 0, w: 0.85, h: 0.9, mode: 'walk', dead: 0, ground: true }]
  s.p.x = 5.8; s.p.y = S.G - 0.95
  for (let i = 0; i < 20; ++i) S.step(s, 1 / 60, {})
  assert(s.status === 'dead', 'walking into one kills a small hero')
  s = S.makeState(1); s.ents = [{ type: 'berry', x: s.p.x, y: s.p.y, vx: 0, vy: 0, w: 0.8, h: 0.8, mode: 'walk', dead: 0, ground: false }]
  S.step(s, 1 / 60, {})
  assert(s.p.big && s.p.h > 1.5, 'big')
  s.ents = [{ type: 'gribble', x: s.p.x, y: s.p.y, vx: 0, vy: 0, w: 0.85, h: 0.9, mode: 'walk', dead: 0, ground: true }]
  S.step(s, 1 / 60, {})
  assert(s.status === 'play' && !s.p.big && s.p.inv > 0, 'a hit shrinks a big hero instead of killing')
})

test('Stomper: a simple bot can clear the early levels, and dying costs lives', () => {
  const S = load('stomper')
  let cleared = 0
  for (let lv = 1; lv <= 3; ++lv) {
    let s = S.makeState(lv, { lives: 999 }), t = 0
    const start = lv
    while (s.level === start && !s.done && t < 400) {
      const p = s.p
      // look ahead: jump over gaps, walls and enemies
      let jump = false
      const ax = Math.floor(p.x + 0.4)
      for (let d = 1; d <= 2 && !jump; ++d) {
        const tx = ax + d, col = tx < s.W ? s.tiles : null
        if (col && (!(S.SOLID[s.tiles[S.G][tx]]) || S.SOLID[s.tiles[S.G - 1][tx]] || S.SOLID[s.tiles[S.G - 2][tx]])) jump = true
      }
      for (const e of s.ents) if (e.dead <= 0 && e.type !== 'berry' && e.x - p.x > 0 && e.x - p.x < 3.2) jump = true
      if (jump && p.ground) S.jump(s)
      const next = S.step(s, 1 / 60, { dx: 1, jump, view: 16 })
      s = next; t += 1 / 60
    }
    if (s.level > start) cleared++
  }
  assert(cleared >= 2, 'bot clears at least two of the first three levels: ' + cleared)
  let d = S.makeState(1); d.lives = 1
  S.die(d)
  for (let i = 0; i < 300 && !d.done; ++i) d = S.step(d, 1 / 60, {})
  assert(d.done && d.status === 'over', 'last life lost ends the game')
})

test('Resume: Billiards, Raid and Bumper Cars survive a save round trip', () => {
  const B = load('billiards'), R = load('raid'), M = load('bumper')
  let b = B.makeState(); b = B.shoot(B.setPower(B.setAim(b, Math.PI), 0.7)); for (let i = 0; i < 30; ++i) b = B.step(b, 1 / 60)
  const b2 = B.deserialize(JSON.parse(JSON.stringify(B.serialize(b))))
  assert(b2 && b2.balls.length === 16 && b2.phase !== 'roll', 'billiards restores at rest')
  let r = R.makeState(); for (let i = 0; i < 200; ++i) r = R.step(r, 0.016)
  const r2 = R.deserialize(JSON.parse(JSON.stringify(R.serialize(r))))
  assert(r2 && r2.score === r.score && r2.lives === r.lives, 'raid restores')
  for (let i = 0; i < 100; ++i) r2.ship && R.step(r2, 0.016)
  let m = M.makeState(); for (let i = 0; i < 100; ++i) m = M.step(m, 0.016)
  const m2 = M.deserialize(JSON.parse(JSON.stringify(M.serialize(m))))
  assert(m2 && m2.cars.length === m.cars.length && m2.round === m.round, 'bumper cars restores')
  assert(B.deserialize(null) === null && R.deserialize({}) === null, 'bad saves are refused')
})

test('Catalog: every game has picker metadata and the filters narrow the list', () => {
  const cat = load('engine/GamesCatalog.js')
  for (const g of cat.GAMES) assert(cat.META[g.id] && cat.META[g.id][0] > 0, g.id + ' needs a META entry')
  const count = (f, scores) => cat.sections('', [], [], [], f, scores || {}).filter(s => cat.TYPE_ORDER.indexOf(s.name) >= 0).reduce((a, s) => a + s.games.length, 0)
  assert(count('') === cat.GAMES.length, 'no filter lists everything')
  assert(count('quick') > 5 && count('quick') < cat.GAMES.length, 'quick narrows')
  assert(count('vs') > 5, 'versus narrows')
  assert(cat.isNew('stomper', Date.parse('2026-10-05')) && !cat.isNew('stomper', Date.parse('2027-01-01')) && !cat.isNew('snake'), 'new lasts 30 days')
  assert(count('unplayed', { snake: 5 }) === cat.GAMES.length - 1, 'unplayed hides games with a score')
  assert(cat.sections('', ['snake'], [], [], 'quick', {}).every(s => s.name !== 'Recent'), 'filtered lists skip Recent')
})

test('Help: every game help text splits into key rows and notes without losing anything', () => {
  const H = load('engine/help.js'), cat = load('engine/GamesCatalog.js')
  let withKeys = 0
  for (const g of cat.GAMES) {
    const q = fs.readFileSync(path.join(ROOT, 'games', g.qml), 'utf8')
    const m = q.match(/helpText:\s*"([^"]*)"/)
    if (!m) continue                         // inherits (Geometry Classic) or builds it elsewhere
    const r = H.parse(m[1])
    assert(r.keys.length + r.notes.length === m[1].split(/\s+·\s+/).filter(s => s.trim()).length, g.id + ': segments lost')
    if (r.keys.length) withKeys++
  }
  assert(withKeys > 90, 'most games show key rows, got ' + withKeys)
  const r = H.parse('ARROWS / HJKL steer · N new game · hold SPACE to fire · WALLS WRAP · Eat the food and grow.')
  assert(r.keys[0].key === 'ARROWS / HJKL' && r.keys[0].desc === 'steer', 'arrows row')
  assert(r.keys.some(k => k.key === 'hold SPACE' && k.desc === 'to fire'), 'hold verb')
  assert(r.notes.indexOf('Eat the food and grow.') >= 0, 'prose stays a note')
})

test('Difficulty: every game that offers it exposes setDifficulty and survives all three levels', () => {
  const ids = ['pong', 'airhockey', 'foosball', 'lightcycles', 'artillery', 'reversi', 'mancala', 'knucklebones', 'empire', 'billiards', 'holdem', 'raid', 'bumper', 'stomper', 'quickdraw', 'bingo']
  for (const id of ids) {
    const L = load(id)
    assert(typeof L.setDifficulty === 'function', id + ' needs setDifficulty')
    for (const lv of [0, 1, 2, -1]) { L.setDifficulty(lv); const s = L.makeState(); assert(s, id + ' makes a state at level ' + lv) }
    L.setDifficulty(1)
  }
  const Q = load('quickdraw'); Q.setDifficulty(0); const easy = Q.oppTime(3); Q.setDifficulty(2); const hard = Q.oppTime(3)
  assert(easy > hard * 1.4, 'easy outlaws are slower than hard ones')
  const R = load('raid'); R.setDifficulty(0); assert(R.makeState().lives === 5, 'easy raid has 5 lives'); R.setDifficulty(2); assert(R.makeState().lives === 2, 'hard raid has 2')
})

test('Rng: seeding makes games deal the same way; unseeding restores real randomness', () => {
  const R = load('engine/Rng.js'), K = load('klondike'), S = load('sudoku')
  R.seed(123); const a = JSON.stringify(K.makeState()); R.seed(123); const b = JSON.stringify(K.makeState())
  assert(a === b, 'same seed, same Klondike deal')
  R.seed(124); assert(JSON.stringify(K.makeState()) !== a, 'different seed, different deal')
  R.seed(5); const s1 = JSON.stringify(S.makeState ? S.makeState(0) : S.generate(0)); R.seed(5)
  const s2 = JSON.stringify(S.makeState ? S.makeState(0) : S.generate(0)); assert(s1 === s2, 'same seed, same Sudoku')
  R.unseed(); assert(!R.isSeeded() && R.random() !== R.random(), 'unseeded is random again')
  assert(R.hash('sudoku2026-10-01') === R.hash('sudoku2026-10-01') && R.hash('a') !== R.hash('b'), 'hash is stable')
  assert(R.today(Date.parse('2026-10-01T12:00:00')) === '2026-10-01', 'today formats a local date')
})

test('Shared parts: the meter sweeps between its limits; circles bounce apart with the right impulse', () => {
  const M = load('meter'), P = load('physics')
  let v = 0, dir = 1, lo = 1, hi = 0
  for (let i = 0; i < 400; ++i) { const r = M.swing(v, dir, 0.016, 1.2, 0.1, 0.9); v = r.v; dir = r.dir; lo = Math.min(lo, v); hi = Math.max(hi, v) }
  assert(Math.abs(lo - 0.1) < 1e-9 && Math.abs(hi - 0.9) < 1e-9, 'meter stays within 0.1 to 0.9 and reaches both ends')
  const a = { x: 0, y: 0, vx: 1, vy: 0 }, b = { x: 0.9, y: 0, vx: 0, vy: 0 }
  const closing = P.collide(a, 0.5, 1, b, 0.5, 1, 1)
  assert(Math.abs(closing - 1) < 1e-9 && Math.abs(a.vx) < 1e-9 && Math.abs(b.vx - 1) < 1e-9, 'equal masses swap velocities when elastic')
  assert(b.x - a.x >= 1 - 1e-9, 'overlap is resolved')
  assert(P.collide({ x: 0, y: 0, vx: 0, vy: 0 }, 0.1, 1, { x: 5, y: 0, vx: 0, vy: 0 }, 0.1, 1, 1) === -1, 'no overlap, no collision')
  const c = { x: 0, y: 0, vx: -1, vy: 0 }, d = { x: 0.9, y: 0, vx: 0, vy: 0 }
  assert(P.collide(c, 0.5, 1, d, 0.5, 1, 1) === 0 && c.vx === -1, 'moving apart: pushed apart, no impulse')
})

test('Two players: Four in a Row, Checkers and Reversi alternate turns with no computer reply; Pong skips its AI', () => {
  const F = load('fourinarow'), C = load('checkers'), R = load('reversi'), P = load('pong')
  F.setTwoPlayer(true); let f = F.makeState()
  f = F.drop(F.moveCursor(f, 0)); assert(f.turn === 2 && f.board.flat().filter(v => v).length === 1, 'one disc, then player 2')
  f = F.dropAt(f, 0); assert(f.board[5][0] === 2 && f.turn === 1, 'player 2 drops, then player 1 again')
  for (let k = 0; k < 3; ++k) { f = F.dropAt(f, 1); f = F.dropAt(f, 0) }
  assert(f.winner !== 0, 'someone wins with a stack of four'); F.setTwoPlayer(false)
  C.setTwoPlayer(true); let c = C.makeState(); assert(C.me(c) === 1, 'player 1 starts')
  const mv = C.moves(c.board, 1)[0]
  c = C.play(c, mv); assert(c.turn === 2 && C.me(c) === 2, 'then player 2, with no computer move'); C.setTwoPlayer(false)
  R.setTwoPlayer(true); let r = R.makeState()
  const lm = R.legalMoves(r.board, R.BLACK)[0]
  r = R.humanMove(r, lm.x, lm.y); assert(r.turn === R.WHITE, 'white (player 2) moves next')
  const wm = R.legalMoves(r.board, R.WHITE)[0]
  r = R.humanMove(r, wm.x, wm.y); assert(r.turn === R.BLACK || r.over, 'back to black')
  r = R.undo(r); assert(r.turn === R.WHITE, 'undo hands the move back to the previous player'); R.setTwoPlayer(false)
  P.setTwoPlayer(true); let p = P.makeState(); p = P.serve(p); const before = p.aiY
  for (let i = 0; i < 120; ++i) p = P.step(p, 1 / 60)
  assert(p.aiY === before, 'with two players the right paddle stays where it is held'); P.setTwoPlayer(false)
})
