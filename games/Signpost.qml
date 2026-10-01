import QtQuick
import "../engine" as Engine
import "logic/signpost.js" as Signpost

// Signpost, after Simon Tatham's (see logic/signpost.js). Puzzles come from
// the prebuilt pack. Score is puzzles solved.
Engine.PackGame {
  id: root
  gameId: "signpost"
  title: "SIGNPOST"
  helpText: "Link the squares into one path from 1 to the last, each step going somewhere along the arrow of the square before · ARROWS move · SPACE pick a square, then SPACE on the one it leads to (that one's then picked, so you can keep going) · SPACE on the picked square lets go · X cut the links at a square · S size · U undo"
  mouseHelp: "Hover moves the cursor, LEFT does what SPACE does, RIGHT cuts the links"

  packName: "signpost"
  status: !pack.ready ? "LOADING PUZZLES…"
    : !state ? ""
    : over ? "SOLVED  ·  SPACE for the next one"
    : paused ? "PAUSED"
    : (state.note ? state.note.toUpperCase() + "  ·  " : "") + (state.from >= 0 ? "LINKING  ·  " : "")
      + sizeName + "  ·  #" + (state.idx + 1)

  function makePuzzleState(p, size, idx) { return Signpost.makeState(p, size, idx) }
  function restorePuzzleState(saved, p) { return Signpost.deserialize(saved, p) }
  function serializePuzzleState(s) { return Signpost.serialize(s) }

  function moveCursor(dx, dy) { if (state && !over) state = Signpost.moveCursor(state, dx, dy) }

  function activate() {
    if (!state) return
    if (over) { newGame(); return }
    state = Signpost.activate(state)
  }

  function undo() { if (state) state = Signpost.undo(state) }

  function handleKey(key, text) {
    if (!state) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "s") { nextSize(); return true }
    if (over) return false
    if (t === "x" || key === Qt.Key_Backspace || key === Qt.Key_Delete) { state = Signpost.clear(state); return true }
    return false
  }

  // Mouse (engine/Pointer.qml): hover moves the cursor, LEFT does what
  // SPACE does, RIGHT cuts the links.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind !== "move" && kind !== "press") return
    var cx = Math.floor((x - (0)) / (board.cell)), cy = Math.floor((y - (0)) / (board.cell))
    if (cx < 0 || cy < 0 || cx >= state.p.w || cy >= state.p.h) return
    if (cx !== state.cursor.x || cy !== state.cursor.y) moveCursor(cx - state.cursor.x, cy - state.cursor.y)
    if (kind !== "press" || b === Qt.MiddleButton) return
    if (b === Qt.RightButton) { state = Signpost.clear(state); return }
    activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property int cols: root.state ? root.state.p.w : 4
    readonly property int rows: root.state ? root.state.p.h : 4
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

    function arrow(ctx, cx, cy, r, d, color) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(d * Math.PI / 4)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, r * 0.1); ctx.lineTo(r * 0.25, r * 0.1)
      ctx.lineTo(r * 0.25, r * 0.8); ctx.lineTo(-r * 0.25, r * 0.8); ctx.lineTo(-r * 0.25, r * 0.1); ctx.lineTo(-r * 0.7, r * 0.1)
      ctx.closePath(); ctx.fill()
      ctx.restore()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, p = s.p, c = cell, N = p.w * p.h
      var nb = Signpost.numbering(s)
      var linked = {}
      for (var i = 0; i < N; ++i) if (s.succ[i] >= 0) { linked[i] = true; linked[s.succ[i]] = true }

      for (i = 0; i < N; ++i) {
        var x = (i % p.w) * c, y = Math.floor(i / p.w) * c, info = nb[i]
        // Chains get a tint of their own; anchored ones the accent.
        ctx.fillStyle = !linked[i] ? theme.withAlpha(theme.foreground, 0.04)
          : info.num ? theme.withAlpha(theme.accent, 0.22) : theme.withAlpha(theme.tone(info.chain + 1), 0.22)
        ctx.fillRect(x + 1, y + 1, c - 2, c - 2)
        if (s.from >= 0 && Signpost.inRay(p, s.from, i)) {
          ctx.strokeStyle = theme.withAlpha(theme.accent, 0.5); ctx.lineWidth = 2
          ctx.strokeRect(x + 4, y + 4, c - 8, c - 8)
        }
        // Arrow in the corner (a star on the last square).
        var given = p.nums[i]
        if (p.arrows[i] >= 0) arrow(ctx, x + c * 0.8, y + c * 0.2, c * 0.13, p.arrows[i], theme.dim)
        else {
          ctx.fillStyle = theme.dim
          ctx.font = Math.floor(c * 0.25) + "px " + theme.fontFamily
          ctx.textAlign = "center"; ctx.textBaseline = "middle"
          ctx.fillText("★", x + c * 0.8, y + c * 0.2)
        }
        var text = info.num ? String(info.num) : info.label
        if (text) {
          ctx.textAlign = "center"; ctx.textBaseline = "middle"
          ctx.font = (given ? "bold " : "") + Math.floor(c * (text.length > 3 ? 0.26 : 0.38)) + "px " + theme.fontFamily
          ctx.fillStyle = info.bad ? theme.danger : given ? theme.foreground : info.num ? theme.accent : theme.withAlpha(theme.foreground, 0.7)
          ctx.fillText(text, x + c / 2, y + c * 0.56)
        }
      }

      // Links as thin lines between centres.
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.35)
      ctx.lineWidth = Math.max(1.5, c * 0.03)
      for (i = 0; i < N; ++i) {
        var j = s.succ[i]
        if (j < 0) continue
        var ax = (i % p.w) * c + c / 2, ay = Math.floor(i / p.w) * c + c / 2
        var bx = (j % p.w) * c + c / 2, by = Math.floor(j / p.w) * c + c / 2
        var len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len
        ctx.beginPath(); ctx.moveTo(ax + ux * c * 0.3, ay + uy * c * 0.3); ctx.lineTo(bx - ux * c * 0.3, by - uy * c * 0.3); ctx.stroke()
      }

      if (s.from >= 0) {
        ctx.strokeStyle = theme.accent; ctx.lineWidth = 3
        ctx.strokeRect((s.from % p.w) * c + 2, Math.floor(s.from / p.w) * c + 2, c - 4, c - 4)
      }
      if (!root.over) {
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3
        ctx.strokeRect(s.cursor.x * c + 6, s.cursor.y * c + 6, c - 12, c - 12)
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
