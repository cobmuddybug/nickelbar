import QtQuick
import "../engine" as Engine
import "logic/loopy.js" as Loopy

// Loopy (Slitherlink), after Simon Tatham's (see logic/loopy.js). Puzzles
// come from the prebuilt pack. Score is puzzles solved.
Engine.PackGame {
  id: root
  gameId: "loopy"
  title: "LOOPY"
  helpText: "Draw one closed loop along the grid lines; each number is how many of that square's sides the loop uses · the cursor is a dot: ARROWS move it · SPACE pen on/off (with the pen on, moving draws a line, or rubs one out) · X cross pen on/off (marks sides that can't be used) · S size · U undo"
  mouseHelp: "Click a side to draw or rub out a line, right-click to cross it; hover moves the dot cursor"

  packName: "loopy"
  status: !pack.ready ? "LOADING PUZZLES…"
    : !state ? ""
    : over ? "SOLVED  ·  SPACE for the next one"
    : paused ? "PAUSED"
    : (state.pen === 1 ? "DRAWING  ·  " : state.pen === 2 ? "CROSSING  ·  " : "") + sizeName + "  ·  #" + (state.idx + 1)

  function makePuzzleState(p, size, idx) { return Loopy.makeState(p, size, idx) }
  function restorePuzzleState(saved, p) { return Loopy.deserialize(saved, p) }
  function serializePuzzleState(s) { return Loopy.serialize(s) }

  function moveCursor(dx, dy) { if (state && !over) state = Loopy.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Loopy.setPen(state, 1)
  }

  function undo() { if (state) state = Loopy.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "s") { nextSize(); return true }
    if (over) return false
    if (t === "x") { state = Loopy.setPen(state, 2); return true }
    return false
  }

  // Mouse (engine/Pointer.qml): click a side to draw or rub out a line,
  // right-click to cross it; hover moves the dot cursor.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var c = board.cell, u = (x - 14) / c, v = (y - 14) / c
    if (kind === "move") {
      var vx = Math.round(u), vy = Math.round(v)
      if (vx >= 0 && vy >= 0 && vx <= state.p.w && vy <= state.p.h && (vx !== state.cursor.x || vy !== state.cursor.y) && !state.pen) {
        var n = Loopy.moveCursor(state, vx - state.cursor.x, 0)
        state = Loopy.moveCursor(n, 0, vy - n.cursor.y)
      }
      return
    }
    if (kind !== "press") return
    var e = Loopy.nearestEdge(state.p, u, v)
    if (e >= 0) state = Loopy.toggleEdge(state, e, b === Qt.RightButton ? 2 : 1)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int cols: root.state ? root.state.p.w : 7
    readonly property int rows: root.state ? root.state.p.h : 7
    readonly property real cell: Math.floor(Math.min((parent.width - 28) / cols, (parent.height - 28) / rows))
    width: cell * cols + 28
    height: cell * rows + 28

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
      var s = root.state, p = s.p, c = cell, o = 14

      // Clues.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(c * 0.5) + "px " + theme.fontFamily
      for (var y = 0; y < p.h; ++y)
        for (var x = 0; x < p.w; ++x) {
          var k = Loopy.clue(p, y * p.w + x)
          if (k < 0) continue
          var have = Loopy.around(s, x, y)
          ctx.fillStyle = have > k ? theme.danger : have === k ? theme.dim : theme.foreground
          ctx.fillText(String(k), o + x * c + c / 2, o + y * c + c / 2 + 1)
        }

      // Lines and crosses.
      ctx.lineCap = "round"
      for (var e = 0; e < s.edges.length; ++e) {
        if (!s.edges[e]) continue
        var en = Loopy.ends(p, e), ax = o + en[0][0] * c, ay = o + en[0][1] * c, bx = o + en[1][0] * c, by = o + en[1][1] * c
        if (s.edges[e] === 1) {
          ctx.strokeStyle = root.over ? theme.accent : theme.foreground
          ctx.lineWidth = Math.max(3, c * 0.1)
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
        } else {
          var mx = (ax + bx) / 2, my = (ay + by) / 2, r = c * 0.08
          ctx.strokeStyle = theme.dim; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(mx - r, my - r); ctx.lineTo(mx + r, my + r); ctx.moveTo(mx + r, my - r); ctx.lineTo(mx - r, my + r); ctx.stroke()
        }
      }

      // Dots; a branching one goes red.
      for (var vy = 0; vy <= p.h; ++vy)
        for (var vx = 0; vx <= p.w; ++vx) {
          var d = Loopy.degree(s, vx, vy)
          ctx.fillStyle = d > 2 ? theme.danger : theme.withAlpha(theme.foreground, 0.55)
          ctx.beginPath(); ctx.arc(o + vx * c, o + vy * c, Math.max(2, c * 0.05), 0, Math.PI * 2); ctx.fill()
        }

      if (!root.over) {
        ctx.strokeStyle = s.pen === 1 ? theme.accent : s.pen === 2 ? theme.tone(2) : theme.highlight
        ctx.lineWidth = s.pen ? 3 : 2
        ctx.beginPath(); ctx.arc(o + s.cursor.x * c, o + s.cursor.y * c, Math.min(12, Math.max(6, c * 0.18)), 0, Math.PI * 2); ctx.stroke()
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
