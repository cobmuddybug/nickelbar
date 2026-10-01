// Light Up (Akari). Puzzle: { w, h, cells: string, one char per cell:
// "." white, "#" black, "0"-"4" numbered black }.
//
// Black cells are scattered with 180° symmetry. A solution always exists:
// keep lighting a random still-dark white cell (nothing can see it, so a
// light there is legal) until nothing's dark. Number every black cell from
// that, then take numbers away while the solver still finds one answer.

exports.sizes = [
  { name: '7×7', args: { w: 7, h: 7 }, count: 150 },
  { name: '10×10', args: { w: 10, h: 10 }, count: 150 },
  { name: '14×14', args: { w: 14, h: 14 }, count: 100 },
]

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

// Row and column runs of white cells; lights see along their runs.
function segments(w, h, black) {
  const rowSeg = Array(w * h).fill(-1), colSeg = Array(w * h).fill(-1), segs = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (black[i] || rowSeg[i] >= 0) continue
    const s = []
    for (let xx = x; xx < w && !black[y * w + xx]; xx++) { rowSeg[y * w + xx] = segs.length; s.push(y * w + xx) }
    segs.push(s)
  }
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
    const i = y * w + x
    if (black[i] || colSeg[i] >= 0) continue
    const s = []
    for (let yy = y; yy < h && !black[yy * w + x]; yy++) { colSeg[yy * w + x] = segs.length; s.push(yy * w + x) }
    segs.push(s)
  }
  return { rowSeg, colSeg, segs }
}

function neighbours(w, h, i) {
  const x = i % w, y = Math.floor(i / w), out = []
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy
    if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx)
  }
  return out
}

// Solutions up to `limit`. num[i] is the clue on black cell i, or -1.
function count(w, h, black, num, limit, mode) {
  const N = w * h, { rowSeg, colSeg, segs } = segments(w, h, black)
  // state: 0 unknown, 1 light, 2 no light
  const st = Array(N).fill(0)
  for (let i = 0; i < N; i++) if (black[i]) st[i] = 2
  const nbs = Array.from({ length: N }, (_, i) => neighbours(w, h, i))
  let found = 0, nodes = 0

  function lit(i) {
    for (const j of segs[rowSeg[i]]) if (st[j] === 1) return true
    for (const j of segs[colSeg[i]]) if (st[j] === 1) return true
    return false
  }

  // Unit propagation. Returns false on contradiction; logs changes to undo.
  function propagate(log) {
    let changed = true
    while (changed) {
      changed = false
      for (let i = 0; i < N; i++) {
        if (black[i]) {
          if (num[i] < 0) continue
          let on = 0, unk = []
          for (const j of nbs[i]) { if (st[j] === 1) on++; else if (st[j] === 0) unk.push(j) }
          if (on > num[i] || on + unk.length < num[i]) return false
          if (unk.length && on === num[i]) { for (const j of unk) { st[j] = 2; log.push(j) } changed = true }
          else if (unk.length && on + unk.length === num[i]) {
            for (const j of unk) { if (!set(j, log)) return false }
            changed = true
          }
          continue
        }
        if (lit(i)) continue
        // Dark cell: something in its runs must become a light.
        const cands = []
        for (const j of segs[rowSeg[i]]) if (st[j] === 0) cands.push(j)
        for (const j of segs[colSeg[i]]) if (st[j] === 0 && j !== i) cands.push(j)
        if (!cands.length) return false
        if (cands.length === 1) { if (!set(cands[0], log)) return false; changed = true }
      }
    }
    return true
  }

  // Place a light at j (if legal) and forbid the rest of its runs.
  function set(j, log) {
    if (st[j] === 2) return false
    if (st[j] === 1) return true
    st[j] = 1; log.push(j)
    for (const k of segs[rowSeg[j]]) if (k !== j) { if (st[k] === 1) return false; if (st[k] === 0) { st[k] = 2; log.push(k) } }
    for (const k of segs[colSeg[j]]) if (k !== j) { if (st[k] === 1) return false; if (st[k] === 0) { st[k] = 2; log.push(k) } }
    return true
  }

  function undo(log) { for (const j of log) st[j] = black[j] ? 2 : 0 }

  function solve() {
    if (found >= limit || ++nodes > 200000) return
    const log = []
    if (!propagate(log)) { undo(log); return }
    // Branch on the unknown cell next to the darkest spot.
    let best = -1, bestC = 1e9
    for (let i = 0; i < N; i++) {
      if (black[i] || lit(i)) continue
      let c = 0
      for (const j of segs[rowSeg[i]]) if (st[j] === 0) c++
      for (const j of segs[colSeg[i]]) if (st[j] === 0 && j !== i) c++
      if (c < bestC) { bestC = c; best = i }
    }
    if (best < 0) {
      // All lit: numbers are exact already (propagate checked); done.
      found++
      undo(log)
      return
    }
    let pick = -1
    for (const j of segs[rowSeg[best]]) if (st[j] === 0) { pick = j; break }
    if (pick < 0) for (const j of segs[colSeg[best]]) if (st[j] === 0) { pick = j; break }
    const a = []
    if (set(pick, a)) solve()
    undo(a)
    st[pick] = 2
    solve()
    st[pick] = 0
    undo(log)
  }
  // Deduction only: the rules above, plus trying one cell either way and
  // seeing a rule break straight away. No nested guesses. 1 if that
  // settles every cell, else 0.
  function deduce() {
    const log = []
    for (;;) {
      if (!propagate(log)) return 0
      let progress = false, unknown = 0
      for (let j = 0; j < N && !progress; j++) {
        if (st[j]) continue
        unknown++
        const a = []
        const lightOk = set(j, a) && propagate(a)
        undo(a)
        if (!lightOk) { st[j] = 2; log.push(j); progress = true; continue }
        st[j] = 2
        const b = []
        const darkOk = propagate(b)
        undo(b)
        st[j] = 0
        if (!darkOk) { if (!set(j, log)) return 0; progress = true }
      }
      if (!unknown) return 1
      if (!progress) return 0
    }
  }
  if (mode === 'deduce') return deduce()

  solve()
  return nodes > 200000 ? limit : found
}

exports.count = count
exports.deducible = (w, h, black, num) => count(w, h, black, num, 1, 'deduce') === 1

exports.generate = function({ w, h }, rand) {
  const N = w * h, black = Array(N).fill(false)
  const density = 0.18 + rand() * 0.06
  for (let i = 0; i < N; i++) if (rand() < density) { black[i] = true; black[N - 1 - i] = true }
  const { rowSeg, colSeg, segs } = segments(w, h, black)
  const light = Array(N).fill(false)
  const litBy = i => segs[rowSeg[i]].some(j => light[j]) || segs[colSeg[i]].some(j => light[j])
  for (;;) {
    const dark = []
    for (let i = 0; i < N; i++) if (!black[i] && !litBy(i)) dark.push(i)
    if (!dark.length) break
    light[dark[Math.floor(rand() * dark.length)]] = true
  }
  const num = Array(N).fill(-1)
  for (let i = 0; i < N; i++) if (black[i]) num[i] = neighbours(w, h, i).filter(j => light[j]).length
  if (count(w, h, black, num, 2) !== 1) return null
  const order = []
  for (let i = 0; i < N; i++) if (black[i]) order.push(i)
  order.sort(() => rand() - 0.5)
  for (const i of order) {
    const keep = num[i]
    num[i] = -1
    if (count(w, h, black, num, 2) !== 1) num[i] = keep
  }
  let cells = ''
  for (let i = 0; i < N; i++) cells += !black[i] ? '.' : num[i] < 0 ? '#' : String(num[i])
  return { w, h, cells }
}
