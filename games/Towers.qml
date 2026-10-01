import QtQuick
import "../engine" as Engine
import "logic/towers.js" as Towers

// Towers, after Simon Tatham's (see logic/towers.js). Puzzles come from the
// prebuilt pack in games/data/tatham/. Score is puzzles solved.
Engine.PackGame {
  id: root
  gameId: "towers"
  title: "TOWERS"
  helpText: "Each row and column holds 1 to N once · digits are tower heights; a clue is how many towers you see from that side · ARROWS move · 1-9 enter (again to clear) · 0/BACKSPACE clear · M pencil marks on/off · SPACE count up · S size · U undo"
  mouseHelp: "LEFT selects a cell (again: dial it up), RIGHT clears, the wheel dials the digit"

  packName: "towers"
  status: !pack.ready ? "LOADING PUZZLES…"
    : !state ? ""
    : over ? "SOLVED  ·  SPACE for the next one"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + (state.markMode ? "MARKING  ·  " : "")
      + sizeName + "  ·  #" + (state.idx + 1)

  function makePuzzleState(p, size, idx) { return Towers.makeState(p, size, idx) }
  function restorePuzzleState(saved, p) { return Towers.deserialize(saved, p) }
  function serializePuzzleState(s) { return Towers.serialize(s) }

  function moveCursor(dx, dy) { if (state && !over) state = Towers.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    var i = state.cursor.y * state.p.n + state.cursor.x
    state = Towers.setDigit(state, (state.vals[i] % state.p.n) + 1)
  }

  function undo() { if (state) state = Towers.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "s") { nextSize(); return true }
    if (over) return false
    if (t === "m") { state = Towers.toggleMarks(state); return true }
    if (t.length === 1 && t >= "1" && t <= "9") { state = Towers.setDigit(state, t.charCodeAt(0) - 48); return true }
    if (t === "0" || key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = Towers.setDigit(state, 0); return true }
    return false
  }

  // Mouse (engine/Pointer.qml): LEFT selects a cell (again: dial it up),
  // RIGHT clears, the wheel dials the digit.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "wheel") { var ti = state.cursor.y * state.p.n + state.cursor.x; state = Towers.setDigit(state, ((state.vals[ti] + (b > 0 ? 0 : state.p.n - 2) + state.p.n) % state.p.n) + 1) }
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (board.cell)) / (board.cell)), cy = Math.floor((y - (board.cell)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= state.p.n || cy >= state.p.n) return
    // Clicking a cell selects it; clicking the selected one again dials it up.
    var moved = cx !== state.cursor.x || cy !== state.cursor.y
    if (moved && kind === "press") { moveCursor(cx - state.cursor.x, cy - state.cursor.y); return }
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { state = Towers.setDigit(state, 0); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int n: root.state ? root.state.p.n : 5
    readonly property real cell: Math.floor(Math.min(parent.width, parent.height) / (n + 2))
    width: cell * (n + 2)
    height: cell * (n + 2)

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
      var s = root.state, n = s.p.n, c = cell, o = c
      var bad = Towers.clashes(s), cs = Towers.clueState(s)

      // Cursor row/column tint, then the grid.
      if (!root.over) {
        ctx.fillStyle = theme.withAlpha(theme.accent, 0.07)
        ctx.fillRect(o, o + s.cursor.y * c, n * c, c)
        ctx.fillRect(o + s.cursor.x * c, o, c, n * c)
      }
      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      for (var i = 0; i <= n; ++i) {
        ctx.beginPath(); ctx.moveTo(o + i * c, o); ctx.lineTo(o + i * c, o + n * c); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(o, o + i * c); ctx.lineTo(o + n * c, o + i * c); ctx.stroke()
      }
      ctx.strokeStyle = theme.dim
      ctx.lineWidth = 2
      ctx.strokeRect(o, o, n * c, n * c)

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      // Clues round the edge.
      ctx.font = "bold " + Math.floor(c * 0.42) + "px " + theme.fontFamily
      for (var k = 0; k < n; ++k) {
        var pos = [[o + k * c + c / 2, c / 2], [o + k * c + c / 2, o + n * c + c / 2],
                   [c / 2, o + k * c + c / 2], [o + n * c + c / 2, o + k * c + c / 2]]
        for (var side = 0; side < 4; ++side) {
          var clue = s.p.clues[side][k]
          if (!clue) continue
          ctx.fillStyle = cs[side][k] === -1 ? theme.danger : cs[side][k] === 1 ? theme.dim : theme.foreground
          ctx.fillText(String(clue), pos[side][0], pos[side][1])
        }
      }

      for (var y = 0; y < n; ++y)
        for (var x = 0; x < n; ++x) {
          var idx = y * n + x, v = s.vals[idx], cx = o + x * c + c / 2, cy = o + y * c + c / 2
          if (v) {
            ctx.font = (s.p.givens[idx] ? "bold " : "") + Math.floor(c * 0.55) + "px " + theme.fontFamily
            ctx.fillStyle = bad[idx] ? theme.danger : s.p.givens[idx] ? theme.foreground : theme.accent
            ctx.fillText(String(v), cx, cy + 1)
          } else if (s.marks[idx]) {
            ctx.font = Math.floor(c * 0.2) + "px " + theme.fontFamily
            ctx.fillStyle = theme.dim
            for (var d = 1; d <= n; ++d) {
              if (!(s.marks[idx] & (1 << d))) continue
              var mx = (d - 1) % 3, my = Math.floor((d - 1) / 3)
              ctx.fillText(String(d), o + x * c + c * (0.22 + mx * 0.28), o + y * c + c * (0.24 + my * 0.28))
            }
          }
        }

      if (!root.over) {
        ctx.strokeStyle = s.markMode ? theme.tone(2) : theme.highlight
        ctx.lineWidth = 3
        ctx.strokeRect(o + s.cursor.x * c + 2, o + s.cursor.y * c + 2, c - 4, c - 4)
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
