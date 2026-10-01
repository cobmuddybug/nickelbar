.pragma library
.import "../../engine/Rng.js" as Rng

// Mind Tester: a machine with one button and no game in it. Press the
// button and it declares how clever you are. The reading is a lie.

var LOW = ["SLEEPWALKING", "A PLEASANT FOG", "VERY SMALL BRAIN, VERY LARGE HEART", "ROCK-ADJACENT", "TECHNICALLY ALIVE"]
var MID = ["PERFECTLY ADEQUATE", "A SOLID BEIGE", "AVERAGE, BUT WITH FLAIR", "BETTER THAN THE LAST ONE", "FINE. HONESTLY FINE"]
var HIGH = ["SUSPICIOUSLY SHARP", "A MIND LIKE A WELL-OILED SPOON", "CONSULT YOUR LOCAL UNIVERSITY", "THE MACHINE IS NERVOUS", "GALAXY-BRAIN, BRIEFLY"]
var ODD = ["ERROR: SUBJECT TOO INTERESTING", "READING MISPLACED. PLEASE TRY AGAIN", "A LEMON. THE MACHINE SAYS A LEMON", "-4. THE MACHINE IS SORRY", "WANGERNUMB"]

function makeState() { return { phase: "idle", t: 0, iq: 0, line: "", n: 0, top: 0, history: [], fill: 0, done: false } }
function copy(s) { var o = {}; for (var k in s) o[k] = s[k]; return o }

function press(s) {
  if (s.phase === "scan") return s
  var o = copy(s)
  o.phase = "scan"; o.t = 0; o.fill = 0
  return o
}

function pickFrom(a) { return a[Math.floor(Rng.random() * a.length)] }

function reading() {
  var r = Rng.random()
  if (r < 0.06) return { iq: 0, line: pickFrom(ODD), odd: true }
  // roughly bell-shaped, 40..180
  var iq = Math.round(100 + (Rng.random() + Rng.random() + Rng.random() - 1.5) * 70)
  return { iq: iq, line: pickFrom(iq < 80 ? LOW : iq < 120 ? MID : HIGH), odd: false }
}

function step(s, dt) {
  if (s.phase !== "scan") return s
  var o = copy(s)
  o.t = s.t + dt
  o.fill = Math.min(1, o.t / 2.2)
  if (o.t >= 2.2) {
    var r = reading()
    o.phase = "show"; o.iq = r.iq; o.line = r.line; o.odd = r.odd; o.n = s.n + 1
    if (r.iq > s.top) o.top = r.iq
    o.history = [r.odd ? "?" : String(r.iq)].concat(s.history).slice(0, 8)
  }
  return o
}
