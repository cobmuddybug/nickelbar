// A random n x n Latin square (values 1..n), by randomised backtracking.
module.exports = function latin(n, rand) {
  const g = Array.from({ length: n }, () => Array(n).fill(0))
  function ok(r, c, v) {
    for (let i = 0; i < n; i++) if (g[r][i] === v || g[i][c] === v) return false
    return true
  }
  function fill(p) {
    if (p === n * n) return true
    const r = Math.floor(p / n), c = p % n
    const vals = Array.from({ length: n }, (_, i) => i + 1).sort(() => rand() - 0.5)
    for (const v of vals) {
      if (!ok(r, c, v)) continue
      g[r][c] = v
      if (fill(p + 1)) return true
      g[r][c] = 0
    }
    return false
  }
  fill(0)
  return g
}
