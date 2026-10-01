import QtQuick
import "../engine" as Engine
import "logic/pipeline.js" as Pipe

// Pipeline (after Pipe Mania); see logic/pipeline.js.
Engine.GameBase {
  id: root
  gameId: "pipeline"
  title: "PIPELINE"
  helpText: "Lay pipe from the source before the water comes · ARROWS move · SPACE lays the next piece (the queue on the left, next at the bottom) · laying over a dry pipe swaps it, -25 · run the level's quota before the water spills · 50 a length, a cross run both ways +500 · F lets the water rip (double points while it does) · U undo"
  mouseHelp: "Click a square to lay the next piece there; right-click lets the water rip"

  property var state: null
  tickInterval: 16
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? state.msg + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LEVEL " + state.level + "  ·  " + state.filled + "/" + Pipe.quota(state.level) + " pipes"
      + (state.wait > 0 ? "  ·  water in " + Math.ceil(state.wait) + "s" : "") + (state.fast ? "  ·  FAST" : "")

  onTick: {
    state = Pipe.step(state, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { clearUndo(); state = Pipe.makeState(); over = false; paused = false }

  // Lay a piece, remembering the board so it can be taken back (the state is
  // edited in place by the water, so the snapshot is a deep copy).
  function lay() {
    var snap = JSON.parse(JSON.stringify(state))
    var next = Pipe.place(state)
    if (next !== state) pushUndo(snap)
    state = next
  }
  // Only until the water starts moving, and only the latest pieces of this level.
  function undo() {
    if (!state || over) return
    var p = popUndo()
    if (!p) return
    if (state.wait > 0 && p.level === state.level) { var keepWait = state.wait; state = p; state.wait = keepWait }
    else { var n = JSON.parse(JSON.stringify(state)); n.msg = "TOO LATE TO UNDO"; n.msgT = 1; state = n }
  }
  function moveCursor(dx, dy) { if (state && !over) state = Pipe.moveCursor(state, dx, dy) }
  function activate() {
    if (over) { newGame(); return }
    if (state) lay()
  }
  function handleKey(key, text) {
    if (text === "f" || text === "F") { if (state && !over) state = Pipe.hurry(state); return true }
    return false
  }

  function pointer(kind, x, y, b) {
    if (!state || over) return
    var L = board.layout(), c = Math.floor((x - L.gx) / L.cs), r = Math.floor((y - L.gy) / L.cs)
    if (c < 0 || c >= Pipe.COLS || r < 0 || r >= Pipe.ROWS) return
    if (c !== state.cursor.c || r !== state.cursor.r) state = Pipe.setCursor(state, c, r)
    if (kind === "press") { if (b === Qt.RightButton) state = Pipe.hurry(state); else lay() }
  }

  // The whole state is plain data, so it saves as is.
  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    clearUndo()
    if (saved && typeof saved === "object" && saved.cells !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    anchors.fill: parent
    Engine.Pointer { game: root }

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function layout() {
      var cs = Math.min(width / (Pipe.COLS + 1.8), height / (Pipe.ROWS + 0.8))
      var gw = cs * Pipe.COLS, gx = (width - gw) / 2 + cs * 0.7, gy = (height - cs * Pipe.ROWS) / 2 + cs * 0.3
      return { cs: cs, gx: gx, gy: gy, qx: gx - cs * 1.4 }
    }

    // A piece at (x, y), size cs: pipe runs from the middle to each opening.
    // Solid walls with a hollow channel down the middle for the water.
    function piece(ctx, p, x, y, cs, col, w) {
      var ops = Pipe.openings(p), mx = x + cs / 2, my = y + cs / 2
      ctx.lineCap = "butt"
      for (var pass = 0; pass < 2; ++pass) {
        ctx.strokeStyle = pass ? theme.background : col
        ctx.lineWidth = pass ? w * 0.5 : w
        for (var i = 0; i < ops.length; ++i) {
          var lw = ctx.lineWidth
          ctx.beginPath(); ctx.moveTo(mx - ops[i].dc * lw / 2, my - ops[i].dr * lw / 2); ctx.lineTo(mx + ops[i].dc * cs / 2, my + ops[i].dr * cs / 2); ctx.stroke()
        }
      }
    }

    // Water along one stretch: in from `from`, out through `out`, up to t.
    function water(ctx, from, out, x, y, cs, t, w) {
      var mx = x + cs / 2, my = y + cs / 2, a = Pipe.dirOf(from), b = Pipe.dirOf(out)
      var ax = mx + a.dc * cs / 2, ay = my + a.dr * cs / 2
      ctx.strokeStyle = theme.accent; ctx.lineWidth = w; ctx.lineCap = "butt"
      ctx.beginPath(); ctx.moveTo(ax, ay)
      if (t <= 0.5) ctx.lineTo(ax + (mx - ax) * t * 2, ay + (my - ay) * t * 2)
      else { ctx.lineTo(mx, my); ctx.lineTo(mx + b.dc * cs / 2 * (t - 0.5) * 2, my + b.dr * cs / 2 * (t - 0.5) * 2) }
      ctx.stroke()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, L = layout(), cs = L.cs, pw = cs * 0.34, ww = cs * 0.17

      for (var r = 0; r < Pipe.ROWS; ++r) for (var c = 0; c < Pipe.COLS; ++c) {
        var cell = s.cells[Pipe.idx(c, r)], x = L.gx + c * cs, y = L.gy + r * cs
        ctx.fillStyle = (c + r) % 2 ? theme.withAlpha(theme.foreground, 0.05) : theme.withAlpha(theme.foreground, 0.08)
        ctx.fillRect(x, y, cs, cs)
        if (cell.wall) { ctx.fillStyle = theme.dim; ctx.fillRect(x + cs * 0.1, y + cs * 0.1, cs * 0.8, cs * 0.8); continue }
        if (cell.source) {
          piece(ctx, cell.p, x, y, cs, theme.foreground, pw)
          ctx.fillStyle = cell.wet ? theme.accent : theme.foreground
          ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * 0.3, 0, Math.PI * 2); ctx.fill()
          if (s.wait > 0) {
            // Countdown as a draining ring.
            ctx.strokeStyle = theme.accent; ctx.lineWidth = cs * 0.06
            ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, cs * 0.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.wait / Pipe.countdown(s.level)); ctx.stroke()
          }
          continue
        }
        if (!cell.p) continue
        piece(ctx, cell.p, x, y, cs, theme.foreground, pw)
        if (cell.p === 15) {
          if (cell.wet & 1) water(ctx, Pipe.N, Pipe.S, x, y, cs, 1, ww)
          if (cell.wet & 2) water(ctx, Pipe.W, Pipe.E, x, y, cs, 1, ww)
        } else if (cell.wet) {
          var ops = Pipe.openings(cell.p)
          water(ctx, ops[0].bit, ops[1].bit, x, y, cs, 1, ww)
        }
      }
      if (s.flow) water(ctx, s.flow.from, s.flow.out, L.gx + s.flow.c * cs, L.gy + s.flow.r * cs, cs, s.flow.t, ww)

      // Cursor with a ghost of the piece it would lay.
      if (s.phase === "play") {
        var cx = L.gx + s.cursor.c * cs, cy = L.gy + s.cursor.r * cs
        ctx.globalAlpha = 0.35
        piece(ctx, s.queue[0], cx, cy, cs, theme.highlight, pw)
        ctx.globalAlpha = 1
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 3
        ctx.strokeRect(cx + 1.5, cy + 1.5, cs - 3, cs - 3)
      }

      // Queue: next piece at the bottom.
      for (var q = 0; q < s.queue.length; ++q) {
        var qy = L.gy + (Pipe.ROWS - 1 - q) * cs * (Pipe.ROWS / Pipe.QUEUE > 1 ? 1 : Pipe.ROWS / Pipe.QUEUE)
        ctx.fillStyle = q === 0 ? theme.withAlpha(theme.accent, 0.2) : theme.withAlpha(theme.foreground, 0.05)
        ctx.fillRect(L.qx, qy, cs, cs)
        piece(ctx, s.queue[q], L.qx, qy, cs, q === 0 ? theme.foreground : theme.withAlpha(theme.foreground, 0.6), pw * 0.8)
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(cs * 0.3) + "px " + theme.fontFamily
      for (var o = 0; o < s.pops.length; ++o) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, s.pops[o].t * 2))
        ctx.fillText(s.pops[o].text, L.gx + (s.pops[o].c + 0.5) * cs, L.gy + (s.pops[o].r + 0.5) * cs)
      }
      if (s.msgT > 0) {
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(cs * 0.45) + "px " + theme.fontFamily
        ctx.fillText(s.msg, L.gx + Pipe.COLS * cs / 2, L.gy - cs * 0.02 < cs * 0.4 ? L.gy + Pipe.ROWS * cs / 2 : L.gy - cs * 0.3)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
