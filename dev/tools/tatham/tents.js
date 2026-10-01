// Tents. Puzzle: { w, h, trees: "0/1" string, rows: [], cols: [] }.
// Place tents so none touch (even diagonally), and a tree can be paired
// with its own orthogonally adjacent tent; the numbers give tents per row
// and column. Only puzzles with one tent layout are kept.

exports.sizes = [
  { name: '8×8', args: { w: 8, h: 8 }, count: 150 },
  { name: '10×10', args: { w: 10, h: 10 }, count: 150 },
  { name: '12×12', args: { w: 12, h: 12 }, count: 100 },
]

const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// Distinct tent layouts, up to `limit`. Search: each tree in turn picks one
// of its free neighbours; layouts are compared as sets, so two ways of
// pairing the same tents count once.
function count(w, h, tree, rows, cols, limit) {
  const N = w * h, trees = []
  for (let i = 0; i < N; i++) if (tree[i]) trees.push(i)
  const tent = Array(N).fill(false), rowC = Array(h).fill(0), colC = Array(w).fill(0)
  const opts = trees.map(t => {
    const x = t % w, y = Math.floor(t / w)
    return ORTH.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < w && b < h && !tree[b * w + a]).map(([a, b]) => b * w + a)
  })
  // Rows/columns can't hold more tents than trees could supply; order
  // trees by fewest options first.
  const order = trees.map((_, k) => k).sort((a, b) => opts[a].length - opts[b].length)
  const seen = new Set()
  let nodes = 0

  function free(i) {
    const x = i % w, y = Math.floor(i / w)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const a = x + dx, b = y + dy
      if (a >= 0 && b >= 0 && a < w && b < h && tent[b * w + a]) return false
    }
    return true
  }

  function go(k) {
    if (seen.size >= limit || ++nodes > 300000) return
    if (k === order.length) {
      for (let y = 0; y < h; y++) if (rowC[y] !== rows[y]) return
      for (let x = 0; x < w; x++) if (colC[x] !== cols[x]) return
      seen.add(tent.map(v => v ? 1 : 0).join(''))
      return
    }
    for (const i of opts[order[k]]) {
      const x = i % w, y = Math.floor(i / w)
      if (tent[i] || !free(i) || rowC[y] >= rows[y] || colC[x] >= cols[x]) continue
      tent[i] = true; rowC[y]++; colC[x]++
      go(k + 1)
      tent[i] = false; rowC[y]--; colC[x]--
    }
  }
  go(0)
  return nodes > 300000 ? limit : seen.size
}

exports.count = count

// Deduction only, no nested guesses. Cells are unknown, tent or grass; the
// rules: grass away from trees, grass around a tent, row/column counts
// (full → rest grass, just enough room → all tents), and every tree
// paired with its own tent (checked as a matching, so a tent can't serve
// two trees). On top of those, try one cell either way and see a rule
// break straight away. True if every cell gets decided.
function deducible(w, h, tree, rows, cols) {
  const N = w * h, st = Array(N).fill(0)   // 0 unknown, 1 tent, 2 grass
  const orth = i => ORTH.map(([dx, dy]) => [i % w + dx, Math.floor(i / w) + dy])
    .filter(([a, b]) => a >= 0 && b >= 0 && a < w && b < h).map(([a, b]) => b * w + a)
  const around = i => {
    const out = [], x = i % w, y = Math.floor(i / w)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const a = x + dx, b = y + dy
      if ((dx || dy) && a >= 0 && b >= 0 && a < w && b < h) out.push(b * w + a)
    }
    return out
  }
  const trees = []
  for (let i = 0; i < N; i++) {
    if (tree[i]) { st[i] = 2; trees.push(i) }
    else if (!orth(i).some(j => tree[j])) st[i] = 2
  }
  const lines = []
  for (let y = 0; y < h; y++) lines.push({ cells: Array.from({ length: w }, (_, x) => y * w + x), want: rows[y] })
  for (let x = 0; x < w; x++) lines.push({ cells: Array.from({ length: h }, (_, y) => y * w + x), want: cols[x] })

  // Trees and tents can still pair off: every tree can get its own
  // tent-or-unknown neighbour, and every tent its own tree. (If each side
  // can be matched, one matching covers both: Mendelsohn-Dulmage.)
  function saturates(from, to) {
    const owner = new Map()
    function aug(a, seen) {
      for (const b of orth(a)) {
        if (!to(b) || seen.has(b)) continue
        seen.add(b)
        if (!owner.has(b) || aug(owner.get(b), seen)) { owner.set(b, a); return true }
      }
      return false
    }
    return from.every(a => aug(a, new Set()))
  }
  function matchable() {
    const tents = []
    for (let i = 0; i < N; i++) if (st[i] === 1) tents.push(i)
    return saturates(trees, c => st[c] !== 2) && saturates(tents, c => tree[c])
  }

  function propagate(log) {
    let changed = true
    const put = (i, v) => { if (st[i] === v) return true; if (st[i]) return false; st[i] = v; log.push(i); changed = true; return true }
    while (changed) {
      changed = false
      for (let i = 0; i < N; i++) if (st[i] === 1) for (const j of around(i)) if (!put(j, 2)) return false
      for (const L of lines) {
        let tents = 0, unk = 0
        for (const c of L.cells) { if (st[c] === 1) tents++; else if (!st[c]) unk++ }
        if (tents > L.want || tents + unk < L.want) return false
        if (!unk) continue
        if (tents === L.want) { for (const c of L.cells) if (!st[c]) put(c, 2) }
        else if (tents + unk === L.want) { for (const c of L.cells) if (!st[c] && !put(c, 1)) return false }
      }
      for (const t of trees) {
        const open = orth(t).filter(c => st[c] !== 2)
        if (!open.length) return false
        if (open.length === 1 && !put(open[0], 1)) return false
      }
      if (!changed && !matchable()) return false
    }
    return true
  }
  const undo = log => { for (const i of log) st[i] = 0 }

  const log = []
  for (;;) {
    if (!propagate(log)) return false
    let progress = false, unknown = 0
    for (let i = 0; i < N && !progress; i++) {
      if (st[i]) continue
      unknown++
      for (const v of [1, 2]) {
        st[i] = v
        const a = []
        const ok = propagate(a)
        undo(a)
        st[i] = 0
        if (!ok) { st[i] = 3 - v; log.push(i); progress = true; break }
      }
    }
    if (!unknown) return true
    if (!progress) return false
  }
}

exports.deducible = deducible

exports.generate = function({ w, h }, rand) {
  const N = w * h, tent = Array(N).fill(false), tree = Array(N).fill(false)
  const target = Math.round(N * 0.19)
  const order = Array.from({ length: N }, (_, i) => i).sort(() => rand() - 0.5)
  let placed = 0
  for (const i of order) {
    if (placed >= target) break
    const x = i % w, y = Math.floor(i / w)
    let ok = !tree[i]
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) {
      const a = x + dx, b = y + dy
      if (a >= 0 && b >= 0 && a < w && b < h && tent[b * w + a]) ok = false
    }
    if (!ok) continue
    const spots = ORTH.map(([dx, dy]) => [x + dx, y + dy])
      .filter(([a, b]) => a >= 0 && b >= 0 && a < w && b < h && !tent[b * w + a] && !tree[b * w + a])
    if (!spots.length) continue
    const [tx, ty] = spots[Math.floor(rand() * spots.length)]
    tent[i] = true
    tree[ty * w + tx] = true
    placed++
  }
  const rows = Array(h).fill(0), cols = Array(w).fill(0)
  for (let i = 0; i < N; i++) if (tent[i]) { rows[Math.floor(i / w)]++; cols[i % w]++ }
  if (count(w, h, tree, rows, cols, 2) !== 1) return null
  return { w, h, trees: tree.map(v => v ? '1' : '0').join(''), rows, cols }
}
