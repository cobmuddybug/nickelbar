.pragma library

// Small physics shared by the games that bounce discs about (Bowling, Billiards,
// Milk Jugs, Bumper Cars). Circles are plain objects with x, y, vx, vy.

// Resolves an overlap between circle a (radius ra, mass ma) and circle b: pushes them apart in
// proportion to the other's mass, then bounces them with restitution e (1 = perfectly elastic).
// Returns -1 when they do not overlap, otherwise the speed at which they were closing along the
// line between them (0 when already moving apart, so no impulse was applied).
function collide(a, ra, ma, b, rb, mb, e) {
  var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy), min = ra + rb
  if (d >= min || d === 0) return -1
  var nx = dx / d, ny = dy / d, pen = min - d
  a.x -= nx * pen * mb / (ma + mb); a.y -= ny * pen * mb / (ma + mb)
  b.x += nx * pen * ma / (ma + mb); b.y += ny * pen * ma / (ma + mb)
  var rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
  if (rel >= 0) return 0
  var j = -(1 + e) * rel / (1 / ma + 1 / mb)
  a.vx -= j * nx / ma; a.vy -= j * ny / ma
  b.vx += j * nx / mb; b.vy += j * ny / mb
  return -rel
}
