import QtQuick
import "Rng.js" as Rng
import Quickshell.Io

// One of the prebuilt puzzle packs in games/data/tatham/ (made by
// dev/tools/tatham/build.js): { sizes: [{ name, puzzles: [...] }] }.
// `ready` flips once it's parsed; games hold any save until then.
Item {
  id: root

  property string name: ""
  property var sizes: []
  readonly property bool ready: sizes.length > 0
  signal loaded()

  FileView {
    path: root.name ? String(Qt.resolvedUrl("../games/data/tatham/" + root.name + ".json")).replace(/^file:\/\//, "") : ""
    printErrors: true
    onLoaded: {
      try { root.sizes = JSON.parse(text()).sizes } catch (e) { root.sizes = [] }
      if (root.ready) root.loaded()
    }
  }

  // A random puzzle index in size `s`, preferring ones not in `solved`
  // (an array of indices); once they're all done, any of them.
  function pick(s, solved) {
    var n = sizes[s].puzzles.length, done = {}
    for (var i = 0; i < (solved || []).length; ++i) done[solved[i]] = true
    var open = []
    for (var j = 0; j < n; ++j) if (!done[j]) open.push(j)
    var from = open.length ? open : Array.from({ length: n }, function(_, k) { return k })
    return from[Math.floor(Rng.random() * from.length)]
  }

  function puzzle(s, i) { return sizes[s].puzzles[i] }
}
