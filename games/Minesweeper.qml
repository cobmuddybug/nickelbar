import QtQuick
import "../engine" as Engine
import "logic/minesweeper.js" as Minesweeper

// Keyboard minesweeper. Flagging has no key of its own in the shared
// keymap, so it rides `undo` (U) — same idea as Stack riding U for hold.
Engine.GameBase {
  id: root
  gameId: "minesweeper"
  title: "MINESWEEPER"
  helpText: "ARROWS move · SPACE/ENTER reveal (chords when satisfied) · F or U flag · first reveal is always safe"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT flags"

  readonly property int cols: 14
  readonly property int rows: 10
  readonly property int mineCount: 22

  property var state: null
  score: state ? state.revealed : 0
  status: !state ? ""
    : (over ? (state.won ? "CLEARED  ·  N for a new game" : "BOOM  ·  N for a new game")
      : (paused ? "PAUSED" : state.revealed + " revealed  ·  " + Math.max(0, state.mines - state.flags) + " flags left"))

  overTitle: state && state.won ? "CLEARED" : "BOOM"

  onStateChanged: if (state && (state.won || !state.alive)) over = true

  function handleKey(key, text) {
    if (text === "f" || text === "F") { undo(); return true }
    return false
  }

  function newGame() {
    state = Minesweeper.makeState(cols, rows, mineCount)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Minesweeper.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = Minesweeper.activateCursor(state)
  }

  function undo() {
    if (over || !state) return
    state = Minesweeper.flagCursor(state)
  }

  function saveState() {
    if (!state || over) return null
    return Minesweeper.serialize(state)
  }

  function loadState(saved) {
    var restored = Minesweeper.deserialize(saved)
    if (restored) { state = restored; over = !restored.alive || restored.won }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does, RIGHT flags.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= root.cols || cy >= root.rows) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { undo(); return }
    activate()
  }

  Engine.Theme { id: theme }

  readonly property var numberColors: [theme.dim, theme.tone(0), theme.tone(1), theme.danger, theme.tone(3), theme.tone(4), theme.tone(5), theme.foreground, theme.foreground]

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / root.cols, parent.height / root.rows))
    width: cell * root.cols
    height: cell * root.rows

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
      var s = root.state
      var c = board.cell
      if (c <= 0) return

      for (var y = 0; y < s.rows; ++y) {
        for (var x = 0; x < s.cols; ++x) {
          var cell = s.board[y][x]
          var px = x * c, py = y * c

          // Hidden cells are raised tiles; revealed ones sink to a faint
          // well, so the open area reads at a glance.
          if (cell.revealed) {
            ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
            ctx.fillRect(px + 1, py + 1, c - 2, c - 2)
          } else {
            ctx.fillStyle = theme.withAlpha(theme.foreground, 0.24)
            ctx.fillRect(px + 1, py + 1, c - 2, c - 2)
            ctx.fillStyle = theme.withAlpha(theme.foreground, 0.1)
            ctx.fillRect(px + 1, py + 1, c - 2, Math.max(2, c * 0.1))
          }

          if (cell.revealed && cell.mine) {
            if (s.boom && s.boom.x === x && s.boom.y === y) {
              ctx.fillStyle = theme.danger
              ctx.globalAlpha = 0.35
              ctx.fillRect(px + 1, py + 1, c - 2, c - 2)
              ctx.globalAlpha = 1.0
            }
            ctx.fillStyle = theme.danger
            ctx.beginPath()
            ctx.arc(px + c / 2, py + c / 2, c * 0.28, 0, Math.PI * 2)
            ctx.fill()
          } else if (cell.revealed && cell.adjacent > 0) {
            ctx.fillStyle = root.numberColors[Math.min(cell.adjacent, root.numberColors.length - 1)]
            ctx.font = Math.floor(c * 0.55) + "px " + theme.fontFamily
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText(String(cell.adjacent), px + c / 2, py + c / 2 + 1)
          } else if (!cell.revealed && cell.flagged) {
            // A flag on a safe square after a loss gets struck through, so
            // the final board shows exactly where the reasoning went wrong.
            if (!s.alive && !cell.mine) {
              ctx.strokeStyle = theme.danger
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(px + c * 0.22, py + c * 0.22); ctx.lineTo(px + c * 0.78, py + c * 0.78)
              ctx.moveTo(px + c * 0.78, py + c * 0.22); ctx.lineTo(px + c * 0.22, py + c * 0.78)
              ctx.stroke()
            }
            ctx.fillStyle = theme.accent
            ctx.beginPath()
            ctx.moveTo(px + c * 0.36, py + c * 0.22)
            ctx.lineTo(px + c * 0.36, py + c * 0.78)
            ctx.lineTo(px + c * 0.68, py + c * 0.5)
            ctx.closePath()
            ctx.fill()
          }
        }
      }

      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = 2
      ctx.strokeRect(s.cursor.x * c + 1, s.cursor.y * c + 1, c - 2, c - 2)

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
