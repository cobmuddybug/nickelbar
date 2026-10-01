import QtQuick
import "../engine" as Engine
import "logic/lightup.js" as LightUp

// Light Up (Akari), after Simon Tatham's (see logic/lightup.js). Puzzles
// come from the prebuilt pack. Score is puzzles solved.
Engine.PackGame {
  id: root
  gameId: "lightup"
  title: "LIGHT UP"
  helpText: "Light every white cell · a light shines along its row and column until a black cell · no light may shine on another · a number is how many lights touch that black cell · ARROWS move · SPACE light on/off · X or . mark 'no light here' · S size · U undo"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT marks \"no light\""

  packName: "lightup"
  status: !pack.ready ? "LOADING PUZZLES…"
    : !state ? ""
    : over ? "SOLVED  ·  SPACE for the next one"
    : paused ? "PAUSED"
    : sizeName + "  ·  #" + (state.idx + 1)

  function makePuzzleState(p, size, idx) { return LightUp.makeState(p, size, idx) }
  function restorePuzzleState(saved, p) { return LightUp.deserialize(saved, p) }
  function serializePuzzleState(s) { return LightUp.serialize(s) }

  function moveCursor(dx, dy) { if (state && !over) state = LightUp.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = LightUp.mark(state, 1)
  }

  function undo() { if (state) state = LightUp.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "s") { nextSize(); return true }
    if (over) return false
    if (t === "x" || t === ".") { state = LightUp.mark(state, 2); return true }
    if (key === Qt.Key_Backspace || key === Qt.Key_Delete) {
      var i = state.cursor.y * state.p.w + state.cursor.x
      if (state.marks[i]) state = LightUp.mark(state, state.marks[i])
      return true
    }
    return false
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does, RIGHT marks "no light".
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= state.p.w || cy >= state.p.h) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { state = LightUp.mark(state, 2); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int cols: root.state ? root.state.p.w : 7
    readonly property int rows: root.state ? root.state.p.h : 7
    readonly property real cell: Math.floor(Math.min(parent.width / cols, parent.height / rows))
    width: cell * cols
    height: cell * rows

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
      var s = root.state, p = s.p, c = cell
      var a = LightUp.analyse(s)
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var y = 0; y < p.h; ++y)
        for (var x = 0; x < p.w; ++x) {
          var i = y * p.w + x, px = x * c, py = y * c
          if (LightUp.isBlack(p, i)) {
            ctx.fillStyle = theme.foreground
            ctx.fillRect(px, py, c, c)
            var n = LightUp.number(p, i)
            if (n >= 0) {
              var have = LightUp.around(s, i)
              ctx.fillStyle = have > n ? theme.danger : have === n ? theme.dim : theme.background
              ctx.font = "bold " + Math.floor(c * 0.5) + "px " + theme.fontFamily
              ctx.fillText(String(n), px + c / 2, py + c / 2 + 1)
            }
            continue
          }
          ctx.fillStyle = a.lit[i] ? theme.withAlpha(theme.tone(3), 0.3) : theme.withAlpha(theme.foreground, 0.04)
          ctx.fillRect(px, py, c, c)
          ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
          ctx.strokeRect(px + 0.5, py + 0.5, c - 1, c - 1)
          if (s.marks[i] === 1) {
            ctx.fillStyle = a.clash[i] ? theme.danger : theme.tone(3)
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.3, 0, Math.PI * 2); ctx.fill()
            ctx.strokeStyle = theme.withAlpha(theme.background, 0.5); ctx.lineWidth = Math.max(1, c * 0.05)
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, c * 0.16, 0, Math.PI * 2); ctx.stroke()
          } else if (s.marks[i] === 2) {
            ctx.fillStyle = theme.dim
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, Math.max(2, c * 0.07), 0, Math.PI * 2); ctx.fill()
          }
        }

      if (!root.over) {
        ctx.strokeStyle = theme.highlight
        ctx.lineWidth = 3
        ctx.strokeRect(s.cursor.x * c + 2, s.cursor.y * c + 2, c - 4, c - 4)
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
