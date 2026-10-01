.pragma library

// Seeded randomness for the whole plugin. Game logic calls Rng.random() where it
// used to call Math.random(); seed(n) makes that a reproducible sequence, so a
// game deals and generates the same way from the same seed: the daily challenge,
// shareable seeds and reproducible bug reports. unseed() goes back to the real
// thing. (Overriding Math.random itself does not work: QML's library scripts
// each see their own.)

var _real = Math.random
var _gen = null

function mulberry(a) {
  return function() {
    a = (a + 0x6D2B79F5) >>> 0
    var t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The drop-in for Math.random: logic files call Rng.random() instead.
function random() { return _gen ? _gen() : _real() }

function seed(n) { _gen = mulberry(Math.floor(Math.abs(Number(n) || 0)) >>> 0) }
function unseed() { _gen = null }
function isSeeded() { return _gen !== null }

// A stable 32-bit hash of a string (a game id plus a date, say) to seed with.
function hash(str) {
  var h = 2166136261
  for (var i = 0; i < str.length; ++i) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// Today's date in the player's own time zone as "YYYY-MM-DD".
function today(nowMs) {
  var d = new Date(nowMs === undefined ? Date.now() : nowMs)
  function p(n) { return n < 10 ? "0" + n : String(n) }
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
}

// Whole days since 1970 for a "YYYY-MM-DD" string, for rotating through a list.
function dayNumber(dateStr) { return Math.floor(Date.parse(dateStr + "T00:00:00Z") / 86400000) }
