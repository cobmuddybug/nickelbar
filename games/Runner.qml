import QtQuick
import "../engine" as Engine
import "logic/runner.js" as Runner

// Endless runner: jump the cacti, duck the high birds. Holding DOWN ducks
// (continuousMove). Runs are short, so there's no mid-run save.
Engine.GameBase {
  id: root
  gameId: "runner"
  title: "RUNNER"
  helpText: "SPACE/UP jump · hold DOWN to duck (or drop faster mid-air) · jump low birds, duck high ones · it keeps getting faster"
  mouseHelp: "Click jumps"

  property var state: null
  property bool started: false
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && started && !over
  score: state ? Runner.score(state) : 0
  overTitle: state ? Runner.score(state) + " M" : ""
  status: !state ? ""
    : (over ? "CRASHED  ·  N or SPACE to run again"
      : (paused ? "PAUSED" : (!started ? "SPACE to start" : Runner.score(state) + " m  ·  speed " + Math.round(state.speed * 100))))

  onTick: {
    state = Runner.step(state, { duck: heldDy > 0 }, tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Runner.makeState()
    started = false
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (dy < 0) activate()
  }

  function activate() {
    if (over) { newGame(); started = true; return }
    if (!state) return
    started = true
    state = Runner.jump(state)
  }

  // Mouse (engine/Pointer.qml): click jumps.
  function pointer(kind, x, y, b) {
    if (kind === "press" && b === Qt.LeftButton) { activate() }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Runner.VIEW_W, parent.height / 0.55)
    width: unit * Runner.VIEW_W
    height: unit * 0.55
    readonly property real groundY: height * 0.82

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
      var s = root.state, u = unit, gy = groundY

      // Parallax: far hills and ground speckle keyed off distance.
      var scroll = s.distance / 10
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
      for (var hIdx = -1; hIdx < 6; ++hIdx) {
        var hx = ((hIdx * 0.42 - scroll * 0.15) % 2.1 + 2.1) % 2.1 - 0.3
        ctx.beginPath()
        ctx.arc(hx * u, gy, u * (0.12 + (hIdx % 3) * 0.04), Math.PI, 0)
        ctx.fill()
      }
      ctx.strokeStyle = theme.dim
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke()
      ctx.fillStyle = theme.faint
      for (var d = 0; d < 30; ++d) {
        var dx = ((d * 0.137 - scroll) % Runner.VIEW_W + Runner.VIEW_W) % Runner.VIEW_W
        ctx.fillRect(dx * u, gy + 4 + (d % 4) * 4, (d % 3 + 1) * 3, 2)
      }

      function box(x, y, w, h) { ctx.fillRect(x * u, gy - (y + h) * u, w * u, h * u) }

      // Obstacles
      for (var i = 0; i < s.obstacles.length; ++i) {
        var o = s.obstacles[i]
        if (o.kind === "cactus") {
          ctx.fillStyle = theme.tone(2)
          var each = (o.w - 0.01 * (o.n - 1)) / o.n
          for (var k = 0; k < o.n; ++k) {
            var cx = o.x + k * (each + 0.01)
            box(cx + each * 0.3, 0, each * 0.4, o.h)
            box(cx, o.h * 0.35, each * 0.3, o.h * 0.3)
            box(cx + each * 0.7, o.h * 0.5, each * 0.3, o.h * 0.25)
          }
        } else {
          ctx.fillStyle = theme.danger
          var flap = Math.floor(s.clock * 6) % 2
          box(o.x + o.w * 0.25, o.y + o.h * 0.3, o.w * 0.5, o.h * 0.4)
          box(o.x, o.y + o.h * 0.4, o.w * 0.3, o.h * 0.2)
          box(o.x + o.w * 0.35, o.y + (flap ? o.h * 0.7 : 0), o.w * 0.3, o.h * 0.3)
        }
      }

      // Runner
      ctx.fillStyle = theme.foreground
      var rh = s.ducking ? Runner.DUCK_H : Runner.RUNNER_H
      var rw = s.ducking ? Runner.RUNNER_W * 1.35 : Runner.RUNNER_W
      box(Runner.RUNNER_X, s.y + rh * 0.25, rw, rh * 0.75)
      ctx.fillStyle = theme.background
      box(Runner.RUNNER_X + rw * 0.65, s.y + rh * 0.8, rw * 0.15, rh * 0.1)
      ctx.fillStyle = theme.foreground
      var stride = s.y > 0 ? 0 : Math.floor(s.clock * 12) % 2
      box(Runner.RUNNER_X + rw * 0.15, s.y + (stride ? rh * 0.08 : 0), rw * 0.2, rh * 0.25)
      box(Runner.RUNNER_X + rw * 0.6, s.y + (stride ? 0 : rh * 0.08), rw * 0.2, rh * 0.25)

      // Distance, top right.
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(u * 0.045) + "px " + theme.fontFamily
      ctx.textAlign = "right"
      ctx.textBaseline = "top"
      ctx.fillText(String(Runner.score(s)).padStart(5, "0"), width - 8, 8)

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
