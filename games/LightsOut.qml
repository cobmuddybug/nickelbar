import QtQuick
import "../engine" as Engine
import "logic/lightsout.js" as LightsOut

// 5x5 Lights Out, with a full undo history (a toggle is its own inverse).
Engine.GameBase {
  id: root
  gameId: "lightsout"
  title: "SWITCH OFF"
  helpText: "ARROWS move · SPACE/ENTER toggle light + neighbours · U undo · fewer moves scores higher"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does"

  property var state: null
  score: state ? (state.won ? Math.max(0, 100 - state.moves * 3) : 0) : 0
  status: !state ? ""
    : (over ? ("SOLVED in " + state.moves + " moves  ·  N for a new game")
      : (paused ? "PAUSED" : state.moves + " moves  ·  " + LightsOut.litCount(state) + " lit"))
  overTitle: state ? "SOLVED IN " + state.moves : ""

  onStateChanged: if (state && state.won) over = true

  function newGame() {
    state = LightsOut.makeState(5)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = LightsOut.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = LightsOut.toggleAtCursor(state)
  }

  function undo() {
    if (over || !state) return
    state = LightsOut.undo(state)
  }

  function saveState() {
    if (!state || over) return null
    return LightsOut.serialize(state)
  }

  function loadState(saved) {
    var restored = LightsOut.deserialize(saved)
    if (restored) { state = restored; over = restored.won }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= state.size || cy >= state.size) return
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
    readonly property real cell: Math.floor(Math.min(parent.width / (root.state ? root.state.size : 5), parent.height / (root.state ? root.state.size : 5)))
    width: cell * (root.state ? root.state.size : 5)
    height: cell * (root.state ? root.state.size : 5)

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

      for (var y = 0; y < s.size; ++y) {
        for (var x = 0; x < s.size; ++x) {
          var lit = s.grid[y][x]
          var px = x * c, py = y * c
          var inset = Math.max(3, c * 0.06)
          ctx.fillStyle = lit ? theme.accent : theme.faint
          ctx.fillRect(px + inset, py + inset, c - inset * 2, c - inset * 2)
          if (lit) {
            // soft glow ring so lit cells read as lamps, not just fills
            ctx.strokeStyle = theme.withAlpha(theme.accent, 0.35)
            ctx.lineWidth = inset
            ctx.strokeRect(px + inset / 2, py + inset / 2, c - inset, c - inset)
          }

        }
      }

      // Cursor plus a faint preview of the cross it will flip.
      var cx0 = s.cursor.x, cy0 = s.cursor.y
      var cross = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
      ctx.strokeStyle = theme.dim
      ctx.lineWidth = 1
      for (var k = 1; k < cross.length; ++k) {
        var qx = cx0 + cross[k][0], qy = cy0 + cross[k][1]
        if (qx < 0 || qy < 0 || qx >= s.size || qy >= s.size) continue
        ctx.strokeRect(qx * c + 2.5, qy * c + 2.5, c - 5, c - 5)
      }
      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = 2
      ctx.strokeRect(cx0 * c + 1, cy0 * c + 1, c - 2, c - 2)

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
