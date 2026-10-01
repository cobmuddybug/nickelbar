// Loopy (Slitherlink) on a square grid. Puzzle: { w, h, clues: string,
// one char per cell, "0"-"3" or "." }. Draw one closed loop along the grid
// lines so each numbered cell has that many of its sides on the loop.
//
// The loop is the border of a random region grown cell by cell, kept free
// of holes and of corner-only touches (so its border really is one simple
// loop). Clues start complete and come off while the loop can still be
// worked out by deduction (see deduce() in count), which also makes it the
// only loop.

exports.sizes = [
  { name: '5×5', args: { w: 5, h: 5 }, count: 150 },
  { name: '7×7', args: { w: 7, h: 7 }, count: 150 },
  { name: '10×10', args: { w: 10, h: 10 }, count: 100 },
]

function geometry(w, h) {
  const HC = w * (h + 1), E = HC + (w + 1) * h
  const hE = (x, y) => y * w + x, vE = (x, y) => HC + y * (w + 1) + x
  const cellEdges = [], vertEdges = [], edgeCells = Array.from({ length: E }, () => []), edgeVerts = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const es = [hE(x, y), hE(x, y + 1), vE(x, y), vE(x + 1, y)]
    cellEdges.push(es)
    for (const e of es) edgeCells[e].push(y * w + x)
  }
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
    const es = []
    if (x > 0) es.push(hE(x - 1, y))
    if (x < w) es.push(hE(x, y))
    if (y > 0) es.push(vE(x, y - 1))
    if (y < h) es.push(vE(x, y))
    vertEdges.push(es)
  }
  for (let e = 0; e < E; e++) edgeVerts.push([])
  vertEdges.forEach((es, v) => es.forEach(e => edgeVerts[e].push(v)))
  return { E, cellEdges, vertEdges, edgeCells, edgeVerts }
}

exports.geometry = geometry

// Solutions up to `limit` (null if the search gave up). clue[i] = -1 for none.
function count(w, h, clue, limit, mode) {
  const g = geometry(w, h), { E, cellEdges, vertEdges, edgeCells, edgeVerts } = g
  const st = new Int8Array(E)   // 0 unknown, 1 on, -1 off
  let found = 0, nodes = 0, gaveUp = false

  function cellOk(c, log) {
    if (clue[c] < 0) return true
    let on = 0, unk = 0
    for (const e of cellEdges[c]) { if (st[e] === 1) on++; else if (!st[e]) unk++ }
    if (on > clue[c] || on + unk < clue[c]) return false
    if (unk && on === clue[c]) { for (const e of cellEdges[c]) if (!st[e]) { st[e] = -1; log.push(e) } }
    else if (unk && on + unk === clue[c]) { for (const e of cellEdges[c]) if (!st[e]) { st[e] = 1; log.push(e) } }
    return true
  }
  function vertOk(v, log) {
    let on = 0, unk = 0, last = -1
    for (const e of vertEdges[v]) { if (st[e] === 1) on++; else if (!st[e]) { unk++; last = e } }
    if (on > 2 || (on === 1 && !unk)) return false
    if (on === 2 && unk) { for (const e of vertEdges[v]) if (!st[e]) { st[e] = -1; log.push(e) } }
    else if (on === 1 && unk === 1) { st[last] = 1; log.push(last) }
    else if (on === 0 && unk === 1) { st[last] = -1; log.push(last) }
    return true
  }

  function propagate(log) {
    let mark = -1
    while (mark !== log.length) {
      mark = log.length
      for (let c = 0; c < cellEdges.length; c++) if (!cellOk(c, log)) return false
      for (let v = 0; v < vertEdges.length; v++) if (!vertOk(v, log)) return false
      if (!loops(log)) return false
    }
    return true
  }

  // Walk the "on" edges into chains. A closed chain must be the whole
  // answer; an unknown edge joining a chain's two ends would close it early.
  function loops(log) {
    const seen = new Uint8Array(E)
    let onTotal = 0
    for (let e = 0; e < E; e++) if (st[e] === 1) onTotal++
    for (let e0 = 0; e0 < E; e0++) {
      if (st[e0] !== 1 || seen[e0]) continue
      // Walk both ways from e0.
      let len = 1, closed = false
      seen[e0] = 1
      const ends = []
      for (const v0 of edgeVerts[e0]) {
        let v = v0, prev = e0
        for (;;) {
          let next = -1
          for (const e of vertEdges[v]) if (e !== prev && st[e] === 1) { next = e; break }
          if (next < 0) { ends.push(v); break }
          if (next === e0) { closed = true; break }
          if (seen[next]) { closed = true; break }
          seen[next] = 1; len++
          prev = next
          v = edgeVerts[next][0] === v ? edgeVerts[next][1] : edgeVerts[next][0]
        }
        if (closed) break
      }
      if (closed) {
        if (len !== onTotal) return false
        // Everything else must be off, and every clue exactly met.
        for (let c = 0; c < cellEdges.length; c++) {
          if (clue[c] < 0) continue
          let on = 0
          for (const e of cellEdges[c]) if (st[e] === 1) on++
          if (on !== clue[c]) return false
        }
        for (let e = 0; e < E; e++) if (!st[e]) { st[e] = -1; log.push(e) }
        return true
      }
      if (ends.length === 2 && len < onTotal) {
        const [a, b] = ends
        for (const e of vertEdges[a]) if (!st[e] && (edgeVerts[e][0] === b || edgeVerts[e][1] === b)) { st[e] = -1; log.push(e) }
      }
    }
    return true
  }

  function undo(log) { for (const e of log) st[e] = 0 }

  function solve() {
    if (found >= limit) return
    if (++nodes > 400000) { gaveUp = true; return }
    const log = []
    if (!propagate(log)) { undo(log); return }
    // Branch: prefer an edge that extends a loose end.
    let pick = -1
    for (let v = 0; v < vertEdges.length && pick < 0; v++) {
      let on = 0, cand = -1
      for (const e of vertEdges[v]) { if (st[e] === 1) on++; else if (!st[e]) cand = e }
      if (on === 1 && cand >= 0) pick = cand
    }
    if (pick < 0) for (let e = 0; e < E; e++) if (!st[e]) { pick = e; break }
    if (pick < 0) {
      // Fully decided. It's a solution if there's one loop of everything on.
      let on = 0
      for (let e = 0; e < E; e++) if (st[e] === 1) on++
      if (on && loops([])) found++
      undo(log)
      return
    }
    for (const val of [1, -1]) {
      st[pick] = val
      solve()
      st[pick] = 0
      if (found >= limit || gaveUp) break
    }
    undo(log)
  }
  // Deduction only: the rules above, plus trying one edge either way and
  // seeing a rule break straight away. No nested guesses. 1 if that
  // decides every edge, else 0.
  function deduce() {
    const log = []
    for (;;) {
      if (!propagate(log)) return 0
      let progress = false, unknown = 0
      for (let e = 0; e < E && !progress; e++) {
        if (st[e]) continue
        unknown++
        for (const val of [1, -1]) {
          st[e] = val
          const a = []
          const ok = propagate(a)
          undo(a)
          st[e] = 0
          if (!ok) { st[e] = -val; log.push(e); progress = true; break }
        }
      }
      if (!unknown) {
        let on = 0
        for (let e = 0; e < E; e++) if (st[e] === 1) on++
        return on && loops([]) ? 1 : 0
      }
      if (!progress) return 0
    }
  }
  if (mode === 'deduce') return deduce()

  solve()
  return gaveUp ? null : found
}

exports.count = count
exports.deducible = (w, h, clue) => count(w, h, clue, 1, 'deduce') === 1

function region(w, h, rand) {
  const N = w * h, inside = new Uint8Array(N)
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : inside[y * w + x]
  const target = Math.floor(N * (0.4 + rand() * 0.2))
  inside[Math.floor(rand() * N)] = 1
  let size = 1, guard = 0
  while (size < target && guard++ < N * 30) {
    const cand = []
    for (let i = 0; i < N; i++) {
      if (inside[i]) continue
      const x = i % w, y = Math.floor(i / w)
      if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) cand.push(i)
    }
    if (!cand.length) break
    const c = cand[Math.floor(rand() * cand.length)]
    inside[c] = 1
    const x0 = c % w, y0 = Math.floor(c / w)
    // No corner-only touches around the new cell.
    let ok = true
    for (const [vx, vy] of [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]]) {
      const a = at(vx - 1, vy - 1), b = at(vx, vy - 1), cc = at(vx - 1, vy), d = at(vx, vy)
      if ((a && d && !b && !cc) || (b && cc && !a && !d)) ok = false
    }
    // No holes: every outside cell still reaches the edge through outside cells.
    if (ok) {
      const seen = new Uint8Array(N), st = []
      for (let i = 0; i < N; i++) {
        const x = i % w, y = Math.floor(i / w)
        if (!inside[i] && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) { seen[i] = 1; st.push(i) }
      }
      while (st.length) {
        const i = st.pop(), x = i % w, y = Math.floor(i / w)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (!inside[j] && !seen[j]) { seen[j] = 1; st.push(j) }
        }
      }
      for (let i = 0; i < N && ok; i++) if (!inside[i] && !seen[i]) ok = false
    }
    if (ok) size++
    else inside[c] = 0
  }
  return inside
}

exports.generate = function({ w, h }, rand) {
  const inside = region(w, h, rand), N = w * h
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : inside[y * w + x]
  const clue = []
  for (let i = 0; i < N; i++) {
    const x = i % w, y = Math.floor(i / w), me = inside[i]
    clue.push([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => at(x + dx, y + dy) !== me).length)
  }
  if (!exports.deducible(w, h, clue)) return null
  const order = Array.from({ length: N }, (_, i) => i).sort(() => rand() - 0.5)
  let left = N
  for (const i of order) {
    if (left <= Math.ceil(N * 0.45)) break
    const keep = clue[i]
    clue[i] = -1
    if (!exports.deducible(w, h, clue)) clue[i] = keep
    else left--
  }
  return { w, h, clues: clue.map(v => v < 0 ? '.' : String(v)).join('') }
}
