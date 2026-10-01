import QtQuick
import "../engine" as Engine
import "logic/pinball.js" as PB

// Pinball; see logic/pinball.js. Three balls, score is the total.
Engine.GameBase {
  id: root
  gameId: "pinball"
  title: "PINBALL"
  helpText: "SPACE or DOWN: hold to pull the plunger, release to launch · LEFT / RIGHT hold a flipper up · UP or SPACE (ball in play) both flippers · light the three top lanes to raise the multiplier (to ×5) · knock down all three targets on the left for 1500 · three balls"
  mouseHelp: "Left button: left flipper · right button: right flipper · either one pulls the plunger when the ball's in the lane"

  property var state: null
  tickInterval: 16
  onStateChanged: playEvents(state)
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? state.score + " POINTS" : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "BALL " + Math.min(PB.BALLS, state.ballNo) + "/" + PB.BALLS + "  ·  ×" + state.mult
      + (state.inLane && state.ball ? "  ·  hold SPACE or DOWN, release to launch" : "")

  property bool mouseL: false
  property bool mouseR: false

  onTick: {
    var lane = state.inLane && !!state.ball
    state = PB.step(state, {
      left: heldDx < 0 || heldDy < 0 || (heldAction && !lane) || (mouseL && !lane),
      right: heldDx > 0 || heldDy < 0 || (heldAction && !lane) || (mouseR && !lane),
      plunge: lane && (heldDy > 0 || heldAction || mouseL || mouseR)
    }, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = PB.makeState(); over = false; paused = false; mouseL = false; mouseR = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame() }

  function saveState() { return state && !over ? PB.serialize(state) : null }
  function loadState(saved) {
    var r = PB.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  function pointer(kind, x, y, b) {
    if (kind === "press") { if (b === Qt.RightButton) mouseR = true; else mouseL = true }
    if (kind === "release") { if (b === Qt.RightButton) mouseR = false; else mouseL = false }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / PB.W, parent.height / PB.H)
    width: unit * PB.W
    height: unit * PB.H

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
      ctx.lineCap = "round"; ctx.lineJoin = "round"

      // Playfield floor inside the arch and walls.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.035)
      ctx.beginPath()
      ctx.moveTo(0.3 * u, PB.H * u)
      ctx.lineTo(0.3 * u, 3.2 * u)
      for (var a = 0; a < 20; ++a) ctx.lineTo(PB.WALLS[a].bx * u, PB.WALLS[a].by * u)
      ctx.lineTo(PB.LANE_X1 * u, PB.H * u)
      ctx.closePath()
      ctx.fill()

      // Score across the middle of the table, faint, like a playfield insert.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.16)
      ctx.font = "bold " + Math.floor(u * 0.9) + "px " + theme.fontFamily
      ctx.fillText(String(s.score), 4.65 * u, 9.3 * u)
      ctx.font = "bold " + Math.floor(u * 0.45) + "px " + theme.fontFamily
      ctx.fillText("×" + s.mult + "   BALL " + Math.min(PB.BALLS, s.ballNo), 4.65 * u, 10.2 * u)

      // Walls and slingshots.
      for (var i = 0; i < PB.WALLS.length; ++i) {
        var w = PB.WALLS[i], sling = w.kind === "sling"
        var lit = sling && s.slingFlash[w.ax < PB.W / 2 ? 0 : 1] > 0
        ctx.strokeStyle = sling ? (lit ? theme.highlight : theme.tone(2)) : theme.dim
        ctx.lineWidth = Math.max(2, u * (sling ? 0.14 : 0.1))
        ctx.beginPath(); ctx.moveTo(w.ax * u, w.ay * u); ctx.lineTo(w.bx * u, w.by * u); ctx.stroke()
      }

      // Top lanes.
      for (var l = 0; l < PB.LANES.length; ++l) {
        ctx.fillStyle = s.lanes[l] ? theme.tone(3) : theme.faint
        ctx.beginPath(); ctx.arc(PB.LANES[l] * u, (PB.LANE_Y + 0.05) * u, 0.16 * u, 0, Math.PI * 2); ctx.fill()
      }

      // Drop targets (a dim mark where a knocked-down one was).
      for (var t = 0; t < PB.TARGETS.length; ++t) {
        var tg = PB.TARGETS[t]
        ctx.fillStyle = s.targets[t] ? theme.faint : theme.tone(1)
        ctx.fillRect((tg.x - 0.08) * u, tg.y0 * u, (s.targets[t] ? 0.08 : 0.24) * u, (tg.y1 - tg.y0) * u)
      }

      // Bumpers.
      for (var j = 0; j < PB.BUMPERS.length; ++j) {
        var bu = PB.BUMPERS[j], hot = s.flash[j] > 0
        ctx.fillStyle = hot ? theme.highlight : theme.withAlpha(theme.tone(0), 0.55)
        ctx.beginPath(); ctx.arc(bu.x * u, bu.y * u, bu.r * u, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = theme.tone(0); ctx.lineWidth = Math.max(2, u * 0.08)
        ctx.beginPath(); ctx.arc(bu.x * u, bu.y * u, bu.r * 0.62 * u, 0, Math.PI * 2); ctx.stroke()
      }

      // Flippers: capsules.
      for (var f = 0; f < 2; ++f) {
        var e = PB.flipperEnds(f, s.flip[f])
        ctx.strokeStyle = theme.accent
        ctx.lineWidth = PB.FLIP_R * 2 * u
        ctx.beginPath(); ctx.moveTo(e.ax * u, e.ay * u); ctx.lineTo(e.bx * u, e.by * u); ctx.stroke()
        ctx.fillStyle = theme.background
        ctx.beginPath(); ctx.arc(e.ax * u, e.ay * u, PB.FLIP_R * 0.4 * u, 0, Math.PI * 2); ctx.fill()
      }

      // Plunger, pulled back by the charge.
      var px = (PB.LANE_X0 + 0.12) * u, pw = (PB.LANE_X1 - PB.LANE_X0 - 0.24) * u
      var py = (PB.PLUNGER_Y + s.charge * 0.7) * u
      ctx.fillStyle = s.charge > 0 ? theme.tone(3) : theme.dim
      ctx.fillRect(px, py, pw, 0.12 * u)
      ctx.fillRect(px + pw * 0.35, py, pw * 0.3, (PB.H - PB.PLUNGER_Y) * u)

      if (s.ball) {
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(s.ball.x * u, s.ball.y * u, PB.BALL_R * u, 0, Math.PI * 2); ctx.fill()
      }

      if (s.msgT > 0) {
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(u * 0.5) + "px " + theme.fontFamily
        ctx.fillText(s.msg, 4.65 * u, 11.3 * u)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.8; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
