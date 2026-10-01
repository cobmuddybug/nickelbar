import QtQuick
import QtMultimedia

// Quiet interface sounds, played by the overlay from events it already sees
// (keys, score changes, round end), so no game needs to know about them.
// Games can also ask for a named sound with GameBase.sound(name).
// The wavs in ../sounds are synthesised by dev/tools/make-sounds.js.
Item {
  id: root

  property bool muted: false
  // Overall level on top of the files' own (already low) volume.
  property real volume: 0.5

  // Every sound there is; the index in this list is the index in `fx`.
  readonly property var names: [
    "move", "act", "score", "pause", "open", "win", "lose", "best", "buzz",
    "note0", "note1", "note2", "note3", "note4", "note5", "note6", "note7",
    "jump", "coin", "stomp", "bump", "power", "die", "flag",
    "click", "tick", "clack", "thud", "pop", "ding", "crash"
  ]
  // A named sound that repeats faster than this many ms is dropped, so a
  // flurry of collisions or a held fire button never turns into a buzz.
  readonly property var gaps: ({ clack: 45, tick: 30, click: 30, thud: 60, pop: 40, crash: 150, ding: 120, coin: 120, stomp: 120, bump: 120, jump: 120 })
  // Sounds that are dropped while their previous play is still going, rather
  // than restarting the stream (restarting every frame wedged the shell once).
  readonly property var noRestart: ({ coin: 1, stomp: 1, bump: 1, jump: 1, clack: 1, tick: 1, click: 1, thud: 1, pop: 1 })

  property var lastPlayed: ({})
  // Recent score-blip times; a game that scores every tick (a distance
  // counter) trips this and goes quiet rather than chattering.
  property var scoreTimes: []

  // SoundEffects are made on first use, so a session opens only the audio
  // streams it actually needs instead of one per sound at startup.
  property var effects: ({})
  Component {
    id: effectComp
    SoundEffect { volume: root.volume }
  }
  function effect(name) {
    var e = root.effects[name]
    if (!e) {
      e = effectComp.createObject(root, { source: Qt.resolvedUrl("../sounds/" + name + ".wav") })
      root.effects[name] = e
    }
    return e
  }

  // minGap: drop the sound if the same one played less than this many ms ago.
  function play(name, minGap) {
    if (root.muted) return
    var i = root.names.indexOf(name)
    if (i < 0) return
    var gap = minGap === undefined ? (root.gaps[name] || 0) : minGap
    var now = Date.now()
    if (now - (root.lastPlayed[name] || 0) < gap) return
    root.lastPlayed[name] = now
    var e = root.effect(name)
    if (!e) return
    if (root.noRestart[name] && e.playing) return
    e.play()
  }

  function scored() {
    var now = Date.now()
    root.scoreTimes = root.scoreTimes.filter(function(t) { return now - t < 2000 }).concat([now])
    if (root.scoreTimes.length <= 5) play("score", 90)
  }

  function roundOver(title, newBest) {
    if (newBest) play("best")
    else if (/^(YOU WIN|SOLVED|CLEARED|CONNECTED|PERFECT|WON|TOPPED|OUT OF THE JUNGLE|GOT IT)/i.test(title || "")) play("win")
    else play("lose")
  }
}
