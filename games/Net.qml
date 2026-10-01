import QtQuick
import "../engine" as Engine
import "logic/net.js" as Net

// Net: spin the tiles until every pipe connects back to the source with no
// loose ends. Score is puzzles solved.
Engine.GameBase {
  id: root
  gameId: "net"
  title: "NET"
  helpText: "Rotate tiles so the whole network connects to the source (the square) with no open ends · ARROWS move (wraps) · SPACE rotate clockwise · A anticlockwise · X lock/unlock a tile · S size 5/7/9/11 · U undo · lit pipes are connected"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT turns anticlockwise, MIDDLE locks"

  property var state: null
  property int size: 7
  score: state ? state.count : 0
  progress: score ? score + " solved" : ""
  overTitle: "CONNECTED · " + (state ? state.moves : 0) + " MOVES"
  status: !state ? ""
    : (over ? "CONNECTED  ·  SPACE for the next one"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + state.n + "×" + state.n + "  ·  " + Net.poweredCount(state) + "/" + (state.n * state.n) + " lit  ·  " + state.moves + " moves"))

  onStateChanged: if (state && state.solved) over = true

  function newGame() {
    state = Net.makeState(size, state ? state.count : 0)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = Net.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Net.rotate(state, true)
  }

  function undo() { if (state && !over) state = Net.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    if (text === "s" || text === "S") {
      var i = Net.SIZES.indexOf(size)
      size = Net.SIZES[(i + 1) % Net.SIZES.length]
      newGame()
      return true
    }
    if (over) return false
    if (text === "a" || text === "A") { state = Net.rotate(state, false); return true }
    if (text === "x" || text === "X") { state = Net.toggleLock(state); return true }
    return false
  }

  function saveState() {
    if (!state) return null
    if (over) return { count: state.count, n: size, solved: true }
    return Net.serialize(state)
  }

  function loadState(saved) {
    if (saved && saved.n) size = saved.n
    var restored = Net.deserialize(saved)
    if (restored && !restored.solved) { state = restored; over = false; return }
    state = Net.makeState(size, saved && saved.count ? saved.count : 0)
    over = false
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does, RIGHT turns anticlockwise, MIDDLE locks.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "press" && b === Qt.MiddleButton) state = Net.toggleLock(state)
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= board.n || cy >= board.n) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { state = Net.rotate(state, false); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int n: root.state ? root.state.n : 7
    readonly property real cell: Math.floor(Math.min(parent.width, parent.height) / n)
    width: cell * n
    height: cell * n

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
      var s = root.state, c = cell, n = s.n
      var on = Net.powered(s)
      var loose = Net.looseEnds(s)
      var src = Math.floor(n / 2) * n + Math.floor(n / 2)
      var pipe = Math.max(3, c * 0.16)

      for (var i = 0; i < n * n; ++i) {
        var x = (i % n) * c, y = Math.floor(i / n) * c
        var cx = x + c / 2, cy = y + c / 2
        ctx.fillStyle = s.locked[i] ? theme.withAlpha(theme.foreground, 0.13) : theme.withAlpha(theme.foreground, 0.05)
        ctx.fillRect(x + 1, y + 1, c - 2, c - 2)

        var m = s.grid[i], lit = !!on[i]
        ctx.lineWidth = pipe
        ctx.lineCap = "butt"
        for (var d = 0; d < 4; ++d) {
          if (!(m & Net.DIRS[d].bit)) continue
          ctx.strokeStyle = lit ? theme.accent : theme.dim
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Net.DIRS[d].dx * c / 2, cy + Net.DIRS[d].dy * c / 2)
          ctx.stroke()
          // A loose end on the lit network gets a short red stub at the
          // tile edge (unlit tiles are all loose, so marking them is noise).
          if (lit && (loose[i] & Net.DIRS[d].bit)) {
            ctx.strokeStyle = theme.danger
            ctx.beginPath()
            ctx.moveTo(cx + Net.DIRS[d].dx * c * 0.34, cy + Net.DIRS[d].dy * c * 0.34)
            ctx.lineTo(cx + Net.DIRS[d].dx * c / 2, cy + Net.DIRS[d].dy * c / 2)
            ctx.stroke()
          }
        }
        // Hub: the source is a square, dead ends are terminals (circles).
        if (i === src) {
          ctx.fillStyle = theme.foreground
          ctx.fillRect(cx - c * 0.2, cy - c * 0.2, c * 0.4, c * 0.4)
          ctx.strokeStyle = theme.accent
          ctx.lineWidth = 2
          ctx.strokeRect(cx - c * 0.2, cy - c * 0.2, c * 0.4, c * 0.4)
        } else if (Net.bits(m) === 1) {
          ctx.beginPath(); ctx.arc(cx, cy, c * 0.2, 0, Math.PI * 2)
          ctx.fillStyle = lit ? theme.accent : theme.background
          ctx.fill()
          ctx.strokeStyle = lit ? theme.accent : theme.dim
          ctx.lineWidth = Math.max(2, c * 0.05)
          ctx.stroke()
        } else {
          ctx.fillStyle = lit ? theme.accent : theme.dim
          ctx.fillRect(cx - pipe / 2, cy - pipe / 2, pipe, pipe)
        }
      }

      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = 3
      ctx.strokeRect(s.cursor.x * c + 1.5, s.cursor.y * c + 1.5, c - 3, c - 3)

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
