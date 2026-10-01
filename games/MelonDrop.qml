import QtQuick
import "../engine" as Engine
import "logic/melon.js" as Melon

// Melon Drop, after the Suika game (see logic/melon.js). Hold LEFT/RIGHT
// to slide the dropper, SPACE to let go.
Engine.GameBase {
  id: root
  gameId: "melon"
  title: "MELON DROP"
  helpText: "Drop fruit; two the same size that touch merge into the next size up · LEFT/RIGHT move (hold to slide) · SPACE drop · don't let the pile sit above the dashed line"
  mouseHelp: "The dropper follows the pointer; click drops"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "BIGGEST: SIZE " + (state.biggest + 1) + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  N for a new game"
    : paused ? "PAUSED"
    : (state.danger > 0 ? "TOO HIGH!  ·  " : "") + "biggest: size " + (state.biggest + 1) + " of " + Melon.RADII.length

  onTick: {
    var dt = tickInterval / 1000
    var s = state
    if (heldDx) s = Melon.move(s, heldDx * 0.9 * dt)
    state = Melon.step(s, dt)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Melon.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dx) state = Melon.move(state, dx * 0.02)
    else if (dy > 0) state = Melon.drop(state)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Melon.drop(state)
  }

  function saveState() { return state && !over ? Melon.serialize(state) : null }

  function loadState(saved) {
    var r = Melon.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the dropper follows the pointer; click drops.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var fx = (x - 0.02 * board.unit) / board.unit
    if (kind === "move" || kind === "drag" || kind === "press") state = Melon.move(state, fx - state.x)
    if (kind === "press" && b === Qt.LeftButton) state = Melon.drop(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root }
    anchors.centerIn: parent
    readonly property real headroom: 0.3      // room above the box for the dropper
    readonly property real unit: Math.min(parent.width / (Melon.W + 0.5), parent.height / (Melon.H + headroom))
    width: unit * (Melon.W + 0.5)
    height: unit * (Melon.H + headroom)

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function fruit(ctx, x, y, r, level) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = theme.tone(level)
      ctx.fill()
      // Bigger fruit get rings so sizes that share a colour still differ.
      ctx.strokeStyle = theme.withAlpha(theme.background, 0.35)
      ctx.lineWidth = Math.max(1, r * 0.08)
      for (var k = 0; k < Math.floor(level / 6) + 1; ++k) {
        ctx.beginPath(); ctx.arc(x, y, r * (0.72 - k * 0.22), 0, Math.PI * 2); ctx.stroke()
      }
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.35)
      ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit, ox = 0.02 * u, oy = headroom * u

      // Box and danger line.
      ctx.strokeStyle = theme.dim
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + Melon.H * u); ctx.lineTo(ox + Melon.W * u, oy + Melon.H * u); ctx.lineTo(ox + Melon.W * u, oy)
      ctx.stroke()
      ctx.strokeStyle = s.danger > 0 ? theme.danger : theme.withAlpha(theme.danger, 0.4)
      ctx.lineWidth = s.danger > 0 ? 2 : 1
      for (var dx = 0; dx < Melon.W; dx += 0.04) {
        ctx.beginPath(); ctx.moveTo(ox + dx * u, oy + Melon.LINE * u); ctx.lineTo(ox + Math.min(Melon.W, dx + 0.02) * u, oy + Melon.LINE * u); ctx.stroke()
      }

      // Dropper: the next fruit and a guide straight down.
      if (!root.over) {
        var r0 = Melon.RADII[s.next]
        ctx.strokeStyle = theme.faint; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(ox + s.x * u, oy - headroom * u * 0.5 + r0 * u); ctx.lineTo(ox + s.x * u, oy + Melon.H * u); ctx.stroke()
        ctx.globalAlpha = s.cooldown > 0 ? 0.4 : 1
        fruit(ctx, ox + s.x * u, oy - headroom * u * 0.5, r0 * u, s.next)
        ctx.globalAlpha = 1
      }

      for (var i = 0; i < s.fruits.length; ++i) {
        var f = s.fruits[i]
        fruit(ctx, ox + f.x * u, oy + f.y * u, Melon.RADII[f.level] * u, f.level)
      }
      for (var p = 0; p < s.pops.length; ++p) {
        var pp = s.pops[p], life = pp.life / 0.3
        ctx.strokeStyle = theme.withAlpha(theme.foreground, life)
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(ox + pp.x * u, oy + pp.y * u, pp.r * u * (2 - life), 0, Math.PI * 2); ctx.stroke()
      }

      // Side panel: what's after next, and the size ladder.
      var sx = ox + (Melon.W + 0.07) * u
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(u * 0.04) + "px " + theme.fontFamily
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillText("NEXT", sx, oy)
      fruit(ctx, sx + 0.08 * u, oy + 0.14 * u, Melon.RADII[s.after] * u, s.after)
      var ly = oy + 0.3 * u
      for (var lv = 0; lv < Melon.RADII.length; ++lv) {
        var rr = Math.min(Melon.RADII[lv], 0.045) * u
        ctx.globalAlpha = lv <= s.biggest ? 1 : 0.25
        fruit(ctx, sx + 0.08 * u, ly + rr, rr, lv)
        ly += rr * 2 + 0.012 * u
      }
      ctx.globalAlpha = 1

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
