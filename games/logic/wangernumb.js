.pragma library

// Wangernumb: a game show whose rules nobody knows, the code included.
// You type numbers; a hidden rule decides whether each one is WANGERNUMB.
// The rule is swapped every two to five turns, the board turns a quarter
// every three or four, the wheel of digits reshuffles every turn, and
// after every fifth WANGERNUMB comes a ten-second bonus round where
// everything scores. Three strikes or twenty turns end the round.
//
// All randomness comes from the seed stored in the state (mulberry32), so
// a run can be replayed and tested. State is a plain object; every
// function returns a new one.

var MAX_STRIKES = 3
var MAX_TURNS = 20
var MAX_DIGITS = 6
var BONUS_TIME = 10

var RULES = ["digitsumprime", "lastpm1", "feel", "oddsec", "coin", "mood", "digitcount", "divisible", "palindrome", "higher"]

// ---- host lines (nobody in them has a name) ---------------------------------

var LINES = {
  start: [
    "Welcome to the show. The rules are on the way.",
    "Contestants, please forget everything you were told.",
    "Tonight's round has been rescheduled to now.",
    "Good evening. The numbers are ready. Are you?",
    "Let's play. It will become clear. It will not."
  ],
  wang: [
    "THAT'S WANGERNUMB!",
    "THAT'S WANGERNUMB! Well played, whoever that was.",
    "Wangernumb! The audience will now clap for a fixed time.",
    "That's Wangernumb! Please do not ask why.",
    "THAT'S WANGERNUMB! The number knew.",
    "Wangernumb! A flag has been raised somewhere.",
    "That's Wangernumb, and I'm as surprised as you are.",
    "THAT'S WANGERNUMB! Quietly, in the back, a bell rings.",
    "Wangernumb! You have been noticed by the numbers.",
    "That is Wangernumb. Please keep it away from the others."
  ],
  wrong: [
    "Sorry, that's not Wangernumb.",
    "Oh no. That one was very nearly a different number.",
    "Not Wangernumb. Try something rounder.",
    "That's not Wangernumb. It might be numbernope.",
    "No. The number has left the building.",
    "Not Wangernumb, but the effort has been logged.",
    "That's not Wangernumb. The audience is being kind.",
    "Sorry. That number was already spoken for.",
    "Wrong. Gently, but wrong.",
    "Not this time. The numbers are conferring."
  ],
  rotate: [
    "Let's turn the board!",
    "Time to turn the board. Mind your neck.",
    "The board is being rotated. This is normal.",
    "Rotating! Please read it however it lands.",
    "Let's turn the board, for the sake of fairness.",
    "Everybody hold still. The board has ideas."
  ],
  bonus: [
    "WANGERNUMB! Everything scores! Nothing is safe!",
    "It's WANGERNUMB time! Type as if it matters!",
    "WANGERNUMB! Ten seconds. All numbers welcome.",
    "The board is spinning. The rules have left. WANGERNUMB!"
  ],
  bonusEnd: [
    "And that's Wangernumb. The rules are back, sorry.",
    "Wangernumb is over. Nobody saw anything.",
    "The spinning has stopped. The rules are returning."
  ],
  over: [
    "And that's the end of the show. Thank you for playing.",
    "The show is over. The numbers will be in touch.",
    "That's all we have time for. The score has been made up.",
    "Game over. Please leave through the number nearest you."
  ]
}

var EVENTS = [
  "A second contestant has scored, for reasons of their own.",
  "The clock is now running backwards.",
  "The rules have changed. (They may not have.)",
  "The scoring currency has been replaced.",
  "The audience has been asked to vote. It abstained.",
  "A small delay while the numbers are counted.",
  "Somebody has left the studio with the good pen.",
  "The show has run over by an amount to be confirmed.",
  "The rival has been awarded points in a side room.",
  "The wheel has been reshuffled, as is traditional."
]

var UNITS = ["wangs", "wongs", "points (approx.)", "units", "wangernumbs"]

// The help screen says this with total confidence. Every line is wrong.
var FAKE_HELP = [
  "Only prime numbers are Wangernumb, except on Tuesdays.",
  "A number is Wangernumb if you said it first.",
  "Numbers that end in a vowel score double.",
  "Wangernumb is the number the host is thinking of.",
  "Small numbers are Wangernumb; large numbers are numbernope.",
  "Anything typed on the left of the keyboard counts.",
  "The rule is simple: there is a rule.",
  "Only even numbers are Wangernumb, unless they are odd."
]

var LEET = "OIZEASGTBP"
var SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹"

// ---- random ------------------------------------------------------------------

function rnd(s) {
  s.seed = (s.seed + 0x6D2B79F5) | 0
  var t = Math.imul(s.seed ^ (s.seed >>> 15), 1 | s.seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function ri(s, n) { return Math.floor(rnd(s) * n) }
function pick(s, arr) { return arr[ri(s, arr.length)] }

function pickLine(s, kind) {
  var pool = LINES[kind], line = pick(s, pool)
  if (line === s.host && pool.length > 1) line = pool[(pool.indexOf(line) + 1) % pool.length]
  return line
}

function clone(s) {
  var o = {}
  for (var k in s) o[k] = s[k]
  return o
}

// ---- number helpers ---------------------------------------------------------

function digitSum(n) { var t = 0; while (n > 0) { t += n % 10; n = Math.floor(n / 10) } return t }
function isPrime(n) {
  if (n < 2) return false
  for (var i = 2; i * i <= n; ++i) if (n % i === 0) return false
  return true
}
function isPalindrome(n) { var t = String(n); return t === t.split("").reverse().join("") }

// Numbers as shown on the prompt: plain digits, leet letters, or superscripts.
function glyph(n, set) {
  var t = String(n)
  if (set === 0) return t
  var m = set === 1 ? LEET : SUPER
  var out = ""
  for (var i = 0; i < t.length; ++i) out += m.charAt(t.charCodeAt(i) - 48)
  return out
}

function fakeHelp(k) { return FAKE_HELP[((k % FAKE_HELP.length) + FAKE_HELP.length) % FAKE_HELP.length] }

// ---- rules -------------------------------------------------------------------

function evaluate(s, n, nowSec) {
  switch (RULES[s.rule]) {
    case "digitsumprime": return isPrime(digitSum(n))
    case "lastpm1": return Math.abs(n - s.last) === 1
    case "feel": return String(n).indexOf(String(s.feel)) >= 0
    case "oddsec": return (Math.floor(nowSec) % 2) === 1
    case "coin": return rnd(s) < 0.5
    case "mood": return s.mood
    case "digitcount": return String(n).length === (s.turn % 3) + 1
    case "divisible": return n % s.divisor === 0
    case "palindrome": return isPalindrome(n)
    case "higher": return n > s.target
  }
  return false
}

// A cryptic clue for rule id r; the host sometimes gives the wrong one.
function hintFor(s, r) {
  switch (RULES[r]) {
    case "digitsumprime": return "Something prime is happening to the digits."
    case "lastpm1": return "One step at a time."
    case "feel": return "The host is feeling " + s.feel + "."
    case "oddsec": return "The clock has opinions."
    case "coin": return "It's a bit heads-or-tails in here."
    case "mood": return "The host is in a " + (s.mood ? "good" : "terrible") + " mood."
    case "digitcount": return "Size matters today."
    case "divisible": return "This round is brought to you by the number " + s.divisor + "."
    case "palindrome": return "Mirrors are involved."
    case "higher": return "Aim higher."
  }
  return ""
}

function pickRule(s) {
  var r = ri(s, RULES.length)
  if (r === s.rule) r = (r + 1) % RULES.length
  s.rule = r
  s.ruleLeft = 2 + ri(4)
  s.feel = ri(s, 10)
  s.divisor = 2 + ri(s, 8)
  s.mood = ri(s, 2) === 0
}

function shuffle(s) {
  var a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (var i = a.length - 1; i > 0; --i) {
    var j = ri(s, i + 1), t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

function newPrompt(s) {
  s.target = 1 + ri(s, 99)
  s.glyph = ri(s, 3)
  s.unit = ri(s, UNITS.length)
  s.wheel = shuffle(s)
  s.input = ""
}

// ---- state -------------------------------------------------------------------

function makeState(seed) {
  var s = { seed: (seed === undefined ? 12345 : seed) | 0, turn: 0, strikes: 0, score: 0, wangs: 0, rival: 0,
    rule: -1, ruleLeft: 0, feel: 0, divisor: 2, mood: true, last: 0, target: 1, input: "", wheel: [],
    host: "", hint: "", event: "", verdict: "", gain: 0, age: 99, rot: 0, sinceRot: 0, rotEvery: 3,
    pal: 0, glyph: 0, unit: 0, bonus: 0, bonusCount: 0, clockDir: 1, over: false }
  pickRule(s)
  s.last = 1 + ri(s, 99)
  s.rotEvery = 3 + ri(s, 2)
  newPrompt(s)
  s.host = pickLine(s, "start")
  return s
}

function unitName(s) { return UNITS[s.unit] }
function turnShown(s) { return s.clockDir > 0 ? Math.min(MAX_TURNS, s.turn + 1) : Math.max(1, MAX_TURNS - s.turn) }
function done(s) { return !!s && s.over }

function typeDigit(state, d) {
  if (state.over || state.input.length >= MAX_DIGITS) return state
  var s = clone(state)
  s.input = (s.input === "0" ? "" : s.input) + String(d)
  return s
}

function backspace(state) {
  if (state.over || !state.input) return state
  var s = clone(state)
  s.input = s.input.slice(0, -1)
  return s
}

// Submit the typed number. nowSec is the wall clock's seconds (the odd-second
// rule reads it; the tests pass their own).
function submit(state, nowSec) {
  if (state.over || !state.input) return state
  var s = clone(state)
  var n = parseInt(s.input, 10)
  var inBonus = s.bonus > 0
  var ok = inBonus || evaluate(s, n, nowSec || 0)
  s.last = n
  s.age = 0
  s.hint = ""
  s.event = ""

  var host
  if (ok) {
    s.wangs += 1
    var r = rnd(s)
    var gain = inBonus ? 7 : (r < 0.08 ? 38 : (r < 0.16 ? -3 : pick(s, [3, 7, 7, 14, 21])))
    s.verdict = "wang"
    host = "wang"
    if (!inBonus && s.wangs % 5 === 0) {
      s.bonus = BONUS_TIME
      s.bonusCount += 1
      s.verdict = "wangernumb"
      host = "bonus"
      gain += 14
    }
    s.gain = gain
    s.score = Math.max(0, s.score + gain)
  } else {
    s.strikes += 1
    s.verdict = "wrong"
    s.gain = 0
    host = "wrong"
  }

  if (!inBonus) {
    s.turn += 1
    s.sinceRot += 1
    s.ruleLeft -= 1
    if (s.ruleLeft <= 0) pickRule(s)
    if (s.sinceRot >= s.rotEvery) {
      s.rot += 1
      s.sinceRot = 0
      s.rotEvery = 3 + ri(s, 2)
      s.pal = (s.pal + 1 + ri(s, 5)) % 6
      if (host !== "bonus") host = "rotate"
    }
  }

  // Sideshows: the rival scores for no reason, the clock flips, currency changes.
  if (ri(s, 3) > 0) s.rival += pick(s, [0, 2, 5, 11])
  if (ri(s, 100) < 35) {
    s.event = pick(s, EVENTS)
    if (s.event.indexOf("backwards") >= 0) s.clockDir = -s.clockDir
    else if (s.event.indexOf("rules have changed") >= 0 && ri(s, 2) === 0) pickRule(s)
  }

  if (s.strikes >= MAX_STRIKES || (s.turn >= MAX_TURNS && s.bonus <= 0)) {
    s.over = true
    host = "over"
  }

  s.host = pickLine(s, host)
  // A clue about a quarter of the time; one clue in five is a fib.
  if (!s.over && s.bonus <= 0 && ri(s, 4) === 0) s.hint = hintFor(s, ri(s, 5) === 0 ? ri(s, RULES.length) : s.rule)

  newPrompt(s)
  return s
}

// Advances the verdict flash and the bonus timer.
function step(state, dt) {
  if (state.over) return state
  var s = clone(state)
  s.age += dt
  if (s.bonus > 0) {
    s.bonus = Math.max(0, s.bonus - dt)
    if (s.bonus === 0) {
      s.host = pickLine(s, "bonusEnd")
      if (s.turn >= MAX_TURNS) { s.over = true; s.host = pickLine(s, "over") }
    }
  }
  return s
}

function serialize(state) { return clone(state) }

function deserialize(saved) {
  if (!saved || typeof saved.seed !== "number" || typeof saved.input !== "string" || !saved.wheel || saved.wheel.length !== 10) return null
  var s = clone(saved)
  if (s.over || s.rule < 0 || s.rule >= RULES.length) return null
  return s
}
