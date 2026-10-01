import QtQuick
import "../engine" as Engine
import "logic/claw.js" as Claw

// Claw machine (see logic/claw.js).
Engine.GameBase {
  id: root
  gameId: "claw"
  title: "CLAW MACHINE"
  helpText: "Steer the claw over a prize and drop it · LEFT/RIGHT steer (hold to glide), SPACE or DOWN drop · 12 seconds to line up or it drops anyway · centre it: an off-centre or heavy prize can slip · every drop costs 100 of your 600 credits and prizes pay in: small 50, medium 150, big 400, gold 1000 · broke = game over"
  mouseHelp: "The claw follows the pointer; click drops it"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? state.won.length + " PRIZES · " + state.score : ""
  status: !state ? ""
    : over ? "BROKE  ·  SPACE to play again"
    : paused ? "PAUSED"
    : (state.noteLife > 0 ? state.note + "  ·  " : "") + state.credits + " credits  ·  " + state.tries + " goes left"
      + (state.phase === "move" ? "  ·  " + Math.ceil(state.timer) + "s" : "")

  onTick: {
    var dt = tickInterval / 1000, s = state
    if (heldDx) s = Claw.steer(s, heldDx * 0.35 * dt)
    state = Claw.step(s, dt)
    if (state.done) over = true
  }

  function newGame() { state = Claw.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dy > 0) state = Claw.drop(state)
    else if (dx) state = Claw.steer(state, dx * 0.01)
  }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Claw.drop(state)
  }

  // Mouse (engine/Pointer.qml): the claw follows the pointer; click drops it.
  function pointer(kind, x, y, b) {
    if (!state || over || state.phase !== "move") return
    state = Claw.steer(state, x / board.width - state.x)
    if (kind === "press" && b === Qt.LeftButton) state = Claw.drop(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    height: parent.height
    width: Math.min(parent.width, height * 0.85)

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
      // Cabinet glass and the chute.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.04)
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = theme.withAlpha(theme.accent, 0.2)
      ctx.fillRect(0, h * 0.62, Claw.CHUTE * w, h * 0.38)
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 2
      ctx.strokeRect(1, h * 0.62, Claw.CHUTE * w, h * 0.38 - 1)
      ctx.fillStyle = theme.accent
      ctx.font = "bold " + Math.floor(w * 0.03) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("PRIZE", Claw.CHUTE * w / 2, h * 0.66)
      // Gantry rail.
      ctx.fillStyle = theme.dim
      ctx.fillRect(0, h * 0.03, w, h * 0.012)

      // Prizes: soft round toys; the gold one shines.
      for (var i = 0; i < s.prizes.length; ++i) {
        var p = s.prizes[i], px = p.x * w, py = p.y * h, pr = p.r * w
        ctx.fillStyle = p.kind === 3 ? theme.tone(3) : theme.tone(p.hue)
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(px - pr * 0.65, py - pr * 0.75, pr * 0.3, 0, Math.PI * 2); ctx.arc(px + pr * 0.65, py - pr * 0.75, pr * 0.3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background
        ctx.beginPath(); ctx.arc(px - pr * 0.3, py - pr * 0.15, Math.max(1.5, pr * 0.1), 0, Math.PI * 2); ctx.arc(px + pr * 0.3, py - pr * 0.15, Math.max(1.5, pr * 0.1), 0, Math.PI * 2); ctx.fill()
        if (p.kind === 3) { ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, pr + 3, 0, Math.PI * 2); ctx.stroke() }
      }

      // Claw: cable, head, and three fingers that close.
      var cx = s.x * w, cy = s.y * h, spread = (0.3 + s.open * 0.7) * w * 0.05
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(cx, h * 0.036); ctx.lineTo(cx, cy - w * 0.02); ctx.stroke()
      ctx.fillStyle = theme.foreground
      ctx.fillRect(cx - w * 0.03, cy - w * 0.035, w * 0.06, w * 0.03)
      ctx.lineWidth = Math.max(2, w * 0.008)
      for (var f = -1; f <= 1; ++f) {
        ctx.beginPath(); ctx.moveTo(cx + f * w * 0.018, cy - w * 0.005)
        ctx.lineTo(cx + f * spread, cy + w * 0.03); ctx.lineTo(cx + f * spread * 0.6, cy + w * 0.055); ctx.stroke()
      }
      if (s.phase === "move" && !root.over) {
        ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(cx, cy + w * 0.06); ctx.lineTo(cx, Claw.floorAt(s, s.x) * h); ctx.stroke()
      }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
