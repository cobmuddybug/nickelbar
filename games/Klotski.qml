import QtQuick
import Quickshell.Io
import "../engine" as Engine
import "logic/klotski.js" as Klotski

// Klotski, after GNOME Klotski (see logic/klotski.js). Levels are sorted
// easiest first; the par is the shortest solution. Score is levels solved.
Engine.GameBase {
  id: root
  gameId: "klotski"
  title: "KLOTSKI"
  helpText: "Get the big block to the bottom middle (the gap in the frame) · ARROWS move the cursor · SPACE grab a block, then ARROWS slide it, SPACE to let go · < > previous / next level · U undo"
  mouseHelp: "Drag a block to slide it, a square at a time"

  property var levels: []
  property var state: null
  property var solved: ({})       // level index -> best move count
  property var pendingSave: null
  property bool hasPendingSave: false

  score: Object.keys(solved).length
  progress: levels.length && score ? score + "/" + levels.length + " levels" : ""
  overTitle: state ? (state.moves <= state.min ? "PERFECT · " : "SOLVED · ") + state.moves + " MOVES (PAR " + state.min + ")" : ""
  status: !levels.length ? "LOADING LEVELS…"
    : !state ? ""
    : over ? "SOLVED  ·  SPACE for the next level"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + (state.grabbed ? "SLIDING  ·  " : "")
      + "LEVEL " + (state.idx + 1) + "/" + levels.length + (levels[state.idx].name ? " (" + levels[state.idx].name + ")" : "")
      + "  ·  " + state.moves + " moves  ·  par " + state.min + (solved[state.idx] ? "  ·  best " + solved[state.idx] : "")

  onStateChanged: {
    if (!state || !state.done || over) return
    var next = {}
    for (var k in solved) next[k] = solved[k]
    if (!next[state.idx] || state.moves < next[state.idx]) next[state.idx] = state.moves
    solved = next
    over = true
  }

  FileView {
    path: String(Qt.resolvedUrl("data/klotski.json")).replace(/^file:\/\//, "")
    printErrors: true
    onLoaded: {
      try { root.levels = JSON.parse(text()).levels } catch (e) { root.levels = [] }
      if (root.hasPendingSave) { root.hasPendingSave = false; root.loadState(root.pendingSave); root.pendingSave = null }
      else if (!root.state) root.newGame()
    }
  }

  function open(i) {
    over = false
    paused = false
    state = Klotski.makeState(levels[i], i)
  }

  // The first unsolved level after the current one (or the next, if
  // they're all done).
  function newGame() {
    if (!levels.length) return
    var start = state ? state.idx + 1 : 0
    for (var k = 0; k < levels.length; ++k) {
      var i = (start + k) % levels.length
      if (!solved[i]) { open(i); return }
    }
    open(start % levels.length)
  }

  function moveCursor(dx, dy) { if (state && !over) state = Klotski.moveCursor(state, dx, dy) }
  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Klotski.activate(state)
  }
  function undo() { if (state) state = Klotski.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    if (text === ">" || text === "<") { open((state.idx + (text === ">" ? 1 : -1) + levels.length) % levels.length); return true }
    return false
  }

  function saveState() {
    if (!levels.length) return pendingSave
    return { solved: solved, current: state && !over ? Klotski.serialize(state) : null, idx: state ? state.idx : 0 }
  }

  function loadState(saved) {
    if (!levels.length) { pendingSave = saved; hasPendingSave = true; return }
    if (saved && saved.solved) solved = saved.solved
    var cur = saved && saved.current
    if (cur && cur.idx >= 0 && cur.idx < levels.length && typeof cur.layout === "string" && cur.layout.length === 20) {
      var s = Klotski.makeState(levels[cur.idx], cur.idx)
      s.layout = cur.layout; s.moves = cur.moves || 0
      over = false; paused = false
      state = s
    } else {
      state = saved && saved.idx >= 0 && saved.idx < levels.length ? Klotski.makeState(levels[saved.idx], saved.idx) : null
      newGame()
    }
  }

  // Mouse (engine/Pointer.qml): drag a block to slide it, a square at a time.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var c = board.cell, o = c * 0.3, cx = Math.floor((x - o) / c), cy = Math.floor((y - o) / c)
    if (kind === "press" && b === Qt.LeftButton) {
      if (cx < 0 || cy < 0 || cx >= Klotski.W || cy >= Klotski.H) return
      if (state.grabbed) state = Klotski.activate(state)
      state = Klotski.moveCursor(state, cx - state.cursor.x, cy - state.cursor.y)
      state = Klotski.activate(state)
      dragFrom = { x: cx, y: cy }
      return
    }
    if (kind === "drag" && state.grabbed && dragFrom) {
      // Step toward the pointer along whichever axis it has moved further.
      var dx = cx - dragFrom.x, dy = cy - dragFrom.y
      if (!dx && !dy) return
      var sx = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0, sy = sx ? 0 : Math.sign(dy)
      var moved = Klotski.moveCursor(state, sx, sy)
      if (moved.layout !== state.layout) { state = moved; dragFrom = { x: dragFrom.x + sx, y: dragFrom.y + sy } }
      else if (sx && dy) {
        var alt = Klotski.moveCursor(state, 0, Math.sign(dy))
        if (alt.layout !== state.layout) { state = alt; dragFrom = { x: dragFrom.x, y: dragFrom.y + Math.sign(dy) } }
      }
      return
    }
    if (kind === "release" && state.grabbed) { state = Klotski.activate(state); dragFrom = null }
  }
  property var dragFrom: null

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / (Klotski.W + 0.6), parent.height / (Klotski.H + 0.6)))
    width: cell * (Klotski.W + 0.6)
    height: cell * (Klotski.H + 0.6)

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, c = cell, o = c * 0.3
      // Frame with the exit gap at the bottom middle.
      ctx.strokeStyle = theme.dim; ctx.lineWidth = Math.max(3, c * 0.08)
      ctx.beginPath()
      ctx.moveTo(o + c, o + Klotski.H * c); ctx.lineTo(o, o + Klotski.H * c); ctx.lineTo(o, o); ctx.lineTo(o + Klotski.W * c, o)
      ctx.lineTo(o + Klotski.W * c, o + Klotski.H * c); ctx.lineTo(o + 3 * c, o + Klotski.H * c)
      ctx.stroke()
      ctx.strokeStyle = theme.withAlpha(theme.accent, 0.5); ctx.lineWidth = 2
      ctx.strokeRect(o + Klotski.GOAL.x * c + 3, o + Klotski.GOAL.y * c + 3, 2 * c - 6, 2 * c - 6)

      var ps = Klotski.pieces(s.layout), big = Klotski.bigId(s.layout)
      for (var id in ps) {
        var p = ps[id], pad = Math.max(2, c * 0.05)
        var kind = id === big ? 0 : p.w === 2 ? 1 : p.h === 2 ? 2 : 3
        ctx.fillStyle = id === big ? theme.accent : theme.tone(kind + 1)
        ctx.globalAlpha = s.grabbed && s.grabbed !== id ? 0.6 : 1
        ctx.fillRect(o + p.x * c + pad, o + p.y * c + pad, p.w * c - pad * 2, p.h * c - pad * 2)
        ctx.globalAlpha = 1
        if (s.grabbed === id) {
          ctx.strokeStyle = theme.foreground; ctx.lineWidth = 3
          ctx.strokeRect(o + p.x * c + pad + 1.5, o + p.y * c + pad + 1.5, p.w * c - pad * 2 - 3, p.h * c - pad * 2 - 3)
        }
      }
      if (!root.over && !s.grabbed) {
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(o + s.cursor.x * c + c / 2, o + s.cursor.y * c + c / 2, c * 0.15, 0, Math.PI * 2); ctx.stroke()
      }
      if (root.paused) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = 0.85
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }
}
