import QtQuick
import "../engine" as Engine
import "logic/ohhi.js" as OhHi

// Binary Grid (after Q42's 0h h1): two colours, three rules (see ohhi.js). Score is puzzles solved.
Engine.GameBase {
  id: root
  gameId: "0hh1"
  title: "BINARY GRID"
  helpText: "Fill every cell. No three of a colour in a row · each row and column half-and-half · no two rows or columns alike. SPACE cycles · 1/2 set a colour · 0 clears · I hint · U undo · S change size (4/6/8/10) · locked cells have a dot"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT cycles backwards"

  property var state: null
  property int size: 6
  score: state ? state.count : 0
  overTitle: "SOLVED · " + (state ? state.count : 0) + " TOTAL"
  status: !state ? ""
    : (over ? "SOLVED  ·  SPACE for the next one"
      : (paused ? "PAUSED"
        : (state.note ? state.note.toUpperCase() + "  ·  " : "")
          + state.n + "×" + state.n + "  ·  " + OhHi.filledCount(state) + "/" + (state.n * state.n)))

  onStateChanged: if (state && state.solved) over = true

  function newGame() {
    state = OhHi.makeState(size, state ? state.count : 0)
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (over || !state) return
    state = OhHi.moveCursor(state, dx, dy)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = OhHi.cycle(state)
  }

  function undo() { if (state && !over) state = OhHi.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    if (text === "s" || text === "S") {
      var i = OhHi.SIZES.indexOf(size)
      size = OhHi.SIZES[(i + 1) % OhHi.SIZES.length]
      newGame()
      return true
    }
    if (over) return false
    if (text === "1") { state = OhHi.setCell(state, 1); return true }
    if (text === "2") { state = OhHi.setCell(state, 2); return true }
    if (text === "0" || key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = OhHi.setCell(state, 0); return true }
    if (text === "i" || text === "I") { state = OhHi.hint(state); return true }
    return false
  }

  function saveState() {
    if (!state) return null
    if (over) return { count: state.count, size: size }
    return OhHi.serialize(state)
  }

  function loadState(saved) {
    var restored = OhHi.deserialize(saved)
    if (restored && !restored.solved) { state = restored; size = restored.n; over = false; return }
    size = saved && saved.size ? saved.size : (restored ? restored.n : 6)
    state = OhHi.makeState(size, saved && saved.count ? saved.count : 0)
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

  readonly property var colors: [theme.faint, theme.tone(0), theme.tone(1)]

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int n: root.state ? root.state.n : 6
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
      var errs = OhHi.errors(s)
      var gap = Math.max(3, c * 0.07), rad = c * 0.14

      function tile(x, y, color) {
        var px = x * c + gap / 2, py = y * c + gap / 2, w = c - gap
        ctx.beginPath()
        ctx.moveTo(px + rad, py); ctx.arcTo(px + w, py, px + w, py + w, rad); ctx.arcTo(px + w, py + w, px, py + w, rad)
        ctx.arcTo(px, py + w, px, py, rad); ctx.arcTo(px, py, px + w, py, rad); ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()
      }

      for (var i = 0; i < n * n; ++i) {
        var x = i % n, y = Math.floor(i / n), v = s.grid[i]
        tile(x, y, v ? root.colors[v] : theme.withAlpha(theme.foreground, 0.07))
        if (s.given[i]) {
          ctx.fillStyle = theme.withAlpha(theme.background, 0.55)
          ctx.beginPath(); ctx.arc(x * c + c / 2, y * c + c / 2, c * 0.07, 0, Math.PI * 2); ctx.fill()
        }
        if (errs[i]) {
          // Hatched rather than outlined in red: one of the two tile
          // colours is often reddish itself.
          ctx.save()
          ctx.beginPath(); ctx.rect(x * c + gap, y * c + gap, c - gap * 2, c - gap * 2); ctx.clip()
          ctx.strokeStyle = theme.withAlpha(theme.background, 0.65)
          ctx.lineWidth = Math.max(2, c * 0.05)
          for (var h = -c; h < c; h += c * 0.2) {
            ctx.beginPath(); ctx.moveTo(x * c + h, y * c + c); ctx.lineTo(x * c + h + c, y * c); ctx.stroke()
          }
          ctx.restore()
        }
      }

      if (s.hint) {
        var hx = s.hint.i % n, hy = Math.floor(s.hint.i / n)
        ctx.strokeStyle = theme.foreground
        ctx.setLineDash([4, 3])
        ctx.lineWidth = 2
        ctx.strokeRect(hx * c + 1, hy * c + 1, c - 2, c - 2)
        ctx.setLineDash([])
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
