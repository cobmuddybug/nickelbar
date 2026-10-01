import QtQuick
import "../engine" as Engine
import "logic/moonbuggy.js" as Buggy

// Moon Buggy, after the terminal game (see logic/moonbuggy.js).
Engine.GameBase {
  id: root
  gameId: "moonbuggy"
  title: "MOON BUGGY"
  helpText: "Drive as far as you can · SPACE or UP jump (craters and rocks) · X, F or RIGHT fire (breaks rocks, +25) · it speeds up the further you get · three buggies"
  mouseHelp: "Click to jump, right-click to fire"

  property var state: null
  tickInterval: 16
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? Math.floor(state.dist) + " METRES" : ""
  status: !state ? ""
    : over ? "OUT OF BUGGIES  ·  N for a new game"
    : paused ? "PAUSED"
    : Math.floor(state.dist) + " m  ·  " + state.lives + " buggies"

  onTick: {
    state = Buggy.step(state, tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() { state = Buggy.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dy < 0) state = Buggy.jump(state)
    else if (dx > 0) state = Buggy.fire(state)
  }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Buggy.jump(state)
  }
  function handleKey(key, text) {
    if (!state || over) return false
    var t = text ? text.toLowerCase() : ""
    if (t === "x" || t === "f") { state = Buggy.fire(state); return true }
    return false
  }
  function saveState() { return state && !over ? Buggy.serialize(state) : null }
  function loadState(saved) {
    var r = Buggy.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click to jump, right-click to fire.
  function pointer(kind, x, y, b) {
    if (!state || over || kind !== "press") return
    state = b === Qt.RightButton ? Buggy.fire(state) : Buggy.jump(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real unit: Math.min(parent.width / Buggy.VIEW, parent.height / 7)
    width: unit * Buggy.VIEW
    height: unit * 7

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
      var s = root.state, u = unit, ground = height - u * 1.6
      function sx(wx) { return (wx - s.dist) * u }

      // Stars and far hills drift slowly for depth.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.35)
      for (var i = 0; i < 24; ++i) {
        var hx = ((i * 97.3 - s.dist * 0.1 * u) % width + width) % width
        ctx.fillRect(hx, (i * 37 % 60) / 60 * ground * 0.5, 2, 2)
      }
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.08)
      ctx.beginPath(); ctx.moveTo(0, ground)
      for (var x = 0; x <= width; x += u * 0.5) {
        var wx = x / u + s.dist * 0.4
        ctx.lineTo(x, ground - u * (1.2 + Math.sin(wx * 0.35) * 0.6 + Math.sin(wx * 0.13) * 0.8))
      }
      ctx.lineTo(width, ground); ctx.closePath(); ctx.fill()

      // Ground with crater gaps.
      ctx.fillStyle = theme.withAlpha(theme.accent, 0.35)
      ctx.fillRect(0, ground, width, height - ground)
      for (var k = 0; k < s.obstacles.length; ++k) {
        var o = s.obstacles[k]
        if (o.kind === "crater") {
          ctx.fillStyle = theme.background
          ctx.beginPath()
          ctx.moveTo(sx(o.x), ground)
          ctx.quadraticCurveTo(sx(o.x + o.w / 2), ground + u * 1.4, sx(o.x + o.w), ground)
          ctx.closePath(); ctx.fill()
        } else if (!o.hit) {
          ctx.fillStyle = theme.dim
          ctx.beginPath()
          ctx.moveTo(sx(o.x), ground); ctx.lineTo(sx(o.x + 0.15), ground - o.h * u * 0.8); ctx.lineTo(sx(o.x + o.w * 0.5), ground - o.h * u)
          ctx.lineTo(sx(o.x + o.w * 0.9), ground - o.h * u * 0.7); ctx.lineTo(sx(o.x + o.w), ground); ctx.closePath(); ctx.fill()
        }
      }

      // Buggy (blinks after a crash).
      if (!(s.crash > 0 && Math.floor(s.crash * 10) % 2)) {
        var bx = Buggy.BUGGY_X * u, by = ground - s.y * u
        ctx.fillStyle = theme.tone(3)
        ctx.fillRect(bx, by - u * 0.75, Buggy.BUGGY_W * u, u * 0.4)
        ctx.fillRect(bx + u * 0.25, by - u * 1.05, u * 0.55, u * 0.32)
        ctx.fillStyle = theme.foreground
        var spin = s.dist * 3
        for (var wh = 0; wh < 3; ++wh) {
          var wxp = bx + u * (0.2 + wh * 0.4), wyp = by - u * 0.2
          ctx.beginPath(); ctx.arc(wxp, wyp, u * 0.2, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = theme.background; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(wxp, wyp); ctx.lineTo(wxp + Math.cos(spin + wh) * u * 0.18, wyp + Math.sin(spin + wh) * u * 0.18); ctx.stroke()
        }
      }
      ctx.fillStyle = theme.highlight
      for (var p = 0; p < s.shots.length; ++p) ctx.fillRect(sx(s.shots[p].x), ground - s.shots[p].y * u - 1.5, u * 0.5, 3)
      for (var b = 0; b < s.bits.length; ++b) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, Math.min(1, s.bits[b].life * 1.5))
        ctx.fillRect(sx(s.bits[b].x), ground - s.bits[b].y * u, 3, 3)
      }
      if (root.paused || root.over) {
        ctx.fillStyle = theme.background
        ctx.globalAlpha = root.paused ? 0.85 : 0.35
        ctx.fillRect(0, 0, width, height)
        ctx.globalAlpha = 1.0
      }
    }
  }

  Component.onCompleted: if (!state) newGame()
}
