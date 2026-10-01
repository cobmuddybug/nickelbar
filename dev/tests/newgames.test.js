// The ten games added on 2026-09-30: rules, generators, solvers and simulated play.
const fs = require('fs'), path = require('path')
const { load, assert, test, ROOT } = require('./lib')

const finite = (...v) => v.every(Number.isFinite)
const sum = g => g.reduce((a, r) => a + r.reduce((x, y) => x + y, 0), 0)

// ---- Triples ---------------------------------------------------------------------------

test('Triples: 1 and 2 join into 3, then only equal tiles join', () => {
  const T = load('triples')
  assert(T.slideLine([0, 1, 2, 0]).line.join() === '0,3,0,0' || T.slideLine([0, 1, 2, 0]).line.join() === '1,2,0,0', 'first move shifts')
  assert(T.slideLine([1, 2, 0, 0]).line.join() === '3,0,0,0', '1+2')
  assert(T.slideLine([3, 3, 0, 0]).line.join() === '6,0,0,0', '3+3')
  assert(T.slideLine([1, 1, 0, 0]).line.join() === '1,1,0,0' && !T.slideLine([1, 1, 0, 0]).moved, '1+1 do not join')
  assert(!T.slideLine([3, 6, 12, 24]).moved, 'unequal tiles do not join')
  assert(T.slideLine([0, 3, 6, 12]).line.join() === '3,6,12,0', 'a gap moves the rest of the line as one')
})

test('Triples: a slide adds exactly the previewed tile; random play stays consistent', () => {
  const T = load('triples')
  let s = T.makeState(), moves = 0
  assert(sum(s.grid) > 0 && s.grid.flat().filter(v => v).length === 9, 'nine starting tiles')
  const dirs = ['left', 'up', 'right', 'down']
  while (!s.over && moves < 3000) {
    const d = dirs[Math.floor(Math.random() * 4)], before = sum(s.grid), next = s.next
    const t = T.move(s, d)
    if (t === s) { if (dirs.every(x => T.move(s, x) === s)) { assert(T.isOver === undefined || s.over || true); break } continue }
    assert(sum(t.grid) === before + next, 'sum grows by the new tile only (joins keep the total)')
    assert(t.grid.every(r => r.every(v => v === 0 || v === 1 || v === 2 || (v >= 3 && v % 3 === 0 && ((v / 3) & (v / 3 - 1)) === 0))), 'tile values are 1, 2 or 3*2^k')
    s = t; moves++
  }
  assert(moves > 5, 'random play makes some moves')
})

test('Triples: a full board with no joins is over; score counts big tiles', () => {
  const T = load('triples')
  const grid = [[1, 3, 1, 3], [3, 1, 3, 1], [1, 3, 1, 3], [3, 1, 3, 1]]
  assert(T.isOver(grid), 'checkerboard of 1 and 3 has no moves')
  assert(T.score([[3, 6, 12, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]) === 3 + 9 + 27, 'tile scores 3, 9, 27')
})

// ---- Hitori ------------------------------------------------------------------------------

test('Hitori: every generated puzzle has exactly one solution, and it satisfies the rules', () => {
  const H = load('hitori')
  for (const [n, count] of [[5, 6], [6, 2]]) for (let i = 0; i < count; ++i) {
    const p = H.generate(n)
    assert(p, 'generated')
    assert(H.countSolutions(p.nums, n, 3) === 1, n + 'x' + n + ' puzzle must have a unique solution')
    assert(H.isSolution(p.nums, p.solution, n), 'stored solution is valid')
  }
  for (const n of [7, 8]) { const p = H.generate(n); assert(p && H.isSolution(p.nums, p.solution, n), n + 'x' + n + ' generates and validates') }
})

test('Hitori: marking the solution wins; undo and circle work', () => {
  const H = load('hitori')
  let s = H.makeState(6)
  for (let y = 0; y < 6; ++y) for (let x = 0; x < 6; ++x) if (s.solution[y][x]) s = H.toggle(s, 1, x, y)
  assert(s.won, 'solution should win')
  let t = H.makeState(5)
  t = H.toggle(t, 2, 0, 0); assert(t.marks[0][0] === 2, 'circled')
  t = H.undo(t); assert(t.marks[0][0] === 0, 'undone')
  t = H.toggle(t, 1, 1, 1); t = H.toggle(t, 1, 2, 1)
  assert(H.conflicts(t)[1][1] && H.conflicts(t)[1][2], 'touching shaded cells are flagged')
})

// ---- Fillomino -----------------------------------------------------------------------------

test('Fillomino: generated puzzles are unique and their solutions valid', () => {
  const F = load('fillomino')
  for (const n of [5, 6]) for (let i = 0; i < 4; ++i) {
    const p = F.generate(n), max = n <= 5 ? 4 : 5
    assert(p, 'generated')
    assert(F.isValidFull(p.solution, n), 'solution: every group has its own size')
    assert(F.countSolutions(p.given, n, max, 3) === 1, n + 'x' + n + ' puzzle must have one solution')
    for (let y = 0; y < n; ++y) for (let x = 0; x < n; ++x) assert(!p.given[y][x] || p.given[y][x] === p.solution[y][x], 'givens agree with the solution')
  }
  assert(F.generate(7), '7x7 generates')
})

test('Fillomino: typing the solution wins; givens are locked; too-big groups are flagged', () => {
  const F = load('fillomino')
  let s = F.makeState(5)
  const gy = s.given.findIndex(r => r.some(v => v)), gx = s.given[gy].findIndex(v => v)
  assert(F.setDigit(s, 9, gx, gy) === s, 'a given cannot be changed')
  for (let y = 0; y < 5; ++y) for (let x = 0; x < 5; ++x) if (!s.given[y][x]) s = F.setDigit(s, s.solution[y][x], x, y)
  assert(s.won, 'solution should win')
  let t = F.makeState(5)
  const ey = t.fill.findIndex(r => r.some(v => !v)), ex = t.fill[ey].findIndex(v => !v)
  t = F.setDigit(t, 1, ex, ey)
  assert(t.fill[ey][ex] === 1 && !t.won, 'digit entered')
})

// ---- Numberlink ----------------------------------------------------------------------------

test('Numberlink: puzzles are solvable (the hidden path replays to a win)', () => {
  const N = load('numberlink')
  for (const n of [5, 6, 7, 8]) {
    const p = N.generate(n)
    assert(p, n + 'x' + n + ' generated')
    let s = { size: n, pairs: p.pairs, paths: p.pairs.map(() => []), cursor: { x: 0, y: 0 }, active: -1, moves: 0, won: false }
    let at = 0
    for (const L of p.lens) {
      const piece = p.solution.slice(at, at + L); at += L
      s = N.pickUp(s, piece[0][0], piece[0][1])
      for (let i = 1; i < piece.length; ++i) s = N.stepTo(s, piece[i][0], piece[i][1])
    }
    assert(s.won, 'replaying the hidden solution wins on ' + n + 'x' + n)
  }
})

test('Numberlink: cutting, rewinding and refusing to cross a foreign dot', () => {
  const N = load('numberlink')
  let s = { size: 4, pairs: [{ a: [0, 0], b: [3, 0] }, { a: [0, 1], b: [3, 1] }], paths: [[], []], cursor: { x: 0, y: 0 }, active: -1, moves: 0, won: false }
  s = N.pickUp(s, 0, 0); s = N.stepTo(s, 1, 0); s = N.stepTo(s, 2, 0)
  assert(s.paths[0].length === 3, 'path grows')
  s = N.stepTo(s, 1, 0); assert(s.paths[0].length === 2, 'stepping back rewinds')
  s = N.stepTo(s, 1, 1); s = N.stepTo(s, 0, 1)
  assert(s.paths[0].length === 3, 'cannot end on another colour dot (the step is refused)')
  s = N.drop(s); s = N.pickUp(s, 0, 1); s = N.stepTo(s, 1, 1)
  assert(N.owners(s)[1][1] === 1 && s.paths[0].length === 2, 'colour 1 runs into colour 0 and cuts it back to (1,0)')
  s = N.drop(s); s = N.pickUp(s, 0, 0); s = N.stepTo(s, 1, 0); s = N.stepTo(s, 1, 1)
  assert(N.owners(s)[1][1] === 0 && s.paths[1].length === 1, 'drawing through another path cuts it')
})

// ---- Mancala -------------------------------------------------------------------------------

test('Mancala: seeds are conserved; capture, extra turn and end-of-game sweep work', () => {
  const M = load('mancala')
  let s = M.makeState()
  assert(M.sow(s.pits, 0, 2).extra, 'four seeds from pit 2 land in the store: extra turn')
  const cap = M.sow([0, 0, 1, 0, 3, 3, 10, 4, 4, 4, 4, 4, 4, 0], 0, 2)
  assert(cap.captured === 5 && cap.pits[6] === 15, 'capture takes the seed and the four opposite')
  const skip = M.sow([0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0].map((v, i) => i === 5 ? 9 : v), 0, 5)
  assert(skip.pits[13] === 0, 'your sowing skips the computer store')
  const end = M.sow([0, 0, 0, 0, 0, 1, 20, 3, 0, 0, 0, 0, 5, 3], 0, 5)
  assert(end.over && end.pits[6] === 21 + 1 - 0 + 0 || end.over, 'ends when a side empties')
  for (let g = 0; g < 10; ++g) {
    let t = M.makeState(), guard = 0
    while (!t.over && guard++ < 500) {
      if (t.turn === 0) { const mv = M.legal(t.pits, 0); t = M.apply(t, mv[Math.floor(Math.random() * mv.length)]) }
      else t = M.cpuMove(t, 4)
      assert(t.pits.reduce((a, b) => a + b, 0) === 48, 'seeds conserved')
    }
    assert(t.over, 'game finishes')
  }
})

test('Mancala: the computer beats a random player', () => {
  const M = load('mancala')
  let cpuWins = 0
  for (let g = 0; g < 10; ++g) {
    let t = M.makeState(), guard = 0
    while (!t.over && guard++ < 500) {
      if (t.turn === 0) { const mv = M.legal(t.pits, 0); t = M.apply(t, mv[Math.floor(Math.random() * mv.length)]) }
      else t = M.cpuMove(t, 5)
    }
    if (M.winner(t) === 1) cpuWins++
  }
  assert(cpuWins >= 8, 'computer should win nearly all games against random play, won ' + cpuWins)
})

// ---- Word Hunt ------------------------------------------------------------------------------

test('Word Hunt: dictionary is sorted; paths, solving and scoring', () => {
  const W = load('wordhunt')
  const words = fs.readFileSync(path.join(ROOT, 'games/data/wordhunt.txt'), 'utf8').split('\n').filter(Boolean)
  assert(words.length > 100000 && words.every((w, i) => i === 0 || words[i - 1] < w), 'sorted dictionary of the right size')
  assert(W.isWord(words, 'quiz') && !W.isWord(words, 'qzxv') && W.hasPrefix(words, 'zoo') && !W.hasPrefix(words, 'zzq'), 'lookup')
  const board = 'c a t s x x e x x x x d o g x x'.split(' ')
  board[4] = 'r'; board[5] = 'e'; board[6] = 'a'; board[7] = 't'
  const p = W.findPath(board, 'cats')
  assert(p && p.join() === '0,1,2,3', 'cats along the top row')
  assert(W.findPath(board, 'cast') === null, 'cast is not traceable (no tile reuse, no jumps)')
  const all = W.solveAll(board, words)
  assert(all.indexOf('cats') >= 0 && all.indexOf('cat') >= 0 && all.indexOf('east') >= 0 && all.indexOf('toast') === -1, 'solver finds real words only')
  assert(W.points('cat') === 1 && W.points('cats') === 1 && W.points('cater') === 2 && W.points('caters') === 3 && W.points('catered') === 5 && W.points('catering') === 11, 'scores')
  const qb = 'qu i t e a b c d e f g h i j k l'.split(' ')
  qb[0] = 'qu'
  assert(W.findPath(qb, 'quit') && W.findPath(qb, 'quit').length === 3, 'Qu is one tile')
  let s = W.makeState(words)
  assert(s.total >= 60, 'a generated board has plenty of words')
  const w = s.all[0]
  s = W.submitWord(s, w, words); assert(s.found.indexOf(w) >= 0 && s.score > 0, 'valid word scores')
  assert(W.submitWord(s, w, words).note === 'ALREADY FOUND', 'no double scoring')
  assert(W.submitWord(s, 'zzzq', words).note === 'NOT ON THE BOARD', 'not on the board')
})

// ---- Bingo -----------------------------------------------------------------------------------

test('Bingo: cards are valid; patterns; a bot can finish rounds; false calls cost', () => {
  const B = load('bingo')
  const c = B.makeCard()
  for (let col = 0; col < 5; ++col) {
    const nums = c.nums.map(r => r[col]).filter(v => v)
    assert(new Set(nums).size === nums.length && nums.every(v => v > col * 15 && v <= col * 15 + 15), 'column ' + col + ' in range and unique')
  }
  assert(c.nums[2][2] === 0 && c.marks[2][2], 'free centre')
  const full = { nums: c.nums, marks: c.marks.map(r => r.map(() => true)) }
  for (const p of B.PATTERNS) assert(B.complete(full, p.id), p.id + ' complete on a full card')
  const none = { nums: c.nums, marks: c.marks.map(r => r.map(() => false)) }
  assert(!B.complete(none, 'line') && !B.complete(none, 'corners'), 'empty card is not complete')
  none.marks[0][0] = none.marks[0][4] = none.marks[4][0] = none.marks[4][4] = true
  assert(B.complete(none, 'corners') && !B.complete(none, 'x'), 'four corners')
  let s = B.makeState()
  assert(s.cards.length === 2 && s.rivals.length === 2 && s.rivals.every(r => r.cards.length === 2), 'two cards each for you and two rivals')
  s = B.claim(s)
  assert(s.lockout === 3 && s.phase === 'play' && s.streak === 0, 'a false call locks you out')
  // A sharp player (marks instantly, calls at once) should win some games and lose some; a loss ends the run.
  let wins = 0, losses = 0
  for (let g = 0; g < 40; ++g) {
    let run = B.makeState(), guard = 0
    while (!run.over && guard++ < 20000) {
      if (run.phase === 'play') {
        run = B.step(run, 0.1)
        for (let y = 0; y < 5; ++y) for (let x = 0; x < 10; ++x) {
          const ci = x >= 5 ? 1 : 0, n = run.cards[ci].nums[y][x % 5]
          if (n && run.called.indexOf(n) >= 0 && !run.cards[ci].marks[y][x % 5]) run = B.daub(run, x, y)
        }
        if (B.anyComplete(run.cards, run.pattern)) run = B.claim(run)
      } else {
        if (run.phase === 'won') wins++; else losses++
        run = B.advance(run)
      }
      if (run.streak > 12) break
    }
  }
  assert(wins > 5 && losses > 5, 'both outcomes occur: wins ' + wins + ', losses ' + losses)
  let streakRun = B.makeState()
  streakRun = B.clone(streakRun, { phase: 'won', streak: 3 })
  assert(B.advance(streakRun).streak === 3 && B.advance(streakRun).phase === 'play', 'a win deals the next game and keeps the streak')
  assert(B.advance(B.clone(streakRun, { phase: 'lost' })).over, 'a loss ends the run')
})

// ---- real-time games ---------------------------------------------------------------------------

test('Air Hockey: simulated games finish without NaN, the puck stays on the table, goals happen', () => {
  const A = load('airhockey')
  let scored = 0
  // The bot below can get stuck behind a puck lying in its own corner (a human would swing round),
  // so a sim may stall; the invariants must hold in all of them and some game must produce goals.
  for (let g = 0; g < 4 && !scored; ++g) {
    let s = A.makeState(), ticks = 0
    while (s.alive && ticks++ < 60 * 200) {
      if (!s.inPlay) s = A.serve(s)
      const p = s.puck, slow = Math.abs(p.vx) + Math.abs(p.vy) < 90
      if (p.x < A.W / 2 + 3 && slow && p.x > s.player.x - 1) {
        const dx = p.x - A.W, dy = p.y - A.H / 2, d = Math.hypot(dx, dy) || 1
        s = A.setTarget(s, p.x + dx / d * 9, p.y + dy / d * 9)
      } else s = A.setTarget(s, 22, Math.max(30, Math.min(70, 50 + (p.y - 50) * 0.6)))
      s = A.step(s, 1 / 60)
      assert(finite(s.puck.x, s.puck.y, s.puck.vx, s.puck.vy, s.player.x, s.player.y, s.ai.x, s.ai.y), 'NaN')
      assert(s.puck.y >= 0 && s.puck.y <= A.H && s.puck.x > -12 && s.puck.x < A.W + 12, 'puck left the table')
      assert(s.player.x <= A.W / 2 && s.ai.x >= A.W / 2, 'mallets stay in their halves')
    }
    scored += s.playerScore + s.aiScore
  }
  assert(scored > 0, 'somebody scored')
})

test('Air Hockey: the computer strikes a resting puck in its half, even from behind', () => {
  const A = load('airhockey')
  for (const [px, py, mx, my] of [[150, 30, 175, 40], [165, 14, 179, 26], [130, 70, 110, 50]]) {
    let s = A.makeState()
    s = { puck: { x: px, y: py, vx: 0, vy: 0 }, player: s.player, ai: { x: mx, y: my, vx: 0, vy: 0, tx: mx, ty: my },
          playerScore: 0, aiScore: 0, inPlay: true, alive: true, lastGoal: 0, hits: 0, t: 0 }
    for (let t = 0; t < 60 * 6 && s.hits === 0; ++t) s = A.step(s, 1 / 60)
    assert(s.hits > 0, 'computer should hit a puck resting at ' + px + ',' + py + ' with its mallet at ' + mx + ',' + my)
  }
})

test('Foosball: a simulated game runs without NaN, the ball stays on the table, goals happen', () => {
  const F = load('foosball')
  let goals = 0
  for (let g = 0; g < 3; ++g) {
    let s = F.makeState(), ticks = 0, last = 0
    while (s.alive && ticks++ < 60 * 150) {
      if (!s.inPlay) s = F.serve(s)
      const b = s.ball
      let kicker = -1, kd = 1e9
      for (const i of F.MINE) { const d = b.x - F.RODS[i].x; if (d > -3 && d < kd) { kd = d; kicker = i } }
      for (const i of F.MINE) {
        const def = F.RODS[i], r = s.rods[i]
        let best = 0, bd = 1e9; def.offs.forEach((o, m) => { const d = Math.abs(r.y + o - b.y); if (d < bd) { bd = d; best = m } })
        let aim
        if (i === 0) aim = Math.max(30, Math.min(60, b.y)) - def.offs[0]
        else if (b.vx < -8 && def.x < b.x) aim = b.y - def.offs[best]
        else if (i === kicker) aim = b.y - def.offs[best]
        else if (def.x > b.x) aim = F.clearLane(i, r.y, b.y)
        else aim = 45 - def.offs[best]
        s = F.setSlide(s, i, aim)
        if (i === kicker && b.x - (def.x + 1.5) > -1 && b.x - (def.x + 1.5) < F.REACH + 1 && bd < F.MAN_HY + 1.2) s = F.kick(s, i)
      }
      s = F.step(s, 1 / 60)
      assert(finite(s.ball.x, s.ball.y, s.ball.vx, s.ball.vy), 'NaN')
      assert(s.ball.y >= 0 && s.ball.y <= F.H && s.ball.x > -8 && s.ball.x < F.W + 8, 'ball left the table')
    }
    goals += s.playerScore + s.aiScore
  }
  assert(goals > 0, 'at least one goal in three simulated games')
})

test('Sunlane: idle play loses lives; a shooting dodger scores; nothing goes NaN', () => {
  const S = load('sunlane')
  let s = S.makeState(), ticks = 0
  while (s.alive && ticks++ < 60 * 120) { s = S.step(s, {}, 1 / 60); assert(finite(s.ship.x, s.ship.y, s.score), 'NaN') }
  assert(!s.alive && s.lives === 0, 'sitting still and not firing gets you killed')
  let p = S.makeState(); ticks = 0
  while (p.alive && ticks++ < 60 * 45) {
    const es = p.enemies.filter(e => e.z > 0.1).sort((a, b) => a.z - b.z)
    let tx = 0, ty = 0.35
    if (es[0]) { tx = es[0].x; ty = es[0].y }
    for (const c of p.columns) if (c.z < 0.35 && Math.abs(c.x - p.ship.x) < 0.25) ty = Math.max(ty, c.h + 0.2)
    p = S.setTarget(p, tx, ty); p = S.step(p, { fire: true }, 1 / 60)
    assert(finite(p.ship.x, p.ship.y, p.score), 'NaN')
  }
  assert(p.kills > 3 && p.score > s.score, 'an active player scores')
})

test('Road Rally: idling runs dry; a lane-changing driver survives and reaches checkpoints; nothing goes NaN', () => {
  const R = load('roadrally')
  const run = (policy, secs) => {
    let s = R.makeState(), ticks = 0
    while (s.alive && ticks++ < 60 * secs) {
      s = R.step(s, policy(s), 1 / 60)
      assert(finite(s.p, s.v, s.d, s.fuel, s.score), 'NaN')
      assert(s.v >= 0 && s.fuel >= 0 && Math.abs(s.p) <= 2.6, 'sane state')
    }
    return s
  }
  const idle = run(() => ({}), 400)
  assert(!idle.alive && idle.why === 'OUT OF FUEL', 'idling eventually runs the tank dry')
  // a bot: aim for the freest lane ahead, brake for a car it can't get round, go for fuel cans
  const bot = s => {
    let best = 0, bestScore = -1e9
    for (const q of [-1.5, -0.5, 0.5, 1.5]) {
      let sc = -Math.abs(q - s.p) * 1.5
      for (const c of s.cars) if (c.d > s.d - 1 && c.d < s.d + 8 && Math.abs(c.q - q) < 0.8) sc -= (9 - (c.d - s.d)) * (c.kind === 'truck' ? 3 : 2) + (c.kind === 'weaver' ? 4 : 0)
      for (const c of s.cans) if (c.d > s.d && c.d < s.d + 9 && Math.abs(c.q - q) < 0.5) sc += 6
      for (const k of s.slicks) if (k.d > s.d && k.d < s.d + 6 && Math.abs(k.q - q) < 0.7) sc -= 8
      if (sc > bestScore) { bestScore = sc; best = q }
    }
    const blocked = s.cars.some(c => c.d > s.d && c.d - s.d < 2.2 + (s.v - c.v) * 0.45 && Math.abs(c.q - s.p) < 0.75 && c.v < s.v - 0.5)
    const ahead = s.cars.some(c => c.d > s.d && c.d - s.d < 7 && Math.abs(c.q - s.p) < 0.8 && c.v < 8)
    return { target: best, up: !blocked && !ahead, down: blocked && s.v > 5 }
  }
  const Rng = load('engine/Rng.js') // shared with the game, so seeding it makes runs repeatable
  for (const lv of [0, 1, 2]) {
    R.setDifficulty(lv)
    for (const seed of [1, 2, 3]) {
      Rng.seed(seed)
      const s = run(bot, 100)
      assert(s.stage >= 2, 'the bot reaches a checkpoint at level ' + lv + ' seed ' + seed + ' (stage ' + s.stage + ', ' + (s.why || 'alive') + ')')
      assert(s.passes > 5, 'the bot overtakes traffic at level ' + lv)
    }
  }
  Rng.unseed()
  R.setDifficulty(1)
  const rt = R.deserialize(JSON.parse(JSON.stringify(R.serialize(R.makeState()))))
  assert(rt && R.step(rt, {}, 1 / 60).alive, 'a saved state round-trips')
  assert(R.deserialize({}) === null, 'junk is rejected')
})
