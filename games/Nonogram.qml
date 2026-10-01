import QtQuick
import "../engine" as Engine
import "logic/nonogram.js" as Nonogram

// Keyboard picross. X marks a cell "definitely empty" (U does too, for
// IPC); satisfied clues dim so progress is visible without spoilers.
Engine.GameBase {
  id: root
  gameId: "nonogram"
  title: "NONOGRAM"
  helpText: "ARROWS move · SPACE/ENTER fill/clear · X or U mark empty · clues dim once their line matches"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT crosses"

  property var state: null
  score: state ? Nonogram.computeScore(state) : 0
  status: !state ? ""
    : (over ? "SOLVED  ·  N for a new game"
      : (paused ? "PAUSED" : Nonogram.filledCount(state) + "/" + Nonogram.totalSolutionFilled(state) + " filled"))
  overTitle: "SOLVED"

  function handleKey(key, text) {
    if (text === "x" || text === "X") { undo(); return true }
    return false
  }

  onStateChanged: if (state && state.solved) over = true

  function newGame() {
    state = Nonogram.makeState(10)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Nonogram.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = Nonogram.toggleFill(state)
  }

  function undo() {
    if (over || !state) return
    state = Nonogram.toggleMark(state)
  }

  function saveState() {
    if (!state || over) return null
    return Nonogram.serialize(state)
  }

  function loadState(saved) {
    var restored = Nonogram.deserialize(saved)
    if (restored) { state = restored; over = !!restored.solved }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does, RIGHT crosses.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (board.width - board.nonoCell() * state.size)) / (board.nonoCell())), cy = Math.floor((y - (board.height - board.nonoCell() * state.size)) / (board.nonoCell()))
    if (cx < 0 || cy < 0 || cx >= state.size || cy >= state.size) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { undo(); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    // Cell size, as onPaint lays it out (clue margin off the shorter side).
    function nonoCell() {
      if (!root.state) return 1
      var margin = Math.min(width, height) * 0.28
      return Math.max(1, Math.floor(Math.min((width - margin) / root.state.size, (height - margin) / root.state.size)))
    }

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
      var size = s.size

      // Reserve a margin for clues, sized off the shorter side, then fit
      // the grid into what's left.
      var shortSide = Math.min(width, height)
      var margin = shortSide * 0.28
      var availW = width - margin
      var availH = height - margin
      var c = Math.floor(Math.min(availW / size, availH / size))
      if (c <= 0) return
      var gridSize = c * size
      var originX = width - gridSize
      var originY = height - gridSize

      // Cursor row/column band, so the matching clues are easy to find.
      ctx.fillStyle = theme.faint
      ctx.globalAlpha = 0.45
      ctx.fillRect(0, originY + s.cursor.y * c, width, c)
      ctx.fillRect(originX + s.cursor.x * c, 0, c, height)
      ctx.globalAlpha = 1.0

      // Grid lines, with a heavier line every 5 cells for readability.
      ctx.lineWidth = 1
      for (var gx = 0; gx <= size; ++gx) {
        ctx.strokeStyle = (gx % 5 === 0) ? theme.border : theme.faint
        ctx.beginPath(); ctx.moveTo(originX + gx * c, originY); ctx.lineTo(originX + gx * c, originY + gridSize); ctx.stroke()
      }
      for (var gy = 0; gy <= size; ++gy) {
        ctx.strokeStyle = (gy % 5 === 0) ? theme.border : theme.faint
        ctx.beginPath(); ctx.moveTo(originX, originY + gy * c); ctx.lineTo(originX + gridSize, originY + gy * c); ctx.stroke()
      }

      // Cells.
      for (var y = 0; y < size; ++y) {
        for (var x = 0; x < size; ++x) {
          var v = s.player[y][x]
          var px = originX + x * c, py = originY + y * c
          if (v === 1) { // filled
            ctx.fillStyle = theme.foreground
            ctx.fillRect(px + 1, py + 1, c - 2, c - 2)
          } else if (v === 2) { // marked-empty
            ctx.strokeStyle = theme.dim
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(px + c * 0.28, py + c * 0.28); ctx.lineTo(px + c * 0.72, py + c * 0.72)
            ctx.moveTo(px + c * 0.72, py + c * 0.28); ctx.lineTo(px + c * 0.28, py + c * 0.72)
            ctx.stroke()
          }
        }
      }

      // Row clues, right-aligned into the left margin.
      var fontSize = Math.max(8, Math.floor(c * 0.48))
      ctx.font = fontSize + "px " + theme.fontFamily
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      for (y = 0; y < size; ++y) {
        ctx.fillStyle = Nonogram.rowSatisfied(s, y) ? theme.dim : theme.foreground
        ctx.fillText(s.rowClues[y].join(" "), originX - 4, originY + y * c + c / 2)
      }

      // Column clues, stacked bottom-up into the top margin.
      ctx.textAlign = "center"
      var lineHeight = Math.max(fontSize, c * 0.42)
      for (x = 0; x < size; ++x) {
        ctx.fillStyle = Nonogram.colSatisfied(s, x) ? theme.dim : theme.foreground
        var clue = s.colClues[x]
        var cx = originX + x * c + c / 2
        for (var j = 0; j < clue.length; ++j) {
          var fromBottom = clue.length - 1 - j
          var cy = originY - fromBottom * lineHeight - lineHeight / 2
          ctx.fillText(String(clue[j]), cx, cy)
        }
      }

      // Cursor.
      ctx.strokeStyle = theme.highlight
      ctx.lineWidth = 2
      ctx.strokeRect(originX + s.cursor.x * c + 1, originY + s.cursor.y * c + 1, c - 2, c - 2)

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
