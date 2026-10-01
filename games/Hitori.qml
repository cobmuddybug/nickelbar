import QtQuick
import "../engine" as Engine
import "logic/hitori.js" as Hitori

// Hitori: shade cells so no number repeats among the unshaded cells of a row
// or column, shaded cells never touch, and the unshaded cells stay in one
// piece. Every puzzle has one answer, reachable by deduction.
Engine.GameBase {
  id: root
  gameId: "hitori"
  title: "HITORI"
  helpText: "ARROWS move · SPACE/ENTER shade a cell · C circle a cell you know stays · U undo · no repeats among unshaded cells in any row or column, shaded cells never touch, unshaded cells stay connected · shaded cells that touch, and circled cells that repeat, are outlined red"
  mouseHelp: "LEFT shades, RIGHT circles; hover moves the cursor"

  property var state: null
  property int solved: 0

  score: solved
  progress: solved ? solved + " solved" : ""
  overTitle: state ? "SOLVED IN " + state.moves + " MOVES" : ""
  status: !state ? ""
    : (over ? "SOLVED  ·  SPACE for the next puzzle"
      : (paused ? "PAUSED" : state.size + "×" + state.size + "  ·  " + state.moves + " moves"))

  onStateChanged: if (state && state.won) over = true

  function sizeFor(n) { return Math.min(8, 5 + Math.floor(n / 3)) }

  function newGame() {
    state = Hitori.makeState(sizeFor(solved))
    over = false
    paused = false
  }

  function moveCursor(dx, dy) { if (!over && state) state = Hitori.moveCursor(state, dx, dy) }

  function activate() {
    if (over) { solved++; newGame(); return }
    if (state) state = Hitori.toggle(state, 1)
  }

  function handleKey(key, text) {
    if (over || !state) return false
    if (key === Qt.Key_C) { state = Hitori.toggle(state, 2); return true }
    return false
  }

  function undo() { if (!over && state) state = Hitori.undo(state) }

  function saveState() {
    if (!state || over) return { solved: solved }
    var o = Hitori.serialize(state); o.solvedCount = solved
    return o
  }
  function loadState(saved) {
    solved = saved && saved.solvedCount !== undefined ? saved.solvedCount : (saved && saved.solved ? saved.solved : 0)
    var r = saved && saved.nums ? Hitori.deserialize(saved) : null
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
    if (kind !== "move" && kind !== "press") return
    var p = cellAt(x, y)
    if (!p) return
    if (p.x !== state.cursor.x || p.y !== state.cursor.y) state = Hitori.moveCursor(state, p.x - state.cursor.x, p.y - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    state = Hitori.toggle(state, b === Qt.RightButton ? 2 : 1, p.x, p.y)
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
      var bad = Hitori.conflicts(s)
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var y = 0; y < n; ++y) for (var x = 0; x < n; ++x) {
        var px = board.ox + x * c, py = board.oy + y * c, inset = Math.max(2, c * 0.05)
        var m = s.marks[y][x]
        ctx.fillStyle = m === 1 ? theme.foreground : theme.faint
        ctx.globalAlpha = m === 1 ? 0.92 : 0.55
        ctx.fillRect(px + inset, py + inset, c - inset * 2, c - inset * 2)
        ctx.globalAlpha = 1
        ctx.fillStyle = m === 1 ? theme.background : theme.foreground
        ctx.globalAlpha = m === 1 ? 0.55 : 1
        ctx.font = "bold " + Math.floor(c * 0.44) + "px " + theme.fontFamily
        ctx.fillText(String(s.nums[y][x]), px + c / 2, py + c / 2 + c * 0.02)
        ctx.globalAlpha = 1
        if (m === 2) {
          ctx.strokeStyle = theme.accent; ctx.lineWidth = Math.max(2, c * 0.06)
          ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.36, 0, Math.PI * 2); ctx.stroke()
        }
        if (bad[y][x]) {
          ctx.strokeStyle = theme.danger; ctx.lineWidth = 2
          ctx.strokeRect(px + inset + 1, py + inset + 1, c - inset * 2 - 2, c - inset * 2 - 2)
        }
      }
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2
      ctx.strokeRect(board.ox + s.cursor.x * c + 1, board.oy + s.cursor.y * c + 1, c - 2, c - 2)
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
