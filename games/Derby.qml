import QtQuick
import "../engine" as Engine
import "logic/derby.js" as Derby

// Derby, the roll-a-ball horse race (see logic/derby.js).
Engine.GameBase {
  id: root
  gameId: "derby"
  title: "DERBY"
  helpText: "Roll when the needle's over a good hole: its number is how far your horse moves (1, 2, or 3 for the middle one) · but the others don't wait, so don't dawdle · SPACE roll · three races; 100 / 50 / 25 for 1st / 2nd / 3rd"
  mouseHelp: "Click to roll"

  property var state: null
  tickInterval: 16
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? state.score + " POINTS" : ""
  status: !state ? ""
    : over ? "THAT'S THE MEETING  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "RACE " + state.race + "/" + Derby.RACES + (state.phase === "done" ? "  ·  " + placeText(state.log[state.log.length - 1]) : "")

  function placeText(p) { return p === 1 ? "YOU WON!" : p === 2 ? "SECOND" : p === 3 ? "THIRD" : "OUT OF THE MONEY" }

  onTick: { state = Derby.step(state, tickInterval / 1000); if (state.done) over = true }
  function newGame() { state = Derby.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Derby.roll(state)
  }

  // Mouse (engine/Pointer.qml): click to roll.
  function pointer(kind, x, y, b) { if (kind === "press" && b === Qt.LeftButton) activate() }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function horse(ctx, x, y, s, col, mine) {
      ctx.fillStyle = col
      ctx.beginPath(); ctx.ellipse(x - s * 0.6, y - s * 0.25, s * 1.1, s * 0.5); ctx.fill()           // body
      ctx.beginPath(); ctx.moveTo(x + s * 0.35, y - s * 0.1); ctx.lineTo(x + s * 0.75, y - s * 0.65)
      ctx.lineTo(x + s * 0.95, y - s * 0.5); ctx.lineTo(x + s * 0.55, y); ctx.closePath(); ctx.fill()     // neck/head
      ctx.fillRect(x - s * 0.5, y + s * 0.15, s * 0.1, s * 0.4); ctx.fillRect(x + s * 0.25, y + s * 0.15, s * 0.1, s * 0.4)
      if (mine) { ctx.fillStyle = theme.background; ctx.beginPath(); ctx.arc(x - s * 0.05, y, s * 0.16, 0, Math.PI * 2); ctx.fill() }
    }

    readonly property var holeColor: [null, "y", "r", "b"]

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, w = width, trackH = height * 0.62, laneH = trackH / Derby.HORSES
      var x0 = w * 0.06, x1 = w * 0.9
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var i = 0; i < Derby.HORSES; ++i) {
        var y = i * laneH
        ctx.fillStyle = i === 0 ? theme.withAlpha(theme.accent, 0.12) : theme.withAlpha(theme.foreground, i % 2 ? 0.03 : 0.06)
        ctx.fillRect(0, y, w, laneH)
        var hx = x0 + (x1 - x0) * s.shown[i] / Derby.LENGTH
        horse(ctx, hx, y + laneH * 0.5, laneH * 0.62, i === 0 ? theme.accent : theme.tone(i), i === 0)
        var place = s.finish.indexOf(i)
        if (place >= 0 && place < 3) {
          ctx.fillStyle = theme.highlight
          ctx.font = "bold " + Math.floor(laneH * 0.4) + "px " + theme.fontFamily
          ctx.fillText(String(place + 1), w * 0.96, y + laneH / 2)
        }
      }
      ctx.fillStyle = theme.danger
      ctx.fillRect(x1 + laneH * 0.4, 0, 3, trackH)

      // The roll-a-ball: holes, sweeping needle, the ball on its way.
      var ry = trackH + height * 0.12, rw = w * 0.8, rx = (w - rw) / 2, hw = rw / Derby.HOLES.length
      for (var k = 0; k < Derby.HOLES.length; ++k) {
        var v = Derby.HOLES[k], cx = rx + (k + 0.5) * hw
        ctx.fillStyle = v === 3 ? theme.tone(0) : v === 2 ? theme.danger : theme.tone(3)
        ctx.beginPath(); ctx.arc(cx, ry, hw * 0.32, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.background
        ctx.font = "bold " + Math.floor(hw * 0.28) + "px " + theme.fontFamily
        ctx.fillText(String(v), cx, ry + 1)
      }
      if (s.phase === "go" && !root.over) {
        var nx = rx + s.needle * rw
        ctx.strokeStyle = theme.foreground; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(nx, ry + hw * 0.5); ctx.lineTo(nx, ry + hw * 0.9); ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.moveTo(nx, ry + hw * 0.42); ctx.lineTo(nx - 6, ry + hw * 0.55); ctx.lineTo(nx + 6, ry + hw * 0.55); ctx.fill()
      }
      if (s.ball) {
        var k2 = Math.min(1, s.ball.t / Derby.ROLL), bx = rx + s.ball.x * rw
        var by = height - (height - ry) * k2 * 0.95
        ctx.fillStyle = theme.foreground
        ctx.globalAlpha = s.ball.scored ? 0.3 : 1
        ctx.beginPath(); ctx.arc(bx, by, hw * 0.14, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }
      // Results so far.
      ctx.fillStyle = theme.dim
      ctx.font = Math.floor(height * 0.03) + "px " + theme.fontFamily
      ctx.textAlign = "left"
      ctx.fillText(s.log.map(function(p, n) { return "R" + (n + 1) + ": " + (p ? ["", "1st", "2nd", "3rd", "4th", "5th", "6th"][p] : "—") }).join("   "), rx, height * 0.97)
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
