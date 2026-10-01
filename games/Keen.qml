import QtQuick
import "../engine" as Engine
import "logic/keen.js" as Keen

// Keen (KenKen), after Simon Tatham's (see logic/keen.js). Puzzles come from
// the prebuilt pack in games/data/tatham/. Score is puzzles solved.
Engine.PackGame {
  id: root
  gameId: "keen"
  title: "KEEN"
  helpText: "Each row and column holds 1 to N once · each outlined cage makes its number with its sum (+), product (×), difference (−) or quotient (÷) · ARROWS move · 1-9 enter (again to clear) · 0/BACKSPACE clear · M pencil marks on/off · SPACE count up · S size · U undo"
  mouseHelp: "LEFT selects a cell (again: dial it up), RIGHT clears, the wheel dials the digit"

  packName: "keen"
  status: !pack.ready ? "LOADING PUZZLES…"
    : !state ? ""
    : over ? "SOLVED  ·  SPACE for the next one"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + (state.markMode ? "MARKING  ·  " : "")
      + sizeName + "  ·  #" + (state.idx + 1)

  function makePuzzleState(p, size, idx) { return Keen.makeState(p, size, idx) }
  function restorePuzzleState(saved, p) { return Keen.deserialize(saved, p) }
  function serializePuzzleState(s) { return Keen.serialize(s) }

  function moveCursor(dx, dy) { if (state && !over) state = Keen.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    var i = state.cursor.y * state.p.n + state.cursor.x
    state = Keen.setDigit(state, (state.vals[i] % state.p.n) + 1)
  }

  function undo() { if (state) state = Keen.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "s") { nextSize(); return true }
    if (over) return false
    if (t === "m") { state = Keen.toggleMarks(state); return true }
    if (t.length === 1 && t >= "1" && t <= "9") { state = Keen.setDigit(state, t.charCodeAt(0) - 48); return true }
    if (t === "0" || key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = Keen.setDigit(state, 0); return true }
    return false
  }

  // Mouse (engine/Pointer.qml): LEFT selects a cell (again: dial it up),
  // RIGHT clears, the wheel dials the digit.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "wheel") { var ki = state.cursor.y * state.p.n + state.cursor.x; state = Keen.setDigit(state, ((state.vals[ki] + (b > 0 ? 0 : state.p.n - 2) + state.p.n) % state.p.n) + 1) }
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= state.p.n || cy >= state.p.n) return
    // Clicking a cell selects it; clicking the selected one again dials it up.
    var moved = cx !== state.cursor.x || cy !== state.cursor.y
    if (moved && kind === "press") { moveCursor(cx - state.cursor.x, cy - state.cursor.y); return }
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { state = Keen.setDigit(state, 0); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int n: root.state ? root.state.p.n : 5
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

    readonly property var opText: ({ "=": "", "+": "+", "-": "−", "*": "×", "/": "÷" })

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, n = s.p.n, c = cell
      var bad = Keen.clashes(s), cs = Keen.cageState(s)

      if (!root.over) {
        ctx.fillStyle = theme.withAlpha(theme.accent, 0.07)
        ctx.fillRect(0, s.cursor.y * c, n * c, c)
        ctx.fillRect(s.cursor.x * c, 0, c, n * c)
      }
      // Wrong full cages get a red wash.
      for (var i = 0; i < n * n; ++i)
        if (cs[s.p.cage[i]] === -1) {
          ctx.fillStyle = theme.withAlpha(theme.danger, 0.12)
          ctx.fillRect((i % n) * c, Math.floor(i / n) * c, c, c)
        }

      // Thin cell lines, then thick lines between cages.
      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      for (var k = 1; k < n; ++k) {
        ctx.beginPath(); ctx.moveTo(k * c, 0); ctx.lineTo(k * c, n * c); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, k * c); ctx.lineTo(n * c, k * c); ctx.stroke()
      }
      ctx.strokeStyle = theme.foreground
      ctx.lineWidth = Math.max(2, c * 0.05)
      ctx.lineCap = "square"
      ctx.beginPath()
      for (var y = 0; y < n; ++y)
        for (var x = 0; x < n; ++x) {
          var id = s.p.cage[y * n + x]
          if (x < n - 1 && s.p.cage[y * n + x + 1] !== id) { ctx.moveTo((x + 1) * c, y * c); ctx.lineTo((x + 1) * c, (y + 1) * c) }
          if (y < n - 1 && s.p.cage[(y + 1) * n + x] !== id) { ctx.moveTo(x * c, (y + 1) * c); ctx.lineTo((x + 1) * c, (y + 1) * c) }
        }
      ctx.stroke()
      ctx.strokeRect(1, 1, n * c - 2, n * c - 2)

      // Cage labels.
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.font = "bold " + Math.floor(c * 0.2) + "px " + theme.fontFamily
      for (var q = 0; q < s.p.cages.length; ++q) {
        var at = Keen.labelCell(s.p, q), cg = s.p.cages[q]
        ctx.fillStyle = cs[q] === -1 ? theme.danger : theme.foreground
        ctx.fillText(cg.target + opText[cg.op], (at % n) * c + c * 0.08, Math.floor(at / n) * c + c * 0.06)
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (y = 0; y < n; ++y)
        for (x = 0; x < n; ++x) {
          var idx = y * n + x, v = s.vals[idx], cx = x * c + c / 2, cy = y * c + c / 2 + c * 0.06
          if (v) {
            ctx.font = Math.floor(c * 0.5) + "px " + theme.fontFamily
            ctx.fillStyle = bad[idx] ? theme.danger : theme.accent
            ctx.fillText(String(v), cx, cy + 1)
          } else if (s.marks[idx]) {
            ctx.font = Math.floor(c * 0.18) + "px " + theme.fontFamily
            ctx.fillStyle = theme.dim
            for (var d = 1; d <= n; ++d) {
              if (!(s.marks[idx] & (1 << d))) continue
              var mx = (d - 1) % 3, my = Math.floor((d - 1) / 3)
              ctx.fillText(String(d), x * c + c * (0.25 + mx * 0.25), y * c + c * (0.45 + my * 0.24))
            }
          }
        }

      if (!root.over) {
        ctx.strokeStyle = s.markMode ? theme.tone(2) : theme.highlight
        ctx.lineWidth = 3
        ctx.strokeRect(s.cursor.x * c + 4, s.cursor.y * c + 4, c - 8, c - 8)
      }

      if (root.paused) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = 0.85
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }
}
