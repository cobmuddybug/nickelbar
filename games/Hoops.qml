import QtQuick
import "../engine" as Engine
import "logic/hoops.js" as Hoops

// Hoops, after Pop-A-Shot (see logic/hoops.js).
Engine.GameBase {
  id: root
  gameId: "hoops"
  title: "HOOPS"
  helpText: "The aim sweeps side to side by itself · hold SPACE to build power and let go to shoot: aim on the hoop, power in the marked band · baskets are 2, 3 in the last ten seconds · after twenty seconds the hoop starts to move · 45 seconds"
  mouseHelp: "Hold the button to build power, let go to shoot"

  property var state: null
  tickInterval: 16
  continuousMove: true            // for heldAction: SPACE is held to charge
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? state.made + " BASKETS · " + state.score : ""
  status: !state ? ""
    : over ? "BUZZER  ·  SPACE to play again"
    : paused ? "PAUSED"
    : Math.ceil(state.clock) + "s  ·  " + state.made + "/" + state.shots + (state.clock <= 10 ? "  ·  3-POINT TIME" : "")

  onHeldActionChanged: if (state && !over) state = heldAction ? Hoops.charge(state) : Hoops.release(state)
  onTick: { state = Hoops.step(state, tickInterval / 1000); if (state.done) over = true }

  function newGame() { state = Hoops.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame() }

  // Mouse (engine/Pointer.qml): hold the button to build power, let go to shoot.
  function pointer(kind, x, y, b) {
    if (!state || over || b !== Qt.LeftButton && kind !== "release") return
    if (kind === "press") state = Hoops.charge(state)
    else if (kind === "release") state = Hoops.release(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    height: parent.height
    width: Math.min(parent.width, height * 0.9)

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
      var s = root.state, w = width, h = height
      var hoopY = h * 0.3, hx = Hoops.hoopX(s, s.clock) * w, hr = Hoops.HOOP_R * w
      // Backboard, hoop, net.
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.5); ctx.lineWidth = 2
      ctx.strokeRect(hx - hr * 2.2, hoopY - hr * 2.4, hr * 4.4, hr * 2.6)
      ctx.strokeRect(hx - hr * 0.8, hoopY - hr * 1.3, hr * 1.6, hr * 1.1)
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.35); ctx.lineWidth = 1
      for (var n = 0; n < 5; ++n) {
        ctx.beginPath(); ctx.moveTo(hx - hr + n * hr / 2, hoopY); ctx.lineTo(hx - hr * 0.6 + n * hr * 0.3, hoopY + hr * 1.2); ctx.stroke()
      }
      ctx.strokeStyle = theme.danger; ctx.lineWidth = Math.max(3, w * 0.008)
      ctx.beginPath(); ctx.moveTo(hx - hr, hoopY); ctx.lineTo(hx + hr, hoopY); ctx.stroke()

      // Balls in flight: an arc from the shooter to where they end up.
      for (var i = 0; i < s.balls.length; ++i) {
        var b = s.balls[i], k = Math.min(1, b.t / Hoops.FLIGHT)
        var endY = b.made ? hoopY + hr * 1.5 : b.power < Hoops.SWEET ? hoopY + h * (Hoops.SWEET - b.power) * 0.8 : hoopY - hr
        var x = (b.from + (b.to - b.from) * k) * w, y = h * 0.88 + (endY - h * 0.88) * k - Math.sin(k * Math.PI) * h * 0.35
        if (b.t > Hoops.FLIGHT) { y = endY + (b.t - Hoops.FLIGHT) * h * 0.8; x = b.to * w + (b.made ? 0 : (b.to * w < hx ? -1 : 1) * (b.t - Hoops.FLIGHT) * w * 0.3) }
        ctx.fillStyle = theme.tone(3)
        ctx.beginPath(); ctx.arc(x, y, w * 0.035 * (1 - k * 0.35), 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.withAlpha(theme.background, 0.6); ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(x - w * 0.03, y); ctx.lineTo(x + w * 0.03, y); ctx.stroke()
      }

      if (!root.over) {
        // Aim marker sweeping along the floor.
        var ax = s.aim * w
        ctx.fillStyle = theme.accent
        ctx.beginPath(); ctx.moveTo(ax, h * 0.8); ctx.lineTo(ax - w * 0.025, h * 0.84); ctx.lineTo(ax + w * 0.025, h * 0.84); ctx.fill()
        ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.9); ctx.lineTo(ax, hoopY + hr * 2); ctx.stroke()
        // Power meter with the good band.
        var mx = w * 0.9, my = h * 0.45, mh = h * 0.42, mw = w * 0.04
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.08); ctx.fillRect(mx, my, mw, mh)
        ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.45)
        ctx.fillRect(mx, my + mh * (1 - Hoops.SWEET - Hoops.BAND), mw, mh * Hoops.BAND * 2)
        ctx.fillStyle = s.charging ? theme.accent : theme.dim
        ctx.fillRect(mx + mw * 0.2, my + mh * (1 - s.power), mw * 0.6, mh * s.power)
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      if (s.noteLife > 0) {
        ctx.fillStyle = theme.withAlpha(s.note.indexOf("+") >= 0 ? theme.highlight : theme.dim, Math.min(1, s.noteLife * 2))
        ctx.font = "bold " + Math.floor(w * 0.06) + "px " + theme.fontFamily
        ctx.fillText(s.note, w / 2, h * 0.62)
      }
      ctx.fillStyle = s.clock <= 10 ? theme.danger : theme.foreground
      ctx.font = "bold " + Math.floor(w * 0.07) + "px " + theme.fontFamily
      ctx.fillText(Math.ceil(s.clock) + "", w * 0.1, h * 0.08)
      ctx.fillStyle = theme.accent
      ctx.fillText(String(s.score), w * 0.9, h * 0.08)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
