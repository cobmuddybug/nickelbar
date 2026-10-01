.pragma library

// The power / aim meter that swings up and down while you wait to press the button,
// used by Artillery, Catapult, Kitty Launch, Bowling, Fishing, Milk Jugs and Ring Toss.

// One step of a meter that sweeps between lo and hi at `rate` (whole sweeps per second
// if hi - lo = 1). Returns the new value and direction.
function swing(value, dir, dt, rate, lo, hi) {
  lo = lo === undefined ? 0 : lo
  hi = hi === undefined ? 1 : hi
  var v = value + dir * dt * rate
  if (v >= hi) return { v: hi, dir: -1 }
  if (v <= lo) return { v: lo, dir: 1 }
  return { v: v, dir: dir }
}
