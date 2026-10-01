import QtQuick
import "../engine" as Engine
import "logic/gallery.js" as Gallery

// Shooting gallery (see logic/gallery.js).
Engine.GameBase {
  id: root
  gameId: "gallery"
  title: "SHOOTING GALLERY"
  helpText: "Twenty-five shots at the moving targets: ducks 10, plates 25, stars 100 · hits in a row add a streak bonus · ARROWS move the sights (hold to glide) · SPACE fire"
  mouseHelp: "Aim with the pointer, click to fire"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && !state.done && !over
  score: state ? state.score : 0
  overTitle: state ? state.hits + "/" + Gallery.SHOTS + " HITS · " + state.score : ""
  status: !state ? ""
    : over ? "OUT OF SHOTS  ·  SPACE to play again"
    : paused ? "PAUSED"
    : state.shots + " shots left" + (state.streak > 1 ? "  ·  STREAK " + state.streak : "")

  onTick: {
    var dt = tickInterval / 1000, s = state
    if (heldDx || heldDy) s = Gallery.aimAt(s, s.aim.x + heldDx * 0.9 * dt, s.aim.y + heldDy * 0.9 * dt)
    state = Gallery.step(s, dt)
    if (state.done) over = true
  }

  function newGame() { state = Gallery.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && !over) state = Gallery.aimAt(state, state.aim.x + dx * 0.02, state.aim.y + dy * 0.02) }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Gallery.shoot(state)
  }

  // Mouse (engine/Pointer.qml): aim with the pointer, click to fire.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    state = Gallery.aimAt(state, x / board.unit, y / board.unit)
    if (kind === "press" && b === Qt.LeftButton) state = Gallery.shoot(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.BlankCursor }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Gallery.W, parent.height / (Gallery.H + 0.1))
    width: unit * Gallery.W
    height: unit * (Gallery.H + 0.1)

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function target(ctx, kind, x, y, u) {
      var r = Gallery.KINDS[kind].r * u
      if (kind === "duck") {
        ctx.fillStyle = theme.tone(3)
        ctx.beginPath(); ctx.ellipse(x - r, y - r * 0.4, r * 2, r * 1.1); ctx.fill()
        ctx.beginPath(); ctx.arc(x + r * 0.7, y - r * 0.6, r * 0.45, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = theme.danger
        ctx.beginPath(); ctx.moveTo(x + r * 1.1, y - r * 0.65); ctx.lineTo(x + r * 1.6, y - r * 0.5); ctx.lineTo(x + r * 1.1, y - r * 0.4); ctx.fill()
        ctx.fillStyle = theme.background
        ctx.beginPath(); ctx.arc(x + r * 0.8, y - r * 0.7, Math.max(1, r * 0.1), 0, Math.PI * 2); ctx.fill()
      } else if (kind === "plate") {
        for (var k = 0; k < 3; ++k) {
          ctx.fillStyle = k % 2 ? theme.background : theme.danger
          ctx.beginPath(); ctx.arc(x, y, r * (1 - k * 0.33), 0, Math.PI * 2); ctx.fill()
        }
      } else {
        ctx.fillStyle = theme.highlight
        ctx.beginPath()
        for (var p = 0; p < 10; ++p) {
          var a = -Math.PI / 2 + p * Math.PI / 5, rr = p % 2 ? r * 0.45 : r * 1.1
          if (p === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
        }
        ctx.closePath(); ctx.fill()
      }
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.04)
      ctx.fillRect(0, 0, Gallery.W * u, Gallery.H * u)
      for (var r = 0; r < Gallery.ROWS.length; ++r) {
        var ry = Gallery.ROWS[r].y * u
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.15)
        ctx.fillRect(0, ry + u * 0.06, Gallery.W * u, u * 0.012)
      }
      for (var i = 0; i < s.targets.length; ++i) {
        var t = s.targets[i]
        if (t.down > 0) continue
        var tx = Gallery.screenX(t) * u, ty = Gallery.ROWS[t.row].y * u
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.3)
        ctx.fillRect(tx - 1, ty, 2, u * 0.06)
        target(ctx, t.kind, tx, ty, u)
      }
      // Curtain edges hide the wrap.
      ctx.fillStyle = theme.withAlpha(theme.tone(1), 0.35)
      ctx.fillRect(0, 0, u * 0.08, Gallery.H * u); ctx.fillRect(Gallery.W * u - u * 0.08, 0, u * 0.08, Gallery.H * u)
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      for (var f = 0; f < s.flashes.length; ++f) {
        var fl = s.flashes[f]
        ctx.fillStyle = theme.withAlpha(fl.v ? theme.highlight : theme.dim, Math.min(1, fl.life * 2))
        ctx.font = "bold " + Math.floor(u * 0.05) + "px " + theme.fontFamily
        ctx.fillText(fl.v ? "+" + fl.v : "miss", fl.x * u, (fl.y - 0.07 - (0.7 - fl.life) * 0.1) * u)
      }
      // Shots left.
      for (var k = 0; k < s.shots; ++k) {
        ctx.fillStyle = theme.tone(3)
        ctx.fillRect(u * 0.02 + k * u * 0.05, (Gallery.H + 0.03) * u, u * 0.02, u * 0.05)
      }
      if (!root.over) {
        var ax = s.aim.x * u, ay = s.aim.y * u, cr = u * 0.035 * (1 + s.recoil * 2)
        ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(ax, ay, cr, 0, Math.PI * 2)
        ctx.moveTo(ax - cr * 1.6, ay); ctx.lineTo(ax - cr * 0.5, ay); ctx.moveTo(ax + cr * 0.5, ay); ctx.lineTo(ax + cr * 1.6, ay)
        ctx.moveTo(ax, ay - cr * 1.6); ctx.lineTo(ax, ay - cr * 0.5); ctx.moveTo(ax, ay + cr * 0.5); ctx.lineTo(ax, ay + cr * 1.6)
        ctx.stroke()
      }
      if (root.paused) { ctx.fillStyle = theme.background; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1 }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
