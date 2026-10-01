// The logic puzzles: every one dealt can be finished by deduction alone,
// never needing a guess. Having exactly one answer isn't enough for that,
// so each generator checks with a solver limited to the reasoning a person
// does; these tests re-run those solvers, and cross-check a few against a
// brute-force count so a solver can't "deduce" its way to a wrong answer.
const path = require('path')
const { ROOT, load, assert, test } = require('./lib')

test('0h h1: every size deals puzzles solvable row by row, to the stored answer', () => {
  const O = load('ohhi')
  for (const n of O.SIZES) for (let k = 0; k < 5; ++k) {
    const s = O.makeState(n), g = s.grid.slice()
    assert(O.deduce(g, n) && g.join() === s.solution.join(), n + 'x' + n + ' puzzle not deducible')
  }
})

test('0h n0: every size deals deducible puzzles that agree with the answer', () => {
  const O = load('ohno')
  for (const n of O.SIZES) for (let k = 0; k < 3; ++k) {
    const s = O.makeState(n)
    assert(O.solvesByDeduction(s.grid, n, s.clues), n + 'x' + n + ' puzzle not deducible')
    for (let i = 0; i < n * n; ++i) assert(!s.grid[i] || s.grid[i] === s.solution[i], 'given disagrees with answer')
  }
})

test('Nonogram: puzzles are solvable line by line', () => {
  const N = load('nonogram')
  for (let k = 0; k < 20; ++k) {
    const s = N.makeState(10)
    assert(N.lineSolvable(s.rowClues, s.colClues, 10), 'puzzle needs a guess')
  }
})

test('Sudoku: puzzles fall to singles, locked candidates and pairs, and are unique', () => {
  const S = load('sudoku')
  function count(g, limit) {
    let best = -1, bc = null
    for (let p = 0; p < 81; ++p) {
      const r = Math.floor(p / 9), c = p % 9
      if (g[r][c]) continue
      const cs = []
      for (let v = 1; v <= 9; ++v) if (S.validAt(g, r, c, v)) cs.push(v)
      if (!cs.length) return 0
      if (!bc || cs.length < bc.length) { best = p; bc = cs }
    }
    if (best < 0) return 1
    let t = 0
    const r = Math.floor(best / 9), c = best % 9
    for (const v of bc) { if (t >= limit) break; g[r][c] = v; t += count(g, limit - t) }
    g[r][c] = 0
    return t
  }
  for (let k = 0; k < 10; ++k) {
    const g = S.makeState(50).grid.map(row => row.map(c => c.value))
    assert(S.humanSolvable(g), 'puzzle needs harder techniques')
    assert(count(g, 2) === 1, 'deducible puzzle has more than one answer')
  }
})

test('Bridges: layouts are deducible, and deducible means one answer', () => {
  const B = load('bridges')
  function count(is, n, limit) {
    const map = B.cellMap(is), edges = [], deg = is.map(() => 0), links = {}
    for (let i = 0; i < is.length; ++i) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nb = B.neighbour(is, map, n, i, dx, dy)
      if (nb) edges.push([i, nb.j])
    }
    let total = 0
    ;(function rec(k) {
      if (total >= limit) return
      if (k === edges.length) {
        if (deg.every((d, i) => d === is[i].need) && B.connected({ islands: is, links })) total++
        return
      }
      const [a, b] = edges[k]
      for (let v = 0; v <= 2; ++v) {
        if (deg[a] + v > is[a].need || deg[b] + v > is[b].need) break
        if (v && B.crosses(is, links, a, b)) break
        links[B.key(a, b)] = v; deg[a] += v; deg[b] += v
        rec(k + 1)
        deg[a] -= v; deg[b] -= v; delete links[B.key(a, b)]
      }
    })(0)
    return total
  }
  for (const n of B.SIZES) {
    const s = B.makeState(n)
    assert(B.solvesByDeduction(s.islands, n), n + 'x' + n + ' layout not deducible')
  }
  for (let k = 0; k < 60; ++k) {
    const is = B.generate(7)
    if (is && B.solvesByDeduction(is, 7)) assert(count(is, 7, 2) === 1, 'solver passed a layout with several answers')
  }
})

test('Net: boards are deducible, and deducible means one answer', () => {
  const Nt = load('net')
  function count(tree, n, limit) {
    const N = n * n, g = Array(N).fill(-1)
    const opts = tree.map(m => { const o = []; for (let r = 0; r < 4; ++r) { if (!o.includes(m)) o.push(m); m = Nt.rotCW(m) } return o })
    let total = 0
    ;(function rec(i) {
      if (total >= limit) return
      if (i === N) { if (Nt.isSolved({ n, grid: g.slice(), locked: [] })) total++; return }
      const x = i % n, y = Math.floor(i / n)
      for (const m of opts[i]) {
        if ((m & 1 && y === 0) || (m & 8 && x === 0) || (m & 2 && x === n - 1) || (m & 4 && y === n - 1)) continue
        if (y > 0 && !!(m & 1) !== !!(g[i - n] & 4)) continue
        if (x > 0 && !!(m & 8) !== !!(g[i - 1] & 2)) continue
        g[i] = m; rec(i + 1); g[i] = -1
      }
    })(0)
    return total
  }
  for (let k = 0; k < 60; ++k) {
    const tree = Nt.makeTree(5)
    if (Nt.solvesByDeduction(tree, 5)) assert(count(tree, 5, 2) === 1, 'solver passed a board with several answers')
  }
  // makeState only hands out deducible trees; the solved tree is a
  // rotation of each dealt tile, so re-solving the dealt board works too.
  for (const n of Nt.SIZES) {
    const s = Nt.makeState(n)
    assert(Nt.solvesByDeduction(s.grid, n), n + 'x' + n + ' board not deducible')
  }
})

test('Tatham packs: every puzzle is deducible', () => {
  const T = path.join(ROOT, 'dev', 'tools', 'tatham'), D = path.join(ROOT, 'games', 'data', 'tatham')
  const checks = {
    lightup: p => require(T + '/lightup.js').deducible(p.w, p.h, [...p.cells].map(c => c !== '.'), [...p.cells].map(c => /\d/.test(c) ? +c : -1)),
    loopy: p => require(T + '/loopy.js').deducible(p.w, p.h, [...p.clues].map(c => c === '.' ? -1 : +c)),
    tents: p => require(T + '/tents.js').deducible(p.w, p.h, [...p.trees].map(c => c === '1'), p.rows, p.cols),
    towers: p => require(T + '/towers.js').deducible(p.n, p.clues, p.givens),
    keen: p => require(T + '/keen.js').deducible(p.n, p.cage, p.cages),
    signpost: p => require(T + '/signpost.js').deducible(p.w, p.h, p.arrows, p.nums),
  }
  for (const game in checks) {
    const pack = require(D + '/' + game + '.json')
    for (const size of pack.sizes) size.puzzles.forEach((p, i) =>
      assert(checks[game](p), game + ' ' + size.name + ' #' + i + ' needs a guess'))
  }
})
