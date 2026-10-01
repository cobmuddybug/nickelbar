// Towers (skyscrapers). Puzzle: { n, clues: [top[], bottom[], left[], right[]], givens: n*n (0 = blank) }.
// Start from every clue, drop clues (down to 2n) while the answer stays
// unique, and add given digits only if the full clue set wasn't enough.
const latin = require('./latin.js')

exports.sizes = [
  { name: '4×4', args: { n: 4 }, count: 120 },
  { name: '5×5', args: { n: 5 }, count: 120 },
  { name: '6×6', args: { n: 6 }, count: 120 },
]

function seen(line) {
  let max = 0, k = 0
  for (const v of line) if (v > max) { max = v; k++ }
  return k
}

function allClues(g) {
  const n = g.length, col = c => g.map(r => r[c])
  return [
    Array.from({ length: n }, (_, c) => seen(col(c))),
    Array.from({ length: n }, (_, c) => seen(col(c).reverse())),
    Array.from({ length: n }, (_, r) => seen(g[r])),
    Array.from({ length: n }, (_, r) => seen(g[r].slice().reverse())),
  ]
}

// Number of solutions, stopping at `limit`.
function count(n, clues, givens, limit) {
  const [top, bottom, left, right] = clues
  const g = Array.from({ length: n }, () => Array(n).fill(0))
  const rowUsed = Array.from({ length: n }, () => new Set()), colUsed = Array.from({ length: n }, () => new Set())
  let found = 0
  function prefixOk(line, clue) {
    // Visible so far can't exceed the clue; once the tallest is in, it's final.
    if (!clue) return true
    let max = 0, k = 0, full = false
    for (const v of line) { if (!v) break; if (v > max) { max = v; k++ } if (v === n) { full = true; break } }
    return full ? k === clue : k <= clue
  }
  function place(p) {
    if (found >= limit) return
    if (p === n * n) { found++; return }
    const r = Math.floor(p / n), c = p % n
    if (givens[p]) return tryV(p, r, c, givens[p])
    for (let v = 1; v <= n; v++) tryV(p, r, c, v)
  }
  function tryV(p, r, c, v) {
    if (rowUsed[r].has(v) || colUsed[c].has(v)) return
    g[r][c] = v
    const colLine = g.map(row => row[c])
    let ok = prefixOk(g[r], left[r]) && prefixOk(colLine, top[c])
    if (ok && c === n - 1) ok = (!right[r] || seen(g[r].slice().reverse()) === right[r]) && (!left[r] || seen(g[r]) === left[r])
    if (ok && r === n - 1) ok = (!bottom[c] || seen(colLine.slice().reverse()) === bottom[c]) && (!top[c] || seen(colLine) === top[c])
    if (ok) { rowUsed[r].add(v); colUsed[c].add(v); place(p + 1); rowUsed[r].delete(v); colUsed[c].delete(v) }
    g[r][c] = 0
  }
  place(0)
  return found
}

exports.count = count

// Deduction only, the way a person works a Towers grid with pencil marks:
// each row and column keeps just the digits some arrangement of it allows
// (a permutation that fits its marks and the clues at both ends), which
// covers singles and hidden singles too. If that stalls, try one mark and see a line break
// straight away. No nested guesses. True if every cell gets one digit.
function deducible(n, clues, givens) {
  const [top, bottom, left, right] = clues, full = (1 << (n + 1)) - 2
  const perms = []
  ;(function gen(p, used) {
    if (p.length === n) { perms.push(p.slice()); return }
    for (let v = 1; v <= n; v++) if (!(used & (1 << v))) { p.push(v); gen(p, used | (1 << v)); p.pop() }
  })([], 0)
  const lines = []
  for (let r = 0; r < n; r++) lines.push({ cells: Array.from({ length: n }, (_, c) => r * n + c), a: left[r], b: right[r] })
  for (let c = 0; c < n; c++) lines.push({ cells: Array.from({ length: n }, (_, r) => r * n + c), a: top[c], b: bottom[c] })
  const fits = perms.map(p => [seen(p), seen(p.slice().reverse())])

  function propagate(cand) {
    let changed = true
    while (changed) {
      changed = false
      for (const L of lines) {
        const allow = Array(n).fill(0)
        let any = false
        for (let k = 0; k < perms.length; k++) {
          const p = perms[k]
          if ((L.a && fits[k][0] !== L.a) || (L.b && fits[k][1] !== L.b)) continue
          let ok = true
          for (let i = 0; i < n && ok; i++) if (!(cand[L.cells[i]] & (1 << p[i]))) ok = false
          if (!ok) continue
          any = true
          for (let i = 0; i < n; i++) allow[i] |= 1 << p[i]
        }
        if (!any) return false
        for (let i = 0; i < n; i++) {
          const c = L.cells[i]
          if ((cand[c] & allow[i]) !== cand[c]) { cand[c] &= allow[i]; changed = true }
        }
      }
    }
    return true
  }
  const single = m => m && !(m & (m - 1))

  const cand = Array.from({ length: n * n }, (_, i) => givens[i] ? 1 << givens[i] : full)
  for (;;) {
    if (!propagate(cand)) return false
    if (cand.every(single)) return true
    let progress = false
    for (let i = 0; i < n * n && !progress; i++) {
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
  const sol = latin(n, rand)
  const clues = allClues(sol)
  const givens = Array(n * n).fill(0)
  if (count(n, clues, givens, 2) !== 1) {
    // Rare: add givens until unique.
    const order = Array.from({ length: n * n }, (_, i) => i).sort(() => rand() - 0.5)
    for (const i of order) {
      givens[i] = sol[Math.floor(i / n)][i % n]
      if (count(n, clues, givens, 2) === 1) break
    }
  }
  const slots = []
  for (let s = 0; s < 4; s++) for (let i = 0; i < n; i++) slots.push([s, i])
  slots.sort(() => rand() - 0.5)
  // Stop at 2n clues: stripping to the bare minimum makes them grim.
  let left = 4 * n
  for (const [s, i] of slots) {
    if (left <= 2 * n) break
    const keep = clues[s][i]
    clues[s][i] = 0
    if (count(n, clues, givens, 2) !== 1) clues[s][i] = keep
    else left--
  }
  return { n, clues, givens }
}
