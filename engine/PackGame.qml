import QtQuick

// Base for the puzzles that play from a prebuilt pack (engine/PuzzlePack.qml):
// picks unsolved puzzles, cycles sizes with S, remembers which ones are
// solved, and holds a save until the pack has loaded. Score is the number
// solved across every size.
//
// A game sets packName and overrides the three hooks below; its logic
// state goes in `state`, and a truthy state.solved ends the round.
GameBase {
  id: root

  property string packName: ""
  property var state: null
  property int size: 0
  property var solved: ({})          // size index -> [puzzle indices]
  property var pendingSave: null
  property bool hasPendingSave: false
  readonly property alias pack: packItem
  readonly property string sizeName: pack.ready && state ? pack.sizes[state.size].name : ""

  // Hooks.
  function makePuzzleState(p, size, idx) { return null }
  function restorePuzzleState(saved, p) { return null }
  function serializePuzzleState(s) { return null }

  score: { var n = 0; for (var k in solved) n += solved[k].length; return n }
  overTitle: "SOLVED"
  progress: score ? score + " solved" : ""

  onStateChanged: {
    if (!state || !state.solved || over) return
    var next = {}
    for (var k in solved) next[k] = solved[k]
    var list = (next[state.size] || []).slice()
    if (list.indexOf(state.idx) < 0) list.push(state.idx)
    next[state.size] = list
    solved = next
    over = true
  }

  PuzzlePack {
    id: packItem
    name: root.packName
    onLoaded: {
      if (root.hasPendingSave) { root.hasPendingSave = false; root.loadState(root.pendingSave); root.pendingSave = null }
      else if (!root.state) root.newGame()
    }
  }

  function newGame() {
    if (!pack.ready) return
    var idx = pack.pick(size, solved[size])
    over = false
    paused = false
    state = root.makePuzzleState(pack.puzzle(size, idx), size, idx)
  }

  function nextSize() {
    if (!pack.ready) return
    size = (size + 1) % pack.sizes.length
    newGame()
  }

  function saveState() {
    if (!pack.ready) return pendingSave
    return { size: size, solved: solved, current: state && !over ? root.serializePuzzleState(state) : null }
  }

  function loadState(saved) {
    if (!pack.ready) { pendingSave = saved; hasPendingSave = true; return }
    if (saved && saved.solved) solved = saved.solved
    if (saved && saved.size >= 0 && saved.size < pack.sizes.length) size = saved.size
    var cur = saved && saved.current
    var p = cur && cur.size >= 0 && cur.size < pack.sizes.length && cur.idx >= 0 && cur.idx < pack.sizes[cur.size].puzzles.length
      ? pack.puzzle(cur.size, cur.idx) : null
    var r = p ? root.restorePuzzleState(cur, p) : null
    if (r && !r.solved) { over = false; paused = false; state = r }
    else newGame()
  }
}
