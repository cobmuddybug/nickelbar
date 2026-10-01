import QtQuick
import "../engine" as Engine
import "logic/newton.js" as Newt

// Newton's Apples (see logic/newton.js): fifty apples into a wheel of cups.
Engine.GameBase {
  id: root
  gameId: "newton"
  title: "NEWTON'S APPLES"
  helpText: "LEFT/RIGHT slide the dispenser (hold) · SPACE drop an apple · Fifty apples; catch them in the cups riding the wheel · A cup tips out and pays when it swings past the bottom (10, 20, 10, 50, 20 and the 100 jackpot cup) · Three or more in the jackpot cup is a 500 bonus · The wheel speeds up as you go"
  mouseHelp: "Move to slide the dispenser, click to drop"

  property var state: null
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  continuousMove: true
  score: state ? state.score : 0
  overTitle: state ? state.score + " POINTS" : ""
  status: !state ? ""
    : over ? "ALL APPLES DROPPED  ·  " + state.score + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.left + " APPLES LEFT" + (state.msg ? "  ·  " + state.msg : "")

  onTick: {
    var s = state
    if (heldDx) s = Newt.slide(s, heldDx * 0.6 * tickInterval / 1000)
    state = Newt.step(s, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Newt.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame(); else if (state) state = Newt.drop(state) }
  function pointer(kind, x, y, b) {
    if (!state) return
    if (kind === "move" || kind === "drag") state = Newt.slide(state, x / board.width - state.x)
    else if (kind === "press" && b === Qt.LeftButton) activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent
    readonly property real u: Math.min(width, height / 1.1)

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
      var u = board.u, ox = (width - u) / 2, oy = 0
      var X = function(x) { return ox + x * u }, Y = function(y) { return oy + y * u }
      // Dispenser.
      ctx.fillStyle = theme.tone(2); ctx.fillRect(X(s.x) - u * 0.04, Y(0), u * 0.08, u * 0.03)
      // Hub and cups.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.2); ctx.beginPath(); ctx.arc(X(Newt.CX), Y(Newt.CY), Newt.RD * u, 0, Math.PI * 2); ctx.fill()
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var i = 0; i < 6; ++i) {
        var c = s.cups[i], cp = Newt.cupPos(s, i), x = X(cp.x), y = Y(cp.y)
        ctx.fillStyle = c.jackpot ? theme.highlight : theme.tone(i)
        ctx.beginPath(); ctx.arc(x, y, Newt.CUP_R * u, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background; ctx.font = "bold " + Math.floor(u * 0.03) + "px " + theme.fontFamily
        ctx.fillText(String(c.value), x, y - 4)
        if (c.n) { ctx.fillStyle = theme.danger; ctx.font = "bold " + Math.floor(u * 0.028) + "px " + theme.fontFamily; ctx.fillText("×" + c.n, x, y + u * 0.025) }
      }
      // Apples.
      ctx.fillStyle = theme.danger
      s.apples.forEach(function(a) { ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), Newt.AR * u, 0, Math.PI * 2); ctx.fill() })
      // Apples remaining along the bottom.
      ctx.fillStyle = theme.withAlpha(theme.danger, 0.6)
      for (var k = 0; k < s.left; ++k) { ctx.beginPath(); ctx.arc(ox + 10 + (k % 25) * 9, height - 14 - Math.floor(k / 25) * 10, 3.5, 0, Math.PI * 2); ctx.fill() }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
