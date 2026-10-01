import QtQuick
import "../engine" as Engine
import "logic/ringtoss.js" as Ring

// Ring Toss (see logic/ringtoss.js): slide the aim, throw as the marker sweeps past a bottle.
Engine.GameBase {
  id: root
  gameId: "ringtoss"
  title: "RING TOSS"
  helpText: "LEFT/RIGHT slide the aim · SPACE throw as the sweeping marker passes a bottle · Twelve rings; back rows are worth more (10, 25, 50, and 100 for the far one) · Farther throws wobble more · Ring every bottle for a 200 bonus"
  mouseHelp: "Move to aim, click to throw"

  property var state: null
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  score: state ? state.total : 0
  overTitle: state ? state.hits + " RINGERS · " + state.total : ""
  status: !state ? ""
    : over ? state.hits + " rings landed  ·  " + state.total + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.rings + " RINGS LEFT" + (state.msg ? "  ·  " + state.msg : "")

  onTick: { state = Ring.step(state, tickInterval / 1000); if (state.done && state.phase !== "fly") over = true }

  function newGame() { state = Ring.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && dx) state = Ring.aim(state, state.ax + dx * 0.035) }
  function activate() { if (over) newGame(); else if (state) state = Ring.toss(state) }
  function pointer(kind, x, y, b) {
    if (!state) return
    if (kind === "move" || kind === "drag") state = Ring.aim(state, x / board.width)
    else if (kind === "press" && b === Qt.LeftButton) { state = Ring.aim(state, x / board.width); activate() }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    // Table depth d (0 near, 1 far) to screen y, with the far end narrower.
    function py(d) { return height * 0.88 - d * height * 0.74 }
    function px(x, d) { return width / 2 + (x - 0.5) * width * (1 - d * 0.22) }
    function ring(ctx, x, y, r, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(x - r, y - r * 0.45, r * 2, r * 0.9); ctx.stroke() }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.18)
      ctx.beginPath(); ctx.moveTo(px(0, 1) - 8, py(1.04)); ctx.lineTo(px(1, 1) + 8, py(1.04)); ctx.lineTo(px(1, 0) + 14, py(0.02)); ctx.lineTo(px(0, 0) - 14, py(0.02)); ctx.closePath(); ctx.fill()
      var sc = 1
      for (var i = 0; i < s.bottles.length; ++i) {
        var b = s.bottles[i], x = px(b.x, b.y), y = py(b.y), k = 1 - b.y * 0.22, bh = height * 0.07 * k, bw = width * 0.025 * k
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.55)
        ctx.fillRect(x - bw, y - bh, bw * 2, bh)
        ctx.fillRect(x - bw * 0.45, y - bh * 1.4, bw * 0.9, bh * 0.45)
        if (b.on) board.ring(ctx, x, y - bh * 1.05, bw * 1.6, theme.highlight, 3 * k)
        ctx.fillStyle = theme.dim; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = Math.floor(height * 0.022 * k) + "px " + theme.fontFamily
        ctx.fillText(String(b.pts), x, y + 3)
      }
      // The marker and the ring in flight.
      if (s.phase === "aim" && !root.over) board.ring(ctx, px(s.ax, Ring.depth(s.m)), py(Ring.depth(s.m)), width * 0.034, theme.accent, 2.5)
      if (s.fly) {
        var p = Math.min(1, s.fly.t / 0.5), fx = px(s.ax + (s.fly.x - s.ax) * p, s.fly.y * p)
        var fy = py(s.fly.y * p) - Math.sin(p * Math.PI) * height * 0.22
        board.ring(ctx, fx, fy, width * 0.034 * (1 - p * 0.15), theme.accent, 4)
      }
      for (var r = 0; r < s.rings; ++r) board.ring(ctx, 18 + r * 22, height - 14, 8, theme.dim, 2)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
