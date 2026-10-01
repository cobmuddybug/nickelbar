import QtQuick
import "../engine" as Engine
import "logic/bounce.js" as Bounce

// Bounce, after KBounce / JezzBall (see logic/bounce.js).
Engine.GameBase {
  id: root
  gameId: "bounce"
  title: "BOUNCE"
  helpText: "Fence off the balls: build walls to trap them in ever smaller space; areas with no ball fill in · ARROWS move the cursor · SPACE build a wall · X switch horizontal / vertical · a ball touching a wall that's still growing breaks it and costs a life · fill 75% for the next level"
  mouseHelp: "The cursor follows the pointer; click builds a wall there, right-click (or the wheel) turns it"

  property var state: null
  tickInterval: 16
  ticking: !!state && state.alive && !over
  score: state ? state.score : 0
  overTitle: state ? "LEVEL " + state.level + " · " + state.score : ""
  status: !state ? ""
    : over ? "GAME OVER  ·  N for a new game"
    : paused ? "PAUSED"
    : state.clearIn > 0 ? "LEVEL " + state.level + " DONE!"
    : "LEVEL " + state.level + "  ·  " + Math.floor(Bounce.openArea(state) * 100) + "% of 75%  ·  " + state.lives + " lives  ·  "
      + (state.vertical ? "VERTICAL" : "HORIZONTAL")

  onTick: {
    state = Bounce.step(state, tickInterval / 1000)
    if (!state.alive) over = true
  }

  function newGame() { state = Bounce.makeState(); over = false; paused = false }
  function moveCursor(dx, dy) { if (state && !over) state = Bounce.moveCursor(state, dx, dy) }
  function activate() {
    if (over) { newGame(); return }
    if (state) state = Bounce.build(state)
  }
  function handleKey(key, text) {
    if (!state || over || !text || text.toLowerCase() !== "x") return false
    state = Bounce.turn(state)
    return true
  }
  function saveState() { return state && !over ? Bounce.serialize(state) : null }
  function loadState(saved) {
    var r = Bounce.deserialize(saved)
    if (r) { state = r; over = false }
    else newGame()
  }

  // Mouse (engine/Pointer.qml): the cursor follows the pointer; click builds
  // a wall there, right-click (or the wheel) turns it.
  function pointer(kind, x, y, b) {
    if (!state || over) return
    if (kind === "wheel" || (kind === "press" && b === Qt.RightButton)) { state = Bounce.turn(state); return }
    var cx = Math.floor(x / board.cell), cy = Math.floor(y / board.cell)
    if (cx !== state.cursor.x || cy !== state.cursor.y) state = Bounce.moveCursor(state, cx - state.cursor.x, cy - state.cursor.y)
    if (kind === "press" && b === Qt.LeftButton) state = Bounce.build(state)
  }

  Engine.Theme { id: theme }

  Canvas {
    id: board
    Engine.Pointer { game: root; shape: Qt.CrossCursor }
    anchors.centerIn: parent
    readonly property real cell: Math.floor(Math.min(parent.width / Bounce.W, parent.height / Bounce.H))
    width: cell * Bounce.W
    height: cell * Bounce.H

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
      var s = root.state, c = cell, W = Bounce.W
      ctx.fillStyle = s.flash > 0 ? theme.withAlpha(theme.danger, 0.12) : theme.withAlpha(theme.foreground, 0.03)
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = theme.withAlpha(theme.accent, 0.45)
      for (var i = 0; i < s.grid.length; ++i) if (s.grid[i]) ctx.fillRect((i % W) * c, Math.floor(i / W) * c, c, c)
      // Walls still growing.
      for (var a = 0; a < s.arms.length; ++a) {
        ctx.fillStyle = a === 0 ? theme.tone(3) : theme.tone(4)
        for (var k = 0; k < s.arms[a].cells.length; ++k) {
          var ci = s.arms[a].cells[k]
          ctx.fillRect((ci % W) * c + 1, Math.floor(ci / W) * c + 1, c - 2, c - 2)
        }
      }
      for (var b = 0; b < s.balls.length; ++b) {
        ctx.fillStyle = theme.foreground
        ctx.beginPath(); ctx.arc(s.balls[b].x * c, s.balls[b].y * c, Bounce.R * c, 0, Math.PI * 2); ctx.fill()
      }
      // Cursor: shows which way the wall will grow.
      if (!root.over && !s.arms.length) {
        var cx = s.cursor.x * c + c / 2, cy = s.cursor.y * c + c / 2
        ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2
        ctx.beginPath()
        if (s.vertical) { ctx.moveTo(cx, cy - c * 1.4); ctx.lineTo(cx, cy + c * 1.4) }
        else { ctx.moveTo(cx - c * 1.4, cy); ctx.lineTo(cx + c * 1.4, cy) }
        ctx.stroke()
        ctx.strokeRect(s.cursor.x * c + 1, s.cursor.y * c + 1, c - 2, c - 2)
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
