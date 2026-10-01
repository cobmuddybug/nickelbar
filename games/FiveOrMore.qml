import QtQuick
import "../engine" as Engine
import "logic/fiveormore.js" as Five

// Five or More, after GNOME Five or More (see logic/fiveormore.js).
Engine.GameBase {
  id: root
  gameId: "fiveormore"
  title: "FIVE OR MORE"
  helpText: "Line up five or more balls of a colour (any direction) to clear them · ARROWS move · SPACE pick a ball, then SPACE on an empty square it can reach (no diagonal steps) · every move that clears nothing brings three new balls (shown in NEXT) · a full board ends it · U undo"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does"

  property var state: null
  score: state ? state.score : 0
  overTitle: "BOARD FULL · " + (state ? state.score : 0)
  status: !state ? ""
    : over ? "BOARD FULL  ·  N for a new game"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + (state.sel >= 0 ? "MOVING  ·  " : "")
      + (Five.N * Five.N - Five.emptyCells(state.grid).length) + " balls on the board"

  onStateChanged: over = !!state && state.over

  function newGame() { clearUndo(); state = Five.makeState(); paused = false }
  function undo() { var p = popUndo(); if (p) { state = p; paused = false } }
  function moveCursor(dx, dy) { if (state && !over) state = Five.moveCursor(state, dx, dy) }
  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    var next = Five.activate(state)
    if (next.grid !== state.grid) pushUndo(state)
    state = next
  }
  function saveState() { return state && !over ? Five.serialize(state) : null }
  function loadState(saved) {
    var r = Five.deserialize(saved)
    clearUndo()
    if (r) { state = r; paused = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= Five.N || cy >= Five.N) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) return
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / (Five.N + 1.6), parent.height / Five.N))
    width: cell * (Five.N + 1.6)
    height: cell * Five.N

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    // Seven colours from a six-tone palette: the seventh is the foreground.
    function color(k) { return k === 6 ? theme.foreground : theme.tone(k) }

    function ball(ctx, cx, cy, r, k) {
      ctx.fillStyle = color(k)
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = theme.withAlpha(theme.background, 0.35)
      ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.28, 0, Math.PI * 2); ctx.fill()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, c = cell, N = Five.N
      for (var i = 0; i < N * N; ++i) {
        var x = (i % N) * c, y = Math.floor(i / N) * c
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
        ctx.fillRect(x + 1, y + 1, c - 2, c - 2)
        if (s.grid[i] >= 0) {
          var lift = s.sel === i ? c * 0.06 : 0
          ball(ctx, x + c / 2, y + c / 2 - lift, c * 0.36, s.grid[i])
          if (s.sel === i) {
            ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2
            ctx.beginPath(); ctx.arc(x + c / 2, y + c / 2 - lift, c * 0.42, 0, Math.PI * 2); ctx.stroke()
          }
        }
      }
      if (!root.over) {
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3
        ctx.strokeRect(s.cursor.x * c + 2, s.cursor.y * c + 2, c - 4, c - 4)
      }
      // Next three.
      var nx = (N + 0.8) * c
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(c * 0.28) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("NEXT", nx, c * 0.4)
      for (var k = 0; k < s.next.length; ++k) ball(ctx, nx, c * (1.2 + k * 0.9), c * 0.3, s.next[k])
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.85 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
