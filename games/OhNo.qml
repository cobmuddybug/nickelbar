import QtQuick
import "../engine" as Engine
import "logic/ohno.js" as OhNo

// Sightlines (after Q42's 0h n0): blue dots that count what they can see, red walls that block
// (see ohno.js). Score is puzzles solved.
Engine.GameBase {
  id: root
  gameId: "0hn0"
  title: "SIGHTLINES"
  helpText: "Numbers count the dots they can see up, down, left and right; walls block the view. Every dot must see at least one other. SPACE cycles dot → wall → empty · 1 dot · 2 wall · 0 clear · I hint · U undo · S change size (4-8)"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT cycles backwards"

  property var state: null
  property int size: 5
  score: state ? state.count : 0
  overTitle: "SOLVED · " + (state ? state.count : 0) + " TOTAL"
  status: !state ? ""
    : (over ? "SOLVED  ·  SPACE for the next one"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + state.n + "×" + state.n + "  ·  " + OhNo.filledCount(state) + "/" + (state.n * state.n)))

  onStateChanged: if (state && state.solved) over = true

  function newGame() {
    state = OhNo.makeState(size, state ? state.count : 0)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = OhNo.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = OhNo.cycle(state)
  }

  function undo() { if (state && !over) state = OhNo.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    if (text === "s" || text === "S") {
      var i = OhNo.SIZES.indexOf(size)
      size = OhNo.SIZES[(i + 1) % OhNo.SIZES.length]
      newGame()
      return true
    }
    if (over) return false
    if (text === "1") { state = OhNo.setCell(state, OhNo.BLUE); return true }
    if (text === "2") { state = OhNo.setCell(state, OhNo.RED); return true }
    if (text === "0" || key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = OhNo.setCell(state, OhNo.EMPTY); return true }
    if (text === "i" || text === "I") { state = OhNo.hint(state); return true }
    return false
  }

  function saveState() {
    if (!state) return null
    if (over) return { count: state.count, size: size }
    return OhNo.serialize(state)
  }

  function loadState(saved) {
    var restored = OhNo.deserialize(saved)
    if (restored && !restored.solved) { state = restored; size = restored.n; over = false; return }
    size = saved && saved.size ? saved.size : (restored ? restored.n : 5)
    state = OhNo.makeState(size, saved && saved.count ? saved.count : 0)
    over = false
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does, RIGHT cycles backwards.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= board.n || cy >= board.n) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { { activate(); activate() }; return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int n: root.state ? root.state.n : 5
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
      var blue = theme.tone(0), red = theme.danger

      for (var i = 0; i < n * n; ++i) {
        var x = i % n, y = Math.floor(i / n), v = s.grid[i]
        var cx = x * c + c / 2, cy = y * c + c / 2, r = c * 0.42
        if (v === OhNo.BLUE) {
          ctx.fillStyle = blue
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
        } else if (v === OhNo.RED) {
          // Walls are rounded squares, so the two never rely on hue alone.
          ctx.fillStyle = red
          var w = r * 1.7
          ctx.fillRect(cx - w / 2, cy - w / 2, w, w)
          if (s.given[i]) {
            ctx.strokeStyle = theme.withAlpha(theme.background, 0.5)
            ctx.lineWidth = Math.max(1.5, c * 0.04)
            ctx.beginPath(); ctx.moveTo(cx - w * 0.2, cy - w * 0.2); ctx.lineTo(cx + w * 0.2, cy + w * 0.2)
            ctx.moveTo(cx + w * 0.2, cy - w * 0.2); ctx.lineTo(cx - w * 0.2, cy + w * 0.2); ctx.stroke()
          }
        } else {
          ctx.fillStyle = theme.withAlpha(theme.foreground, 0.08)
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
        }
        if (s.clues[i]) {
          var st = OhNo.clueStatus(s, i)
          ctx.fillStyle = st === "over" ? theme.danger : theme.background
          if (st === "over") { ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.fillStyle = theme.background; ctx.fill(); ctx.fillStyle = theme.danger }
          ctx.globalAlpha = st === "done" ? 0.55 : 1.0
          ctx.font = "bold " + Math.floor(c * 0.4) + "px " + theme.fontFamily
          ctx.textAlign = "center"; ctx.textBaseline = "middle"
          ctx.fillText(String(s.clues[i]), cx, cy + 1)
          ctx.globalAlpha = 1.0
        }
      }

      if (s.hint) {
        var hx = s.hint.i % n, hy = Math.floor(s.hint.i / n)
        ctx.strokeStyle = theme.foreground
        ctx.setLineDash([4, 3])
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(hx * c + c / 2, hy * c + c / 2, c * 0.48, 0, Math.PI * 2); ctx.stroke()
        ctx.setLineDash([])
      }

      // Cursor: a ring, plus faint sight lines when it sits on a number.
      var ci = s.cursor.y * n + s.cursor.x
      if (s.clues[ci]) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.06)
        ctx.fillRect(0, s.cursor.y * c, width, c)
        ctx.fillRect(s.cursor.x * c, 0, c, height)
      }
      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(s.cursor.x * c + c / 2, s.cursor.y * c + c / 2, c * 0.47, 0, Math.PI * 2); ctx.stroke()

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
