import QtQuick
import "../engine" as Engine
import "logic/fillomino.js" as Fillomino

// Fillomino: fill every cell with a number so that each group of touching
// equal numbers has exactly that many cells: a 3 sits in a group of three,
// a 1 stands alone. Given numbers are fixed. Every puzzle has one answer.
Engine.GameBase {
  id: root
  gameId: "fillomino"
  title: "FILLOMINO"
  helpText: "ARROWS move · type 1-9 to fill a cell · 0 or BACKSPACE clears it · U undo · every group of touching equal numbers must have exactly that many cells · finished groups are tinted, groups that grew too big are outlined red"
  mouseHelp: "LEFT raises the number in a cell, RIGHT lowers it (through blank); the wheel does the same; hover moves the cursor"

  property var state: null
  property int solved: 0

  score: solved
  progress: solved ? solved + " solved" : ""
  overTitle: state ? "SOLVED IN " + state.moves + " MOVES" : ""
  status: !state ? ""
    : (over ? "SOLVED  ·  SPACE for the next puzzle"
      : (paused ? "PAUSED" : state.size + "×" + state.size + "  ·  " + state.moves + " moves"))

  onStateChanged: if (state && state.won) over = true

  function sizeFor(n) { return Math.min(7, 5 + Math.floor(n / 3)) }

  function newGame() {
    state = Fillomino.makeState(sizeFor(solved))
    over = false
    paused = false
  }

  function moveCursor(dx, dy) { if (!over && state) state = Fillomino.moveCursor(state, dx, dy) }

  function activate() {
    if (over) { solved++; newGame(); return }
    if (state) state = Fillomino.step(state, 1)
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = Fillomino.setDigit(state, 0); return true }
    if (text && /^[0-9]$/.test(text)) { state = Fillomino.setDigit(state, parseInt(text)); return true }
    return false
  }

  function undo() { if (!over && state) state = Fillomino.undo(state) }

  function saveState() {
    if (!state || over) return { solved: solved }
    var o = Fillomino.serialize(state); o.solvedCount = solved
    return o
  }
  function loadState(saved) {
    solved = saved && saved.solvedCount !== undefined ? saved.solvedCount : (saved && saved.solved ? saved.solved : 0)
    var r = saved && saved.given ? Fillomino.deserialize(saved) : null
    if (r) { state = r; over = r.won } else newGame()
  }

  function cellAt(x, y) {
    if (!state) return null
    var c = board.cell
    var cx = Math.floor((x - board.ox) / c), cy = Math.floor((y - board.oy) / c)
    if (cx < 0 || cy < 0 || cx >= state.size || cy >= state.size) return null
    return { x: cx, y: cy }
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var p = cellAt(x, y)
    if (!p) return
    if (p.x !== state.cursor.x || p.y !== state.cursor.y) state = Fillomino.moveCursor(state, p.x - state.cursor.x, p.y - state.cursor.y)
    if (kind === "wheel") { state = Fillomino.step(state, b > 0 ? 1 : -1, p.x, p.y); return }
    if (kind !== "press" || b === Qt.MiddleButton) return
    state = Fillomino.step(state, b === Qt.RightButton ? -1 : 1, p.x, p.y)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    readonly property int n: root.state ? root.state.size : 6
    readonly property real cell: Math.floor(Math.min(width * 0.96, height * 0.96) / n)
    readonly property real ox: Math.floor((width - cell * n) / 2)
    readonly property real oy: Math.floor((height - cell * n) / 2)

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
      var s = root.state, c = board.cell, n = board.n
      if (c <= 0) return
      var big = Fillomino.tooBig(s), done = Fillomino.complete(s)
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) {
        var px = board.ox + x * c, py = board.oy + y * c
        var v = s.fill[y][x], given = s.given[y][x] > 0
        ctx.fillStyle = done[y][x] ? theme.accent : theme.faint
        ctx.globalAlpha = done[y][x] ? 0.28 : (given ? 0.5 : 0.28)
        ctx.fillRect(px + 1, py + 1, c - 2, c - 2)
        ctx.globalAlpha = 1
        if (v) {
          ctx.fillStyle = big[y][x] ? theme.danger : (given ? theme.foreground : theme.accent)
          ctx.font = (given ? "bold " : "") + Math.floor(c * 0.5) + "px " + theme.fontFamily
          ctx.fillText(String(v), px + c / 2, py + c / 2 + c * 0.02)
        }
      }
      // borders between cells of different numbers, thin lines between equal ones
      for (var yy = 0; yy < n; ++yy) for (var xx = 0; xx < n; ++xx) {
        var vx = s.fill[yy][xx]
        var ax = board.ox + xx * c, ay = board.oy + yy * c
        if (xx + 1 < n) {
          var same = vx !== 0 && vx === s.fill[yy][xx + 1]
          ctx.strokeStyle = same ? theme.faint : theme.dim; ctx.lineWidth = same ? 1 : 2.5
          ctx.beginPath(); ctx.moveTo(ax + c, ay); ctx.lineTo(ax + c, ay + c); ctx.stroke()
        }
        if (yy + 1 < n) {
          var same2 = vx !== 0 && vx === s.fill[yy + 1][xx]
          ctx.strokeStyle = same2 ? theme.faint : theme.dim; ctx.lineWidth = same2 ? 1 : 2.5
          ctx.beginPath(); ctx.moveTo(ax, ay + c); ctx.lineTo(ax + c, ay + c); ctx.stroke()
        }
      }
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2
      ctx.strokeRect(board.ox, board.oy, c * n, c * n)
      ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2
      ctx.strokeRect(board.ox + s.cursor.x * c + 2, board.oy + s.cursor.y * c + 2, c - 4, c - 4)
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.3
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
