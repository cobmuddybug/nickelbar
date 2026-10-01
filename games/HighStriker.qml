import QtQuick
import "../engine" as Engine
import "logic/striker.js" as Strike

// High Striker (see logic/striker.js): mash for power, strike for the bell.
Engine.GameBase {
  id: root
  gameId: "striker"
  title: "HIGH STRIKER"
  helpText: "SPACE mash to build hammer power (it drains if you stop) · S strike · Ring the bell by striking with the meter in the gold band · Go past it and the puck overshoots, scoring less than a gentle swing · Five swings; after seven seconds the hammer swings itself"
  mouseHelp: "Left-click to build power, right-click to strike"

  property var state: null
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  continuousMove: true
  score: state ? state.total : 0
  overTitle: state ? state.total + " POINTS" : ""
  status: !state ? ""
    : over ? "FIVE SWINGS  ·  " + state.total + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "SWING " + state.swing + "/" + Strike.SWINGS + (state.phase === "mash" ? "  ·  MASH SPACE, S to strike" : "  ·  " + state.outcome)

  onTick: { state = Strike.step(state, tickInterval / 1000); if (state.done) over = true }

  function newGame() { state = Strike.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame(); else if (state) state = Strike.mash(state) }
  function handleKey(key, text) {
    if (!state || over || !text) return false
    if (text === "s" || text === "S") { state = Strike.strike(state); return true }
    return false
  }
  function pointer(kind, x, y, b) {
    if (kind !== "press" || !state) return
    if (b === Qt.RightButton) state = Strike.strike(state); else state = Strike.mash(state)
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

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var top = height * 0.12, bot = height * 0.88, th = bot - top, cx = width * 0.5, tw = Math.min(width * 0.12, 60)
      var y = function(p) { return bot - Math.min(1.5, p) / 1.5 * th * 0.9 }
      // Tower with the bell band in gold.
      ctx.fillStyle = theme.faint; ctx.fillRect(cx - tw / 2, top, tw, th)
      ctx.fillStyle = theme.withAlpha(theme.tone(3), 0.7)
      ctx.fillRect(cx - tw / 2, y(Strike.BELL_HI), tw, y(Strike.BELL_LO) - y(Strike.BELL_HI))
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 1
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = Math.floor(height * 0.025) + "px " + theme.fontFamily; ctx.fillStyle = theme.dim
      for (var m = 0; m <= 10; ++m) { var yy = y(m / 10); ctx.beginPath(); ctx.moveTo(cx + tw / 2, yy); ctx.lineTo(cx + tw / 2 + 8, yy); ctx.stroke() }
      ctx.fillText("BELL", cx + tw / 2 + 12, y(0.95))
      // Bell on top, lit by a jackpot.
      var ding = s.phase === "result" && s.level >= Strike.BELL_LO && s.level <= Strike.BELL_HI
      ctx.fillStyle = ding ? theme.highlight : theme.tone(3)
      ctx.beginPath(); ctx.arc(cx, top - 4, tw * 0.55, Math.PI, 0); ctx.lineTo(cx + tw * 0.6, top + 6); ctx.lineTo(cx - tw * 0.6, top + 6); ctx.closePath(); ctx.fill()
      // The puck.
      var pp = s.phase === "mash" ? 0 : s.puck
      ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(cx, y(pp) - 6, tw * 0.28, 0, Math.PI * 2); ctx.fill()
      // Power meter on the left.
      var mw = Math.min(width * 0.1, 44), mx = width * 0.14
      ctx.fillStyle = theme.faint; ctx.fillRect(mx, top, mw, th)
      var pw = s.phase === "mash" ? s.power : s.level
      ctx.fillStyle = pw > Strike.BELL_HI ? theme.danger : pw >= Strike.BELL_LO ? theme.tone(3) : theme.accent
      ctx.fillRect(mx, y(pw), mw, bot - y(pw))
      ctx.strokeStyle = theme.tone(3); ctx.lineWidth = 2; ctx.strokeRect(mx - 2, y(Strike.BELL_HI), mw + 4, y(Strike.BELL_LO) - y(Strike.BELL_HI))
      // Scores so far.
      ctx.textAlign = "right"; ctx.font = "bold " + Math.floor(height * 0.04) + "px " + theme.fontFamily
      for (var i = 0; i < Strike.SWINGS; ++i) {
        var v = s.scores[i]
        ctx.fillStyle = v === 250 ? theme.highlight : v === undefined ? theme.faint : theme.foreground
        ctx.fillText(v === undefined ? "—" : String(v), width - 24, top + 10 + i * height * 0.06)
      }
      if (s.phase === "result") { ctx.textAlign = "center"; ctx.fillStyle = theme.highlight; ctx.font = "bold " + Math.floor(height * 0.04) + "px " + theme.fontFamily; ctx.fillText(s.outcome, cx, height * 0.06) }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
