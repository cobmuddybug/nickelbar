import QtQuick
import "../engine" as Engine
import "logic/chainburst.js" as CB

// Chain Burst (after Boomshine); see logic/chainburst.js.
Engine.GameBase {
  id: root
  gameId: "chainburst"
  title: "CHAIN BURST"
  helpText: "One burst a level: set it off where the dots will drift into it, and every dot it catches bursts in turn · catch the quota to go on · each link down the chain is worth more, so long chains beat wide ones · gold dots pay ×5 and burst big; sparks are fast; grey duds burst small · ARROWS move the aim · SPACE burst · three misses and it's over"
  mouseHelp: "Point and click to burst"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? "OUT OF TRIES  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LEVEL " + state.level + "  ·  " + state.caught + "/" + state.need + "  ·  " + new Array(Math.max(0, state.lives)).fill("♥").join(" ")
      + (state.maxGen > 1 ? "  ·  chain " + state.maxGen : "")

  onTick: {
    var dt = tickInterval / 1000
    var s = state
    if ((heldDx || heldDy) && s.phase === "aim") s = CB.moveAim(s, heldDx, heldDy, dt)
    state = CB.step(s, dt)
    if (state.dead) over = true
  }

  function newGame() { state = CB.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {}
  function activate() {
    if (over) { newGame(); return }
    if (state) state = CB.fire(state)
  }

  function pointer(kind, x, y, b) {
    if (!state || over || state.phase !== "aim") return
    state = CB.setAim(state, x / board.unit, y / board.unit)
    if (kind === "press") state = CB.fire(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / CB.W, parent.height / CB.H)
    width: unit * CB.W
    height: unit * CB.H

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function colorOf(d) {
      return d.kind === "gold" ? theme.tone(3) : d.kind === "dud" ? theme.dim : d.kind === "player" ? theme.foreground : theme.tone(d.hue === 3 ? 0 : d.hue)
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.03)
      ctx.fillRect(0, 0, width, height)

      // The chain's length, huge and faint behind everything.
      if (s.maxGen > 1) {
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.06 + Math.min(0.1, s.maxGen * 0.005))
        ctx.font = "bold " + Math.floor(u * (3 + Math.min(3, s.maxGen * 0.12))) + "px " + theme.fontFamily
        ctx.fillText("×" + s.maxGen, width / 2, height / 2)
      }

      // Progress toward the quota along the top.
      var frac = Math.min(1, s.caught / Math.max(1, s.need))
      ctx.fillStyle = theme.faint
      ctx.fillRect(0, 0, width, Math.max(3, u * 0.08))
      ctx.fillStyle = s.caught >= s.need ? theme.accent : theme.tone(3)
      ctx.fillRect(0, 0, width * frac, Math.max(3, u * 0.08))

      for (var i = 0; i < s.dots.length; ++i) {
        var d = s.dots[i], col = colorOf(d)
        if (d.state === "burst") {
          var r = CB.burstRadius(d) * u
          ctx.fillStyle = theme.withAlpha(col, d.kind === "player" ? 0.22 : 0.35)
          ctx.beginPath(); ctx.arc(d.x * u, d.y * u, r, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = theme.withAlpha(col, 0.8); ctx.lineWidth = Math.max(1, u * 0.04)
          ctx.stroke()
        } else if (d.state === "free") {
          var dr = CB.DOT_R * u * (d.kind === "gold" ? 1.35 : 1)
          ctx.fillStyle = theme.withAlpha(col, 0.25)
          ctx.beginPath(); ctx.arc(d.x * u, d.y * u, dr * 2, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = col
          ctx.beginPath(); ctx.arc(d.x * u, d.y * u, dr, 0, Math.PI * 2); ctx.fill()
          if (d.kind === "spark") {
            ctx.strokeStyle = theme.withAlpha(col, 0.5); ctx.lineWidth = dr
            ctx.beginPath(); ctx.moveTo(d.x * u, d.y * u); ctx.lineTo((d.x - d.vx * 0.12) * u, (d.y - d.vy * 0.12) * u); ctx.stroke()
          }
        }
      }

      // The aim: a ring the size your burst will reach.
      if (s.phase === "aim" && !root.over) {
        ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.6); ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(s.aim.x * u, s.aim.y * u, CB.BURST_R * 1.1 * u, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(s.aim.x * u, s.aim.y * u, u * 0.08, 0, Math.PI * 2); ctx.fill()
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var p = 0; p < s.pops.length; ++p) {
        var po = s.pops[p]
        ctx.fillStyle = theme.withAlpha(po.big ? theme.tone(3) : theme.foreground, Math.min(1, po.t * 2))
        ctx.font = "bold " + Math.floor(u * (po.big ? 0.55 : 0.35)) + "px " + theme.fontFamily
        ctx.fillText(po.text, po.x * u, po.y * u - u * 0.4)
      }
      if (s.msgT > 0) {
        ctx.fillStyle = s.phase === "end" && !s.passed ? theme.danger : theme.accent
        ctx.font = "bold " + Math.floor(u * 0.6) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height * 0.12)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  function saveState() { return state && !over && state.phase === "aim" ? { level: state.level, score: state.score, lives: state.lives } : null }
  function loadState(saved) {
    newGame()
    if (saved && saved.level) { var s = CB.shallow(state); s.level = saved.level; s.score = saved.score; s.lives = saved.lives; CB.makeLevel(s); state = s }
  }

  Component.onCompleted: if (!state) newGame()
}
