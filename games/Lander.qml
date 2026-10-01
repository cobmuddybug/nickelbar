import QtQuick
import "../engine/Rng.js" as Rng
import "../engine" as Engine
import "logic/lander.js" as Lander

// Lunar Lander. LEFT/RIGHT rotate and UP (or SPACE) burns for as long as
// they're held. Score is points from landings; the game ends when the fuel
// is gone.
Engine.GameBase {
  id: root
  gameId: "lander"
  title: "MOON LANDER"
  helpText: "LEFT/RIGHT rotate · UP or SPACE burn (hold) · land upright, slow and on a flat pad · ×2 ×3 ×5 pads, narrower pays more · a landing refuels a little, a crash costs 200 fuel · out of fuel ends it"
  mouseHelp: "Hold the button to burn"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? state.landings + " LANDINGS · " + state.score : ""
  status: !state ? ""
    : (over ? "OUT OF FUEL  ·  N for a new game"
      : (paused ? "PAUSED"
        : "ROUND " + state.round + "  ·  FUEL " + Math.round(state.fuel) + "  ·  " + state.landings + " landed"))

  onTick: {
    state = Lander.step(state, { turn: heldDx, burn: heldDy < 0 || heldAction }, tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Lander.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {}

  function activate() {
    if (over) newGame()
  }

  function saveState() {
    if (!state || over) return null
    return Lander.serialize(state)
  }

  function loadState(saved) {
    var restored = Lander.deserialize(saved)
    if (restored) { state = restored; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): hold the button to burn.
  function pointer(kind, x, y, b) {
    if (kind === "press" && b === Qt.LeftButton) { activate(); heldAction = true }
    if (kind === "release") heldAction = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Lander.W, parent.height / Lander.H)
    width: unit * Lander.W
    height: unit * Lander.H

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
      var s = root.state, u = unit

      ctx.strokeStyle = theme.faint
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

      // Terrain: filled ridge, pads picked out with their multiplier.
      var pts = s.terrain.pts
      ctx.beginPath()
      ctx.moveTo(0, height)
      for (var i = 0; i < pts.length; ++i) ctx.lineTo(pts[i].x * u, pts[i].y * u)
      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.1)
      ctx.fill()
      ctx.beginPath()
      for (var j = 0; j < pts.length; ++j) {
        if (j === 0) ctx.moveTo(pts[j].x * u, pts[j].y * u); else ctx.lineTo(pts[j].x * u, pts[j].y * u)
      }
      ctx.strokeStyle = theme.dim
      ctx.lineWidth = Math.max(1, u * 0.003)
      ctx.stroke()

      ctx.font = "bold " + Math.floor(u * 0.028) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "top"
      for (var p = 0; p < s.terrain.pads.length; ++p) {
        var pad = s.terrain.pads[p]
        ctx.strokeStyle = theme.tone(pad.mult === 5 ? 1 : pad.mult === 3 ? 2 : 0)
        ctx.lineWidth = Math.max(2, u * 0.007)
        ctx.beginPath(); ctx.moveTo(pad.x0 * u, pad.y * u); ctx.lineTo(pad.x1 * u, pad.y * u); ctx.stroke()
        ctx.fillStyle = ctx.strokeStyle
        ctx.fillText("×" + pad.mult, (pad.x0 + pad.x1) / 2 * u, pad.y * u + u * 0.012)
      }

      // Debris.
      for (var k = 0; k < s.sparks.length; ++k) {
        var sp = s.sparks[k]
        ctx.fillStyle = theme.withAlpha(theme.danger, Math.min(1, sp.life))
        ctx.fillRect(sp.x * u - 1, sp.y * u - 1, 2.5, 2.5)
      }

      // The lander: cabin, legs, and a flame while burning.
      var sh = s.ship
      if (s.phase !== "crashed") {
        ctx.save()
        ctx.translate(sh.x * u, sh.y * u)
        ctx.rotate(sh.a)
        var h = Lander.SHIP_H * u, w = Lander.SHIP_W * u
        ctx.strokeStyle = theme.foreground
        ctx.lineWidth = Math.max(1.5, u * 0.003)
        ctx.beginPath(); ctx.arc(0, -h * 0.25, w * 0.55, 0, Math.PI * 2); ctx.stroke()
        ctx.strokeRect(-w * 0.6, h * 0.1, w * 1.2, h * 0.35)
        ctx.beginPath()
        ctx.moveTo(-w * 0.5, h * 0.45); ctx.lineTo(-w, h)
        ctx.moveTo(w * 0.5, h * 0.45); ctx.lineTo(w, h)
        ctx.moveTo(-w * 1.2, h); ctx.lineTo(-w * 0.8, h)
        ctx.moveTo(w * 0.8, h); ctx.lineTo(w * 1.2, h)
        ctx.stroke()
        if (s.burning) {
          ctx.strokeStyle = theme.accent
          ctx.beginPath()
          ctx.moveTo(-w * 0.3, h * 0.5); ctx.lineTo(0, h * (1.1 + Rng.random() * 0.6)); ctx.lineTo(w * 0.3, h * 0.5)
          ctx.stroke()
        }
        ctx.restore()
      }

      // Instruments, top right. Speeds go red when they'd crash you.
      var fs = Math.max(10, Math.floor(u * 0.03))
      ctx.font = fs + "px " + theme.fontFamily
      ctx.textAlign = "right"; ctx.textBaseline = "top"
      var lines = [
        ["ALT " + Math.round(Lander.altitude(s) * 1000), false],
        ["H.SPD " + Math.round(sh.vx * 1000), Math.abs(sh.vx) > Lander.SAFE_VX],
        ["V.SPD " + Math.round(sh.vy * 1000), sh.vy > Lander.SAFE_VY],
        ["FUEL " + Math.round(s.fuel), s.fuel < 150]
      ]
      for (var l = 0; l < lines.length; ++l) {
        ctx.fillStyle = lines[l][1] ? theme.danger : theme.dim
        ctx.fillText(lines[l][0], width - fs * 0.6, fs * 0.5 + l * fs * 1.25)
      }
      // Fuel bar.
      ctx.fillStyle = theme.faint
      ctx.fillRect(fs * 0.6, fs * 0.6, width * 0.25, fs * 0.5)
      ctx.fillStyle = s.fuel < 150 ? theme.danger : theme.accent
      ctx.fillRect(fs * 0.6, fs * 0.6, width * 0.25 * Math.min(1, s.fuel / Lander.START_FUEL), fs * 0.5)

      if (s.result) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.font = "bold " + Math.floor(u * 0.045) + "px " + theme.fontFamily
        ctx.fillStyle = s.result.ok ? theme.accent : theme.danger
        ctx.fillText(s.result.text, width / 2, height * 0.3)
      }

      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.7 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
