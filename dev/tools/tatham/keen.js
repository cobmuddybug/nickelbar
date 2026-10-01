// Keen (KenKen). Puzzle: { n, cage: n*n cage ids, cages: [{ op, target }] }
// with op one of "=", "+", "-", "*", "/". Latin square, random cages, and
// retry until the cage set pins down one answer.
const latin = require('./latin.js')

exports.sizes = [
  { name: '4×4', args: { n: 4 }, count: 120 },
  { name: '5×5', args: { n: 5 }, count: 120 },
  { name: '6×6', args: { n: 6 }, count: 120 },
]

function makeCages(n, rand) {
  const id = Array(n * n).fill(-1), cells = []
  const order = Array.from({ length: n * n }, (_, i) => i).sort(() => rand() - 0.5)
  for (const start of order) {
    if (id[start] >= 0) continue
    const k = cells.length, want = [1, 2, 2, 2, 3, 3, 3, 4][Math.floor(rand() * 8)]
    const cage = [start]
    id[start] = k
    while (cage.length < want) {
      const opts = []
      for (const c of cage) {
        const r = Math.floor(c / n), x = c % n
        for (const [dr, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const rr = r + dr, xx = x + dx
          if (rr >= 0 && rr < n && xx >= 0 && xx < n && id[rr * n + xx] < 0) opts.push(rr * n + xx)
        }
      }
      if (!opts.length) break
      const pick = opts[Math.floor(rand() * opts.length)]
      id[pick] = k
      cage.push(pick)
    }
    cells.push(cage)
  }
  return { id, cells }
}

function ops(vals, rand) {
  if (vals.length === 1) return { op: '=', target: vals[0] }
  if (vals.length === 2) {
    const [a, b] = vals, hi = Math.max(a, b), lo = Math.min(a, b), opts = ['+', '*', '-', '-']
    if (hi % lo === 0) opts.push('/', '/')
    const op = opts[Math.floor(rand() * opts.length)]
    return { op, target: op === '+' ? a + b : op === '*' ? a * b : op === '-' ? hi - lo : hi / lo }
  }
  const op = rand() < 0.5 ? '+' : '*'
  return { op, target: vals.reduce((s, v) => op === '+' ? s + v : s * v, op === '+' ? 0 : 1) }
}

// Does a (possibly partial) cage still fit? `vals` are its placed values,
// `size` how many cells it has.
function cageOk(c, vals, size) {
  const full = vals.length === size
  if (c.op === '=') return !full || vals[0] === c.target
  if (c.op === '+') { const s = vals.reduce((a, b) => a + b, 0); return full ? s === c.target : s < c.target }
  if (c.op === '*') { const p = vals.reduce((a, b) => a * b, 1); return full ? p === c.target : c.target % p === 0 }
  if (!full) return true
  const hi = Math.max(...vals), lo = Math.min(...vals)
  return c.op === '-' ? hi - lo === c.target : hi === lo * c.target
}

function count(n, cage, cages, limit) {
  const g = Array(n * n).fill(0), members = cages.map(() => [])
  cage.forEach((k, i) => members[k].push(i))
  const rowU = Array(n).fill(0), colU = Array(n).fill(0)
  let found = 0
  function go(p) {
    if (found >= limit) return
    if (p === n * n) { found++; return }
    const r = Math.floor(p / n), c = p % n, k = cage[p]
    for (let v = 1; v <= n; v++) {
      const bit = 1 << v
      if (rowU[r] & bit || colU[c] & bit) continue
      g[p] = v
      const vals = members[k].filter(i => g[i]).map(i => g[i])
      if (cageOk(cages[k], vals, members[k].length)) {
        rowU[r] |= bit; colU[c] |= bit
        go(p + 1)
        rowU[r] &= ~bit; colU[c] &= ~bit
      }
      g[p] = 0
    }
  }
  go(0)
  return found
}

exports.count = count

// Deduction only, the way a person works Keen with pencil marks: each cage
// keeps just the digits some filling of it allows (meets its sum, product,
// difference or ratio, no repeats along a row or column), and each row and
// column just the digits some arrangement of it allows. If that stalls,
// try one mark and see something break straight away. No nested guesses.
// True if every cell gets one digit.
function deducible(n, cage, cages) {
  const full = (1 << (n + 1)) - 2, N = n * n
  const members = cages.map(() => [])
  cage.forEach((k, i) => members[k].push(i))
  const lines = []
  for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c))
  for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c))
  const perms = []
  ;(function gen(p, used) {
    if (p.length === n) { perms.push(p.slice()); return }
    for (let v = 1; v <= n; v++) if (!(used & (1 << v))) { p.push(v); gen(p, used | (1 << v)); p.pop() }
  })([], 0)

  function cageAllow(k, cand) {
    const cells = members[k], allow = Array(cells.length).fill(0), vals = []
    let any = false
    ;(function go(j) {
      if (j === cells.length) {
        if (!cageOk(cages[k], vals, cells.length)) return
        any = true
        for (let q = 0; q < cells.length; q++) allow[q] |= 1 << vals[q]
        return
      }
      const r = Math.floor(cells[j] / n), c = cells[j] % n
      for (let v = 1; v <= n; v++) {
        if (!(cand[cells[j]] & (1 << v))) continue
        let clash = false
        for (let q = 0; q < j && !clash; q++)
          if (vals[q] === v && (Math.floor(cells[q] / n) === r || cells[q] % n === c)) clash = true
        if (clash) continue
        vals.push(v)
        if (cageOk(cages[k], vals, cells.length)) go(j + 1)
        vals.pop()
      }
    })(0)
    return any ? allow : null
  }

  function propagate(cand) {
    let changed = true
    const narrow = (i, m) => { if ((cand[i] & m) !== cand[i]) { cand[i] &= m; changed = true } }
    while (changed) {
      changed = false
      for (let k = 0; k < cages.length; k++) {
        const allow = cageAllow(k, cand)
        if (!allow) return false
        members[k].forEach((i, q) => narrow(i, allow[q]))
      }
      for (const L of lines) {
        const allow = Array(n).fill(0)
        let any = false
        for (const p of perms) {
          let ok = true
          for (let i = 0; i < n && ok; i++) if (!(cand[L[i]] & (1 << p[i]))) ok = false
          if (!ok) continue
          any = true
          for (let i = 0; i < n; i++) allow[i] |= 1 << p[i]
        }
        if (!any) return false
        L.forEach((c, i) => narrow(c, allow[i]))
      }
    }
    return true
  }
  const single = m => m && !(m & (m - 1))

  const cand = Array(N).fill(full)
  for (;;) {
    if (!propagate(cand)) return false
    if (cand.every(single)) return true
    let progress = false
    for (let i = 0; i < N && !progress; i++) {
      if (single(cand[i])) continue
      for (let v = 1; v <= n && !progress; v++) {
        if (!(cand[i] & (1 << v))) continue
        const t = cand.slice()
        t[i] = 1 << v
        if (!propagate(t)) { cand[i] &= ~(1 << v); progress = true }
      }
    }
    if (!progress) return false
  }
}

exports.deducible = deducible

exports.generate = function({ n }, rand) {
  const sol = latin(n, rand).flat()
  for (let attempt = 0; attempt < 30; attempt++) {
    const { id, cells } = makeCages(n, rand)
    // Single-cell cages are free answers; keep them scarce.
    if (cells.filter(cs => cs.length === 1).length > Math.floor(n / 2)) continue
    const cages = cells.map(cs => ops(cs.map(i => sol[i]), rand))
    if (count(n, id, cages, 2) === 1) return { n, cage: id, cages }
  }
  return null
}
