import QtQuick
import "../engine" as Engine
import "logic/cave.js" as Cave

// Hold-to-climb cave flyer. Holding SPACE or UP lifts (continuousMove /
// heldAction); releasing sinks. The cave narrows the further you get.
Engine.GameBase {
  id: root
  gameId: "cave"
  title: "CAVE FLYER"
  helpText: "HOLD SPACE or UP to climb, let go to sink · dodge the walls and pillars · the cave narrows as you go"
  mouseHelp: "Hold the button to climb"

  property var state: null
  property bool started: false
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && started && !over
  score: state ? Cave.score(state) : 0
  overTitle: state ? Cave.score(state) + " M" : ""
  status: !state ? ""
    : (over ? "CRASHED  ·  N or SPACE to fly again"
      : (paused ? "PAUSED" : (!started ? "hold SPACE to take off" : Cave.score(state) + " m")))

  onTick: {
    state = Cave.step(state, { up: heldAction || heldDy < 0 }, tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Cave.makeState()
    started = false
    over = false
    paused = false
  }

  function moveCursor(dx, dy) { if (dy < 0 && !over) started = true }

  function activate() {
    if (over) { newGame(); started = true; return }
    started = true
  }

  // Mouse (engine/Pointer.qml): hold the button to climb.
  function pointer(kind, x, y, b) {
    if (kind === "press" && b === Qt.LeftButton) { activate(); heldAction = true }
    if (kind === "release") heldAction = false
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Cave.VIEW_W, parent.height)
    width: unit * Cave.VIEW_W
    height: unit

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

      // Rock: fill ceiling and floor as two polygons.
      var cols = s.cols
      ctx.fillStyle = theme.withAlpha(theme.tone(0), 0.35)
      ctx.beginPath()
      ctx.moveTo(-s.offset * u, 0)
      for (var i = 0; i < cols.length; ++i) ctx.lineTo((i * Cave.COL_W - s.offset) * u, cols[i].top * u)
      ctx.lineTo(width + 20, 0)
      ctx.closePath(); ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-s.offset * u, height)
      for (i = 0; i < cols.length; ++i) ctx.lineTo((i * Cave.COL_W - s.offset) * u, cols[i].bottom * u)
      ctx.lineTo(width + 20, height)
      ctx.closePath(); ctx.fill()

      ctx.strokeStyle = theme.tone(0)
      ctx.lineWidth = 2
      ctx.beginPath()
      for (i = 0; i < cols.length; ++i) { var x = (i * Cave.COL_W - s.offset) * u; if (i === 0) ctx.moveTo(x, cols[i].top * u); else ctx.lineTo(x, cols[i].top * u) }
      ctx.stroke()
      ctx.beginPath()
      for (i = 0; i < cols.length; ++i) { var x2 = (i * Cave.COL_W - s.offset) * u; if (i === 0) ctx.moveTo(x2, cols[i].bottom * u); else ctx.lineTo(x2, cols[i].bottom * u) }
      ctx.stroke()

      ctx.fillStyle = theme.tone(1)
      for (i = 0; i < cols.length; ++i) {
        var p = cols[i].pillar
        if (!p) continue
        ctx.fillRect((i * Cave.COL_W - s.offset) * u, p.top * u, Cave.COL_W * 1.6 * u, (p.bottom - p.top) * u)
      }

      // Exhaust trail, then the ship tilted with its climb rate.
      var speed = Cave.speedFor(s.distance)
      for (var t = 0; t < s.trail.length; ++t) {
        var age = s.trail.length - t
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.35 * (1 - age / s.trail.length))
        ctx.fillRect((Cave.SHIP_X - age * speed * 0.016) * u - 2, s.trail[t] * u - 1, 3, 3)
      }
      ctx.save()
      ctx.translate(Cave.SHIP_X * u, s.y * u)
      ctx.rotate(s.vy * 0.5)
      var R = Cave.SHIP_R * u
      ctx.fillStyle = theme.foreground
      ctx.beginPath()
      ctx.moveTo(R * 1.6, 0); ctx.lineTo(-R, R * 0.9); ctx.lineTo(-R * 0.5, 0); ctx.lineTo(-R, -R * 0.9)
      ctx.closePath(); ctx.fill()
      if (root.heldAction || root.heldDy < 0) {
        ctx.fillStyle = theme.danger
        ctx.fillRect(-R * 1.5, -R * 0.25, R * 0.8, R * 0.5)
      }
      ctx.restore()

      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(u * 0.04) + "px " + theme.fontFamily
      ctx.textAlign = "right"; ctx.textBaseline = "top"
      ctx.fillText(Cave.score(s) + " m", width - 8, 8)

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
