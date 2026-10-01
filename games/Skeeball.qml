import QtQuick
import "../engine" as Engine
import "logic/skeeball.js" as Skee

// Skee-ball: time the aim needle, then the power bar. Nine balls a game.
Engine.GameBase {
  id: root
  gameId: "skeeball"
  title: "ALLEY ROLL"
  helpText: "SPACE locks the sweeping aim, SPACE again locks the power · nine balls · rings score 10-50, the corner pockets 100 (full power, hard to the side)"
  mouseHelp: "Click rolls"

  property var state: null
  tickInterval: 16
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? state.score + " POINTS" : ""
  status: !state ? ""
    : (over ? "GAME OVER  ·  N or SPACE to play again"
      : (paused ? "PAUSED"
        : "BALL " + state.ball + "/" + Skee.BALLS + "  ·  "
          + (state.phase === "aim" ? "SPACE to set aim" : state.phase === "power" ? "SPACE to set power"
            : state.phase === "score" ? (state.lastPts ? "+" + state.lastPts : "gutter") : "rolling…")))

  onTick: {
    state = Skee.step(state, tickInterval / 1000)
    if (state.done) over = true
  }

  function newGame() {
    state = Skee.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {}

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Skee.press(state)
  }

  // Mouse (engine/Pointer.qml): click rolls.
  function pointer(kind, x, y, b) {
    if (kind === "press" && b === Qt.LeftButton) { activate() }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    height: parent.height
    width: Math.min(parent.width, height * 0.95)

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
      var s = root.state

      // Target board occupies the top ~55%; the lane below it.
      var bw = Math.min(width * 0.62, height * 0.5), bh = bw
      var bx = (width - bw) / 2, by = height * 0.03
      function P(x, y) { return { x: bx + x * bw, y: by + y * bh } }

      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.05)
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = theme.border
      ctx.lineWidth = 1
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1)

      // Gutter band
      var fy = P(0, Skee.FIELD_Y).y
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.08)
      ctx.fillRect(bx, fy, bw, by + bh - fy)
      ctx.fillStyle = theme.dim
      ctx.font = Math.floor(bw * 0.045) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("10", bx + bw / 2, (fy + by + bh) / 2)

      // Rings, outermost first.
      var c = P(Skee.CENTER.x, Skee.CENTER.y)
      for (var i = Skee.RINGS.length - 1; i >= 0; --i) {
        ctx.beginPath(); ctx.arc(c.x, c.y, Skee.RINGS[i].r * bw, 0, Math.PI * 2)
        ctx.fillStyle = theme.withAlpha(theme.tone(i), 0.18 + (3 - i) * 0.05)
        ctx.fill()
        ctx.strokeStyle = theme.tone(i)
        ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.font = "bold " + Math.floor(bw * 0.04) + "px " + theme.fontFamily
        var ly = i === 0 ? c.y : c.y - (Skee.RINGS[i].r + (i > 0 ? Skee.RINGS[i - 1].r : 0)) / 2 * bw
        ctx.fillText(String(Skee.RINGS[i].pts), c.x, ly)
      }
      for (var p = 0; p < Skee.POCKETS.length; ++p) {
        var pp = P(Skee.POCKETS[p].x, Skee.POCKETS[p].y)
        ctx.beginPath(); ctx.arc(pp.x, pp.y, Skee.POCKET_R * bw, 0, Math.PI * 2)
        ctx.fillStyle = theme.withAlpha(theme.danger, 0.3); ctx.fill()
        ctx.strokeStyle = theme.danger; ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.fillText("100", pp.x, pp.y)
      }

      // Previous throws as small dots.
      for (var t = 0; t < s.throws.length; ++t) {
        var tp = P(s.throws[t].x, s.throws[t].y)
        ctx.fillStyle = theme.withAlpha(theme.foreground, t === s.throws.length - 1 && s.phase === "score" ? 1 : 0.35)
        ctx.beginPath(); ctx.arc(tp.x, tp.y, bw * 0.014, 0, Math.PI * 2); ctx.fill()
      }

      // Lane
      var laneTop = by + bh + height * 0.02, laneBottom = height * 0.9
      var laneTopW = bw * 0.55, laneBotW = bw * 0.8
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.04)
      ctx.beginPath()
      ctx.moveTo(width / 2 - laneTopW / 2, laneTop); ctx.lineTo(width / 2 + laneTopW / 2, laneTop)
      ctx.lineTo(width / 2 + laneBotW / 2, laneBottom); ctx.lineTo(width / 2 - laneBotW / 2, laneBottom)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = theme.faint; ctx.stroke()

      // Aim needle (live while aiming, locked after).
      var aim = s.phase === "aim" ? s.aim : s.lockedAim
      var ax = width / 2 + aim * laneBotW * 0.45
      ctx.strokeStyle = s.phase === "aim" ? theme.accent : theme.dim
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(width / 2, laneBottom); ctx.lineTo(ax, laneTop + (laneBottom - laneTop) * 0.35); ctx.stroke()
      ctx.lineWidth = 1

      // Power bar on the right.
      var pwX = width / 2 + laneBotW / 2 + width * 0.04, pwH = laneBottom - laneTop, pwW = Math.max(8, width * 0.025)
      ctx.strokeStyle = theme.border
      ctx.strokeRect(pwX, laneTop, pwW, pwH)
      var power = s.phase === "power" ? s.power : (s.phase === "aim" ? 0 : s.lockedPower)
      ctx.fillStyle = power > 0.97 ? theme.danger : theme.accent
      ctx.fillRect(pwX + 1, laneTop + pwH * (1 - power), pwW - 2, pwH * power)

      // Rolling ball: up the lane, then onto the board.
      var bp = Skee.ballPos(s)
      if (bp) {
        var r = bw * 0.028
        var lx, lyy
        if (bp.k < 0.5) {
          var kk = bp.k / 0.5
          lx = width / 2 + (bp.x - 0.5) * laneBotW * (1 - kk * 0.3)
          lyy = laneBottom - (laneBottom - laneTop) * kk
          r *= 1.3 - kk * 0.3
        } else {
          var k2 = (bp.k - 0.5) / 0.5
          var land = P(s.landing.x, s.landing.y)
          lx = width / 2 + (land.x - width / 2) * (0.7 + 0.3 * k2)
          lyy = laneTop + (land.y - laneTop) * k2 - Math.sin(k2 * Math.PI) * bh * 0.12
        }
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(lx, lyy, r, 0, Math.PI * 2); ctx.fill()
      }

      // Balls left
      for (var b = 0; b < Skee.BALLS; ++b) {
        ctx.fillStyle = b < Skee.BALLS - s.ball + (s.phase === "aim" || s.phase === "power" ? 1 : 0) ? theme.dim : theme.faint
        ctx.beginPath(); ctx.arc(width / 2 - Skee.BALLS * 7 + b * 14 + 7, height * 0.955, 5, 0, Math.PI * 2); ctx.fill()
      }

      // Score, top-left
      ctx.fillStyle = theme.foreground
      ctx.font = "bold " + Math.floor(height * 0.05) + "px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillText(String(s.score), 4, 4)
      if (s.phase === "score") {
        ctx.fillStyle = s.lastPts >= 50 ? theme.accent : theme.foreground
        ctx.textAlign = "center"
        ctx.fillText(s.lastPts ? "+" + s.lastPts : "0", width / 2, laneTop + (laneBottom - laneTop) * 0.5)
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
