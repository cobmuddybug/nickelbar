import QtQuick
import "../engine" as Engine
import "logic/twentyfortyeight.js" as T2048

// Classic 4x4 2048. Unlike Minesweeper's per-cell cursor, moveCursor here
// means "slide the whole board" — the shared keymap only ever sends one
// nonzero axis at a time, so diagonals never arise. Undo rides U for a
// genuine single-level undo, the well-known 2048 feature and this game's
// own use of the spare key (Minesweeper flags, Stack holds, this undoes).
Engine.GameBase {
  id: root
  gameId: "2048"
  title: "2048"
  helpText: "ARROWS slide · U undo last move (works after game over too) · SPACE/ENTER restart when over"
  mouseHelp: "Swipe (drag and let go) to slide"

  property var state: null
  score: state ? state.score : 0
  status: !state ? ""
    : (over ? "GAME OVER  ·  N for a new game"
      : (paused ? "PAUSED" : (T2048.maxTile(state.board) >= 2048 ? "2048!  ·  " : "") + "SCORE " + state.score))

  overTitle: state ? "BEST TILE " + T2048.maxTile(state.board) : ""

  onStateChanged: if (state && !T2048.hasMoves(state.board)) over = true

  function newGame() {
    state = T2048.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = T2048.move(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    // 2048 has no natural activate action otherwise.
  }

  // Undo is allowed from the game-over board: one bad slide shouldn't end
  // a long run with no way back. The overlay has already banked the score.
  function undo() {
    if (!state || !state.prev) return
    state = T2048.undo(state)
    over = !T2048.hasMoves(state.board)
  }

  function saveState() {
    if (!state || over) return null
    return T2048.serialize(state)
  }

  function loadState(saved) {
    var restored = T2048.deserialize(saved)
    if (restored) { state = restored; over = !T2048.hasMoves(restored.board) }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): swipe (drag and let go) to slide.
  property var swipeFrom: null
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "press") { swipeFrom = { x: x, y: y }; return }
    if (kind !== "release" || !swipeFrom) return
    var dx = x - swipeFrom.x, dy = y - swipeFrom.y
    swipeFrom = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < board.cell * 0.3) return
    if (Math.abs(dx) > Math.abs(dy)) moveCursor(dx < 0 ? -1 : 1, 0)
    else moveCursor(0, dy < 0 ? -1 : 1)
  }

  Engine.Theme { id: theme }

  // Theme only exposes a handful of roles, so tile shade is derived by
  // scaling accent's alpha with log2(value) — same trick as Stack's palette.
  function tileColor(value) {
    if (value === 0) return theme.faint
    var alpha = Math.min(0.92, 0.16 + Math.log2(value) * 0.09)
    return Qt.rgba(theme.accent.r, theme.accent.g, theme.accent.b, alpha)
  }

  function tileTextColor(value) {
    var alpha = Math.min(0.92, 0.16 + Math.log2(value) * 0.09)
    return alpha > 0.55 ? theme.background : theme.foreground
  }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / 4, parent.height / 4))
    width: cell * 4
    height: cell * 4

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

      for (var y = 0; y < 4; ++y) {
        for (var x = 0; x < 4; ++x) {
          var v = s.board[y][x]
          var px = x * c, py = y * c
          ctx.fillStyle = root.tileColor(v)
          ctx.fillRect(px + 3, py + 3, c - 6, c - 6)
          if (v !== 0) {
            ctx.fillStyle = root.tileTextColor(v)
            ctx.font = "bold " + Math.floor(c * (v >= 1000 ? 0.3 : 0.4)) + "px " + theme.fontFamily
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText(String(v), px + c / 2, py + c / 2 + 1)
          }
        }
      }

      ctx.strokeStyle = theme.border
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, 4 * c, 4 * c)

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
