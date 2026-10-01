// Signpost. Puzzle: { w, h, arrows: [dir per cell, -1 on the last], nums:
// [given number per cell, 0 = none] }. Directions 0..7 go clockwise from
// up. The answer is a path visiting every cell once, 1 to w*h, each step
// going somewhere along the previous cell's arrow.

exports.sizes = [
  { name: '4×4', args: { w: 4, h: 4 }, count: 150 },
  { name: '5×5', args: { w: 5, h: 5 }, count: 150 },
  { name: '6×6', args: { w: 6, h: 6 }, count: 120 },
]

const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]

function dirTo(w, a, b) {
  const dx = Math.sign(b % w - a % w), dy = Math.sign(Math.floor(b / w) - Math.floor(a / w))
  return DIRS.findIndex(d => d[0] === dx && d[1] === dy)
}

function ray(w, h, i, d) {
  const out = []
  let x = i % w + DIRS[d][0], y = Math.floor(i / w) + DIRS[d][1]
  while (x >= 0 && y >= 0 && x < w && y < h) { out.push(y * w + x); x += DIRS[d][0]; y += DIRS[d][1] }
  return out
}

function lined(w, a, b) {
  const dx = b % w - a % w, dy = Math.floor(b / w) - Math.floor(a / w)
  return a !== b && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))
}

// A random path through every cell where each step is a queen move.
function randomPath(w, h, rand) {
  const N = w * h, used = Array(N).fill(false), path = []
  const nbrs = Array.from({ length: N }, (_, a) => Array.from({ length: N }, (_, b) => b).filter(b => lined(w, a, b)))
  let nodes = 0
  function go(c) {
    if (++nodes > 20000) return false
    used[c] = true; path.push(c)
    if (path.length === N) return true
    // Warnsdorff: fewest onward options first, random among ties.
    const next = nbrs[c].filter(b => !used[b])
      .map(b => [b, nbrs[b].filter(x => !used[x]).length + rand()])
      .sort((p, q) => p[1] - q[1])
    for (const [b] of next) if (go(b)) return true
    used[c] = false; path.pop()
    return false
  }
  return go(Math.floor(rand() * N)) ? path : null
}

// Up to `limit` solutions as position arrays (pos[cell] = step, 1-based).
function solutions(w, h, arrows, nums, limit) {
  const N = w * h, pos = Array(N).fill(0), at = Array(N + 1).fill(-1), out = []
  for (let i = 0; i < N; i++) if (nums[i]) at[nums[i]] = i
  const start = at[1]
  let nodes = 0
  function go(c, k) {
    if (out.length >= limit || ++nodes > 500000) return
    pos[c] = k
    if (k === N) { out.push(pos.slice()); pos[c] = 0; return }
    const forced = at[k + 1]
    for (const b of ray(w, h, c, arrows[c])) {
      if (pos[b]) continue
      if (forced >= 0 ? b !== forced : nums[b]) continue
      if (k + 1 === N ? arrows[b] !== -1 : arrows[b] === -1) continue
      go(b, k + 1)
    }
    pos[c] = 0
  }
  go(start, 1)
  return nodes > 500000 ? null : out
}

exports.solutions = solutions

// Deduction only, the way a person links Signpost cells. A link a→b is
// possible if b is along a's arrow, neither end is linked that way yet,
// it wouldn't close a loop, and the numbers the joined chain would carry
// fit (in range, not clashing with a number some other chain has). Link
// when a cell has only one possible next or previous cell, or when the
// ends of two chains carry k and k+1. If that stalls, try one link and see
// something break straight away. No nested guesses. True if it finishes
// the path.
function deducible(w, h, arrows, nums) {
  const N = w * h, rays = Array.from({ length: N }, (_, i) => arrows[i] < 0 ? [] : ray(w, h, i, arrows[i]))
  const froms = Array.from({ length: N }, () => [])
  rays.forEach((r, a) => r.forEach(b => froms[b].push(a)))

  function fresh() { return { next: Array(N).fill(-1), prev: Array(N).fill(-1), banned: new Set() } }
  function clone(S) { return { next: S.next.slice(), prev: S.prev.slice(), banned: new Set(S.banned) } }
  const head = (S, c) => { while (S.prev[c] >= 0) c = S.prev[c]; return c }
  // The step number of cell c if its chain holds a given number, else 0.
  function number(S, c) {
    let k = 0, x = c
    while (x >= 0) { if (nums[x]) return nums[x] + k; x = S.prev[x]; k++ }
    k = 0; x = c
    while (x >= 0) { if (nums[x]) return nums[x] + k; x = S.next[x]; k-- }
    return 0
  }
  function chainLen(S, c) { let n = 0; for (let x = head(S, c); x >= 0; x = S.next[x]) n++; return n }

  function allowed(S, a, b) {
    if (S.next[a] >= 0 || S.prev[b] >= 0 || S.banned.has(a * N + b)) return false
    if (nums[b] === 1 || arrows[a] < 0) return false
    if (head(S, a) === b) return false
    const na = number(S, a), nb = number(S, b)
    if (na && nb) return nb === na + 1
    const len = chainLen(S, a) + chainLen(S, b)
    if (!na && !nb) return len <= N
    // One side numbered: the joined chain's numbers must fit 1..N and not
    // land on a number that another chain already holds.
    const first = na ? na - (chainLen(S, a) - 1) : nb - chainLen(S, a)
    if (first < 1 || first + len - 1 > N) return false
    const mine = new Set()
    for (let x = head(S, a); x >= 0; x = S.next[x]) mine.add(x)
    for (let x = b; x >= 0; x = S.next[x]) mine.add(x)
    for (let i = 0; i < N; i++) if (!mine.has(i)) {
      const k = number(S, i)
      if (k && k >= first && k < first + len) return false
    }
    return true
  }
  function link(S, a, b) { S.next[a] = b; S.prev[b] = a }

  function propagate(S) {
    let changed = true
    while (changed) {
      changed = false
      for (let a = 0; a < N; a++) {
        if (S.next[a] >= 0 || arrows[a] < 0) continue
        const opts = rays[a].filter(b => allowed(S, a, b))
        if (!opts.length) return false
        if (opts.length === 1) { link(S, a, opts[0]); changed = true }
      }
      for (let b = 0; b < N; b++) {
        if (S.prev[b] >= 0 || nums[b] === 1) continue
        const opts = froms[b].filter(a => allowed(S, a, b))
        if (!opts.length) return false
        if (opts.length === 1) { link(S, opts[0], b); changed = true }
      }
      // Chain ends numbered k and k+1 must join.
      const at = {}
      for (let c = 0; c < N; c++) { const k = number(S, c); if (k) { if (at[k] !== undefined && at[k] !== c) return false; at[k] = c } }
      for (const k in at) {
        const a = at[k], b = at[+k + 1]
        if (b === undefined || S.next[a] === b) continue
        if (!allowed(S, a, b)) return false
        link(S, a, b); changed = true
      }
    }
    return true
  }
  const done = S => S.next.filter(x => x >= 0).length === N - 1

  let S = fresh()
  for (;;) {
    if (!propagate(S)) return false
    if (done(S)) return true
    let progress = false
    for (let a = 0; a < N && !progress; a++) {
      if (S.next[a] >= 0) continue
      for (const b of rays[a]) {
        if (!allowed(S, a, b)) continue
        const T = clone(S)
        link(T, a, b)
        if (!propagate(T)) { S.banned.add(a * N + b); progress = true; break }
      }
    }
    if (!progress) return false
  }
}

exports.deducible = deducible

exports.generate = function({ w, h }, rand) {
  const N = w * h, path = randomPath(w, h, rand)
  if (!path) return null
  const arrows = Array(N).fill(-1), step = Array(N).fill(0)
  path.forEach((c, k) => { step[c] = k + 1; if (k + 1 < N) arrows[c] = dirTo(w, c, path[k + 1]) })
  const nums = Array(N).fill(0)
  nums[path[0]] = 1; nums[path[N - 1]] = N
  // Add numbers where two answers disagree until only one is left.
  for (let guard = 0; guard < N; guard++) {
    const sols = solutions(w, h, arrows, nums, 2)
    if (!sols) return null
    if (sols.length === 1) break
    const diff = []
    for (let i = 0; i < N; i++) if (sols[0][i] !== sols[1][i] && !nums[i]) diff.push(i)
    const c = diff[Math.floor(rand() * diff.length)]
    nums[c] = step[c]
  }
  // Unique isn't enough: add more until it can be worked out without a
  // guess.
  const blank = []
  for (let i = 0; i < N; i++) if (!nums[i]) blank.push(i)
  blank.sort(() => rand() - 0.5)
  while (!deducible(w, h, arrows, nums)) {
    if (!blank.length) return null
    const c = blank.pop()
    nums[c] = step[c]
  }
  // Then drop any that turned out not to be needed.
  const extra = []
  for (let i = 0; i < N; i++) if (nums[i] && nums[i] !== 1 && nums[i] !== N) extra.push(i)
  extra.sort(() => rand() - 0.5)
  for (const i of extra) {
    const keep = nums[i]
    nums[i] = 0
    if (!deducible(w, h, arrows, nums)) nums[i] = keep
  }
  if (!deducible(w, h, arrows, nums)) return null
  return { w, h, arrows, nums }
}
