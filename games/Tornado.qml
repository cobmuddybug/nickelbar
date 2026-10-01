import QtQuick
import "../engine" as Engine
import "logic/tornado.js" as Tor

// Tornado (see logic/tornado.js): drop balls through the storm, steer with wind.
Engine.GameBase {
  id: root
  gameId: "tornado"
  title: "TORNADO"
  helpText: "LEFT/RIGHT slide the dropper (hold) · SPACE drop a ball · A / D blow wind left or right (toggle) while balls fall · Thirty balls; three arms sweep round the funnel and a swirl drags balls along · The slots pay 5 to 50, and the eye in the middle pays 250"
  mouseHelp: "Move to slide the dropper, click to drop; hold the right mouse button to blow right, middle to blow left"

  property var state: null
  property int wind: 0
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  continuousMove: true
  score: state ? state.score : 0
  overTitle: state ? state.score + " POINTS" : ""
  status: !state ? ""
    : over ? "STORM OVER  ·  " + state.score + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.left + " BALLS LEFT" + (state.msg ? "  ·  " + state.msg : "")

  onTick: {
    var s = state
    if (heldDx) s = Tor.slide(s, heldDx * 0.5 * tickInterval / 1000)
    state = Tor.step(Tor.setWind(s, wind), tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Tor.makeState(); over = false; paused = false; wind = 0 }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame(); else if (state) state = Tor.drop(state) }
  function handleKey(key, text) {
    if (!text) return false
    if (text === "a" || text === "A") { wind = wind === -1 ? 0 : -1; return true }
    if (text === "d" || text === "D") { wind = wind === 1 ? 0 : 1; return true }
    return false
  }
  function pointer(kind, x, y, b) {
    if (!state) return
    if (kind === "move" || kind === "drag") state = Tor.slide(state, x / board.width - state.x)
    else if (kind === "press") { if (b === Qt.RightButton) wind = 1; else if (b === Qt.MiddleButton) wind = -1; else activate() }
    else if (kind === "release") wind = 0
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent
    readonly property real u: Math.min(width, height / 1.2)

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
      var u = board.u, ox = (width - u) / 2
      var X = function(x) { return ox + x * u }, Y = function(y) { return y * u }
      // Funnel glow and arms.
      ctx.fillStyle = theme.withAlpha(theme.accent, 0.1)
      ctx.beginPath(); ctx.arc(X(Tor.CX), Y(Tor.CY), 0.3 * u, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = theme.tone(1); ctx.lineWidth = Math.max(4, u * 0.022); ctx.lineCap = "round"
      for (var k = 0; k < 3; ++k) { var e = Tor.armEnds(s, k); ctx.beginPath(); ctx.moveTo(X(e.ax), Y(e.ay)); ctx.lineTo(X(e.bx), Y(e.by)); ctx.stroke() }
      // Dropper and wind.
      ctx.fillStyle = theme.tone(2); ctx.fillRect(X(s.x) - u * 0.035, 0, u * 0.07, u * 0.03)
      if (s.wind) { ctx.strokeStyle = theme.dim; ctx.lineWidth = 2; for (var w = 0; w < 4; ++w) { var wy = Y(0.2 + w * 0.2), dir = s.wind; ctx.beginPath(); ctx.moveTo(X(0.5) - dir * u * 0.3, wy); ctx.lineTo(X(0.5) + dir * u * 0.3, wy); ctx.stroke() } }
      // Balls.
      ctx.fillStyle = theme.highlight
      s.balls.forEach(function(b) { ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), Tor.BR * u, 0, Math.PI * 2); ctx.fill() })
      // Slots.
      var n = Tor.SLOTS.length, sw = u / n
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold " + Math.floor(u * 0.035) + "px " + theme.fontFamily
      for (var i = 0; i < n; ++i) {
        var v = Tor.SLOTS[i]
        ctx.fillStyle = v >= 250 ? theme.highlight : theme.withAlpha(theme.tone(i), 0.35)
        ctx.fillRect(ox + i * sw + 2, Y(Tor.FLOOR), sw - 4, u * 0.08)
        ctx.fillStyle = v >= 250 ? theme.background : theme.foreground; ctx.fillText(String(v), ox + (i + 0.5) * sw, Y(Tor.FLOOR) + u * 0.04)
      }
      ctx.fillStyle = theme.dim; ctx.textAlign = "left"; ctx.font = Math.floor(u * 0.03) + "px " + theme.fontFamily
      ctx.fillText("◀ A   wind   D ▶", ox + 6, height - 8)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
