import QtQuick
import "../engine" as Engine
import "logic/mindtester.js" as Mind

// Mind Tester (see logic/mindtester.js): one button, no game, a verdict.
Engine.GameBase {
  id: root
  gameId: "mindtester"
  title: "MIND TESTER"
  helpText: "SPACE test your mind (or click the button) · The machine measures you and it means nothing · Your best reading is the score"
  mouseHelp: "Click the button"

  property var state: null
  tickInterval: 16
  ticking: !!state && state.phase === "scan"
  endless: true
  score: state ? state.top : 0
  progress: state && state.n ? state.n + " tests" : ""
  status: !state ? ""
    : paused ? "PAUSED"
    : state.phase === "scan" ? "ANALYSING…"
    : state.phase === "show" ? "READING " + (state.odd ? "?" : state.iq) + "  ·  SPACE to test again"
    : "SPACE to begin"

  onTick: state = Mind.step(state, tickInterval / 1000)

  function newGame() { state = Mind.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() { if (state) state = Mind.press(state) }
  function saveState() { return state && state.top > 0 ? { top: state.top, n: state.n } : null }
  function loadState(saved) { newGame(); if (saved && saved.top) { var s = Mind.makeState(); s.top = saved.top; s.n = saved.n || 0; state = s } }
  function pointer(kind, x, y, b) { if (kind === "press" && b === Qt.LeftButton) activate() }

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

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var cx = width / 2, mw = Math.min(width * 0.7, 420), mh = height * 0.5, my = height * 0.08
      ctx.fillStyle = theme.faint; ctx.fillRect(cx - mw / 2, my, mw, mh)
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 3; ctx.strokeRect(cx - mw / 2, my, mw, mh)
      // Dial.
      var dy = my + mh * 0.55, R = mw * 0.32
      ctx.beginPath(); ctx.arc(cx, dy, R, Math.PI, 0); ctx.stroke()
      var frac = s.phase === "scan" ? 0.5 + Math.sin(s.t * 14) * 0.45 * (1 - s.fill * 0.5) : s.phase === "show" && !s.odd ? Math.max(0, Math.min(1, (s.iq - 40) / 140)) : 0.05
      var a = Math.PI + frac * Math.PI
      ctx.strokeStyle = theme.danger; ctx.beginPath(); ctx.moveTo(cx, dy); ctx.lineTo(cx + Math.cos(a) * R * 0.9, dy + Math.sin(a) * R * 0.9); ctx.stroke()
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillStyle = theme.foreground; ctx.font = "bold " + Math.floor(mh * 0.2) + "px " + theme.fontFamily
      if (s.phase === "show") ctx.fillText(s.odd ? "?" : String(s.iq), cx, my + mh * 0.82)
      ctx.font = Math.floor(height * 0.032) + "px " + theme.fontFamily
      ctx.fillStyle = s.phase === "show" ? theme.highlight : theme.dim
      var line = s.phase === "show" ? s.line : s.phase === "scan" ? "ANALYSING…" : "PLACE MIND ON THE BUTTON"
      ctx.fillText(line, cx, my + mh + height * 0.06, width * 0.9)
      // The button.
      var by = my + mh + height * 0.16, br = Math.min(width, height) * 0.1
      ctx.fillStyle = s.phase === "scan" ? theme.dim : theme.danger; ctx.beginPath(); ctx.arc(cx, by + br, br, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, by + br, br * 1.12, 0, Math.PI * 2); ctx.stroke()
      if (s.phase === "scan") { ctx.fillStyle = theme.accent; ctx.fillRect(cx - mw / 2, by + br * 2.4, mw * s.fill, 8) }
      ctx.fillStyle = theme.dim; ctx.font = Math.floor(height * 0.028) + "px " + theme.fontFamily
      ctx.fillText(s.history.join("   "), cx, height - 14)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
