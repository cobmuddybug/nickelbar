import QtQuick
import "../engine" as Engine
import "logic/quickdraw.js" as Draw

// Quick Draw (see logic/quickdraw.js): wait for DRAW, then fire first.
Engine.GameBase {
  id: root
  gameId: "quickdraw"
  difficulties: ["Easy", "Normal", "Hard"]
  onDifficultyChanged: Draw.setDifficulty(difficulty)
  title: "QUICK DRAW"
  helpText: "SPACE fire · Wait for DRAW!, then fire before the outlaw does · Fire early and you foul · Some duels have a decoy (a crow takes off): do not shoot it · Three lives, and every outlaw is quicker than the last · Faster draws score more"
  mouseHelp: "Click to fire"

  property var state: null
  tickInterval: 16
  ownSounds: true
  onStateChanged: playEvents(state)
  ticking: !!state && !state.done
  endless: true
  score: state ? state.score : 0
  overTitle: state ? "OUTLAW " + state.level + " · " + state.score : ""
  progress: state ? "outlaw " + state.level : ""
  status: !state ? ""
    : over ? "SHOT DOWN at outlaw " + state.level + "  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "OUTLAW " + state.level + "  ·  " + new Array(Math.max(0, state.lives)).fill("♥").join(" ") + (state.phase === "result" ? "  ·  " + state.msg + "  ·  SPACE for the next" : "")

  onTick: {
    state = Draw.step(state, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() { state = Draw.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() { if (over) newGame(); else if (state) { state = Draw.fire(state); if (state.done) over = true } }
  function pointer(kind, x, y, b) { if (kind === "press" && b === Qt.LeftButton) activate() }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.fill: parent

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function man(ctx, x, y, h, col, armUp, down) {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, h * 0.06)
      ctx.save(); ctx.translate(x, y)
      if (down) ctx.rotate(down * 1.4)
      ctx.beginPath(); ctx.arc(0, -h * 0.82, h * 0.1, 0, Math.PI * 2); ctx.fill()               // head
      ctx.fillRect(-h * 0.06, -h * 0.72, h * 0.12, h * 0.38)                                    // torso
      ctx.fillRect(-h * 0.16, -h * 0.78, h * 0.32, h * 0.04)                                    // hat brim
      ctx.beginPath(); ctx.moveTo(-h * 0.05, -h * 0.34); ctx.lineTo(-h * 0.1, 0); ctx.moveTo(h * 0.05, -h * 0.34); ctx.lineTo(h * 0.1, 0); ctx.stroke() // legs
      ctx.beginPath(); ctx.moveTo(0, -h * 0.66); ctx.lineTo(h * 0.2 * (armUp ? 1 : 0.4), armUp ? -h * 0.66 : -h * 0.45); ctx.stroke()
      ctx.restore()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      var s = root.state
      if (!s) return
      var ground = height * 0.74, h = height * 0.4
      ctx.fillStyle = theme.faint; ctx.fillRect(0, ground, width, height - ground)
      ctx.fillStyle = theme.dim; ctx.fillRect(0, ground, width, 2)
      var draw = s.phase === "draw", res = s.phase === "result"
      var oppShot = res && !s.won, meShot = res && s.won
      man(ctx, width * 0.22, ground, h, theme.accent, draw || meShot, oppShot ? -1 : 0)
      man(ctx, width * 0.78, ground, h, theme.tone(2), draw && s.t > s.opp * 0.6 || oppShot, meShot ? 1 : 0)
      // Decoy crow.
      if (s.phase === "wait" && s.fakeAt >= 0 && s.t >= s.fakeAt && s.t < s.fakeAt + 0.45) {
        var fx = width * 0.5 + (s.t - s.fakeAt) * width * 0.6, fy = height * 0.25 - (s.t - s.fakeAt) * 120
        ctx.fillStyle = theme.foreground; ctx.beginPath(); ctx.ellipse(fx - 12, fy - 5, 24, 10); ctx.fill()
        ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.lineTo(fx + 8, fy - 16); ctx.lineTo(fx + 14, fy); ctx.fill()
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      if (s.phase === "wait") { ctx.fillStyle = theme.dim; ctx.font = "bold " + Math.floor(height * 0.07) + "px " + theme.fontFamily; ctx.fillText("…", width / 2, height * 0.3) }
      else if (draw) { ctx.fillStyle = theme.danger; ctx.font = "bold " + Math.floor(height * 0.16) + "px " + theme.fontFamily; ctx.fillText("DRAW!", width / 2, height * 0.3) }
      else { ctx.fillStyle = s.won ? theme.highlight : theme.danger; ctx.font = "bold " + Math.floor(height * 0.06) + "px " + theme.fontFamily; ctx.fillText(s.msg, width / 2, height * 0.3) }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
