import QtQuick
import "../engine" as Engine
import "logic/tents.js" as Tents

// Tents, after Simon Tatham's (see logic/tents.js). Puzzles come from the
// prebuilt pack. Score is puzzles solved.
Engine.PackGame {
  id: root
  gameId: "tents"
  title: "TENTS"
  helpText: "Give every tree its own tent in a square beside it (not diagonal) · tents never touch, not even at corners · numbers count tents per row and column · ARROWS move · SPACE tent on/off · X or . grass (no tent here) · R / C grass the rest of the row / column · S size · U undo"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT marks grass"

  packName: "tents"
  status: !pack.ready ? "LOADING PUZZLES…"
    : !state ? ""
    : over ? "SOLVED  ·  SPACE for the next one"
    : paused ? "PAUSED"
    : sizeName + "  ·  #" + (state.idx + 1)

  function makePuzzleState(p, size, idx) { return Tents.makeState(p, size, idx) }
  function restorePuzzleState(saved, p) { return Tents.deserialize(saved, p) }
  function serializePuzzleState(s) { return Tents.serialize(s) }

  function moveCursor(dx, dy) { if (state && !over) state = Tents.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Tents.mark(state, 1)
  }

  function undo() { if (state) state = Tents.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "s") { nextSize(); return true }
    if (over) return false
    if (t === "x" || t === ".") { state = Tents.mark(state, 2); return true }
    if (t === "r" || t === "c") { state = Tents.grassLine(state, t === "r"); return true }
    if (key === Qt.Key_Backspace || key === Qt.Key_Delete) {
      var i = state.cursor.y * state.p.w + state.cursor.x
      if (state.marks[i]) state = Tents.mark(state, state.marks[i])
      return true
    }
    return false
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does, RIGHT marks grass.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= state.p.w || cy >= state.p.h) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { state = Tents.mark(state, 2); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int cols: root.state ? root.state.p.w : 8
    readonly property int rows: root.state ? root.state.p.h : 8
    readonly property real cell: Math.floor(Math.min(parent.width / (cols + 1), parent.height / (rows + 1)))
    width: cell * (cols + 1)
    height: cell * (rows + 1)

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function drawTree(ctx, x, y, c) {
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.5)
      ctx.fillRect(x + c * 0.45, y + c * 0.6, c * 0.1, c * 0.28)
      ctx.fillStyle = theme.tone(2)
      ctx.beginPath(); ctx.arc(x + c / 2, y + c * 0.42, c * 0.28, 0, Math.PI * 2); ctx.fill()
    }

    function drawTent(ctx, x, y, c, bad) {
      ctx.fillStyle = bad ? theme.danger : theme.tone(3)
      ctx.beginPath()
      ctx.moveTo(x + c / 2, y + c * 0.18); ctx.lineTo(x + c * 0.85, y + c * 0.8); ctx.lineTo(x + c * 0.15, y + c * 0.8)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = theme.background
      ctx.beginPath()
      ctx.moveTo(x + c / 2, y + c * 0.45); ctx.lineTo(x + c * 0.6, y + c * 0.8); ctx.lineTo(x + c * 0.4, y + c * 0.8)
      ctx.closePath(); ctx.fill()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, p = s.p, c = cell
      var bad = Tents.badTents(s), cn = Tents.counts(s)

      for (var y = 0; y < p.h; ++y)
        for (var x = 0; x < p.w; ++x) {
          var i = y * p.w + x, px = x * c, py = y * c
          ctx.fillStyle = s.marks[i] === 2 ? theme.withAlpha(theme.foreground, 0.1) : theme.withAlpha(theme.foreground, 0.03)
          ctx.fillRect(px, py, c, c)
          if (s.marks[i] === 2) {
            ctx.fillStyle = theme.dim
            ctx.beginPath(); ctx.arc(px + c / 2, py + c / 2, Math.max(2, c * 0.06), 0, Math.PI * 2); ctx.fill()
          }
          ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
          ctx.strokeRect(px + 0.5, py + 0.5, c - 1, c - 1)
          if (Tents.isTree(p, i)) drawTree(ctx, px, py, c)
          else if (s.marks[i] === 1) drawTent(ctx, px, py, c, bad[i])
        }

      // Row and column targets: dim once met, red once over.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(c * 0.45) + "px " + theme.fontFamily
      for (y = 0; y < p.h; ++y) {
        ctx.fillStyle = cn.rows[y] > p.rows[y] ? theme.danger : cn.rows[y] === p.rows[y] ? theme.dim : theme.foreground
        ctx.fillText(String(p.rows[y]), p.w * c + c / 2, y * c + c / 2)
      }
      for (x = 0; x < p.w; ++x) {
        ctx.fillStyle = cn.cols[x] > p.cols[x] ? theme.danger : cn.cols[x] === p.cols[x] ? theme.dim : theme.foreground
        ctx.fillText(String(p.cols[x]), x * c + c / 2, p.h * c + c / 2)
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
