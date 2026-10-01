import QtQuick
import "../engine" as Engine
import "logic/cyclone.js" as Cyclone

// Cyclone, the light-chaser (see logic/cyclone.js).
Engine.GameBase {
  id: root
  gameId: "cyclone"
  title: "CYCLONE"
  helpText: "A light races round the ring; SPACE stops it · the jackpot at the top pays 500, either side of it 100, the marked lights 25, the rest 5 · ten spins, each faster, and later ones surge to throw you off"
  mouseHelp: "Click stops the light"

  property var state: null
  tickInterval: 16
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? state.score + " POINTS" : ""
  status: !state ? ""
    : over ? "DONE  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "SPIN " + state.spin + "/" + Cyclone.SPINS + (state.phase === "held" ? "  ·  +" + state.lastPay + (state.lastPay >= 500 ? "  JACKPOT!" : "") : "")

  onTick: { state = Cyclone.step(state, tickInterval / 1000); if (state.done) over = true }
  function newGame() { state = Cyclone.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Cyclone.stop(state)
  }

  // Mouse (engine/Pointer.qml): click stops the light.
  function pointer(kind, x, y, b) { if (kind === "press" && b === Qt.LeftButton) activate() }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    width: Math.min(parent.width, parent.height)
    height: width

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
      var s = root.state, cx = width / 2, cy = height / 2, R = width * 0.4, lr = width * 0.026
      var cur = Cyclone.current(s)
      for (var i = 0; i < Cyclone.LIGHTS; ++i) {
        var a = -Math.PI / 2 + i / Cyclone.LIGHTS * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R
        var pay = Cyclone.payFor(i), on = i === cur && !root.over
        var blink = s.phase === "held" && i === s.last && Math.floor(s.hold * 8) % 2 === 0
        var col = pay >= 500 ? theme.tone(3) : pay >= 100 ? theme.tone(1) : pay >= 25 ? theme.accent : theme.dim
        ctx.fillStyle = on || blink ? col : theme.withAlpha(col, 0.18)
        ctx.beginPath(); ctx.arc(x, y, pay >= 500 ? lr * 1.6 : lr, 0, Math.PI * 2); ctx.fill()
        if (on) {
          ctx.fillStyle = theme.withAlpha(col, 0.25)
          ctx.beginPath(); ctx.arc(x, y, lr * 2.2, 0, Math.PI * 2); ctx.fill()
        }
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillStyle = theme.tone(3)
      ctx.font = "bold " + Math.floor(width * 0.05) + "px " + theme.fontFamily
      ctx.fillText("JACKPOT 500", cx, cy - R * 0.72)
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(width * 0.12) + "px " + theme.fontFamily
      ctx.fillText(String(s.score), cx, cy)
      ctx.fillStyle = theme.dim
      ctx.font = Math.floor(width * 0.04) + "px " + theme.fontFamily
      ctx.fillText(s.log.join("  "), cx, cy + R * 0.35)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
