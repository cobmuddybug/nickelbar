import QtQuick
import "../engine" as Engine
import "logic/jugs.js" as Jugs

// Milk Jugs (see logic/jugs.js): three balls to topple the pyramid.
Engine.GameBase {
  id: root
  gameId: "milkjugs"
  title: "MILK JUGS"
  helpText: "UP/DOWN set the angle · SPACE throw as the power meter swings · Three balls per rack; every jug knocked off the shelf is 10 points · Clear the rack for a bonus and a taller pyramid set farther back"
  mouseHelp: "Move to aim (the pointer's height sets the angle), click to throw"

  property var state: null
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  score: state ? state.total : 0
  overTitle: state ? "RACK " + state.level + " · " + state.total : ""
  progress: state ? "rack " + state.level : ""
  status: !state ? ""
    : over ? "OUT OF BALLS at rack " + state.level + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "RACK " + state.level + "  ·  " + state.balls + " BALLS" + (state.msg ? "  ·  " + state.msg : "")

  onTick: { state = Jugs.step(state, tickInterval / 1000); if (state.done) over = true }

  function newGame() { state = Jugs.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && dy) state = Jugs.setAngle(state, state.angle - dy * 0.04) }
  function activate() { if (over) newGame(); else if (state) state = Jugs.throwBall(state) }
  function saveState() { return !state || over ? null : Jugs.serialize(state) }
  function loadState(saved) { var s = Jugs.deserialize(saved); if (s) { state = s; over = false } else newGame() }
  function pointer(kind, x, y, b) {
    if (!state) return
    if (kind === "move" || kind === "drag") state = Jugs.setAngle(state, Math.atan2(board.sy(0.25) - y, Math.max(20, x - board.sx(0.1))))
    else if (kind === "press" && b === Qt.LeftButton) activate()
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent
    readonly property real u: width / (root.state ? root.state.shelf + 0.3 : 2.2)
    function sx(x) { return width * 0.04 + x * u }
    function sy(y) { return height * 0.78 - y * u }

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
      var u = board.u
      // Ground, and the shelf the jugs stand on.
      ctx.fillStyle = theme.faint; ctx.fillRect(0, sy(0), width, height - sy(0))
      ctx.fillStyle = theme.withAlpha(theme.tone(2), 0.5); ctx.fillRect(sx(1.15), sy(0), (s.shelf - 1.15) * u, u * 0.06)
      ctx.fillStyle = theme.dim; ctx.fillRect(sx(1.15), sy(0) + u * 0.06, 4, height)
      // Jugs.
      for (var i = 0; i < s.jugs.length; ++i) {
        var j = s.jugs[i]
        if (j.out && j.y < -0.4) continue
        var x = sx(j.x), y = sy(j.y), r = Jugs.JR * u
        ctx.fillStyle = Jugs.isDown(j) ? theme.withAlpha(theme.foreground, 0.35) : theme.foreground
        ctx.fillRect(x - r * 0.85, y - r, r * 1.7, r * 1.9)
        ctx.fillRect(x - r * 0.4, y - r * 1.5, r * 0.8, r * 0.6)
        ctx.fillStyle = theme.accent; ctx.fillRect(x - r * 0.85, y - r * 0.2, r * 1.7, r * 0.6)
      }
      // The ball, or the aiming line.
      if (s.b) {
        ctx.fillStyle = theme.tone(3); ctx.beginPath(); ctx.arc(sx(s.b.x), sy(s.b.y), Jugs.BR * u, 0, Math.PI * 2); ctx.fill()
      } else if (!root.over) {
        var v = 1.6 + s.m * 2.4, bx = 0.1, by = 0.25, vx = v * Math.cos(s.angle), vy = v * Math.sin(s.angle)
        ctx.fillStyle = theme.withAlpha(theme.accent, 0.8)
        for (var t = 0.08; t < 0.7; t += 0.07) { ctx.beginPath(); ctx.arc(sx(bx + vx * t), sy(by + vy * t - 0.5 * Jugs.G * t * t), 3, 0, Math.PI * 2); ctx.fill() }
        ctx.fillStyle = theme.tone(3); ctx.beginPath(); ctx.arc(sx(bx), sy(by), Jugs.BR * u, 0, Math.PI * 2); ctx.fill()
        // Power meter.
        var mx = width * 0.04, my = height * 0.9, mw = width * 0.3
        ctx.fillStyle = theme.faint; ctx.fillRect(mx, my, mw, 12)
        ctx.fillStyle = theme.accent; ctx.fillRect(mx, my, mw * s.m, 12)
      }
      for (var k = 0; k < s.balls; ++k) { ctx.fillStyle = theme.tone(3); ctx.beginPath(); ctx.arc(width - 24 - k * 22, 22, 8, 0, Math.PI * 2); ctx.fill() }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
