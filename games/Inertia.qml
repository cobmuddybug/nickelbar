import QtQuick
import "../engine" as Engine
import "logic/inertia.js" as Inertia

// Inertia, after Simon Tatham's (see logic/inertia.js). Dying isn't the
// end: U takes the fatal move back. Score is boards cleared.
Engine.GameBase {
  id: root
  gameId: "inertia"
  title: "INERTIA"
  helpText: "Collect every gem · the ball slides until a wall or the edge stops it, or it lands on a stop circle · mines kill (U undoes, even then) · ARROWS slide straight · numpad 7 9 1 3 (or HOME PGUP END PGDN, or Y O B M) slide diagonally; 8 4 6 2 work too"
  mouseHelp: "Click anywhere to slide the ball that way (the nearest of the eight directions)"

  property var state: null
  score: state ? state.solved : 0
  progress: score ? score + " boards" : ""
  overTitle: state ? "ALL GEMS · " + state.moves + " MOVES" : ""
  status: !state ? ""
    : over ? "CLEARED  ·  SPACE for the next board"
    : paused ? "PAUSED"
    : state.dead ? "BOOM  ·  U to undo, N for a new board"
    : state.left + " gems left  ·  " + state.moves + " moves" + (state.deaths ? "  ·  " + state.deaths + " deaths" : "")

  onStateChanged: over = !!state && state.won

  function newGame() {
    state = Inertia.makeState(state ? state.solved : 0)
    paused = false
  }

  // up, right, down, left -> 0, 2, 4, 6
  function moveCursor(dx, dy) {
    if (!state || over) return
    state = Inertia.move(state, dy < 0 ? 0 : dx > 0 ? 2 : dy > 0 ? 4 : 6)
  }

  function activate() { if (over) newGame() }
  function undo() { if (state) state = Inertia.undo(state) }

  function handleKey(key, text) {
    if (!state || over) return false
    var t = text ? text.toLowerCase() : ""
    var d = { "8": 0, "9": 1, "6": 2, "3": 3, "2": 4, "1": 5, "4": 6, "7": 7, "y": 7, "o": 1, "b": 5, "m": 3 }[t]
    if (d === undefined) d = key === Qt.Key_Home ? 7 : key === Qt.Key_PageUp ? 1 : key === Qt.Key_End ? 5 : key === Qt.Key_PageDown ? 3 : -1
    if (d < 0) return false
    state = Inertia.move(state, d)
    return true
  }

  function saveState() { return state ? Inertia.serialize(state) : null }

  function loadState(saved) {
    var r = Inertia.deserialize(saved)
    if (r && r.board) { state = r; paused = false }
    else { state = null; state = Inertia.makeState(r ? r.solvedOnly : 0) }
  }

  // Mouse (engine/Pointer.qml): click anywhere to slide the ball that way
  // (the nearest of the eight directions).
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press" || b !== Qt.LeftButton) return
    var c = board.cell, bx = (state.pos % Inertia.W + 0.5) * c, by = (Math.floor(state.pos / Inertia.W) + 0.5) * c
    if (Math.abs(x - bx) < c / 2 && Math.abs(y - by) < c / 2) return
    // Octant, 0 = up, clockwise, as in logic/inertia.js.
    var a = Math.atan2(x - bx, -(y - by))
    state = Inertia.move(state, (Math.round(a / (Math.PI / 4)) + 8) % 8)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Inertia.W, parent.height / Inertia.H))
    width: cell * Inertia.W
    height: cell * Inertia.H

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
      var s = root.state, c = cell, W = Inertia.W
      for (var i = 0; i < W * Inertia.H; ++i) {
        var x = (i % W) * c, y = Math.floor(i / W) * c, cx = x + c / 2, cy = y + c / 2, k = Inertia.cellAt(s, i)
        ctx.fillStyle = k === "#" ? theme.withAlpha(theme.foreground, 0.55) : theme.withAlpha(theme.foreground, 0.04)
        ctx.fillRect(x + 1, y + 1, c - 2, c - 2)
        if (k === "s") {
          ctx.strokeStyle = theme.dim; ctx.lineWidth = Math.max(1.5, c * 0.05)
          ctx.beginPath(); ctx.arc(cx, cy, c * 0.34, 0, Math.PI * 2); ctx.stroke()
        } else if (k === "g") {
          ctx.fillStyle = theme.tone(2)
          ctx.beginPath(); ctx.moveTo(cx, cy - c * 0.3); ctx.lineTo(cx + c * 0.24, cy); ctx.lineTo(cx, cy + c * 0.3); ctx.lineTo(cx - c * 0.24, cy)
          ctx.closePath(); ctx.fill()
        } else if (k === "m") {
          ctx.fillStyle = theme.danger
          ctx.beginPath(); ctx.arc(cx, cy, c * 0.2, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = theme.danger; ctx.lineWidth = Math.max(1.5, c * 0.05)
          ctx.beginPath()
          for (var a = 0; a < 8; ++a) {
            var an = a * Math.PI / 4
            ctx.moveTo(cx + Math.cos(an) * c * 0.2, cy + Math.sin(an) * c * 0.2)
            ctx.lineTo(cx + Math.cos(an) * c * 0.32, cy + Math.sin(an) * c * 0.32)
          }
          ctx.stroke()
        }
      }
      // Last slide's trail.
      if (s.trail.length > 1) {
        ctx.strokeStyle = theme.withAlpha(theme.accent, 0.35); ctx.lineWidth = Math.max(2, c * 0.08); ctx.lineCap = "round"
        ctx.beginPath()
        for (var t = 0; t < s.trail.length; ++t) {
          var tx = (s.trail[t] % W) * c + c / 2, ty = Math.floor(s.trail[t] / W) * c + c / 2
          if (t === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty)
        }
        ctx.stroke()
      }
      var bx = (s.pos % W) * c + c / 2, by = Math.floor(s.pos / W) * c + c / 2
      ctx.fillStyle = s.dead ? theme.danger : theme.accent
      ctx.beginPath(); ctx.arc(bx, by, c * 0.3, 0, Math.PI * 2); ctx.fill()
      if (s.dead) {
        ctx.strokeStyle = theme.background; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(bx - c * 0.14, by - c * 0.14); ctx.lineTo(bx + c * 0.14, by + c * 0.14)
        ctx.moveTo(bx + c * 0.14, by - c * 0.14); ctx.lineTo(bx - c * 0.14, by + c * 0.14); ctx.stroke()
      }
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.85 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
