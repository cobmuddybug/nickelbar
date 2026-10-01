import QtQuick
import "../engine" as Engine
import "logic/bigfish.js" as Fish

// Big Fish (after Fishy); see logic/bigfish.js.
Engine.GameBase {
  id: root
  gameId: "bigfish"
  title: "BIG FISH"
  helpText: "Eat smaller fish, dodge bigger ones · fish you can eat are calm colours, fish that can eat you are the danger colour · ARROWS swim · quick meals build a combo · golden fish pay big · jellyfish sting (you freeze) · grow to full size to clear the level · from level 3, watch the edges for a shark · three lives"
  mouseHelp: "Your fish swims toward the pointer"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? state.eaten + " fish eaten  ·  SPACE to play again"
    : paused ? "PAUSED"
    : "LEVEL " + state.level + "  ·  " + new Array(Math.max(0, state.lives)).fill("♥").join(" ") + (state.combo > 1 ? "  ·  combo ×" + state.combo : "")

  property point mouseAt: Qt.point(-1, -1)

  onTick: {
    var input = heldDx || heldDy || mouseAt.x < 0 ? { dx: heldDx, dy: heldDy } : { tx: mouseAt.x, ty: mouseAt.y }
    state = Fish.step(state, input, tickInterval / 1000)
    if (state.dead) over = true
  }

  function newGame() { state = Fish.makeState(); over = false; paused = false; mouseAt = Qt.point(-1, -1) }
  function moveCursor(dx, dy) { mouseAt = Qt.point(-1, -1) }
  function activate() { if (over) newGame() }

  function pointer(kind, x, y, b) { mouseAt = Qt.point(x / board.unit, y / board.unit) }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Fish.W, parent.height / Fish.H)
    width: unit * Fish.W
    height: unit * Fish.H

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    // A fish: oval body, tail, eye; `face` is +1 facing right.
    function fish(ctx, x, y, r, face, body, wag) {
      ctx.fillStyle = body
      ctx.beginPath(); ctx.ellipse(x - r * 1.2, y - r * 0.75, r * 2.4, r * 1.5); ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x - face * r * 0.95, y)
      ctx.lineTo(x - face * r * 1.75, y - r * (0.7 + wag * 0.15))
      ctx.lineTo(x - face * r * 1.75, y + r * (0.7 - wag * 0.15))
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = theme.background
      ctx.beginPath(); ctx.arc(x + face * r * 0.6, y - r * 0.2, Math.max(1.2, r * 0.2), 0, Math.PI * 2); ctx.fill()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit, p = s.p

      ctx.fillStyle = theme.withAlpha(theme.tone(5), 0.08)
      ctx.fillRect(0, 0, width, height)
      // Drifting bubbles.
      ctx.strokeStyle = theme.withAlpha(theme.foreground, 0.12); ctx.lineWidth = 1
      for (var b = 0; b < 14; ++b) {
        var bx = ((b * 7919) % 1000) / 1000 * Fish.W, by = Fish.H - ((s.t * (0.4 + b % 3 * 0.2) + b * 1.7) % (Fish.H + 1))
        ctx.beginPath(); ctx.arc(bx * u, by * u, u * (0.05 + (b % 3) * 0.03), 0, Math.PI * 2); ctx.stroke()
      }

      // Growth toward the next level.
      ctx.fillStyle = theme.faint
      ctx.fillRect(0, 0, width, Math.max(3, u * 0.08))
      ctx.fillStyle = theme.accent
      ctx.fillRect(0, 0, width * Fish.progress(s), Math.max(3, u * 0.08))

      var calm = [theme.tone(2), theme.tone(5), theme.tone(1)]
      for (var i = 0; i < s.fish.length; ++i) {
        var f = s.fish[i], fx = f.x * u, fy = f.y * u, fr = f.r * u
        if (f.kind === "jelly") {
          ctx.fillStyle = theme.withAlpha(theme.tone(4), 0.75)
          ctx.beginPath(); ctx.arc(fx, fy, fr, Math.PI, 0); ctx.closePath(); ctx.fill()
          ctx.strokeStyle = theme.withAlpha(theme.tone(4), 0.6); ctx.lineWidth = Math.max(1, fr * 0.12)
          for (var k = -2; k <= 2; ++k) {
            ctx.beginPath(); ctx.moveTo(fx + k * fr * 0.35, fy)
            ctx.quadraticCurveTo(fx + k * fr * 0.35 + Math.sin(f.phase + k) * fr * 0.4, fy + fr * 0.8, fx + k * fr * 0.3, fy + fr * 1.6); ctx.stroke()
          }
          continue
        }
        var danger = f.r > p.r * 1.05, face = f.vx > 0 ? 1 : -1
        var col = f.kind === "shark" ? theme.danger : f.kind === "gold" ? theme.tone(3) : danger ? theme.withAlpha(theme.danger, 0.55 + Math.min(0.4, (f.r / p.r - 1) * 0.4)) : calm[f.hue]
        fish(ctx, fx, fy, fr, face, col, Math.sin(f.phase * 3))
        if (f.kind === "shark") {
          ctx.fillStyle = theme.danger
          ctx.beginPath(); ctx.moveTo(fx - face * fr * 0.2, fy - fr * 0.7); ctx.lineTo(fx - face * fr * 0.6, fy - fr * 1.5); ctx.lineTo(fx - face * fr * 0.9, fy - fr * 0.6); ctx.fill()
        }
      }

      if (s.warn) {
        var wx = s.warn.left ? u * 0.5 : width - u * 0.5
        ctx.fillStyle = Math.floor(s.t * 8) % 2 ? theme.danger : theme.withAlpha(theme.danger, 0.4)
        ctx.font = "bold " + Math.floor(u * 1.1) + "px " + theme.fontFamily
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText("!", wx, s.warn.y * u)
      }

      // You: blinks while safe, stars while stung.
      if (!(s.inv > 0 && Math.floor(s.inv * 8) % 2)) {
        fish(ctx, p.x * u, p.y * u, p.r * u, p.face, theme.accent, Math.sin(s.t * 12))
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = Math.max(1, u * 0.04)
        ctx.beginPath(); ctx.ellipse((p.x - p.r * 1.2) * u, (p.y - p.r * 0.75) * u, p.r * 2.4 * u, p.r * 1.5 * u); ctx.stroke()
      }
      if (s.stun > 0) {
        ctx.fillStyle = theme.tone(4)
        for (var z = 0; z < 3; ++z) {
          var a = s.t * 6 + z * 2.1
          ctx.beginPath(); ctx.arc((p.x + Math.cos(a) * p.r * 1.3) * u, (p.y - p.r * 1.1 + Math.sin(a) * p.r * 0.3) * u, u * 0.07, 0, Math.PI * 2); ctx.fill()
        }
      }

      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var q = 0; q < s.pops.length; ++q) {
        var po = s.pops[q]
        ctx.fillStyle = theme.withAlpha(po.big ? theme.tone(3) : theme.foreground, Math.min(1, po.t * 2))
        ctx.font = "bold " + Math.floor(u * (po.big ? 0.5 : 0.32)) + "px " + theme.fontFamily
        ctx.fillText(po.text, po.x * u, po.y * u - u * 0.4)
      }
      if (s.msgT > 0) {
        ctx.fillStyle = theme.accent
        ctx.font = "bold " + Math.floor(u * 0.7) + "px " + theme.fontFamily
        ctx.fillText(s.msg, width / 2, height * 0.2)
      }
      if (root.paused) {
        ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1
      }
    }
  }

  function saveState() { return state && !over ? JSON.parse(JSON.stringify(state)) : null }
  function loadState(saved) {
    if (saved && typeof saved === "object" && saved.fish !== undefined) { state = saved; over = false; paused = false }
    else newGame()
  }

  Component.onCompleted: if (!state) newGame()
}
