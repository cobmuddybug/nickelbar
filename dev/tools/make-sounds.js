#!/usr/bin/env node
// Synthesises the plugin's sound effects into sounds/*.wav: short, soft sine
// and triangle blips (nothing sampled, nothing to license). Run from the repo
// root: node dev/tools/make-sounds.js
const fs = require("fs")
const path = require("path")

let seed = 12345
const RATE = 44100
const OUT = path.join(__dirname, "..", "..", "sounds")

// notes: [{ f: Hz or [fromHz, toHz], t: start s, d: length s, v: volume, wave }]
function render(notes, tail = 0.02) {
  const total = Math.max(...notes.map(n => n.t + n.d)) + tail
  const buf = new Float32Array(Math.ceil(total * RATE))
  for (const n of notes) {
    const start = Math.floor(n.t * RATE), len = Math.floor(n.d * RATE)
    const [f0, f1] = Array.isArray(n.f) ? n.f : [n.f, n.f]
    let phase = 0
    for (let i = 0; i < len && start + i < buf.length; ++i) {
      const p = i / len
      phase += 2 * Math.PI * (f0 + (f1 - f0) * p) / RATE
      const env = Math.min(1, i / (RATE * 0.004)) * Math.pow(1 - p, 2)
      let s
      if (n.wave === "noise") { seed = (seed * 1664525 + 1013904223) >>> 0; s = (seed / 2147483648) - 1 }
      else s = n.wave === "tri" ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase)
      buf[start + i] += s * env * n.v
    }
  }
  return buf
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2))
  const h = Buffer.alloc(44)
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write("data", 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

// Levels are low on purpose: these are garnish. The overlay scales them again.
const SOUNDS = {
  move:   [{ f: 520, t: 0, d: 0.035, v: 0.30, wave: "tri" }],
  act:    [{ f: [440, 620], t: 0, d: 0.06, v: 0.40 }],
  score:  [{ f: 784, t: 0, d: 0.07, v: 0.35 }, { f: 1175, t: 0.05, d: 0.10, v: 0.30 }],
  pause:  [{ f: [500, 330], t: 0, d: 0.09, v: 0.35 }],
  open:   [{ f: 392, t: 0, d: 0.07, v: 0.30 }, { f: 587, t: 0.05, d: 0.10, v: 0.30 }],
  win:    [523, 659, 784, 1047].map((f, i) => ({ f, t: i * 0.09, d: 0.2, v: 0.32 })),
  lose:   [{ f: [330, 220], t: 0, d: 0.22, v: 0.35, wave: "tri" }, { f: [262, 165], t: 0.16, d: 0.34, v: 0.35, wave: "tri" }],
  best:   [659, 784, 988, 1319, 1568].map((f, i) => ({ f, t: i * 0.07, d: 0.18, v: 0.30 })),
}

// Notes for games that play instruments (Echo): a C major scale with a soft overtone, plus a low buzz.
;[261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25].forEach((f, i) => {
  SOUNDS["note" + i] = [{ f, t: 0, d: 0.4, v: 0.3 }, { f: f * 2, t: 0, d: 0.25, v: 0.08 }]
})
// Platformer effects (Stomper).
SOUNDS.jump = [{ f: [330, 620], t: 0, d: 0.13, v: 0.3 }]
SOUNDS.coin = [{ f: 988, t: 0, d: 0.06, v: 0.3 }, { f: 1319, t: 0.05, d: 0.2, v: 0.3 }]
SOUNDS.stomp = [{ f: [220, 90], t: 0, d: 0.12, v: 0.4, wave: "tri" }]
SOUNDS.bump = [{ f: [160, 110], t: 0, d: 0.09, v: 0.4, wave: "tri" }]
SOUNDS.power = [392, 494, 587, 784, 988].map((f, i) => ({ f, t: i * 0.06, d: 0.14, v: 0.28 }))
SOUNDS.die = [{ f: [500, 120], t: 0, d: 0.7, v: 0.3, wave: "tri" }]
SOUNDS.flag = [523, 659, 784, 1047, 784, 1047, 1319].map((f, i) => ({ f, t: i * 0.1, d: 0.18, v: 0.28 }))
// Shared game effects: small, dry and quiet.
SOUNDS.click = [{ f: 1900, t: 0, d: 0.018, v: 0.3 }]
SOUNDS.tick = [{ f: 1300, t: 0, d: 0.012, v: 0.22 }]
SOUNDS.clack = [{ f: 0, t: 0, d: 0.035, v: 0.35, wave: "noise" }, { f: [1500, 900], t: 0, d: 0.05, v: 0.22 }]
SOUNDS.thud = [{ f: [170, 65], t: 0, d: 0.13, v: 0.4, wave: "tri" }]
SOUNDS.pop = [{ f: [900, 320], t: 0, d: 0.06, v: 0.3 }]
SOUNDS.ding = [{ f: 1568, t: 0, d: 0.5, v: 0.28 }, { f: 2352, t: 0, d: 0.3, v: 0.08 }]
SOUNDS.crash = [{ f: 0, t: 0, d: 0.35, v: 0.3, wave: "noise" }, { f: [300, 90], t: 0, d: 0.3, v: 0.2, wave: "tri" }]
SOUNDS.buzz = [{ f: [150, 110], t: 0, d: 0.4, v: 0.3, wave: "tri" }]

fs.mkdirSync(OUT, { recursive: true })
for (const [name, notes] of Object.entries(SOUNDS)) {
  const buf = wav(render(notes))
  fs.writeFileSync(path.join(OUT, name + ".wav"), buf)
  console.log(name + ".wav", buf.length, "bytes")
}
