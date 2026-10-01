import QtQuick
import qs.Commons
import "../engine" as Engine
import "logic/stack.js" as Stack

// Blockfall: the falling-block line clearer (id "stack" for save
// compatibility; titled Blockfall so it isn't confused with Stacker).
// Hold is C (and U, since there's nothing to undo in an arcade game);
// X/Z rotate either way alongside UP.
Engine.GameBase {
  id: root
  gameId: "stack"
  title: "BLOCKFALL"
  helpText: "ARROWS move · UP or X rotate · Z rotate back · DOWN soft drop · SPACE hard drop · C or U hold"
  mouseHelp: "The piece follows the pointer's column; click drops it, right-click or the wheel rotates"

  property var state: null
  tickInterval: state ? Stack.speedForLevel(state.level) : 800
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  status: !state ? ""
    : (over ? "GAME OVER  ·  N for a new game"
      : (paused ? "PAUSED" : "LINES " + state.lines + "  ·  LV " + (state.level + 1)))

  overTitle: state ? state.lines + " LINES · " + state.score + " pts" : ""

  // A cleared line pops (the overlay's score chime covers the rest).
  property int _lines: -1
  onStateChanged: {
    if (!state) return
    if (_lines >= 0 && state.lines > _lines) sound("pop")
    _lines = state.lines
  }

  onTick: {
    state = Stack.gravity(state)
    if (!state.alive) over = true
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (text === "x" || text === "X") { state = Stack.rotate(state, 1); return true }
    if (text === "z" || text === "Z") { state = Stack.rotate(state, -1); return true }
    if (text === "c" || text === "C") { undo(); return true }
    return false
  }

  function newGame() {
    state = Stack.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    if (dy < 0) { state = Stack.rotate(state, 1); return }
    if (dx !== 0) { state = Stack.move(state, dx, 0); return }
    if (dy > 0) state = Stack.softDrop(state)
    if (!state.alive) over = true
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = Stack.hardDrop(state)
    if (!state.alive) over = true
  }

  function undo() {
    if (over || !state) return
    state = Stack.hold(state)
  }

  function saveState() {
    if (!state || over) return null
    return Stack.serialize(state)
  }

  function loadState(saved) {
    var restored = Stack.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the piece follows the pointer's column;
  // click drops it, right-click or the wheel rotates.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "wheel") { state = Stack.rotate(state, b > 0 ? 1 : -1); return }
    if (kind === "press" && b === Qt.RightButton) { state = Stack.rotate(state, 1); return }
    if (kind === "move" || kind === "drag") {
      // Line the piece's middle up with the pointer, a step at a time.
      var cells = Stack.cellsFor(state.current.type, state.current.rot), lo = 9, hi = 0
      for (var i = 0; i < cells.length; ++i) { lo = Math.min(lo, cells[i].x); hi = Math.max(hi, cells[i].x) }
      var target = Math.floor(x / board.cellSize) - Math.floor((lo + hi) / 2)
      for (var guard = 0; guard < 12 && state.current.x !== target; ++guard) {
        var n = Stack.move(state, state.current.x < target ? 1 : -1, 0)
        if (n.current.x === state.current.x) break
        state = n
      }
      return
    }
    if (kind === "press" && b === Qt.LeftButton) activate()
  }

  Engine.Theme { id: theme }

  // Seven piece types over six hue tones plus the theme's danger colour,
  // so every tetromino reads as its own colour whatever the theme.
  function pieceColor(typeIndex, alpha) {
    var c = typeIndex === 7 ? theme.danger : theme.tone(typeIndex - 1)
    return Qt.rgba(c.r, c.g, c.b, alpha === undefined ? 0.92 : alpha)
  }

  function drawMiniPiece(ctx, w, h, type) {
    ctx.clearRect(0, 0, w, h)
    if (!type) return
    var cells = Stack.cellsFor(type, 0)
    var maxX = 0, maxY = 0
    for (var i = 0; i < cells.length; ++i) { maxX = Math.max(maxX, cells[i].x); maxY = Math.max(maxY, cells[i].y) }
    var cell = Math.min(w / (maxX + 1), h / (maxY + 1)) * 0.82
    var offX = (w - (maxX + 1) * cell) / 2
    var offY = (h - (maxY + 1) * cell) / 2
    ctx.fillStyle = pieceColor(Stack.TYPES.indexOf(type) + 1, 0.9)
    for (i = 0; i < cells.length; ++i)
      ctx.fillRect(offX + cells[i].x * cell + 1, offY + cells[i].y * cell + 1, cell - 2, cell - 2)
  }

  Row {
    anchors.fill: parent
    spacing: Style.spacing.md

    Item {
      id: boardArea
      width: parent.width - sidebar.width - Style.spacing.md
      height: parent.height

      Canvas {
        id: board
        Engine.Pointer { game: root }
        anchors.centerIn: parent
        readonly property real cellSize: Math.floor(Math.min(boardArea.width / Stack.COLS, boardArea.height / Stack.ROWS))
        width: cellSize * Stack.COLS
        height: cellSize * Stack.ROWS

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
          var c = board.cellSize

          ctx.strokeStyle = theme.faint
          ctx.lineWidth = 1
          for (var gx = 0; gx <= Stack.COLS; ++gx) { ctx.beginPath(); ctx.moveTo(gx * c, 0); ctx.lineTo(gx * c, Stack.ROWS * c); ctx.stroke() }
          for (var gy = 0; gy <= Stack.ROWS; ++gy) { ctx.beginPath(); ctx.moveTo(0, gy * c); ctx.lineTo(Stack.COLS * c, gy * c); ctx.stroke() }

          for (var r = 0; r < Stack.ROWS; ++r) {
            for (var col = 0; col < Stack.COLS; ++col) {
              var v = s.board[r][col]
              if (v === 0) continue
              ctx.fillStyle = root.pieceColor(v)
              ctx.fillRect(col * c + 1, r * c + 1, c - 2, c - 2)
            }
          }

          var ghostRow = Stack.ghostY(s)
          var ghostCells = Stack.cellsFor(s.current.type, s.current.rot)
          ctx.strokeStyle = root.pieceColor(Stack.TYPES.indexOf(s.current.type) + 1, 0.55)
          ctx.lineWidth = 2
          var i
          for (i = 0; i < ghostCells.length; ++i) {
            var gx2 = (s.current.x + ghostCells[i].x) * c, gy2 = (ghostRow + ghostCells[i].y) * c
            ctx.strokeRect(gx2 + 2, gy2 + 2, c - 4, c - 4)
          }

          ctx.fillStyle = root.pieceColor(Stack.TYPES.indexOf(s.current.type) + 1)
          for (i = 0; i < ghostCells.length; ++i) {
            var px = (s.current.x + ghostCells[i].x) * c, py = (s.current.y + ghostCells[i].y) * c
            if (py >= 0) ctx.fillRect(px + 1, py + 1, c - 2, c - 2)
          }

          if (root.paused || root.over) {
            ctx.fillStyle = theme.background
            ctx.globalAlpha = root.paused ? 0.7 : 0.35
            ctx.fillRect(0, 0, width, height)
            ctx.globalAlpha = 1.0
          }
        }
      }
    }

    Column {
      id: sidebar
      width: Style.space(96)
      height: parent.height
      spacing: Style.spacing.lg

      Column {
        width: parent.width
        spacing: Style.spacing.xs
        Text { text: "NEXT"; color: theme.dim; font.family: theme.fontFamily; font.pixelSize: Style.font.caption; font.bold: true }
        Canvas {
          id: nextCanvas
          width: parent.width; height: parent.width
          Connections { target: root; function onStateChanged() { nextCanvas.requestPaint() } }
          onPaint: { var ctx = getContext("2d"); root.drawMiniPiece(ctx, width, height, root.state ? root.state.next : null) }
        }
      }

      Column {
        width: parent.width
        spacing: Style.spacing.xs
        Text { text: "HOLD"; color: theme.dim; font.family: theme.fontFamily; font.pixelSize: Style.font.caption; font.bold: true }
        Canvas {
          id: holdCanvas
          width: parent.width; height: parent.width
          opacity: root.state && root.state.holdUsed ? 0.5 : 1.0
          Connections { target: root; function onStateChanged() { holdCanvas.requestPaint() } }
          onPaint: { var ctx = getContext("2d"); root.drawMiniPiece(ctx, width, height, root.state ? root.state.hold : null) }
        }
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
