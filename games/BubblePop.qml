import QtQuick
import "../engine" as Engine
import "logic/bubbles.js" as Bubbles

// Bubble Pop, after Frozen Bubble (see logic/bubbles.js). Hold LEFT/RIGHT
// to aim, SPACE to fire; the dotted line shows the first bounce.
Engine.GameBase {
  id: root
  gameId: "bubbles"
  title: "BUBBLE POP"
  helpText: "Pop groups of three or more of one colour; whatever's left hanging falls for a bonus · LEFT/RIGHT aim (hold to sweep) · SPACE or UP fire · the ceiling drops every few shots that don't pop anything · a bubble past the bottom line ends the game"
  mouseHelp: "The launcher aims at the pointer; click fires"

  property var state: null
  tickInterval: 16
  continuousMove: true
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  N for a new game"
    : paused ? "PAUSED"
    : state.cleared ? "LEVEL " + state.level + " CLEARED!"
    : "LEVEL " + state.level + "  ·  ceiling in " + (Bubbles.shotsPerDrop(state.level) - state.shots % Bubbles.shotsPerDrop(state.level))

  onTick: {
    var dt = tickInterval / 1000
    var s = state
    if (heldDx) s = Bubbles.turn(s, heldDx * 1.5 * dt)
    state = Bubbles.step(s, dt)
    if (!state.alive) over = true
  }

  function newGame() {
    state = Bubbles.makeState()
    over = false
    paused = false
  }

  function moveCursor(dx, dy) {
    if (!state || over) return
    if (dx) state = Bubbles.turn(state, dx * 0.03)
    else if (dy < 0) state = Bubbles.fire(state)
  }

  function activate() {
    if (over) { newGame(); return }
    if (state) state = Bubbles.fire(state)
  }

  function saveState() { return state && !over ? Bubbles.serialize(state) : null }

  function loadState(saved) {
    var r = Bubbles.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the launcher aims at the pointer; click fires.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    var u = board.unit, dx = x / u - Bubbles.COLS / 2, dy = y / u - Bubbles.SHOOT_Y
    if ((kind === "move" || kind === "drag") && dy < -0.2) state = Bubbles.turn(state, Math.atan2(dy, dx) - state.aim)
    if (kind === "press" && b === Qt.LeftButton) {
      if (dy < -0.2) state = Bubbles.turn(state, Math.atan2(dy, dx) - state.aim)
      state = Bubbles.fire(state)
    }
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real side: 2.2        // room right of the field for "next"
    readonly property real unit: Math.min(parent.width / (Bubbles.COLS + side), parent.height / Bubbles.FIELD_H)
    width: unit * (Bubbles.COLS + side)
    height: unit * Bubbles.FIELD_H

    Connections {
      target: root
      function onStateChanged() { board.requestPaint() }
      function onOverChanged() { board.requestPaint() }
      function onPausedChanged() { board.requestPaint() }
    }
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()

    function bubble(ctx, x, y, r, color) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = theme.tone(color); ctx.fill()
      ctx.strokeStyle = theme.withAlpha(theme.background, 0.4); ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke()
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.45)
      ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.2, 0, Math.PI * 2); ctx.fill()
      // A mark per colour, so it's playable without telling hues apart.
      ctx.fillStyle = theme.withAlpha(theme.background, 0.45)
      var m = r * 0.28
      ctx.beginPath()
      if (color === 1) ctx.rect(x - m / 2, y - m / 2, m, m)
      else if (color === 2) { ctx.moveTo(x, y - m * 0.7); ctx.lineTo(x + m * 0.7, y + m * 0.5); ctx.lineTo(x - m * 0.7, y + m * 0.5); ctx.closePath() }
      else if (color === 3) { ctx.moveTo(x, y - m * 0.7); ctx.lineTo(x + m * 0.7, y); ctx.lineTo(x, y + m * 0.7); ctx.lineTo(x - m * 0.7, y); ctx.closePath() }
      else if (color === 4) ctx.rect(x - m * 0.8, y - m * 0.2, m * 1.6, m * 0.4)
      else if (color === 5) ctx.rect(x - m * 0.2, y - m * 0.8, m * 0.4, m * 1.6)
      else ctx.arc(x, y, m * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }

    onPaint: {
      var ctx = getContext("2d")
      ctx.clearRect(0, 0, width, height)
      if (!root.state) return
      var s = root.state, u = unit, W = Bubbles.COLS, r = u * 0.48

      // Field, lowered ceiling, and the death line.
      ctx.fillStyle = theme.withAlpha(theme.foreground, 0.03)
      ctx.fillRect(0, 0, W * u, height)
      if (s.drop > 0) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.14)
        ctx.fillRect(0, 0, W * u, s.drop * Bubbles.ROWH * u)
      }
      var dy = Bubbles.DEATH_ROW * Bubbles.ROWH * u
      ctx.strokeStyle = theme.withAlpha(theme.danger, 0.5); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, dy); ctx.lineTo(W * u, dy); ctx.stroke()
      ctx.strokeStyle = theme.dim; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, height); ctx.moveTo(W * u, 0); ctx.lineTo(W * u, height); ctx.stroke()

      for (var row = 0; row < s.grid.length; ++row)
        for (var c = 0; c < s.grid[row].length; ++c)
          if (s.grid[row][c] >= 0) bubble(ctx, Bubbles.cellX(row, c) * u, Bubbles.cellY(s, row) * u, r, s.grid[row][c])

      for (var i = 0; i < s.falling.length; ++i) bubble(ctx, s.falling[i].x * u, s.falling[i].y * u, r, s.falling[i].color)
      for (var p = 0; p < s.pops.length; ++p) {
        var pp = s.pops[p], life = pp.life / 0.25
        ctx.strokeStyle = theme.withAlpha(theme.tone(pp.color), life); ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(pp.x * u, pp.y * u, r * (1.6 - life * 0.6), 0, Math.PI * 2); ctx.stroke()
      }

      // Aim guide: dots to the first bounce and a little past it.
      var sx = W / 2, sy = Bubbles.SHOOT_Y, vx = Math.cos(s.aim), vy = Math.sin(s.aim)
      if (!s.shot && !root.over) {
        ctx.fillStyle = theme.withAlpha(theme.foreground, 0.4)
        var x = sx, y = sy, bounces = 0
        for (var k = 0; k < 40 && bounces < 2 && y > 0.5; ++k) {
          x += vx * 0.35; y += vy * 0.35
          if (x < 0.5) { x = 1 - x; vx = -vx; bounces++ }
          if (x > W - 0.5) { x = 2 * (W - 0.5) - x; vx = -vx; bounces++ }
          if (k > 1) { ctx.beginPath(); ctx.arc(x * u, y * u, Math.max(1.2, u * 0.05), 0, Math.PI * 2); ctx.fill() }
        }
      }

      // Launcher.
      ctx.strokeStyle = theme.foreground; ctx.lineWidth = Math.max(2, u * 0.12); ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(sx * u, sy * u); ctx.lineTo((sx + Math.cos(s.aim) * 1.1) * u, (sy + Math.sin(s.aim) * 1.1) * u); ctx.stroke()
      if (!s.shot && !s.cleared) bubble(ctx, sx * u, sy * u, r, s.cur)
      if (s.shot) bubble(ctx, s.shot.x * u, s.shot.y * u, r, s.shot.color)

      // Next up.
      ctx.fillStyle = theme.dim
      ctx.font = "bold " + Math.floor(u * 0.4) + "px " + theme.fontFamily
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText("NEXT", (W + side / 2) * u, (sy - 1.2) * u)
      bubble(ctx, (W + side / 2) * u, sy * u, r, s.shot ? s.cur : s.next)

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
