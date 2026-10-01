import QtQuick
import "../engine" as Engine
import "logic/sudoku.js" as Sudoku

// Classic 9x9 sudoku with solver-verified unique puzzles. Digits 1-9 type
// straight into the cell (0 / Backspace / Delete clear it); SPACE/ENTER and
// U still dial the value up and down for anyone driving it by IPC.
Engine.GameBase {
  id: root
  gameId: "sudoku"
  title: "SUDOKU"
  helpText: "ARROWS move · 1-9 enter digit · 0/BACKSPACE clear · SPACE/U dial +1/-1"
  mouseHelp: "LEFT selects a cell (again: dial it up), RIGHT clears, the wheel dials the digit"

  readonly property int removeCount: 50
  overTitle: "SOLVED"

  function handleKey(key, text) {
    if (over || !state) return false
    if (text.length === 1 && text >= "1" && text <= "9") { state = Sudoku.setCursor(state, Number(text)); return true }
    if (text === "0" || key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = Sudoku.setCursor(state, 0); return true }
    return false
  }

  property var state: null
  readonly property var stats: state ? Sudoku.stats(state.grid) : null
  score: stats ? stats.correct : 0
  status: !state ? ""
    : (over ? "SOLVED  ·  N for a new game"
      : (paused ? "PAUSED" : stats.filled + "/" + stats.totalBlank + " filled"))

  onStateChanged: if (state && Sudoku.isSolved(state.grid)) over = true

  function newGame() {
    state = Sudoku.makeState(removeCount)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Sudoku.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (!state) return
    state = Sudoku.incrementCursor(state)
  }

  function undo() {
    if (over || !state) return
    state = Sudoku.decrementCursor(state)
  }

  function saveState() {
    if (!state || over) return null
    return Sudoku.serialize(state)
  }

  function loadState(saved) {
    var restored = Sudoku.deserialize(saved)
    if (restored) { state = restored; over = Sudoku.isSolved(restored.grid) }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): LEFT selects a cell (again: dial it up),
  // RIGHT clears, the wheel dials the digit.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "wheel") { if (b > 0) activate(); else undo() }
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= 9 || cy >= 9) return
    // Clicking a cell selects it; clicking the selected one again dials it up.
    var moved = cx !== state.cursor.x || cy !== state.cursor.y
    if (moved && kind === "press") { moveCursor(cx - state.cursor.x, cy - state.cursor.y); return }
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { state = Sudoku.setCursor(state, 0); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / 9, parent.height / 9))
    width: cell * 9
    height: cell * 9

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

      // Peer shading: the cursor's row, column and box, plus every cell
      // holding the same digit as the cursor.
      var cur = s.cursor
      var curVal = s.grid[cur.y][cur.x].value
      for (var hy = 0; hy < 9; ++hy) {
        for (var hx = 0; hx < 9; ++hx) {
          var peer = hx === cur.x || hy === cur.y
            || (Math.floor(hx / 3) === Math.floor(cur.x / 3) && Math.floor(hy / 3) === Math.floor(cur.y / 3))
          var same = curVal !== 0 && s.grid[hy][hx].value === curVal
          if (!peer && !same) continue
          ctx.fillStyle = same ? theme.selectedBackground : theme.faint
          ctx.globalAlpha = same ? 1.0 : 0.35
          ctx.fillRect(hx * c + 1, hy * c + 1, c - 2, c - 2)
        }
      }
      ctx.globalAlpha = 1.0

      for (var y = 0; y < 9; ++y) {
        for (var x = 0; x < 9; ++x) {
          var cell = s.grid[y][x]
          var px = x * c, py = y * c

          if (cell.value !== 0 && Sudoku.hasConflict(s.grid, x, y)) {
            ctx.fillStyle = theme.danger
            ctx.globalAlpha = 0.22
            ctx.fillRect(px + 1, py + 1, c - 2, c - 2)
            ctx.globalAlpha = 1.0
          }

          if (cell.value !== 0) {
            ctx.fillStyle = cell.given ? theme.foreground : theme.accent
            ctx.font = (cell.given ? "bold " : "") + Math.floor(c * 0.55) + "px " + theme.fontFamily
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText(String(cell.value), px + c / 2, py + c / 2 + 1)
          }
        }
      }

      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      for (var gx = 0; gx <= 9; ++gx) {
        if (gx % 3 === 0) continue
        ctx.beginPath(); ctx.moveTo(gx * c, 0); ctx.lineTo(gx * c, 9 * c); ctx.stroke()
      }
      for (var gy = 0; gy <= 9; ++gy) {
        if (gy % 3 === 0) continue
        ctx.beginPath(); ctx.moveTo(0, gy * c); ctx.lineTo(9 * c, gy * c); ctx.stroke()
      }

      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = 2
      for (var bx = 0; bx <= 9; bx += 3) {
        ctx.beginPath(); ctx.moveTo(bx * c, 0); ctx.lineTo(bx * c, 9 * c); ctx.stroke()
      }
      for (var by = 0; by <= 9; by += 3) {
        ctx.beginPath(); ctx.moveTo(0, by * c); ctx.lineTo(9 * c, by * c); ctx.stroke()
      }

      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 3
      ctx.strokeRect(s.cursor.x * c + 2, s.cursor.y * c + 2, c - 4, c - 4)

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
