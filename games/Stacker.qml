import QtQuick
import "../engine" as Engine
import "logic/stacker.js" as Stacker

// Arcade Stacker (not to be confused with Blockfall, the falling-piece
// game whose id is still "stack"). SPACE stops the sliding row.
Engine.GameBase {
  id: root
  gameId: "stacker"
  title: "STACKER"
  helpText: "SPACE/ENTER stop the sliding row · overhanging blocks fall off · reach the top row to win · rows speed up as you climb"
  mouseHelp: "Click stops the row"

  property var state: null
  tickInterval: 16
  ticking: !!state && state.alive && !state.won && !over
  score: state ? state.score : 0
  overTitle: state && state.won ? "TOPPED OUT!" : "ROW " + (state ? state.row : 0) + " OF " + Stacker.ROWS
  status: !state ? ""
    : (over ? (state.won ? "TOPPED OUT" : "MISSED") + "  ·  N or SPACE to play again"
      : (paused ? "PAUSED" : "ROW " + (state.row + 1) + "/" + Stacker.ROWS + "  ·  " + state.current.width + " wide"))

  onTick: state = Stacker.step(state, tickInterval / 1000)

  // Keep animating falling blocks briefly after the game ends.
  Timer {
    interval: 16
    repeat: true
    running: root.over && !!root.state && root.state.falling.length > 0
    onTriggered: root.state = Stacker.settle(root.state, 0.016)
  }

  function newGame() {
    state = Stacker.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {}

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = Stacker.stop(state)
    if (!state.alive || state.won) over = true
  }

  // Mouse (engine/Pointer.qml): click stops the row.
  function pointer(kind, x, y, b) {
    if (kind === "press" && b === Qt.LeftButton) { activate() }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Stacker.COLS, parent.height / Stacker.ROWS))
    width: cell * Stacker.COLS
    height: cell * Stacker.ROWS

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
      var s = root.state, c = cell, R = Stacker.ROWS

      // Cabinet grid, with prize lines at rows 5 and 10.
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.08)
      ctx.lineWidth = 1
      for (var gx = 0; gx <= Stacker.COLS; ++gx) { ctx.beginPath(); ctx.moveTo(gx * c + 0.5, 0); ctx.lineTo(gx * c + 0.5, height); ctx.stroke() }
      for (var gy = 0; gy <= R; ++gy) { ctx.beginPath(); ctx.moveTo(0, gy * c + 0.5); ctx.lineTo(width, gy * c + 0.5); ctx.stroke() }
      ctx.strokeStyle = theme.withAlpha(theme.accent, 0.6)
      ctx.setLineDash([4, 4])
      var marks = [5, 10, R]
      for (var m = 0; m < marks.length; ++m) {
        var my = (R - marks[m]) * c + 0.5
        ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(width, my); ctx.stroke()
      }
      ctx.setLineDash([])

      function block(x, rowFromBottom, color) {
        ctx.fillStyle = color
        ctx.fillRect(x * c + 2, (R - 1 - rowFromBottom) * c + 2, c - 4, c - 4)
      }

      for (var r = 0; r < s.rows.length; ++r) {
        var row = s.rows[r]
        for (var x = row.left; x < row.left + row.width; ++x) block(x, r, theme.tone(Math.floor(r / 5)))
      }
      if (s.alive && !s.won) {
        var cur = s.current
        for (var cx = cur.left; cx < cur.left + cur.width; ++cx) block(cx, s.row, theme.foreground)
      }
      ctx.fillStyle = theme.danger
      for (var f = 0; f < s.falling.length; ++f) {
        var fb = s.falling[f]
        ctx.fillRect(fb.x * c + 2, fb.y * c + 2, c - 4, c - 4)
      }

      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
