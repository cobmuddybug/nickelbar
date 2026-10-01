import QtQuick
import "../engine" as Engine
import "logic/hexfall.js" as Hex

// Hexfall, after Hextris (see logic/hexfall.js). LEFT/RIGHT turn the
// hexagon a side at a time; match three of a colour to clear them.
Engine.GameBase {
  id: root
  gameId: "hexfall"
  title: "HEXFALL"
  helpText: "Turn the hexagon so falling blocks land where you want · LEFT/RIGHT rotate · three or more of one colour touching clear (along a side, or across neighbouring sides) · quick clears build a combo · a side stacked past the outer ring ends the game"
  mouseHelp: "Click left of the hexagon to turn it anticlockwise, right of it to turn it clockwise; the wheel turns it too"

  property var state: null
  tickInterval: 16
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "CLEARED " + state.cleared + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  N for a new game"
    : paused ? "PAUSED"
    : (state.combo > 1 ? "COMBO ×" + state.combo + "  ·  " : "") + state.cleared + " cleared"

  onTick: {
    state = Hex.step(state, tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Hex.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (!state || over || !dx) return
    state = Hex.rotate(state, dx)
  }

  function activate() { if (over) newGame() }

  function saveState() { return state && !over ? Hex.serialize(state) : null }

  function loadState(saved) {
    var r = Hex.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): click left of the hexagon to turn it
  // anticlockwise, right of it to turn it clockwise; the wheel turns it too.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "press") state = Hex.rotate(state, b === Qt.RightButton || x > board.width / 2 ? 1 : -1)
    else if (kind === "wheel") state = Hex.rotate(state, -b)
  }

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

    readonly property real k30: Math.cos(Math.PI / 6)

    // Lane angle: lane 0 points straight up, lanes go clockwise.
    function laneAngle(l) { return -Math.PI / 2 + l * Math.PI / 3 }

    // The band between apothems a1 and a2 on the side facing angle `ang`.
    function band(ctx, cx, cy, ang, a1, a2) {
      var h = Math.PI / 6, r1 = a1 / k30, r2 = a2 / k30
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang - h) * r1, cy + Math.sin(ang - h) * r1)
      ctx.lineTo(cx + Math.cos(ang + h) * r1, cy + Math.sin(ang + h) * r1)
      ctx.lineTo(cx + Math.cos(ang + h) * r2, cy + Math.sin(ang + h) * r2)
      ctx.lineTo(cx + Math.cos(ang - h) * r2, cy + Math.sin(ang - h) * r2)
      ctx.closePath()
    }

    function hexPath(ctx, cx, cy, apothem, rot) {
      var r = apothem / k30
      ctx.beginPath()
      for (var i = 0; i < 6; ++i) {
        var a = laneAngle(rot + i) - Math.PI / 6
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }
      ctx.closePath()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state
      var cx = width / 2, cy = height / 2, half = Math.min(width, height) / 2
      var A0 = half * 0.16, bh = (half * 0.98 - A0) / (Hex.MAX_ROWS + 1.2), gap = Math.max(1, bh * 0.08)

      // Limit ring: stacks mustn't pass it.
      hexPath(ctx, cx, cy, A0 + Hex.MAX_ROWS * bh + gap, s.vis)
      ctx.strokeStyle = theme.withAlpha(theme.danger, 0.35); ctx.lineWidth = 1.5; ctx.stroke()

      // Stacks, turned with the hexagon.
      for (var sd = 0; sd < Hex.SIDES; ++sd) {
        var col = s.stacks[sd], ang = laneAngle(sd + s.vis)
        for (var r = 0; r < col.length; ++r) {
          band(ctx, cx, cy, ang, A0 + r * bh + gap, A0 + (r + 1) * bh)
          ctx.fillStyle = theme.tone(col[r])
          ctx.fill()
        }
      }

      // Falling blocks, fixed to their lanes.
      for (var i = 0; i < s.falling.length; ++i) {
        var b = s.falling[i]
        band(ctx, cx, cy, laneAngle(b.lane), A0 + b.d * bh + gap, A0 + (b.d + 1) * bh)
        ctx.fillStyle = theme.tone(b.color)
        ctx.fill()
      }

      // Cleared blocks flash out.
      for (var q = 0; q < s.bursts.length; ++q) {
        var bu = s.bursts[q], life = bu.life / 0.35
        band(ctx, cx, cy, laneAngle(bu.lane), A0 + bu.row * bh + gap - (1 - life) * bh * 0.3, A0 + (bu.row + 1) * bh + (1 - life) * bh * 0.3)
        ctx.fillStyle = theme.withAlpha(theme.foreground, life * 0.8)
        ctx.fill()
      }

      // The hexagon itself.
      hexPath(ctx, cx, cy, A0, s.vis)
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.12); ctx.fill()
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = theme.foreground
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.font = "bold " + Math.floor(A0 * 0.5) + "px " + theme.fontFamily
      ctx.fillText(String(s.score), cx, cy + 1)

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
